import React, { useState, useRef } from 'react';
import { useTickets } from './TicketContext';
import { WorkflowStep, WORKFLOW_STEPS, Ticket, LotInfo, Worker } from './types';
import { normalizeWorkflowStatus } from './storage';
import { 
  X, 
  Upload, 
  Database, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Layers, 
  Users, 
  Package, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedDataResult {
  tickets: Ticket[];
  lots: LotInfo[];
  workers: Worker[];
  sourceFileName: string;
  sourceType: 'json' | 'excel' | 'csv';
}

export default function DataSyncModal({ isOpen, onClose }: Props) {
  const { importData, isSupabaseOnline, refreshData } = useTickets();
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedDataResult | null>(null);
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setParsedData(null);
    setErrorMessage('');
    setStatusMessage('');
    setSyncSuccess(false);
    setSyncProgress(0);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ================= BỘ PHÂN TÍCH VÀ ĐỌC FILE DỮ LIỆU CŨ =================

  const parseJsonContent = (text: string, fileName: string): ParsedDataResult => {
    let rawObj: any;
    try {
      rawObj = JSON.parse(text);
    } catch (e) {
      throw new Error('Định dạng tệp JSON không hợp lệ, vui lòng kiểm tra lại cấu trúc cú pháp.');
    }

    const rawTickets: any[] = 
      rawObj.tickets || 
      rawObj.rma_tickets_data || 
      rawObj.data?.tickets || 
      (Array.isArray(rawObj) ? rawObj : []);

    const rawLots: any[] = 
      rawObj.lots || 
      rawObj.rma_lots_data || 
      rawObj.data?.lots || 
      [];

    const rawWorkers: any[] = 
      rawObj.workers || 
      rawObj.rma_workers_data || 
      rawObj.data?.workers || 
      [];

    const now = new Date().toISOString();

    // Map Tickets
    const parsedTickets: Ticket[] = rawTickets.map((row: any, idx: number) => {
      const id = String(row.id || row.ticket_id || row.ticketId || `RMA-OLD-${Date.now().toString().slice(-4)}-${idx + 1}`).trim();
      const productName = String(row.productName || row.product_name || row['Tên sản phẩm'] || row.model || 'Sản phẩm').trim();
      const productCode = row.productCode || row.product_code || row['Mã sản phẩm'] || productName;
      const lotNumber = String(row.lotNumber || row.lot_number || row['Mã Lô'] || row.lot || 'LÔ-01').trim();
      const serialNumber = String(row.serialNumber || row.serial_number || row['Số máy (Serial)'] || row.serial || `SN-${idx + 1}`).trim();
      const quantity = parseInt(row.quantity || row['Số lượng'] || '1') || 1;
      const issueDescription = String(row.issueDescription || row.issue_description || row['Mô tả lỗi'] || '').trim();
      const status = normalizeWorkflowStatus(row.status || row['Trạng thái'] || row['Bước']);

      return {
        id,
        productName,
        productCode,
        lotNumber,
        serialNumber,
        quantity,
        issueDescription,
        status,
        createdAt: row.createdAt || row.created_at || now,
        updatedAt: row.updatedAt || row.updated_at || now,
        imei: row.imei || row['Mã IMEI'] || undefined,
        evaluationNotes: row.evaluationNotes || row.evaluation_notes || row['Ghi chú đánh giá'] || undefined,
        damagedParts: Array.isArray(row.damagedParts || row.damaged_parts) 
          ? (row.damagedParts || row.damaged_parts)
          : (typeof (row.damagedParts || row.damaged_parts) === 'string' 
              ? (row.damagedParts || row.damaged_parts).split(',').map((s: string) => s.trim()).filter(Boolean)
              : undefined),
        quotationAmount: row.quotationAmount !== undefined ? Number(row.quotationAmount) : (row.quotation_amount !== undefined ? Number(row.quotation_amount) : undefined),
        reworkNotes: row.reworkNotes || row.rework_notes || row['Ghi chú sản xuất'] || undefined,
        returnLocation: row.returnLocation || row.return_location || row['Vị trí trả'] || undefined,
      };
    });

    // Map Lots (hoặc tự động trích xuất từ tickets)
    const lotMap = new Map<string, LotInfo>();
    rawLots.forEach((l: any) => {
      const lotNum = String(l.lotNumber || l.lot_number || l['Mã Lô'] || '').trim();
      if (lotNum) {
        lotMap.set(lotNum, {
          lotNumber: lotNum,
          productName: l.productName || l.product_name || l['Tên sản phẩm'] || '',
          productCode: l.productCode || l.product_code || l['Mã sản phẩm'] || '',
          createdAt: l.createdAt || l.created_at || now,
        });
      }
    });

    // Bổ sung các Lô xuất hiện trong danh sách tickets nếu chưa có
    parsedTickets.forEach(t => {
      if (t.lotNumber && !lotMap.has(t.lotNumber)) {
        lotMap.set(t.lotNumber, {
          lotNumber: t.lotNumber,
          productName: t.productName,
          productCode: t.productCode || t.productName,
          createdAt: t.createdAt || now,
        });
      }
    });

    // Map Workers
    const parsedWorkers: Worker[] = rawWorkers.map((w: any, idx: number) => {
      const id = String(w.id || `W-OLD-${idx + 1}`);
      const rawStatus = w.status ?? (w.active === true ? 'active' : w.active === false ? 'inactive' : 'active');
      const isActive = rawStatus === 'active' || rawStatus === 'Đang làm việc' || rawStatus === true;

      return {
        id,
        name: w.full_name || w.name || w['Họ và tên'] || `Nhân viên ${idx + 1}`,
        code: w.worker_code || w.code || w['Mã NV'] || `NV-${idx + 1}`,
        department: w.department || w['Bộ phận'] || 'Xưởng Rework NMBD',
        role: w.role || 'Kỹ thuật viên',
        phone: w.phone || '',
        email: w.email || '',
        active: isActive,
        createdAt: w.created_at || w.createdAt || now,
        updatedAt: w.updated_at || w.updatedAt || now,
      };
    });

    return {
      tickets: parsedTickets,
      lots: Array.from(lotMap.values()),
      workers: parsedWorkers,
      sourceFileName: fileName,
      sourceType: 'json',
    };
  };

  const parseExcelContent = (buffer: ArrayBuffer, fileName: string): ParsedDataResult => {
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rawRows || rawRows.length === 0) {
      throw new Error('Tệp Excel/CSV không có dữ liệu.');
    }

    const now = new Date().toISOString();
    const parsedTickets: Ticket[] = [];
    const lotMap = new Map<string, LotInfo>();

    rawRows.forEach((row, idx) => {
      const productName = String(row['Tên sản phẩm'] || row['productName'] || row['product_name'] || row['Mã sản phẩm'] || row['Model'] || row['Mã SP'] || '').trim();
      const productCode = String(row['Mã sản phẩm'] || row['productCode'] || row['product_code'] || row['Model'] || productName).trim();
      const lotNumber = String(row['Mã Lô'] || row['lotNumber'] || row['lot_number'] || row['Lô hàng'] || row['Lot'] || 'LÔ-01').trim();
      const serialNumber = String(row['Số máy (Serial)'] || row['serialNumber'] || row['serial_number'] || row['Số máy'] || row['Serial'] || `SN-${idx + 1}`).trim();
      const quantity = parseInt(row['Số lượng'] || row['quantity'] || '1') || 1;
      const issueDescription = String(row['Mô tả lỗi'] || row['issueDescription'] || row['issue_description'] || row['Tình trạng'] || '').trim();
      const rawStatus = row['Trạng thái'] || row['status'] || row['Bước'] || row['WorkflowStep'];
      const status = normalizeWorkflowStatus(rawStatus);

      const id = String(row['Mã RMA'] || row['id'] || row['ticket_id'] || `RMA-SYNC-${Date.now().toString().slice(-4)}-${idx + 1}`).trim();

      parsedTickets.push({
        id,
        productName: productName || 'Sản phẩm RMA',
        productCode: productCode || undefined,
        lotNumber,
        serialNumber,
        quantity,
        issueDescription,
        status,
        createdAt: row['Ngày tạo'] || row['createdAt'] || now,
        updatedAt: row['Ngày cập nhật'] || row['updatedAt'] || now,
        imei: row['Mã IMEI'] || row['IMEI'] || row['imei'] || undefined,
        evaluationNotes: row['Ghi chú đánh giá'] || row['evaluationNotes'] || undefined,
        damagedParts: row['Linh kiện thay thế'] 
          ? String(row['Linh kiện thay thế']).split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
        quotationAmount: row['Báo giá'] || row['quotationAmount'] ? Number(row['Báo giá'] || row['quotationAmount']) : undefined,
        reworkNotes: row['Ghi chú sản xuất'] || row['reworkNotes'] || undefined,
        returnLocation: row['Vị trí trả'] || row['returnLocation'] || undefined,
      });

      if (lotNumber && !lotMap.has(lotNumber)) {
        lotMap.set(lotNumber, {
          lotNumber,
          productName: productName || productCode || 'Sản phẩm',
          productCode: productCode || productName,
          createdAt: now,
        });
      }
    });

    return {
      tickets: parsedTickets,
      lots: Array.from(lotMap.values()),
      workers: [],
      sourceFileName: fileName,
      sourceType: fileName.endsWith('.csv') ? 'csv' : 'excel',
    };
  };

  const handleFileProcess = async (file: File) => {
    setErrorMessage('');
    setStatusMessage('Đang phân tích cấu trúc file...');
    try {
      const fileName = file.name.toLowerCase();
      let result: ParsedDataResult;

      if (fileName.endsWith('.json')) {
        const text = await file.text();
        result = parseJsonContent(text, file.name);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const buffer = await file.arrayBuffer();
        result = parseExcelContent(buffer, file.name);
      } else {
        throw new Error('Hệ thống hỗ trợ các định dạng: .json, .xlsx, .xls, .csv.');
      }

      if (result.tickets.length === 0 && result.lots.length === 0 && result.workers.length === 0) {
        throw new Error('Không tìm thấy bản ghi phiếu RMA, lô hàng hoặc nhân sự nào trong file.');
      }

      setParsedData(result);
      setStatusMessage(`Đã đọc thành công ${result.tickets.length} phiếu RMA, ${result.lots.length} lô hàng từ "${file.name}"`);
    } catch (err: any) {
      console.error('Lỗi khi đọc file đồng bộ:', err);
      setErrorMessage(err?.message || 'Không thể phân tích dữ liệu tệp tin.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // ================= THỰC HIỆN ĐỒNG BỘ LÊN SUPABASE VÀ HỆ THỐNG MỚI =================

  const handleExecuteSync = async () => {
    if (!parsedData) return;

    setIsProcessing(true);
    setErrorMessage('');
    setSyncProgress(10);
    setStatusMessage('Bắt đầu đồng bộ dữ liệu vào cơ sở dữ liệu...');

    try {
      setSyncProgress(40);
      setStatusMessage(`Đang tải lên Supabase (${parsedData.tickets.length} phiếu, ${parsedData.lots.length} lô)...`);

      const result = await importData({
        tickets: parsedData.tickets,
        lots: parsedData.lots,
        workers: parsedData.workers.length > 0 ? parsedData.workers : undefined,
        mode: syncMode,
      });

      setSyncProgress(90);
      setStatusMessage('Đang kích hoạt đồng bộ Realtime tới tất cả các thiết bị kết nối...');

      // Đồng bộ nhẹ nhàng
      await refreshData();

      setSyncProgress(100);
      setSyncSuccess(true);
      setStatusMessage(
        `✅ Đồng bộ thành công! Đã cập nhật ${result.ticketsSynced} phiếu RMA, ${result.lotsSynced} lô hàng lên hệ thống mới.`
      );
    } catch (err: any) {
      console.error('Lỗi khi thực hiện đồng bộ:', err);
      setErrorMessage(err?.message || 'Đồng bộ thất bại. Vui lòng kiểm tra kết nối mạng.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Thống kê phân bố các bước
  const getStepStats = () => {
    if (!parsedData) return [];
    return WORKFLOW_STEPS.map(step => ({
      ...step,
      count: parsedData.tickets.filter(t => t.status === step.id).length
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Đồng Bộ & Khôi Phục Dữ Liệu Cũ</h2>
              <p className="text-xs text-slate-500 font-medium">Nạp file backup (.json / .xlsx / .csv) của hệ thống cũ lên dữ liệu mới</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {/* Supabase Connection Status Banner */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
            isSupabaseOnline 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isSupabaseOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isSupabaseOnline ? 'Supabase Cloud đã kết nối. Dữ liệu sẽ đồng bộ Realtime tức thì.' : 'Đang ở chế độ Cục bộ (Offline). Dữ liệu sẽ lưu vào bộ nhớ trình duyệt.'}</span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">{isSupabaseOnline ? 'Realtime Egress Tối ưu' : 'Offline Mode'}</span>
          </div>

          {!parsedData ? (
            /* Khu vực Tải / Kéo thả File */
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50/80 scale-[0.99]' 
                  : 'border-slate-300 hover:border-blue-400 hover:bg-white bg-white/70'
              }`}
            >
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".json,.xlsx,.xls,.csv" 
                onChange={handleFileInputChange} 
                className="hidden" 
              />
              <div className="w-16 h-16 rounded-2xl bg-blue-100/70 border border-blue-200 flex items-center justify-center mb-3 text-blue-600">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Kéo thả file đồng bộ dữ liệu cũ vào đây
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-4">
                Hỗ trợ file sao lưu <span className="font-semibold text-slate-700">JSON (.json)</span> hoặc bảng tính <span className="font-semibold text-slate-700">Excel / CSV (.xlsx, .xls, .csv)</span>
              </p>
              <div className="flex items-center space-x-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 font-semibold">
                <FileText className="w-4 h-4" />
                <span>Hoặc bấm để duyệt file từ máy tính</span>
              </div>
            </div>
          ) : (
            /* Bản xem trước dữ liệu đã đọc */
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {parsedData.sourceType === 'json' ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{parsedData.sourceFileName}</h4>
                    <p className="text-xs text-slate-500">Loại file: {parsedData.sourceType.toUpperCase()}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetState}
                  className="text-xs font-semibold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                >
                  Chọn file khác
                </button>
              </div>

              {/* Data Cards Overview */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-blue-600 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-600">Phiếu RMA</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{parsedData.tickets.length}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-indigo-600 mb-1">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-600">Lô Hàng (Lots)</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{parsedData.lots.length}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-emerald-600 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-600">Nhân sự (Workers)</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{parsedData.workers.length}</div>
                </div>
              </div>

              {/* Step breakdown */}
              {parsedData.tickets.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Phân bố phiếu RMA theo các bước quy trình:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getStepStats().map((step) => (
                      <div key={step.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                        <span className="text-slate-600 truncate mr-2 font-medium">{step.label}</span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{step.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode Selection */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2">
                  <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tùy chọn đồng bộ:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label 
                    onClick={() => setSyncMode('merge')}
                    className={`p-3 rounded-xl border-2 flex items-start space-x-3 cursor-pointer transition-all ${
                      syncMode === 'merge'
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="syncMode" 
                      checked={syncMode === 'merge'} 
                      onChange={() => setSyncMode('merge')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500" 
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Gộp & Cập nhật (Khuyên dùng)</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Giữ nguyên dữ liệu hiện tại, thêm các phiếu mới và cập nhật lại các phiếu đã có trùng ID.
                      </p>
                    </div>
                  </label>

                  <label 
                    onClick={() => setSyncMode('replace')}
                    className={`p-3 rounded-xl border-2 flex items-start space-x-3 cursor-pointer transition-all ${
                      syncMode === 'replace'
                        ? 'border-red-500 bg-red-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="syncMode" 
                      checked={syncMode === 'replace'} 
                      onChange={() => setSyncMode('replace')}
                      className="mt-0.5 text-red-600 focus:ring-red-500" 
                    />
                    <div>
                      <div className="text-xs font-bold text-red-700">Ghi đè toàn bộ (Thay thế)</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Xóa và thay thế hoàn toàn dữ liệu hiện tại bằng dữ liệu từ file sao lưu cũ.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar & Status messages */}
          {isProcessing && (
            <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  {statusMessage || 'Đang đồng bộ dữ liệu...'}
                </span>
                <span>{syncProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start space-x-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lỗi xử lý: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {syncSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3 text-xs text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm mb-1 text-emerald-900">Đồng bộ hoàn tất thành công!</h4>
                <p className="text-emerald-700 leading-relaxed">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Tối ưu hóa batch chunks để bảo vệ giới hạn Egress Supabase.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {syncSuccess ? 'Đóng' : 'Hủy'}
            </button>

            {parsedData && !syncSuccess && (
              <button
                type="button"
                onClick={handleExecuteSync}
                disabled={isProcessing}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang nạp dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <span>Đồng bộ lên dữ liệu mới</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
