import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Download, 
  Plus, 
  HelpCircle,
  Database
} from 'lucide-react';
import { Product } from './data';

interface ProductConfigProps {
  products: Product[];
  onUpdateProducts: (newProducts: Product[]) => void;
  onResetProducts: () => void;
}

export default function ProductConfig({ products, onUpdateProducts, onResetProducts }: ProductConfigProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Product[] | null>(null);
  const [errorsList, setErrorsList] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thêm thủ công sản phẩm
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Tải file mẫu Excel
  const handleDownloadTemplate = () => {
    const data = [
      {
        'Tên Sản Phẩm': 'Máy lọc nước RO Sunhouse 9 lõi SHA8858K',
        'Dây Chuyền': 'Dây chuyền LR RO',
        'Đơn Giá (VNĐ)': 4500000,
        'Năng Suất Định Mức (SP/Giờ)': 60
      },
      {
        'Tên Sản Phẩm': 'Máy lọc nước RO Sunhouse 10 lõi SHA88116K',
        'Dây Chuyền': 'Dây chuyền LR RO',
        'Đơn Giá (VNĐ)': 5200000,
        'Năng Suất Định Mức (SP/Giờ)': 48
      },
      {
        'Tên Sản Phẩm': 'Bếp gas đôi Sunhouse SHB3365',
        'Dây Chuyền': 'Dây chuyền Bếp Gas',
        'Đơn Giá (VNĐ)': 1200000,
        'Năng Suất Định Mức (SP/Giờ)': 120
      },
      {
        'Tên Sản Phẩm': 'Bếp gas âm cao cấp SHB5536',
        'Dây Chuyền': 'Dây chuyền Bếp Gas',
        'Đơn Giá (VNĐ)': 2800000,
        'Năng Suất Định Mức (SP/Giờ)': 60
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sach san pham');
    
    // Cài đặt độ rộng cột tự động
    worksheet['!cols'] = [
      { wch: 45 }, // Tên Sản Phẩm
      { wch: 25 }, // Dây Chuyền
      { wch: 18 }, // Đơn Giá (VNĐ)
      { wch: 30 }  // Năng Suất Định Mức
    ];

    XLSX.writeFile(workbook, 'Sunhouse_Product_Prices_Template.xlsx');
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseExcelFile(e.target.files[0]);
    }
  };

  // Đọc file Excel
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (rawJson.length === 0) {
          alert('File Excel trống rỗng, vui lòng nhập dữ liệu sản phẩm!');
          return;
        }

        const parsedProducts: Product[] = [];
        const errors: string[] = [];

        rawJson.forEach((row: any, idx) => {
          let name = '';
          let lineRaw = '';
          let unitPrice = 0;
          let standardRate = 0;

          // Mapping cột động (không phân biệt chữ hoa, chữ thường hay dấu tiếng Việt)
          Object.entries(row).forEach(([key, val]) => {
            const cleanKey = key.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // loại bỏ dấu
              .replace(/đ/g, "d")
              .trim();

            if (cleanKey.includes('ten') || cleanKey.includes('product') || cleanKey.includes('san pham') || cleanKey === 'name') {
              name = String(val).trim();
            } else if (cleanKey.includes('chuyen') || cleanKey.includes('line') || cleanKey.includes('day chuyen')) {
              lineRaw = String(val).trim();
            } else if (cleanKey.includes('gia') || cleanKey.includes('price') || cleanKey.includes('don gia') || cleanKey === 'unitprice') {
              unitPrice = Number(val) || 0;
            } else if (cleanKey.includes('nang suat') || cleanKey.includes('rate') || cleanKey.includes('dinh muc') || cleanKey.includes('standard')) {
              standardRate = Number(val) || 0;
            }
          });

          // Chuẩn hóa Dây chuyền
          let line: 'Dây chuyền LR RO' | 'Dây chuyền Bếp Gas' | '' = '';
          const lowerLine = lineRaw.toLowerCase();
          if (lowerLine.includes('ro') || lowerLine.includes('lr') || lowerLine.includes('loc nuoc')) {
            line = 'Dây chuyền LR RO';
          } else if (lowerLine.includes('bep') || lowerLine.includes('gas')) {
            line = 'Dây chuyền Bếp Gas';
          }

          // Xác thực dữ liệu
          const rowNum = idx + 2; // file excel bắt đầu từ hàng 2
          if (!name) {
            errors.push(`Hàng ${rowNum}: Tên sản phẩm đang trống.`);
            return;
          }
          if (!line) {
            errors.push(`Hàng ${rowNum}: Dây chuyền không hợp lệ ("${lineRaw}"). Vui lòng ghi "Dây chuyền LR RO" hoặc "Dây chuyền Bếp Gas".`);
            return;
          }
          if (unitPrice <= 0) {
            errors.push(`Hàng ${rowNum}: Đơn giá sản phẩm (${unitPrice} VNĐ) phải lớn hơn 0.`);
            return;
          }
          if (standardRate <= 0) {
            errors.push(`Hàng ${rowNum}: Năng suất định mức (${standardRate} SP/Giờ) phải lớn hơn 0.`);
            return;
          }

          parsedProducts.push({
            name,
            line,
            unitPrice,
            standardRate
          });
        });

        setPreviewProducts(parsedProducts);
        setErrorsList(errors);
        setSuccessMessage(null);
      } catch (err) {
        console.error(err);
        alert('Lỗi phân tích tệp Excel. Vui lòng sử dụng tệp mẫu Excel được tải từ hệ thống!');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Xác nhận lưu sản phẩm đã import
  const handleApplyImport = () => {
    if (!previewProducts || previewProducts.length === 0) return;
    onUpdateProducts(previewProducts);
    setSuccessMessage(`Đã cập nhật thành công ${previewProducts.length} sản phẩm và bảng giá từ file Excel!`);
    setPreviewProducts(null);
    setErrorsList([]);
    
    // Tự động tắt thông báo sau 4 giây
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Hủy import nháp
  const handleCancelImport = () => {
    setPreviewProducts(null);
    setErrorsList([]);
  };

  // Xóa 1 sản phẩm khỏi danh sách hiện tại
  const handleDeleteProduct = (name: string) => {
    if (confirm(`Bạn có chắc muốn xóa sản phẩm "${name}" khỏi hệ thống?`)) {
      onUpdateProducts(products.filter(p => p.name !== name));
    }
  };

  // Thêm sản phẩm thủ công từ form nhanh
  const handleAddProductManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return alert('Vui lòng nhập tên sản phẩm!');
    if (!newProdPrice || Number(newProdPrice) <= 0) return alert('Đơn giá phải lớn hơn 0!');

    // Check trùng tên sản phẩm
    if (products.some(p => p.name.toLowerCase() === newProdName.trim().toLowerCase())) {
      return alert('Sản phẩm này đã tồn tại trong hệ thống!');
    }

    const newProd: Product = {
      name: newProdName.trim(),
      line: 'Dây chuyền LR RO', // Mặc định dây chuyền
      unitPrice: Number(newProdPrice),
      standardRate: 60 // Mặc định năng suất định mức tiêu chuẩn
    };

    onUpdateProducts([...products, newProd]);
    setNewProdName('');
    setNewProdPrice('');
    setShowAddForm(false);
    setSuccessMessage(`Đã thêm mới sản phẩm "${newProd.name}" thành công!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* KHU VỰC TOOLBAR TIÊU ĐỀ & KHÔI PHỤC MẶC ĐỊNH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
              Danh mục Sản phẩm & Giá bán
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý danh sách sản phẩm đang sản xuất và đơn giá bán để tính toán tổn thất doanh thu khi dừng Line.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              if (confirm('Bạn có chắc chắn muốn khôi phục danh mục sản phẩm gốc của nhà máy Sunhouse không? Mọi dữ liệu vừa chỉnh sửa sẽ bị ghi đè.')) {
                onResetProducts();
                setSuccessMessage('Đã khôi phục danh mục sản phẩm mặc định!');
                setTimeout(() => setSuccessMessage(null), 4000);
              }
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Khôi phục mặc định
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* FORM THÊM SẢN PHẨM THỦ CÔNG */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddProductManual} className="bg-slate-50 p-5 rounded-xl border border-gray-250 border-dashed space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nhập thông tin sản phẩm mới
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Tên sản phẩm</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="e.g., Máy lọc nước Sunhouse SHA..."
                    className="w-full p-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Đơn giá bán (VNĐ)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g., 5000000"
                    className="w-full p-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 font-semibold text-gray-500 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Lưu sản phẩm
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THÔNG BÁO THÀNH CÔNG */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {/* PHẦN IMPORT BẰNG EXCEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hộp Drag & Drop Import Excel */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex-1 min-h-[180px] p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all relative ${
              isDragActive 
                ? 'border-red-500 bg-red-50/50 scale-98' 
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? 'text-red-500' : 'text-gray-400'}`} />
            
            <p className="text-xs font-bold text-gray-800">
              Kéo & thả tệp Excel vào đây
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              hoặc click để chọn từ máy tính
            </p>
            
            <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded-full border border-red-100">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Chấp nhận: .xlsx, .xls, .csv
            </span>
          </div>

          {/* Nút tải file mẫu */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-600 leading-relaxed">
                <p className="font-bold text-gray-800 mb-1">Hướng dẫn cập nhật giá bằng Excel:</p>
                <p>1. Tải về file mẫu Excel chuẩn để có định dạng tương thích.</p>
                <p>2. Chỉnh sửa tên, dây chuyền, đơn giá bán (VNĐ) và năng suất định mức.</p>
                <p>3. Kéo thả file Excel vào khung trên để kiểm tra dữ liệu và lưu lại.</p>
              </div>
            </div>
            
            <button
              onClick={handleDownloadTemplate}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Tải File Excel Mẫu
            </button>
          </div>

        </div>

        {/* BẢNG HIỂN THỊ DANH SÁCH SẢN PHẨM HIỆN TẠI HOẶC TRÌNH PREVIEW IMPORT */}
        <div className="lg:col-span-8">
          
          <AnimatePresence mode="wait">
            {previewProducts ? (
              /* PANEL PREVIEW DỮ LIỆU EXCEL NHÁP */
              <motion.div
                key="preview-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-xl border border-yellow-300 shadow-md overflow-hidden flex flex-col h-[350px]"
              >
                {/* Header Preview */}
                <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Xem trước dữ liệu cập nhật từ Excel ({previewProducts.length} sản phẩm)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelImport}
                      className="px-3 py-1 text-[11px] font-bold text-gray-600 bg-white hover:bg-gray-100 border border-gray-300 rounded-md cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleApplyImport}
                      className="px-3 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md cursor-pointer"
                    >
                      Áp dụng & Lưu lại
                    </button>
                  </div>
                </div>

                {/* Danh sách cảnh báo/lỗi định dạng nếu có */}
                {errorsList.length > 0 && (
                  <div className="bg-red-50 border-b border-red-150 p-3 max-h-[100px] overflow-y-auto text-[11px] text-red-700 space-y-1 flex-shrink-0">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Phát hiện {errorsList.length} lỗi trong file Excel (Các dòng lỗi sẽ bị bỏ qua):
                    </p>
                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                      {errorsList.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}

                {/* Bảng dữ liệu preview nháp */}
                <div className="flex-1 overflow-auto p-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                        <th className="py-2.5 px-3">Tên sản phẩm</th>
                        <th className="py-2.5 px-3">Dây chuyền</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá (VNĐ)</th>
                        <th className="py-2.5 px-3 text-right">Định mức (SP/H)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {previewProducts.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-gray-800 max-w-[250px] truncate" title={p.name}>
                            {p.name}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              p.line === 'Dây chuyền LR RO' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : 'bg-orange-50 text-orange-700 border border-orange-100'
                            }`}>
                              {p.line}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-900">
                            {p.unitPrice.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-500">
                            {p.standardRate} SP/H
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : (
              /* DANH SÁCH SẢN PHẨM HIỆN TẠI */
              <motion.div
                key="current-list-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[350px]"
              >
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Danh sách sản phẩm hiện hành ({products.length} mã hàng)
                  </span>
                </div>

                <div className="flex-1 overflow-auto p-2">
                  {products.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                      <FileSpreadsheet className="w-12 h-12 mb-2 text-gray-300" />
                      <p className="text-xs">Không có sản phẩm nào trong hệ thống.</p>
                      <p className="text-[10px] mt-1">Vui lòng tải tệp Excel lên hoặc thêm mới sản phẩm thủ công.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                          <th className="py-2.5 px-3">Tên sản phẩm</th>
                          <th className="py-2.5 px-3">Dây chuyền</th>
                          <th className="py-2.5 px-3 text-right">Đơn giá bán (VNĐ)</th>
                          <th className="py-2.5 px-3 text-right">Định mức (SP/H)</th>
                          <th className="py-2.5 px-3 text-center">Tác vụ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {products.map((p) => (
                          <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-medium text-gray-800 max-w-[280px] truncate" title={p.name}>
                              {p.name}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                p.line === 'Dây chuyền LR RO' 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                  : 'bg-orange-50 text-orange-700 border border-orange-100'
                              }`}>
                                {p.line}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                              {p.unitPrice.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-gray-500">
                              {p.standardRate} SP/H
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleDeleteProduct(p.name)}
                                title="Xóa sản phẩm"
                                className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

    </div>
  );
}
