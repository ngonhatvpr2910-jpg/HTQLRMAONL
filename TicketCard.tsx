import React from 'react';
import { Ticket, WorkflowStep } from './types';
import { Clock, AlertCircle, CheckCircle2, Factory, FileEdit, FileText, PackageCheck } from 'lucide-react';
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
    default: return null;
  }
};

export const TicketCard: React.FC<Props> = ({ ticket, onClick, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
          {ticket.id}
        </span>
        {getStepIcon(ticket.status)}
      </div>
      
      <h4 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-blue-600 transition-colors">
        {ticket.productName}
      </h4>
      <div className="flex flex-col text-xs text-slate-500 mb-3 space-y-1">
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
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="text-slate-500">Báo giá:</span>
          <span className="font-semibold text-slate-800">
            {ticket.quotationAmount.toLocaleString()} đ
          </span>
        </div>
      )}
      
      {ticket.status === WorkflowStep.FINISHED && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-emerald-600 text-xs font-medium space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Sẵn sàng trả hàng</span>
        </div>
      )}
    </motion.div>
  );
}
