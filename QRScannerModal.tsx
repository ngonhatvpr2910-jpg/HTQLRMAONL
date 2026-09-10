import React from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onClose: () => void;
  onScan: (text: string) => void;
}

export default function QRScannerModal({ onClose, onScan }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Quét mã QR Sản phẩm</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-black w-full aspect-square flex justify-center items-center overflow-hidden">
          <Scanner
            onScan={(result) => {
              if (Array.isArray(result) && result.length > 0) {
                onScan(result[0].rawValue);
              } else if (typeof result === 'string') {
                onScan(result);
              } else if (result && (result as any).text) {
                onScan((result as any).text);
              } else if (result && (result as any).rawValue) {
                onScan((result as any).rawValue);
              }
            }}
            onError={(error) => console.error(error)}
          />
        </div>
        <div className="p-4 text-center text-sm text-slate-600 bg-white">
          Hướng camera vào mã QR trên sản phẩm để tra cứu hoặc cập nhật trạng thái quy trình.
        </div>
      </motion.div>
    </div>
  );
}
