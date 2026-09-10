import React from 'react';
import { useTickets } from './TicketContext';
import { WORKFLOW_STEPS, WorkflowStep } from './types';
import { X, ArrowRight, Edit, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  ticketId: string;
  onClose: () => void;
  onOpenDetail: () => void;
}

export default function ScanActionModal({ ticketId, onClose, onOpenDetail }: Props) {
  const { tickets, moveTicket } = useTickets();
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) return null;

  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.id === ticket.status);
  const nextStep = WORKFLOW_STEPS[currentStepIndex + 1];
  const currentStepLabel = WORKFLOW_STEPS[currentStepIndex]?.label;

  const handleAdvance = () => {
    if (nextStep) {
      moveTicket(ticket.id, nextStep.id);
      onClose();
    }
  };

  const getActionText = () => {
    switch (ticket.status) {
      case WorkflowStep.RMA_IN:
        return 'Xác nhận đã đánh giá vật tư hư hỏng';
      case WorkflowStep.EVALUATION:
        return 'Xác nhận đã lên báo giá';
      case WorkflowStep.QUOTED:
        return 'Xác nhận máy đã được kéo hàng về sản xuất';
      case WorkflowStep.REWORK:
        return 'Xác nhận nhập kho';
      case WorkflowStep.FINISHED:
        return 'Sản phẩm đã hoàn thành nhập kho';
      default:
        return 'Chuyển sang bước tiếp theo';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Kết quả Quét QR</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-md text-sm border border-blue-200">
              {ticket.id}
            </span>
            <h3 className="font-bold text-slate-800">{ticket.productName}</h3>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã Lô (Lot):</span>
              <span className="font-mono font-medium text-slate-800">{ticket.lotNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Số máy (Serial):</span>
              <span className="font-mono font-medium text-slate-800">{ticket.serialNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Số lượng:</span>
              <span className="font-medium text-slate-800">{ticket.quantity}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-500">Trạng thái:</span>
              <span className="font-bold text-blue-600">{currentStepLabel}</span>
            </div>
          </div>

          <div className="space-y-3">
            {nextStep ? (
              <button 
                onClick={handleAdvance}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{getActionText()}</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-center space-x-2 bg-emerald-100 text-emerald-700 font-medium py-3 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
                <span>{getActionText()}</span>
              </div>
            )}
            
            <button 
              onClick={() => {
                onClose();
                onOpenDetail();
              }}
              className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Xem và cập nhật chi tiết</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
