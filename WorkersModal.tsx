import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Worker } from './types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Search, 
  RefreshCw, 
  Building, 
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface WorkersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Cột truy vấn tối thiểu theo đúng yêu cầu để tiết kiệm tối đa Egress
const MINIMAL_WORKER_COLUMNS = 'id, worker_code, full_name, department, status';

export default function WorkersModal({ isOpen, onClose }: WorkersModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State form Thêm / Sửa
  const [isAdding, setIsAdding] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    department: 'Xưởng Rework NMBD',
    status: 'active',
  });

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  /**
   * Chuyển đổi linh hoạt row từ Supabase sang Worker State
   * Hỗ trợ chuẩn: worker_code, full_name, status hoặc code, name, active
   */
  const mapRowToWorkerState = (row: any): Worker => {
    const rawStatus = row.status ?? (row.active === true ? 'active' : row.active === false ? 'inactive' : 'active');
    const isActive = rawStatus === 'active' || rawStatus === 'Đang làm việc' || rawStatus === true;

    return {
      id: String(row.id),
      name: row.full_name ?? row.name ?? '',
      code: row.worker_code ?? row.code ?? '',
      role: row.role ?? (isActive ? 'Kỹ thuật viên' : 'Đã nghỉ'),
      department: row.department ?? 'Xưởng Rework NMBD',
      phone: row.phone ?? '',
      email: row.email ?? '',
      active: isActive,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? new Date().toISOString(),
    };
  };

  /**
   * 2. TỐI ƯU HÀM FETCH BAN ĐẦU:
   * Chỉ select('id, worker_code, full_name, department, status') chọn đúng các cột cần hiển thị trên bảng
   */
  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        // Ưu tiên select đúng các cột tối ưu egress
        let { data, error } = await supabase
          .from('workers')
          .select(MINIMAL_WORKER_COLUMNS)
          .order('created_at', { ascending: false });

        // Fallback tự thích ứng nếu bảng dùng tên cột name / code
        if (error && error.message?.includes('does not exist')) {
          console.warn('[fetchWorkers] Cột tối ưu chưa khớp schema, thử fallback sang name/code/department/active');
          const fallbackRes = await supabase
            .from('workers')
            .select('id, code, name, department, active')
            .order('created_at', { ascending: false });
          
          if (!fallbackRes.error && fallbackRes.data) {
            data = fallbackRes.data as any;
            error = null;
          }
        }

        if (error) {
          console.warn('Lỗi khi fetchWorkers từ Supabase:', error.message);
          // Đọc từ cache local
          const localSaved = localStorage.getItem('rma_workers_data');
          if (localSaved) {
            setWorkers(JSON.parse(localSaved));
          }
        } else if (data) {
          const mappedList: Worker[] = data.map(mapRowToWorkerState);
          setWorkers(mappedList);
          localStorage.setItem('rma_workers_data', JSON.stringify(mappedList));
        }
      } else {
        const localSaved = localStorage.getItem('rma_workers_data');
        if (localSaved) {
          setWorkers(JSON.parse(localSaved));
        }
      }
    } catch (err: any) {
      console.error('Lỗi ngoại lệ khi tải danh sách nhân viên:', err);
      showToast('Không thể kết nối danh sách nhân viên: ' + (err?.message || 'Lỗi mạng'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 1. TỐI ƯU REALTIME (Update local state thay vì Re-fetch):
   * Lắng nghe sự kiện Realtime trên bảng workers. Khi có thay đổi:
   * - INSERT: Append bản ghi mới (payload.new) vào state workers hiện tại.
   * - UPDATE: Tìm và thay thế bản ghi trong state bằng (payload.new).
   * - DELETE: Filter loại bỏ bản ghi có ID matching (payload.old.id) khỏi state.
   * => Tuyệt đối KHÔNG gọi lại hàm fetchWorkers() toàn bộ bảng khi Realtime kích hoạt để tránh tốn Egress.
   * Đảm bảo cleanup subscription.unsubscribe() khi component unmount để ngắt kết nối ngầm.
   */
  useEffect(() => {
    if (!isOpen) return;

    // Chỉ fetch 1 lần khi mở modal
    fetchWorkers();

    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        (payload) => {
          console.log(`📡 [Realtime Delta] Bảng workers event: ${payload.eventType} (Tiết kiệm Egress 100%)`);

          if (payload.eventType === 'INSERT' && payload.new) {
            const newWorker = mapRowToWorkerState(payload.new);
            setWorkers((prev) => {
              // Tránh duplicate nếu chính máy này vừa thêm
              if (prev.some((w) => w.id === newWorker.id)) {
                return prev.map((w) => (w.id === newWorker.id ? newWorker : w));
              }
              return [newWorker, ...prev];
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedWorker = mapRowToWorkerState(payload.new);
            setWorkers((prev) =>
              prev.map((w) => (w.id === updatedWorker.id ? updatedWorker : w))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const targetId = String((payload.old as any).id);
            if (targetId) {
              setWorkers((prev) => prev.filter((w) => w.id !== targetId));
            }
          }
        }
      );

    const subscription = channel.subscribe();

    // CLEANUP: unsubscribe khi component unmount để ngắt kết nối ngầm
    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [isOpen, fetchWorkers]);

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      department: 'Xưởng Rework NMBD',
      status: 'active',
    });
    setIsAdding(false);
    setEditingWorkerId(null);
  };

  const handleStartEdit = (worker: Worker) => {
    setFormData({
      name: worker.name,
      code: worker.code || '',
      department: worker.department || 'Xưởng Rework NMBD',
      status: worker.active ? 'active' : 'inactive',
    });
    setEditingWorkerId(worker.id);
    setIsAdding(false);
  };

  /**
   * 3. THÊM MỚI (INSERT):
   * Viết các hàm async gọi trực tiếp supabase.from('workers'):
   * INSERT: supabase.from('workers').insert([data])
   */
  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Vui lòng nhập họ và tên nhân viên', 'error');
      return;
    }

    setActionLoading(true);
    const newId = `W-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    // Chuẩn bị payload tương thích cả worker_code/full_name lẫn code/name
    const data: Record<string, any> = {
      id: newId,
      full_name: formData.name.trim(),
      name: formData.name.trim(),
      worker_code: formData.code.trim() || `NV-${Date.now().toString().slice(-4)}`,
      code: formData.code.trim() || `NV-${Date.now().toString().slice(-4)}`,
      department: formData.department.trim() || 'Xưởng Rework NMBD',
      status: formData.status,
      active: formData.status === 'active',
      created_at: now,
      updated_at: now,
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('workers').insert([data]);

        if (error) {
          // Thử lại với payload tối giản nếu gặp schema strict
          if (error.message?.includes('does not exist')) {
            const minimalData = {
              id: newId,
              name: formData.name.trim(),
              code: formData.code.trim() || `NV-${Date.now().toString().slice(-4)}`,
              department: formData.department.trim(),
              active: formData.status === 'active',
            };
            const retryRes = await supabase.from('workers').insert([minimalData]);
            if (retryRes.error) {
              showToast(`Thêm thất bại: ${retryRes.error.message}`, 'error');
              setActionLoading(false);
              return;
            }
          } else {
            showToast(`Thêm thất bại: ${error.message}`, 'error');
            setActionLoading(false);
            return;
          }
        }
      }

      // Cập nhật optimistic local state ngay lập tức
      const newWorkerItem: Worker = {
        id: newId,
        name: formData.name.trim(),
        code: formData.code.trim() || `NV-${Date.now().toString().slice(-4)}`,
        role: 'Kỹ thuật viên',
        department: formData.department.trim(),
        active: formData.status === 'active',
        createdAt: now,
        updatedAt: now,
      };

      setWorkers((prev) => {
        if (prev.some((w) => w.id === newId)) return prev;
        const next = [newWorkerItem, ...prev];
        localStorage.setItem('rma_workers_data', JSON.stringify(next));
        return next;
      });

      showToast(`Đã thêm nhân viên "${formData.name}" thành công!`, 'success');
      resetForm();
    } catch (err: any) {
      console.error('Lỗi khi insert worker:', err);
      showToast(`Lỗi: ${err?.message || 'Không thể kết nối'}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 3. SỬA / CẬP NHẬT (UPDATE):
   * UPDATE: supabase.from('workers').update(data).eq('id', id)
   */
  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkerId) return;

    if (!formData.name.trim()) {
      showToast('Vui lòng nhập họ và tên nhân viên', 'error');
      return;
    }

    setActionLoading(true);
    const now = new Date().toISOString();

    const data: Record<string, any> = {
      full_name: formData.name.trim(),
      name: formData.name.trim(),
      worker_code: formData.code.trim() || null,
      code: formData.code.trim() || null,
      department: formData.department.trim() || 'Xưởng Rework NMBD',
      status: formData.status,
      active: formData.status === 'active',
      updated_at: now,
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('workers')
          .update(data)
          .eq('id', editingWorkerId);

        if (error) {
          if (error.message?.includes('does not exist')) {
            const minimalData = {
              name: formData.name.trim(),
              code: formData.code.trim() || null,
              department: formData.department.trim(),
              active: formData.status === 'active',
            };
            const retryRes = await supabase
              .from('workers')
              .update(minimalData)
              .eq('id', editingWorkerId);
            if (retryRes.error) {
              showToast(`Cập nhật thất bại: ${retryRes.error.message}`, 'error');
              setActionLoading(false);
              return;
            }
          } else {
            showToast(`Cập nhật thất bại: ${error.message}`, 'error');
            setActionLoading(false);
            return;
          }
        }
      }

      // Cập nhật State trực tiếp mà không cần fetch lại toàn bộ bảng
      setWorkers((prev) => {
        const next = prev.map((w) =>
          w.id === editingWorkerId
            ? {
                ...w,
                name: formData.name.trim(),
                code: formData.code.trim() || w.code,
                department: formData.department.trim(),
                active: formData.status === 'active',
                updatedAt: now,
              }
            : w
        );
        localStorage.setItem('rma_workers_data', JSON.stringify(next));
        return next;
      });

      showToast(`Đã cập nhật nhân viên thành công!`, 'success');
      resetForm();
    } catch (err: any) {
      console.error('Lỗi khi update worker:', err);
      showToast(`Lỗi: ${err?.message || 'Không thể kết nối'}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 3. XÓA (DELETE):
   * DELETE: supabase.from('workers').delete().eq('id', id)
   * Chỉ cập nhật State trên giao diện sau khi Supabase trả về kết quả xóa thành công.
   */
  const handleDeleteWorker = async (worker: Worker) => {
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa nhân viên "${worker.name}" khỏi Supabase?`
    );
    if (!confirmDelete) return;

    setActionLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('workers')
          .delete()
          .eq('id', worker.id);

        if (error) {
          console.error('Lỗi khi xóa nhân viên trên Supabase:', error);
          showToast(`Xóa thất bại: ${error.message}`, 'error');
          setActionLoading(false);
          return;
        }
      }

      // CHỈ CẬP NHẬT STATE TRÊN GIAO DIỆN SAU KHI XÓA THÀNH CÔNG
      setWorkers((prev) => {
        const next = prev.filter((w) => w.id !== worker.id);
        localStorage.setItem('rma_workers_data', JSON.stringify(next));
        return next;
      });
      showToast(`Đã xóa nhân viên "${worker.name}" thành công!`, 'success');

      if (editingWorkerId === worker.id) {
        resetForm();
      }
    } catch (err: any) {
      console.error('Lỗi ngoại lệ khi xóa worker:', err);
      showToast(`Lỗi: ${err?.message || 'Không thể kết nối máy chủ'}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * UPFILE EXCEL / CSV NHÂN SỰ
   * Đọc file Excel/CSV, upsert trực tiếp lên Supabase mà không re-fetch, kích hoạt realtime
   */
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelUploading(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (!rows || rows.length === 0) {
        showToast('Tệp Excel không có dữ liệu.', 'error');
        setIsExcelUploading(false);
        return;
      }

      const now = new Date().toISOString();
      const newWorkersToInsert: any[] = [];
      const localStateWorkers: Worker[] = [];

      rows.forEach((row, index) => {
        const fullName = row['Họ và tên'] || row['Tên'] || row['full_name'] || row['name'] || row['FullName'];
        if (!fullName) return;

        const code = row['Mã NV'] || row['Mã'] || row['worker_code'] || row['code'] || `NV-${String(index + 1).padStart(3, '0')}`;
        const department = row['Bộ phận'] || row['Phòng ban'] || row['department'] || 'Xưởng Rework NMBD';
        const rawStatus = row['Trạng thái'] || row['status'] || 'active';
        const isActive = rawStatus === 'active' || rawStatus === 'Đang làm việc' || rawStatus === true || rawStatus === 1;
        const id = row['ID'] || row['id'] || `W-${Date.now().toString().slice(-6)}-${index}`;

        newWorkersToInsert.push({
          id,
          full_name: String(fullName).trim(),
          name: String(fullName).trim(),
          worker_code: String(code).trim(),
          code: String(code).trim(),
          department: String(department).trim(),
          status: isActive ? 'active' : 'inactive',
          active: isActive,
          created_at: now,
          updated_at: now,
        });

        localStateWorkers.push({
          id,
          name: String(fullName).trim(),
          code: String(code).trim(),
          role: 'Kỹ thuật viên',
          department: String(department).trim(),
          active: isActive,
          createdAt: now,
          updatedAt: now,
        });
      });

      if (newWorkersToInsert.length === 0) {
        showToast('Không tìm thấy cột Họ và tên (hoặc full_name, name) trong file Excel.', 'error');
        setIsExcelUploading(false);
        return;
      }

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('workers')
          .upsert(newWorkersToInsert, { onConflict: 'id' });

        if (error) {
          console.error('Lỗi khi upsert danh sách nhân viên từ Excel:', error);
          showToast(`Lỗi đồng bộ lên Supabase: ${error.message}`, 'error');
          setIsExcelUploading(false);
          return;
        }
      }

      // Cập nhật State cục bộ ngay lập tức (không fetch lại toàn bảng, không tốn Egress)
      setWorkers((prev) => {
        const existingIds = new Set(prev.map((w) => w.id));
        const merged = [...localStateWorkers.filter((w) => !existingIds.has(w.id)), ...prev];
        localStorage.setItem('rma_workers_data', JSON.stringify(merged));
        return merged;
      });

      showToast(`Đã nhập thành công ${newWorkersToInsert.length} nhân sự từ file Excel!`, 'success');
    } catch (err: any) {
      console.error('Lỗi đọc file Excel:', err);
      showToast(`Lỗi đọc file Excel: ${err?.message || 'Định dạng không hợp lệ'}`, 'error');
    } finally {
      setIsExcelUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Tải file Excel mẫu cho Quản lý nhân sự
   */
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      { 'Mã NV': 'NV-101', 'Họ và tên': 'Nguyễn Văn An', 'Bộ phận': 'Xưởng Rework NMBD', 'Trạng thái': 'active' },
      { 'Mã NV': 'NV-102', 'Họ và tên': 'Trần Thị Bình', 'Bộ phận': 'Phòng Bảo Hành', 'Trạng thái': 'active' },
      { 'Mã NV': 'NV-103', 'Họ và tên': 'Lê Hoàng Cường', 'Bộ phận': 'Kỹ Thuật Đánh Giá', 'Trạng thái': 'active' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachNhanSu');
    XLSX.writeFile(wb, 'Mau_Nhap_Nhan_Su_Supabase.xlsx');
  };

  if (!isOpen) return null;

  const filteredWorkers = workers.filter((w) => {
    const query = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(query) ||
      (w.code && w.code.toLowerCase().includes(query)) ||
      (w.department && w.department.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        id="workers-management-modal"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Quản lý Nhân sự / Kỹ thuật viên</h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  Egress Tối Ưu
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Đồng bộ Delta Realtime (INSERT, UPDATE, DELETE) trực tiếp qua bảng <code className="text-blue-300 font-mono">workers</code>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchWorkers}
              disabled={loading}
              title="Tải lại dữ liệu ban đầu (Select đúng 5 cột tối ưu Egress)"
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div 
            className={`px-6 py-2.5 flex items-center space-x-2 text-sm font-medium transition-all ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-b border-emerald-200 text-emerald-800' 
                : toast.type === 'error'
                ? 'bg-rose-50 border-b border-rose-200 text-rose-800'
                : 'bg-blue-50 border-b border-blue-200 text-blue-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            {toast.type === 'info' && <Database className="w-4 h-4 shrink-0 text-blue-600" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-xs font-bold hover:underline">
              Đóng
            </button>
          </div>
        )}

        {/* Toolbar: Search + Excel Upload + Add Button */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo Tên, Mã NV, Bộ phận..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 flex-wrap">
            {/* Tải mẫu Excel */}
            <button
              onClick={handleDownloadSampleExcel}
              className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs"
              title="Tải file Excel mẫu để nhập danh sách nhân sự"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Mẫu Excel</span>
            </button>

            {/* Upfile Excel Nhân sự */}
            <label 
              className={`flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer ${
                isExcelUploading ? 'opacity-60 pointer-events-none' : ''
              }`}
              title="Tải file Excel/CSV lên Supabase"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isExcelUploading ? 'Đang đọc...' : 'Upfile Excel'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="hidden"
                disabled={isExcelUploading}
              />
            </label>

            {!isAdding && !editingWorkerId && (
              <button
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors"
                id="btn-add-worker"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm nhân sự</span>
              </button>
            )}
          </div>
        </div>

        {/* Form Thêm / Chỉnh sửa */}
        {(isAdding || editingWorkerId) && (
          <div className="p-5 bg-blue-50/70 border-b border-blue-200 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                {editingWorkerId ? (
                  <>
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>Chỉnh sửa thông tin nhân viên</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Thêm nhân viên mới (Gọi INSERT Supabase)</span>
                  </>
                )}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-500 hover:text-slate-700 text-xs font-semibold"
              >
                Hủy bỏ
              </button>
            </div>

            <form onSubmit={editingWorkerId ? handleUpdateWorker : handleCreateWorker}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên (full_name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã nhân viên (worker_code)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: NV-101"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bộ phận (department)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Xưởng Rework NMBD"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng thái (status)
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    <option value="active">Đang làm việc (active)</option>
                    <option value="inactive">Đã nghỉ việc (inactive)</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingWorkerId ? 'Lưu thay đổi (UPDATE)' : 'Xác nhận thêm (INSERT)'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Danh sách nhân sự */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && workers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <p className="text-sm">Đang tải danh sách nhân sự từ Supabase...</p>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Không tìm thấy nhân viên nào</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'Thử thay đổi từ khóa tìm kiếm' : 'Bấm nút "Thêm nhân sự" hoặc "Upfile Excel" để nhập danh sách'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Mã NV (worker_code)</th>
                    <th className="py-3 px-4">Họ và tên (full_name)</th>
                    <th className="py-3 px-4">Bộ phận (department)</th>
                    <th className="py-3 px-4 text-center">Trạng thái (status)</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredWorkers.map((worker) => (
                    <tr 
                      key={worker.id}
                      id={`worker-row-${worker.id}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-xs">
                        {worker.code || worker.id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {worker.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{worker.department || 'Xưởng Rework NMBD'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            worker.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${worker.active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {worker.active ? 'Đang làm việc' : 'Đã nghỉ việc'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleStartEdit(worker)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Sửa thông tin nhân viên (UPDATE)"
                            id={`btn-edit-worker-${worker.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* 3. XÓA (DELETE):
                              Khi bấm biểu tượng thùng rác, gọi lệnh xóa trực tiếp lên Supabase:
                              await supabase.from('workers').delete().eq('id', workerId);
                          */}
                          <button
                            onClick={() => handleDeleteWorker(worker)}
                            disabled={actionLoading}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Xóa nhân viên khỏi Supabase (DELETE)"
                            id={`btn-delete-worker-${worker.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Tổng số: <strong>{workers.length}</strong> nhân sự | Kênh Realtime: <strong className="text-slate-700">schema-db-changes</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
