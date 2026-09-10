import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket } from './types';

interface Props {
  tickets: Ticket[];
  onClose: () => void;
}

export default function PrintQRModal({ tickets, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const totalQRs = tickets.reduce((acc, ticket) => acc + (ticket.quantity || 1), 0);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const originalContents = document.body.innerHTML;
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>In Mã QR RMA</title>
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
            <h2 className="text-xl font-bold text-slate-800">Tạo / In Mã QR</h2>
            <p className="text-sm text-slate-500 mt-1">Danh sách {totalQRs} mã QR để in</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p>Không có dữ liệu để tạo mã QR.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {tickets.flatMap(ticket => 
                Array.from({ length: ticket.quantity || 1 }).map((_, idx) => (
                  <div key={`${ticket.id}-${idx}`} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <span className="font-bold text-sm text-slate-800 truncate w-full mb-1" title={ticket.productName}>{ticket.productName}</span>
                    <span className="text-xs text-slate-500 mb-3 truncate w-full" title={ticket.lotNumber}>Lot: {ticket.lotNumber}</span>
                    <QRCodeSVG 
                      value={`${ticket.id}-${String(idx + 1).padStart(4, '0')}`} 
                      size={100}
                      level="M"
                      includeMargin={false}
                    />
                    <span className="mt-3 text-sm font-bold text-slate-800">RMA-{String(idx + 1).padStart(4, '0')}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Actual hidden print container holding the live SVGs */}
        <div className="hidden">
           <div ref={printRef}>
             {tickets.flatMap(ticket => 
                Array.from({ length: ticket.quantity || 1 }).map((_, idx) => (
                <div key={`${ticket.id}-${idx}`} className="card">
                  <div className="qr-wrapper">
                    <QRCodeSVG 
                      value={`${ticket.id}-${String(idx + 1).padStart(4, '0')}`} 
                      size={140}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-wrapper">
                    <div className="title">{ticket.productCode || ticket.productName}</div>
                    <div className="subtitle">Lot: {ticket.lotNumber}</div>
                    <div className="id">RMA-{String(idx + 1).padStart(4, '0')}</div>
                  </div>
                </div>
                ))
              )}
           </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end bg-white rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors mr-3"
          >
            Đóng
          </button>
          <button 
            onClick={handlePrint}
            disabled={totalQRs === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>In {totalQRs} mã QR</span>
          </button>
        </div>
      </div>
    </div>
  );
}
