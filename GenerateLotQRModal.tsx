import React, { useState, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTickets } from './TicketContext';

interface Props {
  onClose: () => void;
}

export default function GenerateLotQRModal({ onClose }: Props) {
  const { registerLot } = useTickets();
  const [formData, setFormData] = useState({
    productCode: '',
    lotNumber: '',
    quantity: 50
  });
  const [isGenerated, setIsGenerated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    
    registerLot({
      lotNumber: formData.lotNumber,
      productName: formData.productCode, // Use code as name
      productCode: formData.productCode,
      createdAt: new Date().toISOString()
    });

    setIsGenerated(true);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>In Mã QR Lô Hàng</title>
            <style>
              body { font-family: sans-serif; margin: 0; padding: 20px; }
              .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
              .card { border: 1px dashed #ccc; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-inside: avoid; }
              .title { font-weight: bold; margin-bottom: 5px; font-size: 16px; }
              .subtitle { font-size: 16px; color: #000; font-weight: bold; margin-bottom: 10px; }
              .id { font-weight: bold; margin-top: 10px; font-size: 16px; }
              @media print {
                @page { size: 72mm 22mm; margin: 0; }
                body { padding: 0; margin: 0; width: 72mm; }
                .grid { 
                  display: flex; 
                  flex-wrap: wrap;
                  width: 72mm;
                  gap: 0;
                }
                .card { 
                  width: 35mm; 
                  height: 22mm; 
                  border: none; 
                  padding: 1.5mm 1mm; 
                  margin: 0; 
                  page-break-inside: avoid;
                  box-sizing: border-box;
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  text-align: left;
                  overflow: hidden;
                }
                .qr-wrapper {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                }
                .text-wrapper {
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  min-width: 0;
                  flex-grow: 1;
                  padding-left: 1mm;
                }
                .title { 
                  font-size: 8.5pt; 
                  margin-bottom: 0.5mm; 
                  font-weight: bold;
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                  line-height: 1.1;
                }
                .subtitle { 
                  font-size: 8.5pt; 
                  margin-bottom: 0.5mm; 
                  line-height: 1.1;
                  font-weight: bold;
                  color: #000;
                }
                .id { 
                  font-size: 8.5pt; 
                  margin-top: 0.5mm; 
                  font-weight: bold;
                  line-height: 1.1;
                }
                svg { width: 14mm !important; height: 14mm !important; }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${printContent.innerHTML}
            </div>
            <script>
              window.onload = () => {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Tạo QR Lô Hàng Mới</h2>
            <p className="text-sm text-slate-500 mt-1">Nhập thông tin lô hàng để tạo hàng loạt mã QR</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {!isGenerated ? (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-md mx-auto">
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mã Sản phẩm</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                    placeholder="VD: MSV2"
                    value={formData.productCode}
                    onChange={e => setFormData({...formData, productCode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số Lô / Thời gian nhập</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                    placeholder="VD: 76623KL"
                    value={formData.lotNumber}
                    onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors mt-2"
                >
                  Tạo {formData.quantity} mã QR
                </button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: formData.quantity }).map((_, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                  <span className="font-bold text-sm text-slate-800 truncate w-full mb-1" title={formData.productCode}>{formData.productCode}</span>
                  <span className="text-xs text-slate-500 mb-3 truncate w-full" title={formData.lotNumber}>Lot: {formData.lotNumber}</span>
                  <QRCodeSVG 
                    value={`LOT|${formData.productCode}|${formData.lotNumber}|${String(idx + 1).padStart(4, '0')}`} 
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="mt-3 text-sm font-bold text-slate-800">SN-{String(idx + 1).padStart(4, '0')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actual hidden print container holding the live SVGs */}
        <div className="hidden">
           <div ref={printRef}>
             {isGenerated && Array.from({ length: formData.quantity }).map((_, idx) => (
                <div key={idx} className="card">
                  <div className="qr-wrapper">
                    <QRCodeSVG 
                      value={`LOT|${formData.productCode}|${formData.lotNumber}|${String(idx + 1).padStart(4, '0')}`} 
                      size={140}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-wrapper">
                    <div className="title">{formData.productCode}</div>
                    <div className="subtitle">Lot: {formData.lotNumber}</div>
                    <div className="id">SN-{String(idx + 1).padStart(4, '0')}</div>
                  </div>
                </div>
              ))}
           </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end bg-white rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors mr-3"
          >
            Đóng
          </button>
          {isGenerated && (
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>In {formData.quantity} mã QR</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
