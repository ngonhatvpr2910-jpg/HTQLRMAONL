import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  History, 
  Database,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  HeartPulse,
  Trash2,
  DownloadCloud,
  UploadCloud,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2, 
  Loader2,
  Users
} from 'lucide-react';
import { DowntimeReport, Worker } from './types';
import { INITIAL_DOWNTIME_REPORTS, PRODUCTS, Product } from './data';
import KPICards from './KPICards';
import DowntimeCharts from './DowntimeCharts';
import DowntimeForm from './DowntimeForm';
import DowntimeTable from './DowntimeTable';
import ProductConfig from './ProductConfig';
import WorkerManagement from './WorkerManagement';
import { exportFullSystemDataToExcel, importFullSystemDataFromExcel } from './excelExport';
import { 
  fetchReports, 
  fetchAllReportsForBackup,
  addReport, 
  updateReport, 
  deleteReport, 
  deleteMultipleReports, 
  resetReportsToDefault, 
  bulkImportReports,
  fetchProducts, 
  saveProducts, 
  resetProductsToDefault,
  subscribeToReports,
  fetchWorkers,
  addWorker,
  updateWorker,
  deleteWorker,
  resetWorkersToDefault,
  bulkImportWorkers,
  subscribeToWorkers
} from './storage';
import { isSupabaseConfigured } from './supabaseClient';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trạng thái dữ liệu
  const [reports, setReports] = useState<DowntimeReport[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  
  // Trạng thái tải và đồng bộ database online
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showDbInfoModal, setShowDbInfoModal] = useState<boolean>(false);

  // 2. Các trạng thái giao diện (UI state)
  const [activeTab, setActiveTab] = useState<'logs' | 'analytics' | 'products' | 'workers'>('logs');
  const [showForm, setShowForm] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<DowntimeReport | null>(null);
  
  // Đồng hồ hiển thị thời gian thực ở Header
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tải dữ liệu ban đầu từ Supabase (hoặc cache cục bộ) và thiết lập Realtime Subscription
  const loadData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const [reportsData, productsData, workersData] = await Promise.all([
        fetchReports(),
        fetchProducts(),
        fetchWorkers(),
      ]);
      setReports(reportsData);
      setProducts(productsData);
      setWorkers(workersData);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu từ Supabase:', err);
      setDbError(err?.message || 'Không thể kết nối với cơ sở dữ liệu đám mây');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 1. Lắng nghe Realtime bảng downtime_reports
    const unsubscribeReports = subscribeToReports((event) => {
      console.info('[Realtime] Cập nhật delta reports:', event.eventType, event.new?.id || event.oldId);
      if (event.eventType === 'INSERT' && event.new) {
        setReports((prev) => [event.new!, ...prev.filter((r) => r.id !== event.new!.id)].slice(0, 100));
      } else if (event.eventType === 'UPDATE' && event.new) {
        setReports((prev) => prev.map((r) => (r.id === event.new!.id ? event.new! : r)));
      } else if (event.eventType === 'DELETE' && event.oldId) {
        setReports((prev) => prev.filter((r) => r.id !== event.oldId));
      } else {
        fetchReports(100).then((latest) => setReports(latest));
      }
    });

    // 2. Lắng nghe Realtime bảng workers (TỐI ƯU EGRESS: cập nhật local state thay vì Re-fetch)
    const workerSubscription = subscribeToWorkers((event) => {
      console.info('[Realtime Workers] Delta event:', event.eventType);
      if (event.eventType === 'INSERT' && event.new) {
        // Với event 'INSERT': Append bản ghi mới (payload.new) vào state workers hiện tại
        setWorkers((prev) => {
          if (prev.some((w) => w.id === event.new!.id)) {
            return prev.map((w) => (w.id === event.new!.id ? event.new! : w));
          }
          return [event.new!, ...prev];
        });
      } else if (event.eventType === 'UPDATE' && event.new) {
        // Với event 'UPDATE': Tìm và thay thế bản ghi trong state bằng (payload.new)
        setWorkers((prev) => prev.map((w) => (w.id === event.new!.id ? event.new! : w)));
      } else if (event.eventType === 'DELETE' && event.old?.id) {
        // Với event 'DELETE': Filter loại bỏ bản ghi có ID matching (payload.old.id) khỏi state
        setWorkers((prev) => prev.filter((w) => w.id !== event.old!.id));
      }
    });

    // Cleanup: giải phóng cả 2 kết nối Realtime khi unmount để ngắt kết nối ngầm
    return () => {
      unsubscribeReports();
      workerSubscription.unsubscribe();
    };
  }, []);

  // 3. Thêm mới hoặc Cập nhật báo cáo (Async/Await qua Supabase)
  const handleSubmitReport = async (formData: Omit<DowntimeReport, 'id' | 'createdAt'> & { id?: string }) => {
    setIsSyncing(true);
    setDbError(null);
    try {
      if (formData.id) {
        // Chế độ CẬP NHẬT (Update/Edit)
        const existing = reports.find((r) => r.id === formData.id);
        const reportToUpdate: DowntimeReport = {
          ...formData,
          id: formData.id,
          createdAt: existing?.createdAt || new Date().toISOString(),
        };
        const updated = await updateReport(reportToUpdate);
        setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setReportToEdit(null);
      } else {
        // Chế độ THÊM MỚI (Add)
        const created = await addReport(formData);
        setReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      }
      setShowForm(false);
    } catch (err: any) {
      console.error('Lỗi lưu báo cáo:', err);
      alert('Không thể lưu báo cáo vào database: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Kích hoạt chỉnh sửa báo cáo
  const handleEditClick = (report: DowntimeReport) => {
    setReportToEdit(report);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 5. Xóa báo cáo (Async/Await)
  const handleDeleteClick = async (id: string) => {
    setIsSyncing(true);
    setDbError(null);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error('Lỗi khi xóa báo cáo:', err);
      alert('Lỗi xóa báo cáo trên database: ' + (err?.message || 'Vui lòng kiểm tra lại quyền'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteAllReports = async (ids: string[]) => {
    setIsSyncing(true);
    setDbError(null);
    try {
      await deleteMultipleReports(ids);
      setReports((prev) => prev.filter((r) => !ids.includes(r.id)));
    } catch (err: any) {
      console.error('Lỗi xóa nhiều báo cáo:', err);
      alert('Lỗi xóa hàng loạt trên database: ' + (err?.message || 'Vui lòng kiểm tra lại quyền'));
    } finally {
      setIsSyncing(false);
    }
  };

  // 6. Reset về dữ liệu mẫu mặc định
  const handleResetToDemo = async () => {
    if (confirm('Bạn có chắc muốn khôi phục toàn bộ dữ liệu mẫu mặc định lên database? Tất cả các báo cáo do bạn tự thêm sẽ bị ghi đè.')) {
      setIsSyncing(true);
      setDbError(null);
      try {
        const [resReports, resProducts] = await Promise.all([
          resetReportsToDefault(INITIAL_DOWNTIME_REPORTS),
          resetProductsToDefault(PRODUCTS),
        ]);
        setReports(resReports);
        setProducts(resProducts);
        setShowForm(false);
        setReportToEdit(null);
      } catch (err: any) {
        console.error('Lỗi khôi phục mẫu:', err);
        alert('Lỗi khôi phục mẫu trên cơ sở dữ liệu: ' + (err?.message || ''));
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Cập nhật danh mục sản phẩm (Async/Await)
  const handleUpdateProducts = async (newProducts: Product[]) => {
    setIsSyncing(true);
    try {
      await saveProducts(newProducts);
      setProducts(newProducts);
    } catch (err: any) {
      console.error('Lỗi cập nhật sản phẩm:', err);
      alert('Lỗi cập nhật sản phẩm: ' + (err?.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetProducts = async () => {
    setIsSyncing(true);
    try {
      const resetProds = await resetProductsToDefault(PRODUCTS);
      setProducts(resetProds);
    } catch (err: any) {
      console.error('Lỗi reset sản phẩm:', err);
      alert('Lỗi reset danh mục sản phẩm: ' + (err?.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  // Quản lý Nhân sự / Kỹ thuật viên (Thêm, Sửa, Xóa kết nối Supabase)
  const handleAddWorker = async (workerData: Omit<Worker, 'id' | 'created_at'> & { id?: string }) => {
    setIsSyncing(true);
    try {
      const saved = await addWorker(workerData);
      setWorkers((prev) => [saved, ...prev.filter((w) => w.id !== saved.id)]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateWorker = async (workerId: string, updatedData: Partial<Worker>) => {
    setIsSyncing(true);
    try {
      const updated = await updateWorker(workerId, updatedData);
      setWorkers((prev) => prev.map((w) => (w.id === workerId ? updated : w)));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    setIsSyncing(true);
    try {
      // Chỉ cập nhật State trên giao diện sau khi Supabase trả về kết quả xóa thành công
      await deleteWorker(workerId);
      setWorkers((prev) => prev.filter((w) => w.id !== workerId));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetWorkers = async () => {
    setIsSyncing(true);
    try {
      const res = await resetWorkersToDefault();
      setWorkers(res);
    } catch (err: any) {
      console.error('Lỗi reset nhân sự:', err);
      alert('Lỗi khôi phục danh sách nhân sự: ' + (err?.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  // 7. Backup và Restore hệ thống
  const handleFullBackup = async () => {
    setIsSyncing(true);
    try {
      const fullReports = await fetchAllReportsForBackup();
      exportFullSystemDataToExcel(
        fullReports.length > 0 ? fullReports : reports, 
        products, 
        workers
      );
    } catch (e) {
      console.warn('Dùng cache reports hiện tại để xuất Excel:', e);
      exportFullSystemDataToExcel(reports, products, workers);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (confirm('Cảnh báo: Việc khôi phục dữ liệu sẽ đồng bộ toàn bộ báo cáo, danh mục sản phẩm và nhân sự lên Supabase Online. Bạn có chắc chắn muốn tiếp tục?')) {
      setIsSyncing(true);
      try {
        const data = await importFullSystemDataFromExcel(file);
        if (data.reports && data.reports.length > 0) {
          await bulkImportReports(data.reports);
          setReports(data.reports);
        }
        if (data.products && data.products.length > 0) {
          await saveProducts(data.products);
          setProducts(data.products);
        }
        if (data.workers && data.workers.length > 0) {
          await bulkImportWorkers(data.workers);
          setWorkers(data.workers);
        }
        alert(`Khôi phục thành công ${data.reports.length} sự cố dừng Line, ${data.products.length} sản phẩm, và ${data.workers.length} nhân sự lên Supabase!`);
      } catch (error: any) {
        console.error('Lỗi import file:', error);
        alert('Lỗi: File không đúng định dạng sao lưu hoặc lỗi kết nối database: ' + (error?.message || ''));
      } finally {
        setIsSyncing(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Nhập dữ liệu riêng từng tab qua Excel
  const handleImportReports = async (importedReports: DowntimeReport[]) => {
    setIsSyncing(true);
    try {
      await bulkImportReports(importedReports);
      setReports((prev) => {
        const existingIds = new Set(importedReports.map((r) => r.id));
        return [...importedReports, ...prev.filter((r) => !existingIds.has(r.id))];
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportWorkers = async (importedWorkers: Worker[]) => {
    setIsSyncing(true);
    try {
      await bulkImportWorkers(importedWorkers);
      setWorkers((prev) => {
        const existingCodes = new Set(importedWorkers.map((w) => w.worker_code || w.code));
        return [...importedWorkers, ...prev.filter((w) => !existingCodes.has(w.worker_code || w.code))];
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Hidden File Input for Restore */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFullRestore} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* HEADER DOANH NGHIỆP - Tông đỏ Sunhouse thương hiệu */}
      <header className="bg-[#B71C1C] text-white shadow-md border-b-4 border-[#8E1010]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Logo & Tiêu đề */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-white p-2 rounded-lg shadow-inner flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-[#B71C1C]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-[#FFE082] text-[#5D4037] text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">
                  Nhà máy Sunhouse
                </span>
                <span className="text-[10px] text-red-100 font-medium">Hệ thống IoT & Giám sát</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
                BÁO CÁO THỜI GIAN DỪNG LINE SẢN XUẤT
              </h1>
            </div>
          </div>

          {/* Widget Thời gian thực & Tiện ích */}
          <div className="flex flex-col sm:flex-row items-center gap-3 self-stretch md:self-auto">
            
            {/* Trạng thái Supabase Cloud DB Badge */}
            <button
              onClick={() => setShowDbInfoModal(true)}
              title={isSupabaseConfigured ? 'Cơ sở dữ liệu Supabase Online kết nối Realtime' : 'Chưa cấu hình Supabase, đang chạy bộ nhớ cục bộ'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                isSupabaseConfigured 
                  ? 'bg-emerald-900/50 border-emerald-400/40 text-emerald-200 hover:bg-emerald-900/80' 
                  : 'bg-amber-900/50 border-amber-400/40 text-amber-200 hover:bg-amber-900/80'
              }`}
            >
              {isSupabaseConfigured ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <Database className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Cloud DB (Supabase)</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 text-amber-300" />
                  <span>Bộ nhớ Cục bộ (Offline)</span>
                </>
              )}
            </button>

            {/* Hệ thống Backup/Restore */}
            <div className="flex items-center gap-2 bg-[#8E1010]/30 p-1.5 rounded-lg border border-white/10">
              <button 
                onClick={handleFullBackup}
                title="Tải toàn bộ dữ liệu hệ thống (.xlsx)"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold transition-all cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Sao lưu
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                title="Khôi phục dữ liệu từ file backup"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold transition-all shadow-sm cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Khôi phục
              </button>
            </div>

            <div className="flex items-center space-x-2 bg-[#8E1010]/50 px-3 py-2 rounded-lg text-xs font-mono border border-red-800">
              <Clock className="w-4 h-4 text-amber-300" />
              <div>
                <span className="text-red-200">Giờ:</span>{' '}
                <span className="font-bold text-white">
                  {currentTime.toLocaleTimeString('vi-VN')}
                </span>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* BANNER THÔNG BÁO LỖI HOẶC ĐỒNG BỘ NẾU CÓ */}
      {dbError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span>{dbError}. Đang sử dụng dữ liệu bộ nhớ đệm an toàn.</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* BODY CHÍNH */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full">
        
        {/* Loading overlay / spinner khi tải dữ liệu lần đầu */}
        {isLoading ? (
          <div className="min-h-[380px] bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
            <h3 className="text-base font-bold text-slate-800">Đang kết nối và tải dữ liệu từ Supabase...</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Đang đồng bộ báo cáo dừng Line, định mức sản phẩm và thiết lập kênh Realtime đa thiết bị.
            </p>
          </div>
        ) : (
          <>
            {/* KPI DASHBOARD SECTION */}
            <section aria-label="Thống kê hiệu năng dừng Line">
              <KPICards reports={reports} />
            </section>

            {/* CONTAINER NHẬP BÁO CÁO (Thu gọn / Mở rộng mượt mà) */}
            <AnimatePresence initial={false}>
              {showForm && (
                <motion.section
                  id="form-section"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ 
                    opacity: 1, 
                    height: 'auto',
                    marginBottom: 24,
                    transition: { height: { type: 'spring', stiffness: 200, damping: 25 }, opacity: { duration: 0.2 } }
                  }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { height: { duration: 0.2 }, opacity: { duration: 0.1 } } }}
                  className="overflow-hidden"
                >
                  <DowntimeForm
                    reportToEdit={reportToEdit}
                    onSubmit={handleSubmitReport}
                    onCancel={() => {
                      setShowForm(false);
                      setReportToEdit(null);
                    }}
                    products={products}
                    workers={workers}
                  />
                </motion.section>
              )}
            </AnimatePresence>

            {/* PHÂN VÙNG CHỨC NĂNG - TABS DƯỚI DẠNG THIẾT KẾ ĐẸP MẮT */}
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
              
              {/* Tabs chuyển đổi */}
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg w-full sm:w-auto gap-1">
                <button
                  onClick={() => {
                    setActiveTab('logs');
                    setShowForm(false);
                    setReportToEdit(null);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'logs'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Nhật Ký Dừng Line
                </button>
                <button
                  onClick={() => {
                    setActiveTab('analytics');
                    setShowForm(false);
                    setReportToEdit(null);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Biểu Đồ Trực Quan
                </button>
                <button
                  onClick={() => {
                    setActiveTab('products');
                    setShowForm(false);
                    setReportToEdit(null);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'products'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Sản Phẩm & Giá Bán
                </button>
                <button
                  onClick={() => {
                    setActiveTab('workers');
                    setShowForm(false);
                    setReportToEdit(null);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'workers'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Nhân Sự & Kỹ Thuật
                </button>
              </div>

              {/* Trạng thái đồng bộ và tỷ lệ chạy Line */}
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold self-stretch sm:self-auto justify-end px-2">
                {isSyncing ? (
                  <span className="flex items-center gap-1.5 text-blue-600 font-bold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang lưu lên Cloud...
                  </span>
                ) : isSupabaseConfigured ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Realtime Sync
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    Lưu cục bộ
                  </span>
                )}
                <span className="h-4 w-px bg-slate-200" />
                <span className="flex items-center gap-1">
                  <HeartPulse className="w-4 h-4 text-emerald-500" />
                  Tỷ lệ chạy Line: <span className="font-bold text-slate-800">97.8%</span>
                </span>
                <span className="h-4 w-px bg-slate-200" />
                <span>Mã nhà xưởng: <span className="font-bold text-slate-800">SHD-SH1</span></span>
              </div>

            </div>

            {/* NỘI DUNG TABS CHUYỂN ĐỔI */}
            <div className="transition-all duration-300">
              {activeTab === 'logs' ? (
                <section aria-label="Bảng nhật ký sự cố dừng Line">
                  <DowntimeTable
                    reports={reports}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onDeleteAll={handleDeleteAllReports}
                    onImportReports={handleImportReports}
                    onAddNewClick={() => {
                      setReportToEdit(null);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                </section>
              ) : activeTab === 'analytics' ? (
                <section aria-label="Biểu đồ phân tích thời gian dừng Line">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DowntimeCharts reports={reports} />
                  </motion.div>
                </section>
              ) : activeTab === 'products' ? (
                <section aria-label="Danh mục sản phẩm và giá bán">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProductConfig 
                      products={products}
                      onUpdateProducts={handleUpdateProducts}
                      onResetProducts={handleResetProducts}
                    />
                  </motion.div>
                </section>
              ) : (
                <section aria-label="Quản lý nhân sự và kỹ thuật viên">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <WorkerManagement
                      workers={workers}
                      onAddWorker={handleAddWorker}
                      onUpdateWorker={handleUpdateWorker}
                      onDeleteWorker={handleDeleteWorker}
                      onResetWorkers={handleResetWorkers}
                      onImportWorkers={handleImportWorkers}
                      isSyncing={isSyncing}
                    />
                  </motion.div>
                </section>
              )}
            </div>
          </>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-6 mt-12 border-t border-slate-900 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-300">HỆ THỐNG BÁO CÁO THỜI GIAN DỪNG LINE SẢN XUẤT - NHÀ MÁY SUNHOUSE</p>
          <p className="mt-1.5 text-slate-500">
            Hỗ trợ ghi chép dữ liệu trực tiếp, đồng bộ Supabase Cloud Realtime, phân tích biểu đồ Pareto và xuất bảng tính Excel.
          </p>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px]">
            <button
              onClick={() => setShowDbInfoModal(true)}
              className="text-slate-400 hover:text-white underline cursor-pointer"
            >
              Xem hướng dẫn cấu hình Supabase
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={handleResetToDemo}
              className="text-slate-400 hover:text-red-400 underline cursor-pointer"
            >
              Khôi phục dữ liệu mẫu ban đầu
            </button>
          </div>
          <p className="mt-4 text-[10px] text-slate-600">
            &copy; 2026 Sunhouse Group. All rights reserved. Tiêu chuẩn ISO 9001:2015.
          </p>
        </div>
      </footer>

      {/* MODAL THÔNG TIN CẤU HÌNH SUPABASE */}
      <AnimatePresence>
        {showDbInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-slate-900">Trạng Thái Kết Nối Supabase</h3>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    isSupabaseConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isSupabaseConfigured ? 'Đã kết nối Online' : 'Bộ nhớ Cục bộ'}
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p>
                    {isSupabaseConfigured ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ Ứng dụng đã được kết nối với dự án Supabase của bạn. Mọi thao tác thêm, sửa, xóa sẽ tự động đồng bộ tức thời giữa các máy tính và điện thoại.
                      </span>
                    ) : (
                      <span>
                        Ứng dụng hiện đang chạy ở chế độ <b>Offline / Local Storage</b>. Để đồng bộ dữ liệu trực tuyến qua Supabase giữa các thiết bị:
                      </span>
                    )}
                  </p>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1">
                    <div className="text-slate-500 font-bold mb-1">Cấu hình biến môi trường trong file .env:</div>
                    <div>VITE_SUPABASE_URL=https://your-project-id.supabase.co</div>
                    <div>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...</div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-blue-800 text-[11px]">
                    <b>Mẹo:</b> Đoạn mã SQL để tạo 2 bảng <code className="font-mono bg-blue-100 px-1 rounded">downtime_reports</code> và <code className="font-mono bg-blue-100 px-1 rounded">products</code> trên Supabase SQL Editor đã được chuẩn bị đầy đủ kèm tính năng Realtime!
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDbInfoModal(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Đã hiểu & Đóng
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
