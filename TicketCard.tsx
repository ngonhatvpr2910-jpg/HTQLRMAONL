import React from 'react';
import { Ticket, WorkflowStep, WORKFLOW_STEPS } from './types';
import { useTickets } from './TicketContext';
import { Clock, AlertCircle, CheckCircle2, Factory, FileEdit, FileText, PackageCheck, ArrowLeft, ArrowRight, QrCode, Truck } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  ticket: Ticket;
  onClick: () => void;
  index: number;
}

const getStepIcon = (status: WorkflowStep) => {
  switch(status) {
    case WorkflowStep.RMA_IN: return <AlertCircle className="w-4 h-4 text-blue-500" />;
    case WorkflowStep.EVALUATION: return <FileEdit className="w-4 h-4 text-amber-500" />;
    case WorkflowStep.QUOTED: return <FileText className="w-4 h-4 text-purple-500" />;
    case WorkflowStep.REWORK: return <Factory className="w-4 h-4 text-indigo-500" />;
    case WorkflowStep.FINISHED: return <PackageCheck className="w-4 h-4 text-emerald-500" />;
    case WorkflowStep.LIQUIDATION: return <AlertCircle className="w-4 h-4 text-rose-500" />;
    case WorkflowStep.SHIPPED: return <Truck className="w-4 h-4 text-teal-600" />;
    default: return null;
  }
};

export const TicketCard: React.FC<Props> = ({ ticket, onClick, index }) => {
  const { moveTicket, requestConfirm } = useTickets();
  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.id === ticket.status);
  
  let prevStep: typeof WORKFLOW_STEPS[number] | null = null;
  let nextStep: typeof WORKFLOW_STEPS[number] | null = null;

  if (ticket.status === WorkflowStep.LIQUIDATION) {
    prevStep = WORKFLOW_STEPS.find(s => s.id === WorkflowStep.QUOTED) || null;
    nextStep = null;
  } else if (ticket.status === WorkflowStep.FINISHED) {
    prevStep = WORKFLOW_STEPS.find(s => s.id === WorkflowStep.REWORK) || null;
    nextStep = WORKFLOW_STEPS.find(s => s.id === WorkflowStep.SHIPPED) || null;
  } else if (ticket.status === WorkflowStep.SHIPPED) {
    prevStep = WORKFLOW_STEPS.find(s => s.id === WorkflowStep.FINISHED) || null;
    nextStep = null;
  } else {
    if (currentStepIndex > 0) {
      prevStep = WORKFLOW_STEPS[currentStepIndex - 1];
    }
    if (currentStepIndex >= 0 && currentStepIndex < WORKFLOW_STEPS.length - 1) {
      nextStep = WORKFLOW_STEPS[currentStepIndex + 1];
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {ticket.id}
        </span>
        {getStepIcon(ticket.status)}
      </div>
      
      <h4 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-blue-600 transition-colors">
        {ticket.productName}
      </h4>
      <div className="flex flex-col text-xs text-slate-500 mb-2.5 space-y-1">
        <div className="flex justify-between items-center">
          <div>Lô: <span className="font-mono text-slate-700">{ticket.lotNumber}</span></div>
          <div>SL: <span className="font-bold text-slate-700">{ticket.quantity}</span></div>
        </div>
        <div>Máy: <span className="font-mono text-slate-700">{ticket.serialNumber}</span></div>
      </div>
      
      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-md border border-slate-100">
        {ticket.issueDescription}
      </p>

      {ticket.status === WorkflowStep.QUOTED && ticket.quotationAmount && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="text-slate-500">Báo giá:</span>
          <span className="font-semibold text-slate-800">
            {ticket.quotationAmount.toLocaleString()} đ
          </span>
        </div>
      )}
      
      {ticket.status === WorkflowStep.FINISHED && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center text-emerald-600 text-xs font-medium space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Sẵn sàng xuất hàng</span>
        </div>
      )}

      {ticket.status === WorkflowStep.SHIPPED && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center text-teal-700 text-xs font-medium space-x-1">
          <Truck className="w-3.5 h-3.5 text-teal-600" />
          <span>Hàng đã được xuất</span>
        </div>
      )}

      {/* Quick Move Action Bar (Back / Forward) */}
      {(prevStep || nextStep) && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
          {prevStep ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                requestConfirm({
                  title: 'Xác nhận trả máy về bước trước',
                  message: `Bạn có chắc chắn muốn trả máy "${ticket.serialNumber}" về bước "${prevStep.label}"?`,
                  detail: `Model: ${ticket.productName} | Lô: ${ticket.lotNumber} | Mã phiếu: ${ticket.id}`,
                  confirmText: 'Xác nhận trả về',
                  cancelText: 'Hủy bỏ',
                  type: 'warning',
                  onConfirm: async () => {
                    await moveTicket(ticket.id, prevStep.id);
                  },
                });
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded transition-colors"
              title={`Trả về: ${prevStep.fullLabel}`}
            >
              <ArrowLeft className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Về {prevStep.label.split('.')[0]}</span>
            </button>
          ) : <div />}

          {nextStep ? (
            nextStep.id === WorkflowStep.FINISHED ? (
              <span 
                className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-1 rounded ml-auto"
                title="Tắt chuyển bước 5 thủ công. Chỉ được phép quét mã để xác nhận hoàn thành."
              >
                <QrCode className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Quét để sang B5</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  requestConfirm({
                    title: 'Xác nhận chuyển máy sang bước tiếp theo',
                    message: `Bạn có chắc chắn muốn chuyển máy "${ticket.serialNumber}" sang bước "${nextStep.label}"?`,
                    detail: `Model: ${ticket.productName} | Lô: ${ticket.lotNumber} | Mã phiếu: ${ticket.id}`,
                    confirmText: 'Xác nhận chuyển',
                    cancelText: 'Hủy bỏ',
                    type: 'primary',
                    onConfirm: async () => {
                      await moveTicket(ticket.id, nextStep.id);
                    },
                  });
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition-colors ml-auto"
                title={`Chuyển sang: ${nextStep.fullLabel}`}
              >
                <span>Sang {nextStep.label.split('.')[0]}</span>
                <ArrowRight className="w-3 h-3 text-blue-600 shrink-0" />
              </button>
            )
          ) : null}
        </div>
      )}
    </motion.div>
  );
};
