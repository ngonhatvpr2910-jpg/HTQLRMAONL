import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Phone, 
  Briefcase, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RotateCcw,
  Loader2,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  Download,
  UploadCloud
} from 'lucide-react';
import { Worker } from './types';
import { PRODUCTION_LINES } from './data';
import { downloadWorkerTemplate, parseWorkersExcel } from './excelExport';

interface WorkerManagementProps {
  workers: Worker[];
  onAddWorker: (workerData: Omit<Worker, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
  onUpdateWorker: (id: string, updatedData: Partial<Worker>) => Promise<void>;
  onDeleteWorker: (id: string) => Promise<void>;
  onResetWorkers: () => Promise<void>;
  onImportWorkers?: (workers: Worker[]) => Promise<void>;
  isSyncing?: boolean;
}

export default function WorkerManagement({
  workers,
  onAddWorker,
  onUpdateWorker,
  onDeleteWorker,
  onResetWorkers,
  onImportWorkers,
  isSyncing = false,
}: WorkerManagementProps) {
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  // Trạng thái tìm kiếm & lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Trạng thái Modal Thêm / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Trạng thái Toast thông báo
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDepartment, setFormDepartment] = useState('Dây chuyền LR RO');
  const [formRole, setFormRole] = useState('Kỹ thuật viên');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<'Đang làm việc' | 'Nghỉ phép' | 'Đã nghỉ'>('Đang làm việc');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Mở modal Thêm mới
  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setFormName('');
    setFormCode(`SH-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormDepartment('Dây chuyền LR RO');
    setFormRole('Kỹ thuật viên');
    setFormPhone('');
    setFormStatus('Đang làm việc');
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Mở modal Chỉnh sửa
  const handleOpenEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    setFormName(worker.full_name || worker.name || '');
    setFormCode(worker.worker_code || worker.code || '');
    setFormDepartment(worker.department || 'Dây chuyền LR RO');
    setFormRole(worker.role || 'Kỹ thuật viên');
    setFormPhone(worker.phone || '');
    setFormStatus((worker.status as any) || 'Đang làm việc');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingWorker(null);
  };

  // Validate form
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formName.trim()) {
      errs.name = 'Họ và tên nhân sự không được để trống';
    }
    if (!formDepartment.trim()) {
      errs.department = 'Vui lòng chọn hoặc nhập bộ phận';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Xử lý Submit Form (Thêm hoặc Sửa)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingWorker) {
        // 2. SỬA / CẬP NHẬT (UPDATE): Gọi update lên Supabase
        await onUpdateWorker(editingWorker.id, {
          worker_code: formCode.trim(),
          full_name: formName.trim(),
          name: formName.trim(),
          code: formCode.trim(),
          department: formDepartment.trim(),
          role: formRole.trim(),
          phone: formPhone.trim(),
          status: formStatus,
        });
        showToast('success', `Đã cập nhật thông tin nhân sự "${formName}" thành công!`);
      } else {
        // 3. THÊM MỚI (INSERT): Gọi insert lên Supabase
        await onAddWorker({
          worker_code: formCode.trim(),
          full_name: formName.trim(),
          name: formName.trim(),
          code: formCode.trim(),
          department: formDepartment.trim(),
          role: formRole.trim(),
          phone: formPhone.trim(),
          status: formStatus,
        });
        showToast('success', `Đã thêm nhân sự "${formName}" vào hệ thống thành công!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Lỗi khi lưu nhân sự:', err);
      showToast('error', `Thao tác thất bại: ${err.message || 'Lỗi kết nối cơ sở dữ liệu'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. XÓA (DELETE): Khi bấm biểu tượng thùng rác
  const handleDelete = async (worker: Worker) => {
    const workerName = worker.full_name || worker.name;
    const workerCode = worker.worker_code || worker.code || 'N/A';
    const confirmed = window.confirm(
      `Xác nhận xóa nhân sự:\n- Họ tên: ${workerName}\n- Mã: ${workerCode}\n\nHành động này sẽ xóa trực tiếp trên Supabase và không thể hoàn tác.`
    );
    if (!confirmed) return;

    setDeletingId(worker.id);
    try {
      await onDeleteWorker(worker.id);
      showToast('success', `Đã xóa nhân sự "${workerName}" khỏi cơ sở dữ liệu Supabase!`);
    } catch (err: any) {
      console.error('Lỗi khi xóa nhân sự:', err);
      showToast('error', `Không thể xóa nhân sự: ${err.message || 'Lỗi kết nối Supabase'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // 2. NHẬP EXCEL (IMPORT EXCEL): Đọc file và gọi lưu hàng loạt lên Supabase
  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingExcel(true);
    try {
      const imported = await parseWorkersExcel(file);
      if (onImportWorkers) {
        await onImportWorkers(imported);
      } else {
        // Fallback: Thêm từng nhân viên
        for (const w of imported) {
          await onAddWorker(w);
        }
      }
      showToast('success', `Đã nhập thành công ${imported.length} nhân sự lên cơ sở dữ liệu Supabase!`);
    } catch (err: any) {
      console.error('Lỗi nhập Excel nhân sự:', err);
      showToast('error', `Lỗi nhập Excel: ${err.message || 'Kiểm tra lại cấu trúc file'}`);
    } finally {
      setIsImportingExcel(false);
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
    }
  };

  // Lọc dữ liệu hiển thị
  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const name = (worker.full_name || worker.name || '').toLowerCase();
      const code = (worker.worker_code || worker.code || '').toLowerCase();
      const phone = worker.phone || '';
      const role = (worker.role || '').toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchSearch = 
        name.includes(query) ||
        code.includes(query) ||
        phone.includes(query) ||
        role.includes(query);

      const matchDept = selectedDept === 'all' || worker.department === selectedDept;
      const matchStatus = selectedStatus === 'all' || worker.status === selectedStatus;

      return matchSearch && matchDept && matchStatus;
    });
  }, [workers, searchQuery, selectedDept, selectedStatus]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = workers.length;
    const active = workers.filter((w) => w.status === 'Đang làm việc').length;
    const onLeave = workers.filter((w) => w.status === 'Nghỉ phép').length;
    return { total, active, onLeave };
  }, [workers]);

  return (
    <div className="space-y-6">
      {/* Toast thông báo nổi */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium border ${
              toastMessage.type === 'success' 
                ? 'bg-emerald-600 border-emerald-500 shadow-emerald-500/20' 
                : 'bg-red-600 border-red-500 shadow-red-500/20'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-200 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 hover:opacity-80 p-0.5 text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Chỉ số nhanh */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                QUẢN LÝ NHÂN SỰ & KỸ THUẬT VIÊN
              </h2>
              <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Sunhouse Factory
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Đồng bộ Realtime 2 chiều với bảng <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-700">workers</code> trên Supabase
            </p>
          </div>
        </div>

        {/* Thẻ thống kê nhỏ và nút hành động */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200/60 text-xs">
            <span className="text-gray-500 font-medium">Tổng số:</span>
            <span className="font-bold text-gray-800">{stats.total}</span>
            <span className="mx-1 text-gray-300">|</span>
            <span className="text-emerald-600 font-medium">Hoạt động:</span>
            <span className="font-bold text-emerald-700">{stats.active}</span>
          </div>

          {/* Nút Tải file mẫu Excel */}
          <button
            onClick={downloadWorkerTemplate}
            title="Tải file mẫu Excel danh sách nhân sự"
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Mẫu Excel</span>
          </button>

          {/* Nút Nhập file Excel */}
          <input
            type="file"
            ref={excelInputRef}
            onChange={handleUploadExcel}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            onClick={() => excelInputRef.current?.click()}
            disabled={isImportingExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isImportingExcel ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>{isImportingExcel ? 'Đang nhập...' : 'Nhập Excel'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-red-500/20 transition-all cursor-pointer active:scale-95 ml-auto md:ml-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm Nhân Viên</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('Khôi phục danh sách nhân sự mặc định Sunhouse?')) {
                onResetWorkers();
                showToast('success', 'Đã tải lại danh sách nhân sự chuẩn Sunhouse!');
              }
            }}
            title="Khôi phục danh sách mẫu Sunhouse"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
          >
            <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-red-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, mã NV (SH-...), số điện thoại, chức danh..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 hover:bg-gray-100/60 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs text-gray-700 font-medium cursor-pointer"
            >
              <option value="all">Tất cả Dây chuyền / Phòng ban</option>
              {PRODUCTION_LINES.map((line) => (
                <option key={line} value={line}>{line}</option>
              ))}
              <option value="Phòng Quản lý Chất lượng (QC)">Phòng Quản lý Chất lượng (QC)</option>
              <option value="Phòng Cơ điện & Bảo trì">Phòng Cơ điện & Bảo trì</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs text-gray-700 font-medium cursor-pointer"
            >
              <option value="all">Tất cả Trạng thái</option>
              <option value="Đang làm việc">🟢 Đang làm việc</option>
              <option value="Nghỉ phép">🟡 Nghỉ phép</option>
              <option value="Đã nghỉ">⚪ Đã nghỉ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bảng danh sách Nhân sự */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nhân sự</th>
                <th className="py-3.5 px-4">Mã NV</th>
                <th className="py-3.5 px-4">Bộ phận / Dây chuyền</th>
                <th className="py-3.5 px-4">Chức vụ / Vị trí</th>
                <th className="py-3.5 px-4">Số điện thoại</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-300 opacity-60" />
                    <p className="font-medium">Không tìm thấy nhân sự phù hợp</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Thử thay đổi bộ lọc hoặc bấm "Thêm Nhân Viên" mới
                    </p>
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker) => {
                  const isDeleting = deletingId === worker.id;
                  const displayName = worker.full_name || worker.name || 'Chưa đặt tên';
                  const displayCode = worker.worker_code || worker.code || '';
                  const initials = displayName
                    .split(' ')
                    .filter(Boolean)
                    .slice(-2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={worker.id}
                      className="hover:bg-red-50/30 transition-colors group"
                    >
                      {/* Cột Tên & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-red-500/10">
                            {initials || 'NV'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                              {displayName}
                            </div>
                            <div className="text-xs text-gray-400 md:hidden">
                              {displayCode || 'Chưa có mã'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột Mã NV */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold border border-gray-200">
                          {displayCode || '—'}
                        </span>
                      </td>

                      {/* Cột Bộ phận */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-gray-700 text-xs font-medium">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{worker.department || 'Dây chuyền LR RO'}</span>
                        </div>
                      </td>

                      {/* Cột Chức vụ */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{worker.role || 'Kỹ thuật viên'}</span>
                        </div>
                      </td>

                      {/* Cột SĐT */}
                      <td className="py-3 px-4">
                        {worker.phone ? (
                          <div className="flex items-center gap-1.5 text-gray-600 text-xs font-mono">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{worker.phone}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Cột Trạng thái */}
                      <td className="py-3 px-4 text-center">
                        {worker.status === 'Đang làm việc' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang làm việc
                          </span>
                        ) : worker.status === 'Nghỉ phép' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Nghỉ phép
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Đã nghỉ
                          </span>
                        )}
                      </td>

                      {/* Cột Thao tác */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Sửa */}
                          <button
                            onClick={() => handleOpenEditModal(worker)}
                            title="Chỉnh sửa thông tin nhân viên"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Nút Xóa (DELETE trực tiếp lên Supabase) */}
                          <button
                            onClick={() => handleDelete(worker)}
                            disabled={isDeleting}
                            title="Xóa nhân sự khỏi Supabase"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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
      </div>

      {/* Modal Thêm Mới / Chỉnh Sửa Nhân Sự */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {editingWorker ? (
                    <Edit3 className="w-5 h-5 text-red-100" />
                  ) : (
                    <UserPlus className="w-5 h-5 text-red-100" />
                  )}
                  <h3 className="font-bold text-base">
                    {editingWorker ? 'Chỉnh Sửa Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                {/* Họ và tên */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Họ và Tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formErrors.name) {
                        setFormErrors((prev) => ({ ...prev, name: '' }));
                      }
                    }}
                    placeholder="VD: Nguyễn Minh Hoàng Khiêm"
                    className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all ${
                      formErrors.name ? 'border-red-500 bg-red-50/50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.name}</p>
                  )}
                </div>

                {/* Mã nhân viên & SĐT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Mã Nhân Viên
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="VD: SH-0102"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Số Điện Thoại
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="VD: 0987654321"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                  </div>
                </div>

                {/* Bộ phận / Dây chuyền */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Bộ phận / Dây chuyền <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
                  >
                    {PRODUCTION_LINES.map((line) => (
                      <option key={line} value={line}>{line}</option>
                    ))}
                    <option value="Phòng Quản lý Chất lượng (QC)">Phòng Quản lý Chất lượng (QC)</option>
                    <option value="Phòng Cơ điện & Bảo trì">Phòng Cơ điện & Bảo trì</option>
                    <option value="Tổ Trưởng / Quản đốc Xưởng">Tổ Trưởng / Quản đốc Xưởng</option>
                  </select>
                </div>

                {/* Chức vụ / Vị trí */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Chức danh / Vị trí
                  </label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="VD: Kỹ thuật viên Trưởng, Trưởng Ca 1, Kỹ sư QC..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  />
                </div>

                {/* Trạng thái làm việc */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Trạng thái làm việc
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Đang làm việc', 'Nghỉ phép', 'Đã nghỉ'] as const).map((statusOption) => (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => setFormStatus(statusOption)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                          formStatus === statusOption
                            ? statusOption === 'Đang làm việc'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-500 font-semibold'
                              : statusOption === 'Nghỉ phép'
                              ? 'bg-amber-50 text-amber-700 border-amber-500 font-semibold'
                              : 'bg-gray-100 text-gray-700 border-gray-400 font-semibold'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {statusOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nút Submit & Cancel */}
                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-red-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu lên Supabase...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{editingWorker ? 'Cập Nhật Nhân Viên' : 'Lưu Nhân Viên'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
