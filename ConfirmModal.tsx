import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ArrowRight, ArrowLeft, X, Loader2 } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'primary' | 'warning' | 'danger';
  onConfirm: () => void | Promise<void>;
}

interface ConfirmModalProps {
  options: ConfirmDialogOptions | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ options, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!options) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await options.onConfirm();
      onClose();
    } catch (err) {
      console.error('Lỗi khi xác nhận thao tác:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getIcon = () => {
    switch (options.type) {
      case 'warning':
        return (
          <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </div>
        );
      case 'danger':
        return (
          <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <ArrowRight className="w-6 h-6" />
          </div>
        );
    }
  };

  const getButtonColor = () => {
    switch (options.type) {
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white';
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="p-6">
            <div className="flex items-start space-x-4">
              {getIcon()}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800 leading-6">
                  {options.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {options.message}
                </p>
                {options.detail && (
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
                    {options.detail}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-6 py-3.5 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {options.cancelText || 'Hủy bỏ'}
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer ${getButtonColor()}`}
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isProcessing ? 'Đang thực hiện...' : (options.confirmText || 'Xác nhận')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
