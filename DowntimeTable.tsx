import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  Calendar,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  Download,
  Loader2
} from 'lucide-react';
import { DowntimeReport, DowntimeFilters, ReasonCategory } from './types';
import { PRODUCTION_LINES, REASON_CATEGORIES, REASON_COLORS } from './data';
import { formatDurationToReadable, calculateDowntimeCost, formatVND } from './timeHelpers';
import { exportDowntimeReportsToExcel, downloadDowntimeReportTemplate, parseDowntimeReportsExcel } from './excelExport';

interface DowntimeTableProps {
  reports: DowntimeReport[];
  onEdit: (report: DowntimeReport) => void;
  onDelete: (id: string) => void;
  onDeleteAll: (ids: string[]) => void;
  onAddNewClick: () => void;
  onImportReports?: (reports: DowntimeReport[]) => Promise<void>;
}

export default function DowntimeTable({ 
  reports, 
  onEdit, 
  onDelete, 
  onDeleteAll, 
  onAddNewClick,
  onImportReports 
}: DowntimeTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // 1. Quản lý trạng thái bộ lọc (Filters)
  const [filters, setFilters] = useState<DowntimeFilters>({
    startDate: '',
    endDate: '',
    line: '',
    reasonCategory: '',
    status: '',
    search: '',
  });

  // 2. Phân trang (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset bộ lọc về mặc định
  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      line: '',
      reasonCategory: '',
      status: '',
      search: '',
    });
    setCurrentPage(1);
  };

  // 3. Tiến hành lọc dữ liệu
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Lọc theo ngày bắt đầu
      if (filters.startDate && r.date < filters.startDate) return false;
      // Lọc theo ngày kết thúc
      if (filters.endDate && r.date > filters.endDate) return false;
      // Lọc theo Line sản xuất
      if (filters.line && r.line !== filters.line) return false;
      // Lọc theo Nhóm nguyên nhân
      if (filters.reasonCategory && r.reasonCategory !== filters.reasonCategory) return false;
      // Lọc theo Trạng thái
      if (filters.status && r.status !== filters.status) return false;
      // Tìm kiếm văn bản tự do (Tìm theo Thiết bị, Chi tiết lỗi, Biện pháp khắc phục, Người báo cáo)
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchEquipment = r.equipment.toLowerCase().includes(query);
        const matchDetails = r.details.toLowerCase().includes(query);
        const matchSolution = (r.solution || '').toLowerCase().includes(query);
        const matchPic = r.pic.toLowerCase().includes(query);
        if (!matchEquipment && !matchDetails && !matchSolution && !matchPic) return false;
      }
      return true;
    }).sort((a, b) => {
      // Sắp xếp theo ngày giảm dần (Mới nhất lên đầu)
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // Nếu cùng ngày, sắp xếp theo giờ bắt đầu giảm dần
      return b.startTime.localeCompare(a.startTime);
    });
  }, [reports, filters]);

  // 4. Áp dụng Phân trang trên dữ liệu đã lọc
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReports, currentPage]);

  // Điều chỉnh trang khi dữ liệu lọc thay đổi dải phân trang
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // 5. Chuẩn bị thông tin điều kiện lọc để ghi nhận trong Excel xuất ra
  const handleExportExcel = () => {
    const activeFilters: string[] = [];
    if (filters.startDate) activeFilters.push(`Từ ngày ${filters.startDate}`);
    if (filters.endDate) activeFilters.push(`Đến ngày ${filters.endDate}`);
    if (filters.line) activeFilters.push(`Line: ${filters.line}`);
    if (filters.reasonCategory) activeFilters.push(`Nhóm NN: ${filters.reasonCategory}`);
    if (filters.status) activeFilters.push(`Trạng thái: ${filters.status}`);
    if (filters.search) activeFilters.push(`Từ khóa: "${filters.search}"`);

    const filtersDescription = activeFilters.length > 0 
      ? activeFilters.join(', ') 
      : 'Tất cả dữ liệu (Không lọc)';

    exportDowntimeReportsToExcel(filteredReports, filtersDescription);
  };

  // 6. Nhập Excel danh sách sự cố dừng Line
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsedReports = await parseDowntimeReportsExcel(file);
      if (onImportReports) {
        await onImportReports(parsedReports);
      }
      alert(`Đã nhập thành công ${parsedReports.length} sự cố dừng Line lên cơ sở dữ liệu Supabase!`);
    } catch (err: any) {
      console.error('Lỗi nhập Excel dừng Line:', err);
      alert('Lỗi nhập Excel: ' + (err?.message || 'Kiểm tra lại định dạng file'));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      
      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="p-5 border-b border-gray-100 bg-gray-50/50 space-y-4">
        
        {/* Hàng 1: Tìm kiếm nhanh & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, search: e.target.value }));
                setCurrentPage(1);
              }}
              placeholder="Tìm theo thiết bị, chi tiết sự cố, PIC báo cáo..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleResetFilters}
              title="Reset bộ lọc"
              className="p-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Tải file mẫu Excel Báo Cáo */}
            <button
              onClick={downloadDowntimeReportTemplate}
              title="Tải file mẫu Excel nhập báo cáo dừng Line"
              className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              Mẫu Excel
            </button>

            {/* Nhập file Excel Báo Cáo */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
            </button>

            <button
              onClick={handleExportExcel}
              disabled={filteredReports.length === 0}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất Excel ({filteredReports.length})
            </button>

            {filteredReports.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all border border-slate-200 hover:border-red-200 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Xóa lọc ({filteredReports.length})
              </button>
            )}

            <button
              onClick={onAddNewClick}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nhập Sự Cố Mới
            </button>
          </div>
        </div>

        {/* Hàng 2: Bộ lọc nâng cao */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
          {/* Lọc Line */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Line sản xuất</label>
            <select
              value={filters.line}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, line: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="">-- Tất cả Line --</option>
              {PRODUCTION_LINES.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>

          {/* Lọc Nguyên nhân */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nhóm nguyên nhân</label>
            <select
              value={filters.reasonCategory}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, reasonCategory: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="">-- Tất cả nguyên nhân --</option>
              {REASON_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Lọc Trạng thái */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Trạng thái</label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, status: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="">-- Tất cả trạng thái --</option>
              <option value="Đang xử lý">⚠️ Đang xử lý</option>
              <option value="Đã khắc phục">✅ Đã khắc phục</option>
            </select>
          </div>

          {/* Ngày bắt đầu */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Từ ngày</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, startDate: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Ngày kết thúc */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Đến ngày</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, endDate: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>

      </div>

      {/* Bảng Dữ Liệu - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100/75 border-b border-gray-200">
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Thời Gian</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[150px]">Line sản xuất</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[150px]">Thiết bị / Công đoạn</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[180px]">Sản phẩm & Đơn giá</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[150px]">Nhóm nguyên nhân</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[100px]">Thời lượng</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[130px]">Chi phí dừng (VND)</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[140px]">Tổn thất Doanh thu</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[110px]">Trạng thái</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider">Chi tiết sự cố & Khắc phục</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[140px]">Người báo cáo</th>
              <th className="p-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider w-[90px] text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {paginatedReports.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-10 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Filter className="w-8 h-8 text-gray-300" />
                    <p className="font-semibold text-gray-600">Không tìm thấy báo cáo dừng Line nào</p>
                    <p className="text-xs text-gray-400">Hãy thử điều chỉnh lại bộ lọc hoặc nhập mới một báo cáo sự cố.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedReports.map((report) => {
                // Định dạng hiển thị ngày DD/MM
                const parts = report.date.split('-');
                const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : report.date;

                return (
                  <tr 
                    key={report.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Thời gian */}
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-900">{displayDate}</div>
                      <div className="text-xs text-gray-600 font-medium mt-0.5">{report.shift}</div>
                    </td>

                    {/* Line */}
                    <td className="p-3.5">
                      <span className="font-semibold text-gray-800">{report.line}</span>
                    </td>

                    {/* Thiết bị */}
                    <td className="p-3.5">
                      <div className="font-bold text-gray-900">{report.equipment}</div>
                    </td>

                    {/* Sản phẩm & Đơn giá */}
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-950 text-xs line-clamp-2" title={report.productName || 'Không rõ sản phẩm'}>
                        {report.productName || 'N/A'}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 font-medium">
                        ĐG: {report.productUnitPrice ? formatVND(report.productUnitPrice) : '0 ₫'}
                        {report.standardRate ? ` | ${report.standardRate} sp/h` : ''}
                      </div>
                    </td>

                    {/* Nguyên nhân */}
                    <td className="p-3.5">
                      <span 
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border"
                        style={{
                          backgroundColor: `${REASON_COLORS[report.reasonCategory as keyof typeof REASON_COLORS]}15`,
                          color: REASON_COLORS[report.reasonCategory as keyof typeof REASON_COLORS],
                          borderColor: `${REASON_COLORS[report.reasonCategory as keyof typeof REASON_COLORS]}40`
                        }}
                      >
                        {report.reasonCategory}
                      </span>
                    </td>

                    {/* Thời lượng */}
                    <td className="p-3.5">
                      {report.status === 'Đang xử lý' ? (
                        <span className="text-xs font-bold text-amber-600 italic animate-pulse">Chưa chốt</span>
                      ) : (
                        <div>
                          <div className={`font-bold ${report.duration >= 60 ? 'text-red-600' : 'text-gray-900'}`}>
                            {report.duration} phút
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium">
                            {report.startTime} - {report.endTime}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Chi phí dừng (VND) */}
                    <td className="p-3.5 font-semibold text-rose-600 text-xs">
                      {report.status === 'Đang xử lý' ? (
                        <span className="text-xs text-amber-600 italic animate-pulse font-medium">Đang tích lũy...</span>
                      ) : (
                        <span>{formatVND(calculateDowntimeCost(report.duration))}</span>
                      )}
                    </td>

                    {/* Tổn thất Doanh thu */}
                    <td className="p-3.5 font-bold text-emerald-700 text-xs">
                      {report.status === 'Đang xử lý' ? (
                        <span className="text-xs text-amber-600 italic animate-pulse font-medium">Đang tích lũy...</span>
                      ) : (
                        <span>
                          {report.productName && report.productUnitPrice && report.standardRate ? (
                            formatVND(Math.round((report.duration / 60) * report.standardRate * report.productUnitPrice))
                          ) : (
                            '0 ₫'
                          )}
                        </span>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td className="p-3.5">
                      {report.status === 'Đang xử lý' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Đang xử lý
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 shrink-0" />
                          Đã khắc phục
                        </span>
                      )}
                    </td>

                    {/* Chi tiết sự cố & khắc phục */}
                    <td className="p-3.5">
                      <div className="text-xs text-gray-800 font-medium line-clamp-2" title={report.details}>
                        <strong className="text-gray-700">Sự cố:</strong> {report.details}
                      </div>
                      {report.solution && (
                        <div className="text-xs text-gray-600 font-normal line-clamp-2 mt-1" title={report.solution}>
                          <strong className="text-emerald-700">Khắc phục:</strong> {report.solution}
                        </div>
                      )}
                    </td>

                    {/* Người báo cáo / PIC */}
                    <td className="p-3.5">
                      <div className="text-xs font-semibold text-gray-900 truncate" title={report.pic}>
                        {report.pic}
                      </div>
                    </td>

                    {/* Thao tác */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(report);
                          }}
                          title="Sửa báo cáo"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(report.id);
                          }}
                          title="Xóa báo cáo"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* View Card cho Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginatedReports.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Filter className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-600 text-sm">Không tìm thấy báo cáo nào</p>
          </div>
        ) : (
          paginatedReports.map((report) => {
            const parts = report.date.split('-');
            const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : report.date;

            return (
              <div key={report.id} className="p-4 hover:bg-gray-50 transition-colors">
                {/* Header Card: Ngày, Line, Thiết bị */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {displayDate} - {report.shift}
                      </span>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                        {report.line}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm">{report.equipment}</h4>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${report.duration >= 60 ? 'text-red-600' : 'text-gray-900'}`}>
                      {report.duration}p
                    </div>
                    <div className="text-[10px] text-gray-500">{report.startTime} - {report.endTime || '??'}</div>
                  </div>
                </div>

                {/* Body Card: Chi tiết sự cố, Người báo cáo & Thao tác */}
                <div className="space-y-2.5">
                  <div className="text-xs text-gray-800 leading-relaxed">
                    <strong className="text-gray-700">Sự cố:</strong> {report.details}
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                        {report.pic.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{report.pic}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(report)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(report.id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {report.solution && (
                    <div className="text-xs text-emerald-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                      <strong className="text-emerald-700">Khắc phục:</strong> {report.solution}
                    </div>
                  )}
                </div>

                {/* Footer Card: Sản phẩm & Trạng thái */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <div className="text-[10px] text-gray-500 font-medium truncate max-w-[150px]">
                    {report.productName || 'N/A'}
                  </div>
                  {report.status === 'Đang xử lý' ? (
                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Đang xử lý
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Đã xong
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer phân trang */}
      {filteredReports.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-600">
            Hiển thị từ <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> đến{' '}
            <span className="font-semibold">
              {Math.min(currentPage * itemsPerPage, filteredReports.length)}
            </span>{' '}
            trong tổng số <span className="font-bold text-gray-900">{filteredReports.length}</span> vụ việc dừng Line
          </p>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  currentPage === i + 1
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa báo cáo?</h3>
                <p className="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa báo cáo này? Hành động này không thể hoàn tác.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId) {
                        onDelete(confirmDeleteId);
                        setConfirmDeleteId(null);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {confirmDeleteAll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa hàng loạt?</h3>
                <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn xóa TẤT CẢ <span className="font-bold text-red-600">{filteredReports.length}</span> báo cáo đang hiển thị trong bộ lọc này không?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAll(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteAll(filteredReports.map(r => r.id));
                      setConfirmDeleteAll(false);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
