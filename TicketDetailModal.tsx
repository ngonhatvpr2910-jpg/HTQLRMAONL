import React, { useState, useEffect } from 'react';
import { useTickets } from './TicketContext';
import { WORKFLOW_STEPS, WorkflowStep, Ticket } from './types';
import { X, ArrowRight, Save, CheckCircle2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  ticketId: string;
  onClose: () => void;
}

export default function TicketDetailModal({ ticketId, onClose }: Props) {
  const { tickets, updateTicket, moveTicket, deleteTicket } = useTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  const [formData, setFormData] = useState<Partial<Ticket>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (ticket) setFormData(ticket);
  }, [ticket]);

  if (!ticket) return null;

  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.id === ticket.status);
  const nextStep = WORKFLOW_STEPS[currentStepIndex + 1];

  const handleUpdate = () => {
    updateTicket(ticket.id, formData);
  };

  const handleMove = () => {
    handleUpdate();
    if (nextStep) {
      moveTicket(ticket.id, nextStep.id);
      onClose();
    }
  };

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    deleteTicket(ticket.id);
    onClose();
  };

  const renderCurrentStepFields = () => {
    switch (ticket.status) {
      case WorkflowStep.RMA_IN:
        return (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
            <h4 className="font-semibold text-blue-800 mb-2">Chuyển sang bước Đánh giá</h4>
            <p className="text-sm text-blue-600 mb-4">Xác nhận đã nhận hàng lỗi từ phòng bảo hành và chuyển cho bộ phận kỹ thuật để đánh giá linh kiện hư hỏng.</p>
          </div>
        );
      case WorkflowStep.EVALUATION:
        return (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú đánh giá hư hỏng</label>
              <textarea 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
                value={formData.evaluationNotes || ''}
                onChange={e => setFormData({...formData, evaluationNotes: e.target.value})}
                placeholder="Mô tả chi tiết các vật tư cần thay thế..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vật tư cần thay thế (cách nhau bằng dấu phẩy)</label>
              <input 
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.damagedParts?.join(', ') || ''}
                onChange={e => setFormData({...formData, damagedParts: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                placeholder="Ví dụ: Bo mạch nguồn, Cầu chì, Quạt tản nhiệt"
              />
            </div>
          </div>
        );
      case WorkflowStep.QUOTED:
        return (
          <div className="space-y-4 mb-4">
            <p className="text-sm text-slate-500 italic">
              Bước này dùng để ghi nhận các mã đã được báo giá thành công.
            </p>
          </div>
        );
      case WorkflowStep.REWORK:
        return (
          <div className="space-y-4 mb-4">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-2">
              <p className="text-sm text-indigo-700 font-medium">Đã kéo hàng từ kho MPL về và đang tiến hành Rework.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú sản xuất (Không bắt buộc)</label>
              <textarea 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={2}
                value={formData.reworkNotes || ''}
                onChange={e => setFormData({...formData, reworkNotes: e.target.value})}
                placeholder="Ghi chú thêm trong quá trình làm..."
              />
            </div>
          </div>
        );
      case WorkflowStep.FINISHED:
        return (
          <div className="bg-emerald-50 p-6 rounded-lg border border-emerald-100 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-emerald-800">Quy trình hoàn tất</h3>
            <p className="text-sm text-emerald-600 mt-1">Sản phẩm đã được nhập lại kho xuất hàng để trả về phòng bảo hành.</p>
            {ticket.imei && (
              <div className="mt-4 pt-4 border-t border-emerald-100 w-full">
                <span className="text-[10px] text-emerald-500 uppercase font-bold block">Ghi nhận IMEI</span>
                <span className="text-sm font-mono font-bold text-emerald-700">{ticket.imei}</span>
              </div>
            )}
          </div>
        );
      case WorkflowStep.LIQUIDATION:
        return (
          <div className="bg-rose-50 p-6 rounded-lg border border-rose-100 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-12 h-12 text-rose-500 mb-3" />
            <h3 className="text-lg font-bold text-rose-800">Đã chuyển trả thanh lý</h3>
            <p className="text-sm text-rose-600 mt-1">Sản phẩm đã được phân loại và chuyển sang kho hàng thanh lý.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-md text-sm border border-blue-200">
              {ticket.id}
            </span>
            <h2 className="text-lg font-bold text-slate-800">{ticket.productName}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded-full transition-all duration-500"
                style={{ width: `${(currentStepIndex / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
              ></div>
              
              {WORKFLOW_STEPS.map((step, idx) => (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 
                    ${idx < currentStepIndex ? 'bg-blue-500 border-blue-500 text-white' : 
                      idx === currentStepIndex ? 'bg-white border-blue-500 text-blue-600' : 'bg-white border-slate-300 text-slate-400'}`}
                  >
                    {idx < currentStepIndex ? '✓' : idx + 1}
                  </div>
                  <span className={`text-[10px] mt-2 font-medium max-w-[60px] text-center ${idx <= currentStepIndex ? 'text-slate-700' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Info panel */}
            <div className="col-span-1 bg-slate-50 p-4 rounded-lg border border-slate-100 h-fit space-y-4">
              <div className="flex flex-col items-center justify-center mb-4 p-4 bg-white rounded-lg border border-slate-200">
                <QRCodeSVG value={ticket.id} size={120} level="H" />
                <span className="mt-3 text-sm font-bold text-slate-800 text-center">{ticket.productName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">Mã lô (Lot)</span>
                <span className="font-mono text-sm font-semibold text-slate-800">{ticket.lotNumber}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">Số máy (Serial)</span>
                <span className="font-mono text-sm font-semibold text-slate-800">{ticket.serialNumber}</span>
              </div>
              {ticket.imei && (
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Mã IMEI</span>
                  <span className="font-mono text-sm font-semibold text-indigo-700">{ticket.imei}</span>
                </div>
              )}
              <div className="flex justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Số lượng</span>
                  <span className="font-mono text-sm font-semibold text-slate-800">{ticket.quantity}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Ngày quét/nhập</span>
                  <span className="text-sm font-medium text-slate-800">
                    {new Date().toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block mb-1">Mô tả lỗi ban đầu</span>
                <p className="text-sm text-slate-700 bg-white p-2 border border-slate-200 rounded">{ticket.issueDescription || 'Không có mô tả'}</p>
              </div>
              
              {ticket.damagedParts && ticket.damagedParts.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 font-medium block mb-1">Linh kiện thay thế</span>
                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1">
                    {ticket.damagedParts.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Action panel */}
            <div className="col-span-2">
              <h3 className="font-bold text-slate-800 mb-4 text-lg border-b pb-2">
                {WORKFLOW_STEPS[currentStepIndex].fullLabel}
              </h3>
              
              {renderCurrentStepFields()}
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                {(ticket.status === WorkflowStep.FINISHED || ticket.status === WorkflowStep.LIQUIDATION) && (
                  <div className="mr-auto flex items-center">
                    {!isConfirmingDelete ? (
                      <button 
                        onClick={handleDeleteClick}
                        className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Xóa phiếu RMA</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2 bg-red-50 p-1.5 rounded-lg border border-red-100">
                        <span className="text-sm text-red-800 font-medium px-2">Xác nhận xóa?</span>
                        <button 
                          onClick={handleConfirmDelete}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          Có
                        </button>
                        <button 
                          onClick={() => setIsConfirmingDelete(false)}
                          className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-md transition-colors border border-slate-200"
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                <button 
                  onClick={handleUpdate}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu thông tin</span>
                </button>
                
                {nextStep && (
                  <button 
                    onClick={handleMove}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm flex items-center space-x-2"
                  >
                    <span>Chuyển: {nextStep.label}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
