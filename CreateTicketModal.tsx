import React, { useState, useRef } from 'react';
import { useTickets } from './TicketContext';
import { WorkflowStep, Ticket } from './types';
import { X, FileSpreadsheet, Plus, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

interface Props {
  onClose: () => void;
  initialTab?: 'single' | 'excel';
}

export default function CreateTicketModal({ onClose, initialTab = 'single' }: Props) {
  const { tickets, addTicket, batchAddTickets } = useTickets();
  const [activeTab, setActiveTab] = useState<'single' | 'excel'>(initialTab);
  
  // Single ticket form
  const [formData, setFormData] = useState({
    productCode: '',
    lotNumber: '',
    serialNumber: '',
    quantity: 1,
    issueDescription: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel state
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [excelError, setExcelError] = useState('');
  const [excelSuccess, setExcelSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productCode || !formData.lotNumber || !formData.serialNumber || formData.quantity < 1) return;
    
    // Validate unique serial number
    const exists = tickets.some(t => t.serialNumber.trim().toLowerCase() === formData.serialNumber.trim().toLowerCase());
    if (exists) {
      setError(`Số máy/Serial "${formData.serialNumber}" đã tồn tại trên hệ thống.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addTicket({
        productName: formData.productCode.trim(),
        productCode: formData.productCode.trim(),
        lotNumber: formData.lotNumber.trim(),
        serialNumber: formData.serialNumber.trim(),
        quantity: formData.quantity,
        issueDescription: formData.issueDescription.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi tạo phiếu');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tải file mẫu Excel RMA
  const handleDownloadSample = () => {
    const sample = [
      {
        'Mã sản phẩm': 'MSV2',
        'Mã Lô': '50-11-2023',
        'Số máy (Serial)': 'SN-900101',
        'Số lượng': 1,
        'Mô tả lỗi': 'Mất nguồn, không khởi động'
      },
      {
        'Mã sản phẩm': 'MSV2',
        'Mã Lô': '50-11-2023',
        'Số máy (Serial)': 'SN-900102',
        'Số lượng': 1,
        'Mô tả lỗi': 'Lỗi mạch điều khiển'
      },
      {
        'Mã sản phẩm': 'SHD-585',
        'Mã Lô': '20-12-2023',
        'Số máy (Serial)': 'SN-900103',
        'Số lượng': 1,
        'Mô tả lỗi': 'Hỏng cối xay'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_RMA');
    XLSX.writeFile(wb, 'Mau_Nhap_RMA_Sunhouse.xlsx');
  };

  // Xử lý đọc file Excel / CSV
  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelError('');
    setExcelSuccess('');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (!rawRows || rawRows.length === 0) {
        setExcelError('Tệp Excel không có dòng dữ liệu nào.');
        return;
      }

      const parsed: any[] = [];
      const existingSerials = new Set(tickets.map(t => t.serialNumber.trim().toLowerCase()));
      const batchSerials = new Set<string>();

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const productCode = String(row['Mã sản phẩm'] || row['productCode'] || row['Mã SP'] || row['Model'] || '').trim();
        const lotNumber = String(row['Mã Lô'] || row['lotNumber'] || row['Lô hàng'] || row['Lot'] || '').trim();
        const serialNumber = String(row['Số máy (Serial)'] || row['serialNumber'] || row['Số máy'] || row['Serial'] || '').trim();
        const quantity = parseInt(row['Số lượng'] || row['quantity'] || '1') || 1;
        const issueDescription = String(row['Mô tả lỗi'] || row['issueDescription'] || row['Tình trạng'] || '').trim();

        if (!productCode || !lotNumber || !serialNumber) {
          continue; // Bỏ qua dòng thiếu thông tin cơ bản
        }

        const serialKey = serialNumber.toLowerCase();
        if (existingSerials.has(serialKey) || batchSerials.has(serialKey)) {
          console.warn(`Serial trùng lặp bị bỏ qua: ${serialNumber}`);
          continue;
        }

        batchSerials.add(serialKey);
        parsed.push({
          productCode,
          lotNumber,
          serialNumber,
          quantity,
          issueDescription
        });
      }

      if (parsed.length === 0) {
        setExcelError('Không tìm thấy dữ liệu hợp lệ (hoặc tất cả số máy Serial đã tồn tại trên hệ thống).');
        return;
      }

      setExcelRows(parsed);
      setExcelSuccess(`Đã đọc ${parsed.length} dòng dữ liệu hợp lệ từ tệp Excel.`);
    } catch (err: any) {
      console.error('Lỗi đọc tệp Excel:', err);
      setExcelError(`Lỗi đọc tệp: ${err?.message || 'Định dạng tệp không tương thích'}`);
    }
  };

  // Xác nhận lưu hàng loạt lên Supabase
  const handleConfirmBatchUpload = async () => {
    if (excelRows.length === 0) return;

    setIsSubmitting(true);
    setExcelError('');

    try {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const datePrefix = `${year}${month}`;
      const baseCount = tickets.filter(t => t.id.startsWith(`RMA-${datePrefix}`)).length;

      const newTickets: Ticket[] = excelRows.map((item, index) => {
        const nextNumber = (baseCount + index + 1).toString().padStart(4, '0');
        return {
          id: `RMA-${datePrefix}-${nextNumber}`,
          productName: item.productCode,
          productCode: item.productCode,
          lotNumber: item.lotNumber,
          serialNumber: item.serialNumber,
          quantity: item.quantity,
          issueDescription: item.issueDescription,
          status: WorkflowStep.RMA_IN,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };
      });

      await batchAddTickets(newTickets);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu batch RMA:', err);
      setExcelError(`Lưu thất bại: ${err?.message || 'Lỗi kết nối'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">1. Nhập hàng lỗi (RMA IN)</h2>
              <p className="text-xs text-slate-500">Đồng bộ Realtime tức thì lên bảng tickets của Supabase</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'single'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nhập từng phiếu thủ công</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'excel'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upfile Excel / CSV (Nhiều phiếu)</span>
          </button>
        </div>

        {activeTab === 'single' ? (
          <form onSubmit={handleSubmitSingle} className="p-5 flex flex-col space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mã Sản phẩm <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder="VD: MSV2"
                value={formData.productCode}
                onChange={e => {
                  setError('');
                  setFormData({...formData, productCode: e.target.value});
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã Lô (Lot) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="VD: 50-11-2023"
                  value={formData.lotNumber}
                  onChange={e => {
                    setError('');
                    setFormData({...formData, lotNumber: e.target.value});
                  }}
                />
                <p className="text-[10px] text-slate-500 mt-1">Cấu trúc: SL - Tháng - Năm</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số máy (Serial) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="VD: SN-12345"
                  value={formData.serialNumber}
                  onChange={e => {
                    setError('');
                    setFormData({...formData, serialNumber: e.target.value});
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Số lượng <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                min="1"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                value={formData.quantity}
                onChange={e => {
                  setError('');
                  setFormData({...formData, quantity: parseInt(e.target.value) || 1});
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mô tả lỗi từ khách hàng
              </label>
              <textarea 
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                placeholder="Mô tả chi tiết tình trạng..."
                value={formData.issueDescription}
                onChange={e => setFormData({...formData, issueDescription: e.target.value})}
              />
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Đang tạo...' : 'Tạo phiếu RMA'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 flex flex-col space-y-4 max-h-[70vh] overflow-y-auto">
            {excelError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{excelError}</span>
              </div>
            )}

            {excelSuccess && (
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm border border-emerald-100 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{excelSuccess}</span>
              </div>
            )}

            {/* Khung tải file Excel */}
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 transition-colors">
              <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Chọn hoặc kéo thả tệp Excel (.xlsx, .xls, .csv)</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Hỗ trợ các cột: Mã sản phẩm, Mã Lô, Số máy (Serial), Số lượng, Mô tả lỗi</p>
              
              <div className="flex items-center justify-center space-x-3">
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file Excel mẫu</span>
                </button>

                <label className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn tệp Excel</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Xem trước bảng dữ liệu */}
            {excelRows.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Dữ liệu xem trước ({excelRows.length} phiếu)</span>
                  <span className="text-emerald-600">Sẵn sàng nhập</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 text-slate-600">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 px-3">Mã SP</th>
                        <th className="py-2 px-3">Mã Lô</th>
                        <th className="py-2 px-3">Số máy (Serial)</th>
                        <th className="py-2 px-3">SL</th>
                        <th className="py-2 px-3">Mô tả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {excelRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-bold text-blue-700">{r.productCode}</td>
                          <td className="py-1.5 px-3 text-slate-700">{r.lotNumber}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-900">{r.serialNumber}</td>
                          <td className="py-1.5 px-3 text-slate-600">{r.quantity}</td>
                          <td className="py-1.5 px-3 text-slate-500 truncate max-w-[120px]">{r.issueDescription || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {excelRows.length > 50 && (
                    <div className="p-2 text-center text-slate-400 text-xs bg-slate-50">
                      ... và {excelRows.length - 50} dòng khác
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={handleConfirmBatchUpload}
                disabled={excelRows.length === 0 || isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang đồng bộ...' : `Xác nhận nhập ${excelRows.length} phiếu lên Supabase`}</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
