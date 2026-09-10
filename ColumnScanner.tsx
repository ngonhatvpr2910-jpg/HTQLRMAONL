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
      updateTicket(pendingTicketId, { imei: scannedId });
      moveTicket(pendingTicketId, WorkflowStep.FINISHED);
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
        WorkflowStep.LIQUIDATION
      ];

      const currentIndex = STEP_SEQUENCE.indexOf(foundTicket.status);
      const targetIndex = STEP_SEQUENCE.indexOf(stepId);

      // Block moving back to Step 1 if already at Step 2 or further
      if (stepId === WorkflowStep.RMA_IN && currentIndex >= 1) {
        alert(`Sản phẩm [${foundTicket.serialNumber}] đã qua bước Đánh giá, không thể quay lại bước Nhập RMA.`);
        setInputValue('');
        return;
      }

      if (targetIndex > currentIndex + 1) {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      processScan(inputValue.trim());
    }
  };

  const getPlaceholder = () => {
    if (pendingTicketId && stepId === WorkflowStep.FINISHED) {
      return "Quét mã IMEI máy...";
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
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
              <button 
                onClick={() => setPendingTicketId(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600 bg-slate-100 px-1 rounded"
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
