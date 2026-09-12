import React, { useState } from 'react';
import { useTickets } from './TicketContext';
import { WORKFLOW_STEPS, WorkflowStep, Ticket } from './types';
import { TicketCard } from './TicketCard';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailModal from './TicketDetailModal';
import QRScannerModal from './QRScannerModal';
import ScanActionModal from './ScanActionModal';
import GenerateLotQRModal from './GenerateLotQRModal';
import ColumnScanner from './ColumnScanner';
import WorkersModal from './WorkersModal';
import DataSyncModal from './DataSyncModal';
import { Plus, QrCode, Download, Search, Printer, ArrowRight, ArrowLeft, RotateCcw, Upload, Database, ChevronDown, ChevronRight, Folder, Users, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

const ModelFolder: React.FC<{ 
  stepId: WorkflowStep;
  modelName: string; 
  tickets: Ticket[]; 
  allTickets: Ticket[];
  onTicketClick: (id: string) => void;
  onMoveLot: (lotNumber: string, currentStep: WorkflowStep, nextStep: WorkflowStep) => void;
}> = ({ 
  stepId,
  modelName, 
  tickets, 
  allTickets,
  onTicketClick,
  onMoveLot
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const { requestConfirm } = useTickets();

  // Lấy danh sách các lô có trong folder này
  const lotsInFolder = Array.from(new Set(tickets.map(t => t.lotNumber)));

  // Cấu hình chuyển bước cho lô hàng theo từng bước hiện tại
  const getLotTransitions = (currentStep: WorkflowStep) => {
    switch (currentStep) {
      case WorkflowStep.RMA_IN:
        return {
          prev: null,
          next: { step: WorkflowStep.EVALUATION, label: 'Sang 2. Đánh giá' },
          extra: null,
        };
      case WorkflowStep.EVALUATION:
        return {
          prev: { step: WorkflowStep.RMA_IN, label: 'Về 1. Nhập RMA' },
          next: { step: WorkflowStep.QUOTED, label: 'Sang 3. Đã báo giá' },
          extra: null,
        };
      case WorkflowStep.QUOTED:
        return {
          prev: { step: WorkflowStep.EVALUATION, label: 'Về 2. Đánh giá' },
          next: { step: WorkflowStep.REWORK, label: 'Sang 4. Sản xuất' },
          extra: { step: WorkflowStep.LIQUIDATION, label: 'Thanh lý Lô' },
        };
      case WorkflowStep.REWORK:
        return {
          prev: { step: WorkflowStep.QUOTED, label: 'Về 3. Đã báo giá' },
          next: null, // Tắt chuyển bước 5 thủ công, chỉ được phép scan để xác nhận hoàn thành
          extra: null,
        };
      case WorkflowStep.FINISHED:
        return {
          prev: { step: WorkflowStep.REWORK, label: 'Về 4. Sản xuất' },
          next: { step: WorkflowStep.SHIPPED, label: 'Sang 7. Đã xuất' },
          extra: null,
        };
      case WorkflowStep.LIQUIDATION:
        return {
          prev: { step: WorkflowStep.QUOTED, label: 'Về 3. Đã báo giá' },
          next: null,
          extra: null,
        };
      case WorkflowStep.SHIPPED:
        return {
          prev: { step: WorkflowStep.FINISHED, label: 'Về 5. Nhập kho' },
          next: null,
          extra: null,
        };
      default:
        return { prev: null, next: null, extra: null };
    }
  };

  const transitions = getLotTransitions(stepId);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-3">
      <div 
        className="flex items-center justify-between p-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          <Folder className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-slate-700">{modelName}</span>
        </div>
        {(() => {
          const isRmaStep = stepId === WorkflowStep.RMA_IN || stepId === WorkflowStep.EVALUATION || stepId === WorkflowStep.QUOTED;
          const countInStep = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
          const totalModelInRma = allTickets
            .filter(t => (t.productCode === modelName || t.productName === modelName) && 
              (t.status === WorkflowStep.RMA_IN || t.status === WorkflowStep.EVALUATION || t.status === WorkflowStep.QUOTED))
            .reduce((sum, t) => sum + (t.quantity || 1), 0);

          return (
            <span 
              className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold"
              title={isRmaStep && countInStep !== totalModelInRma 
                ? `Bước này: ${countInStep} máy | Tổng RMA (Bước 1+2+3): ${totalModelInRma} máy` 
                : `${countInStep} máy`}
            >
              {isRmaStep && countInStep !== totalModelInRma ? `${countInStep}/${totalModelInRma}` : countInStep}
            </span>
          );
        })()}
      </div>
      {isOpen && (
        <div className="p-2 flex flex-col space-y-2 bg-slate-50/50">
          {/* Các nút chuyển / trả bước cho từng Lô hàng */}
          {lotsInFolder.map(lotNum => {
            const lotTickets = tickets.filter(t => t.lotNumber === lotNum);
            const countInFolder = lotTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
            
            // Công thức: Số lượng Lô trong quy trình RMA = Bước 1 + Bước 2 + Bước 3
            const isRmaStep = stepId === WorkflowStep.RMA_IN || stepId === WorkflowStep.EVALUATION || stepId === WorkflowStep.QUOTED;
            const rmaLotTickets = allTickets.filter(
              t => t.lotNumber === lotNum && 
              (t.status === WorkflowStep.RMA_IN || t.status === WorkflowStep.EVALUATION || t.status === WorkflowStep.QUOTED)
            );
            const totalRmaInLot = rmaLotTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
            const totalInSystem = allTickets.filter(t => t.lotNumber === lotNum).reduce((sum, t) => sum + (t.quantity || 1), 0);
            
            const targetTotal = isRmaStep ? totalRmaInLot : totalInSystem;
            const hasActions = transitions.prev || transitions.next || transitions.extra;

            if (!hasActions) return null;

            return (
              <div 
                key={`lot-actions-${lotNum}`} 
                className="bg-white border border-slate-200 rounded-lg p-2 mb-1 shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                    <span className="truncate">Lô: <span className="font-mono text-blue-700">{lotNum}</span></span>
                  </span>
                  <span 
                    className="text-[10px] text-slate-600 font-semibold shrink-0 ml-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60"
                    title={isRmaStep 
                      ? `Số lượng bước này: ${countInFolder} máy | Tổng Lô ở RMA (Bước 1+2+3): ${targetTotal} máy` 
                      : `Số lượng bước này: ${countInFolder} máy | Tổng Lô trên toàn hệ thống: ${targetTotal} máy`}
                  >
                    {countInFolder === targetTotal ? `${countInFolder} máy` : `${countInFolder}/${targetTotal} máy`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {transitions.prev && (
                    <button
                      type="button"
                      onClick={() => {
                        requestConfirm({
                          title: 'Xác nhận trả Lô hàng về bước trước',
                          message: `Bạn có chắc chắn muốn trả lại ${countInFolder} máy thuộc Lô "${lotNum}" về bước "${transitions.prev!.label}"?`,
                          detail: `Model: ${modelName} | Số lượng trong thư mục: ${countInFolder} máy`,
                          confirmText: 'Xác nhận trả về',
                          cancelText: 'Hủy bỏ',
                          type: 'warning',
                          onConfirm: async () => {
                            onMoveLot(lotNum, stepId, transitions.prev!.step);
                          },
                        });
                      }}
                      className="flex-1 min-w-[105px] flex items-center justify-center space-x-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors shadow-xs group"
                      title={`Trả Lô ${lotNum} về ${transitions.prev.label}`}
                    >
                      <ArrowLeft className="w-3 h-3 text-amber-600 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="truncate">{transitions.prev.label}</span>
                    </button>
                  )}

                  {transitions.next && (
                    <button
                      type="button"
                      onClick={() => {
                        requestConfirm({
                          title: 'Xác nhận chuyển Lô hàng sang bước tiếp theo',
                          message: `Bạn có chắc chắn muốn chuyển ${countInFolder} máy thuộc Lô "${lotNum}" sang bước "${transitions.next!.label}"?`,
                          detail: `Model: ${modelName} | Số lượng trong thư mục: ${countInFolder} máy`,
                          confirmText: 'Xác nhận chuyển',
                          cancelText: 'Hủy bỏ',
                          type: 'primary',
                          onConfirm: async () => {
                            onMoveLot(lotNum, stepId, transitions.next!.step);
                          },
                        });
                      }}
                      className="flex-1 min-w-[105px] flex items-center justify-center space-x-1 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors shadow-xs group"
                      title={`Chuyển Lô ${lotNum} sang ${transitions.next.label}`}
                    >
                      <span className="truncate">{transitions.next.label}</span>
                      <ArrowRight className="w-3 h-3 text-blue-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}

                  {stepId === WorkflowStep.REWORK && (
                    <div 
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-1.5 bg-slate-50 border border-slate-200/80 text-slate-600 px-2 py-1.5 rounded-md text-[11px] font-medium shadow-2xs"
                      title="Chuyển bước 5 thủ công đã được tắt. Vui lòng quét mã barcode/QR của từng máy tại Cột 5 để xác nhận hoàn thành."
                    >
                      <QrCode className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">Quét mã B5 để nhập kho</span>
                    </div>
                  )}

                  {transitions.extra && (
                    <button
                      type="button"
                      onClick={() => {
                        requestConfirm({
                          title: 'Xác nhận thanh lý Lô hàng',
                          message: `Bạn có chắc chắn muốn chuyển ${countInFolder} máy thuộc Lô "${lotNum}" sang bước Thanh lý?`,
                          detail: `Model: ${modelName} | Số lượng trong thư mục: ${countInFolder} máy`,
                          confirmText: 'Thanh lý Lô',
                          cancelText: 'Hủy bỏ',
                          type: 'danger',
                          onConfirm: async () => {
                            onMoveLot(lotNum, stepId, transitions.extra!.step);
                          },
                        });
                      }}
                      className="flex-1 min-w-[90px] flex items-center justify-center space-x-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors shadow-xs group"
                      title={transitions.extra.label}
                    >
                      <span className="truncate">{transitions.extra.label}</span>
                      <ArrowRight className="w-3 h-3 text-rose-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {tickets.map((ticket, i) => (
             <TicketCard 
               key={ticket.id} 
               ticket={ticket} 
               onClick={() => onTicketClick(ticket.id)} 
               index={i}
             />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { tickets, moveLot, lots, importData } = useTickets();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGenerateLotQROpen, setIsGenerateLotQROpen] = useState(false);
  const [isWorkersOpen, setIsWorkersOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [createTicketTab, setCreateTicketTab] = useState<'single' | 'excel'>('single');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [scannedTicketId, setScannedTicketId] = useState<string | null>(null);
  const [searchLot, setSearchLot] = useState('');

  const handleScan = (scannedId: string) => {
    setIsScannerOpen(false);
    
    let foundTicket = null;

    if (scannedId.startsWith('LOT-')) {
      const parts = scannedId.split('-');
      if (parts.length >= 2) {
        const lotNumber = parts[1];
        foundTicket = tickets.find(t => t.lotNumber === lotNumber);
      }
    } else {
      let baseId = scannedId;
      if (scannedId.includes('-') && scannedId.split('-').length > 2) {
         baseId = scannedId.split('-').slice(0, 2).join('-');
      }
      foundTicket = tickets.find(t => t.id === baseId || t.id === scannedId);
    }
    
    if (foundTicket) {
      setScannedTicketId(foundTicket.id);
    } else {
      alert(`Không tìm thấy dữ liệu cho mã: ${scannedId}`);
    }
  };

  const handleExportParts = () => {
    const rows = [
      ['Tên sản phẩm', 'Mã Lô/Lot', 'Số máy (Serial)', 'Mã RMA', 'Linh kiện thay thế', 'Số lượng cần']
    ];

    tickets.forEach(ticket => {
      if (ticket.damagedParts && ticket.damagedParts.length > 0) {
        ticket.damagedParts.forEach(part => {
          rows.push([
            `"${ticket.productName}"`, 
            `"${ticket.lotNumber}"`, 
            `"${ticket.serialNumber}"`,
            `"${ticket.id}"`, 
            `"${part}"`, 
            ticket.quantity.toString()
          ]);
        });
      }
    });

    if (rows.length === 1) {
      alert("Chưa có dữ liệu linh kiện hư hỏng để xuất.");
      return;
    }

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Du_Lieu_Linh_Kien_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackup = () => {
    const data = {
      tickets,
      lots,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rma_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.tickets && data.lots) {
          if (confirm('Bạn có chắc chắn muốn khôi phục toàn bộ dữ liệu? Dữ liệu hiện tại sẽ bị thay thế.')) {
            importData(data);
            alert('Khôi phục dữ liệu thành công!');
          }
        } else {
          alert('Tệp sao lưu không hợp lệ.');
        }
      } catch (err) {
        alert('Lỗi khi đọc tệp sao lưu.');
      }
    };
    reader.readAsText(file);
    // @ts-ignore
    e.target.value = '';
  };

  const filteredTickets = tickets.filter(t => 
    searchLot.trim() === '' ? true : t.lotNumber.toLowerCase().includes(searchLot.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        {/* Row 1: Main Actions */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Tìm kiếm theo mã Lô..." 
              value={searchLot}
              onChange={(e) => setSearchLot(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportParts}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Xuất vật tư"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline whitespace-nowrap">Xuất vật tư</span>
            </button>
            
            <button 
              onClick={() => setIsGenerateLotQROpen(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Tạo QR Lô Hàng"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden lg:inline whitespace-nowrap">Tạo QR Lô</span>
            </button>

            <button 
              onClick={handleBackup}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Sao lưu toàn bộ dữ liệu"
            >
              <Database className="w-4 h-4" />
              <span className="hidden lg:inline whitespace-nowrap">Sao lưu</span>
            </button>

            <button 
              onClick={() => setIsWorkersOpen(true)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Quản lý Nhân sự & Kỹ thuật viên"
              id="btn-open-workers-modal"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline whitespace-nowrap">Nhân sự</span>
            </button>

            <button 
              onClick={() => setIsSyncModalOpen(true)}
              className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm" 
              title="Đồng bộ & Nạp file dữ liệu cũ (.json / .xlsx / .csv)"
              id="btn-open-sync-modal"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline whitespace-nowrap">Đồng bộ Dữ liệu Cũ</span>
            </button>

            <button 
              onClick={() => {
                const finishedTickets = filteredTickets.filter(t => t.status === WorkflowStep.FINISHED && t.imei);
                if (finishedTickets.length === 0) {
                  alert("Không có dữ liệu IMEI ở bước 5 để xuất.");
                  return;
                }
                
                let csvContent = "\uFEFF"; // BOM for Excel
                csvContent += "Lô hàng,Mã sản phẩm,Số máy (Serial),Mã IMEI,Ngày nhập kho\n";
                
                finishedTickets.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber)).forEach(t => {
                  const date = new Date(t.updatedAt).toLocaleDateString('vi-VN');

                  csvContent += `"${t.lotNumber}","${t.productName}","${t.serialNumber}","${t.imei}","${date}"\n`;
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `IMEI_Buoc5_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center space-x-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Xuất IMEI Bước 5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline whitespace-nowrap">Xuất IMEI (B5)</span>
            </button>

            <button 
              onClick={() => {
                setCreateTicketTab('excel');
                setIsCreateOpen(true);
              }}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Nhập hàng loạt phiếu RMA bằng tệp Excel/CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline whitespace-nowrap">Excel RMA</span>
            </button>

            <button 
              onClick={() => {
                setCreateTicketTab('single');
                setIsCreateOpen(true);
              }}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md border border-blue-500"
            >
              <Plus className="w-4 h-4" />
              <span className="whitespace-nowrap">Tạo RMA</span>
            </button>
          </div>
        </div>

        {/* Row 2: Workflow Summary Stats */}
        <div className="px-6 pb-3 flex items-center space-x-3 overflow-x-auto scrollbar-hide">
          {(() => {
            const rmaCount = filteredTickets
              .filter(t => t.status === WorkflowStep.RMA_IN || t.status === WorkflowStep.EVALUATION || t.status === WorkflowStep.QUOTED)
              .reduce((sum, t) => sum + (t.quantity || 1), 0);
            const totalCount = filteredTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);

            return (
              <>
                <div 
                  className="flex items-center bg-blue-50/80 rounded-md px-2.5 py-1.5 border border-blue-200 shrink-0 shadow-2xs"
                  title="Tồn Kho MPL = Bước 1 (Nhập RMA) + Bước 2 (Đánh giá) + Bước 3 (Đã báo giá)"
                >
                  <span className="text-[10px] text-blue-700 uppercase font-bold mr-2 tracking-wider">Tồn Kho MPL</span>
                  <span className="text-sm font-black text-blue-900 leading-none">{rmaCount}</span>
                </div>

                <div 
                  className="flex items-center bg-slate-100 rounded-md px-2.5 py-1.5 border border-slate-200 shrink-0"
                  title="Tổng toàn bộ máy trong hệ thống (gồm cả SX Rework, Nhập kho và Thanh lý)"
                >
                  <span className="text-[10px] text-slate-500 uppercase font-bold mr-2 tracking-wider">Toàn bộ</span>
                  <span className="text-sm font-bold text-slate-700 leading-none">{totalCount}</span>
                </div>
              </>
            );
          })()}
          
          <div className="h-6 w-px bg-slate-200 mx-1 shrink-0"></div>

          {WORKFLOW_STEPS.map((step) => {
            const count = filteredTickets
              .filter(t => t.status === step.id)
              .reduce((sum, t) => sum + (t.quantity || 1), 0);
            let dotColor = "bg-slate-400";
            let activeBg = "bg-white";
            
            if (step.id === WorkflowStep.RMA_IN) { dotColor = "bg-blue-500"; activeBg = "bg-blue-50/50"; }
            if (step.id === WorkflowStep.EVALUATION) { dotColor = "bg-orange-500"; activeBg = "bg-orange-50/50"; }
            if (step.id === WorkflowStep.QUOTED) { dotColor = "bg-emerald-500"; activeBg = "bg-emerald-50/50"; }
            if (step.id === WorkflowStep.REWORK) { dotColor = "bg-indigo-500"; activeBg = "bg-indigo-50/50"; }
            if (step.id === WorkflowStep.FINISHED) { dotColor = "bg-green-500"; activeBg = "bg-green-50/50"; }
            if (step.id === WorkflowStep.LIQUIDATION) { dotColor = "bg-rose-500"; activeBg = "bg-rose-50/50"; }
            if (step.id === WorkflowStep.SHIPPED) { dotColor = "bg-teal-500"; activeBg = "bg-teal-50/50"; }

            return (
              <div key={step.id} className={`flex items-center ${activeBg} border border-slate-100 rounded-md px-3 py-1.5 shadow-sm shrink-0 transition-colors`}>
                <div className={`w-2 h-2 rounded-full ${dotColor} mr-2.5`}></div>
                <span className="text-[10px] text-slate-600 font-bold mr-3 whitespace-nowrap tracking-wide">{step.label}</span>
                <span className="text-sm font-black text-slate-900 leading-none">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-slate-50">
        <div className="flex space-x-6 h-full items-start min-w-max pb-4">
          {WORKFLOW_STEPS.map((step, index) => (
            <div key={step.id} className="w-80 flex flex-col max-h-full">
              <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <h3 className="font-semibold text-slate-700 text-sm">{step.fullLabel}</h3>
                <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {filteredTickets.filter(t => t.status === step.id).reduce((sum, t) => sum + (t.quantity || 1), 0)}
                </span>
              </div>
              
              <ColumnScanner stepId={step.id} />

              <div className="flex-1 overflow-y-auto bg-slate-100/50 rounded-xl p-2.5 border border-slate-200/60 min-h-[150px]">
                <div className="flex flex-col">
                  {(() => {
                    const stepTickets = filteredTickets.filter(t => t.status === step.id);
                    if (stepTickets.length === 0) {
                      return (
                        <div className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-sm font-medium">
                          Trống
                        </div>
                      );
                    }
                    
                    const grouped = stepTickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
                      const modelName = ticket.productCode || ticket.productName || 'Khác';
                      if (!acc[modelName]) acc[modelName] = [];
                      acc[modelName].push(ticket);
                      return acc;
                    }, {});
                    
                    return Object.entries(grouped).map(([modelName, tcks]: [string, Ticket[]]) => (
                      <ModelFolder 
                        key={modelName} 
                        stepId={step.id}
                        modelName={modelName} 
                        tickets={tcks}
                        allTickets={tickets}
                        onTicketClick={(id) => setSelectedTicketId(id)}
                        onMoveLot={moveLot}
                      />
                    ));
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isCreateOpen && (
        <CreateTicketModal 
          onClose={() => setIsCreateOpen(false)} 
          initialTab={createTicketTab}
        />
      )}
      {isScannerOpen && <QRScannerModal onClose={() => setIsScannerOpen(false)} onScan={handleScan} />}
      {scannedTicketId && (
        <ScanActionModal 
          ticketId={scannedTicketId}
          onClose={() => setScannedTicketId(null)}
          onOpenDetail={() => setSelectedTicketId(scannedTicketId)}
        />
      )}
      {selectedTicketId && (
        <TicketDetailModal 
          ticketId={selectedTicketId} 
          onClose={() => setSelectedTicketId(null)} 
        />
      )}
      {isGenerateLotQROpen && (
        <GenerateLotQRModal
          onClose={() => setIsGenerateLotQROpen(false)}
        />
      )}
      <WorkersModal
        isOpen={isWorkersOpen}
        onClose={() => setIsWorkersOpen(false)}
      />
      <DataSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
}

