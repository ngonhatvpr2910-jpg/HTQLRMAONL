import React, { useState } from 'react';
import { TicketProvider, useTickets } from './TicketContext';
import Dashboard from './Dashboard';
import WorkersModal from './WorkersModal';
import { Settings, Package, RefreshCw, CloudOff, AlertTriangle, Users } from 'lucide-react';

function MainLayout() {
  const { isLoading, isSyncing, error, isSupabaseOnline, refreshData } = useTickets();
  const [isWorkersOpen, setIsWorkersOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <Package className="text-white w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">RMA REWORK NMBD</h1>
              {isSupabaseOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Supabase Cloud (Realtime)
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                  title="Chưa cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong .env"
                >
                  <CloudOff className="w-3.5 h-3.5" />
                  Chế độ Cục bộ (Offline)
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 font-medium">Hệ thống quản lý quy trình xử lý hàng RMA</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Nút Quản lý Nhân sự */}
          <button
            onClick={() => setIsWorkersOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors shadow-xs"
            title="Quản lý nhân sự & Kỹ thuật viên (Bảng workers)"
            id="header-btn-workers"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Nhân sự</span>
          </button>

          {/* Nút đồng bộ thủ công */}
          <button
            onClick={() => refreshData()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            title="Đồng bộ dữ liệu với Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
          </button>

          <button 
            onClick={() => setIsWorkersOpen(true)}
            title="Cài đặt hệ thống & Nhân sự"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
            AD
          </div>
        </div>
      </header>

      {/* Workers Management Modal */}
      <WorkersModal isOpen={isWorkersOpen} onClose={() => setIsWorkersOpen(false)} />


      {/* Thông báo lỗi nếu kết nối cơ sở dữ liệu gặp sự cố */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => refreshData()} className="font-semibold underline hover:text-red-900 ml-4">
            Thử lại
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Đang tải và đồng bộ dữ liệu RMA...</p>
          </div>
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <TicketProvider>
      <MainLayout />
    </TicketProvider>
  );
}
