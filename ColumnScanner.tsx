import React, { useState } from 'react';
import { QrCode, Camera } from 'lucide-react';
import { WorkflowStep, WORKFLOW_STEPS } from './types';
import { useTickets } from './TicketContext';
import QRScannerModal from './QRScannerModal';

interface Props {
  stepId: WorkflowStep;
}

export default function ColumnScanner({ stepId }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { tickets, lots, moveTicket, addTicket, updateTicket } = useTickets();

  const processScan = (scannedId: string) => {
    // Handle IMEI scan for Step 5
    if (pendingTicketId && stepId === WorkflowStep.FINISHED) {
      updateTicket(pendingTicketId, { imei: scannedId, status: WorkflowStep.FINISHED });
      setPendingTicketId(null);
      setInputValue('');
      return;
    }

    const upperScannedId = scannedId.toUpperCase();
    let foundTicket = null;

    if (upperScannedId.startsWith('LOT-') || upperScannedId.startsWith('LOT|')) {
      // Format: LOT-LotNumber-Serial or LOT|ProductCode|LotNumber|Serial
      const delimiter = scannedId.includes('|') ? '|' : '-';
      const parts = scannedId.split(delimiter);
      
      let productCode = '';
      let lotNumber = '';
      let serialPart = '';

      if (delimiter === '|') {
        // LOT|ProductCode|LotNumber|Serial
        if (parts.length >= 4) {
          productCode = parts[1];
          lotNumber = parts[2];
          serialPart = parts[3];
        }
      } else {
        // LOT-LotNumber-Serial (Old format)
        if (parts.length >= 3) {
          lotNumber = parts[1];
          serialPart = parts[2];
        }
      }

      if (lotNumber && serialPart) {
        const fullSerial = `SN-${serialPart}`;
        
        // 1. Check if this specific item is already an RMA ticket
        foundTicket = tickets.find(t => t.lotNumber === lotNumber && t.serialNumber === fullSerial);

        // 2. If not found and scanning into RMA_IN, create it!
        if (!foundTicket && stepId === WorkflowStep.RMA_IN) {
          const lotInfo = lots.find(l => l.lotNumber === lotNumber);
          
          // Extract info from QR data if lotInfo is not found
          const finalProductName = lotInfo?.productName || productCode || lotNumber;
          const finalProductCode = lotInfo?.productCode || productCode;

          addTicket({
            productName: finalProductName,
            productCode: finalProductCode,
            lotNumber: lotNumber,
            serialNumber: fullSerial,
            quantity: 1,
            issueDescription: 'Nhập hàng lỗi từ quét mã lô hàng',
          });
          setInputValue('');
          return;
        }
      }
    } else {
      // Format: RMA-1001-0001 or RMA-1001
      let baseId = scannedId;
      if (scannedId.includes('-') && scannedId.split('-').length > 2) {
        baseId = scannedId.split('-').slice(0, 2).join('-');
      }
      foundTicket = tickets.find(t => t.id === baseId || t.id === scannedId);
    }
    
    if (foundTicket) {
      // Enforce sequential workflow
      const STEP_SEQUENCE = [
        WorkflowStep.RMA_IN,
        WorkflowStep.EVALUATION,
        WorkflowStep.QUOTED,
        WorkflowStep.REWORK,
        WorkflowStep.FINISHED,
        WorkflowStep.LIQUIDATION,
        WorkflowStep.SHIPPED,
      ];

      const currentIndex = STEP_SEQUENCE.indexOf(foundTicket.status);
      const targetIndex = STEP_SEQUENCE.indexOf(stepId);

      // If already at this step
      if (currentIndex === targetIndex) {
        alert(`Sản phẩm [${foundTicket.serialNumber}] hiện đã ở bước này.`);
        setInputValue('');
        return;
      }

      // Allow returning to previous steps (e.g., Step 2 back to Step 1, Step 3 back to Step 2, Step 7 back to Step 5, etc.)
      if (targetIndex < currentIndex) {
        moveTicket(foundTicket.id, stepId);
        setInputValue('');
        return;
      }

      // Allow skipping from QUOTED (index 2) directly to LIQUIDATION (index 5)
      const isQuotedToLiquidation = foundTicket.status === WorkflowStep.QUOTED && stepId === WorkflowStep.LIQUIDATION;
      // Allow advancing from FINISHED (index 4) directly to SHIPPED (index 6)
      const isFinishedToShipped = foundTicket.status === WorkflowStep.FINISHED && stepId === WorkflowStep.SHIPPED;
      // Allow advancing from LIQUIDATION (index 5) directly to SHIPPED (index 6)
      const isLiquidationToShipped = foundTicket.status === WorkflowStep.LIQUIDATION && stepId === WorkflowStep.SHIPPED;

      if (targetIndex > currentIndex + 1 && !isQuotedToLiquidation && !isFinishedToShipped && !isLiquidationToShipped) {
        const nextStepLabel = STEP_SEQUENCE[currentIndex + 1];
        // Find label for the missing step
        const missingStep = WORKFLOW_STEPS.find(s => s.id === STEP_SEQUENCE[currentIndex + 1]);
        alert(`Lỗi quy trình: Mã ${foundTicket.id} chưa qua bước "${missingStep?.fullLabel || nextStepLabel}". Vui lòng thực hiện theo đúng trình tự.`);
        setInputValue('');
        return;
      }

      // Special handling for Step 5: Requires IMEI after QR scan
      if (stepId === WorkflowStep.FINISHED) {
        setPendingTicketId(foundTicket.id);
        setInputValue('');
        return;
      }

      moveTicket(foundTicket.id, stepId);
    } else {
      alert(`Không tìm thấy dữ liệu cho mã: ${scannedId}. Vui lòng kiểm tra lại lô hàng.`);
    }
    setInputValue('');
  };

  const pendingTicket = pendingTicketId ? tickets.find(t => t.id === pendingTicketId) : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        processScan(inputValue.trim());
      } else if (pendingTicketId && stepId === WorkflowStep.FINISHED) {
        updateTicket(pendingTicketId, { status: WorkflowStep.FINISHED });
        setPendingTicketId(null);
      }
    }
  };

  const getPlaceholder = () => {
    if (pendingTicket && stepId === WorkflowStep.FINISHED) {
      return `Quét IMEI ${pendingTicket.serialNumber} (hoặc Enter để xong)...`;
    }
    return "Quét mã vào đây...";
  };

  return (
    <div className="mb-2 px-1">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <QrCode className={`h-4 w-4 ${pendingTicketId ? 'text-blue-500' : 'text-slate-400'}`} />
          </div>
          <input
            type="text"
            placeholder={getPlaceholder()}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full pl-8 pr-3 py-1.5 bg-white border ${pendingTicketId ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow shadow-sm`}
          />
          {pendingTicketId && (
            <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center space-x-1">
              <button 
                type="button"
                onClick={() => {
                  updateTicket(pendingTicketId, { status: WorkflowStep.FINISHED });
                  setPendingTicketId(null);
                  setInputValue('');
                }}
                className="text-[10px] text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-1.5 py-0.5 rounded font-bold transition-colors"
                title="Xác nhận hoàn thành nhập kho (không cần IMEI)"
              >
                Xác nhận
              </button>
              <button 
                type="button"
                onClick={() => {
                  setPendingTicketId(null);
                  setInputValue('');
                }}
                className="text-[10px] text-slate-400 hover:text-slate-600 bg-slate-100 px-1 py-0.5 rounded"
                title="Hủy thao tác"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCameraOpen(true)}
          className="p-1.5 bg-slate-100 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors shadow-sm"
          title="Mở camera quét QR"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {isCameraOpen && (
        <QRScannerModal 
          onClose={() => setIsCameraOpen(false)}
          onScan={(text) => {
            setIsCameraOpen(false);
            processScan(text);
          }}
        />
      )}
    </div>
  );
}
