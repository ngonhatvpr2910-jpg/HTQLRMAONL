import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Ticket, WorkflowStep, LotInfo } from './types';
import {
  fetchTicketsFromDB,
  fetchLotsFromDB,
  createTicketInDB,
  updateTicketInDB,
  moveTicketInDB,
  moveLotInDB,
  deleteTicketFromDB,
  registerLotInDB,
  importDataToDB,
  batchCreateTicketsInDB,
  subscribeToRealtimeChanges,
} from './storage';
import { isSupabaseConfigured } from './supabaseClient';

interface TicketContextType {
  tickets: Ticket[];
  lots: LotInfo[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  isSupabaseOnline: boolean;
  refreshData: () => Promise<void>;
  addTicket: (ticket: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  batchAddTickets: (newTickets: Ticket[]) => Promise<void>;
  registerLot: (lot: LotInfo) => Promise<void>;
  updateTicket: (id: string, updates: Partial<Ticket>) => Promise<void>;
  moveTicket: (id: string, newStatus: WorkflowStep) => Promise<void>;
  moveLot: (lotNumber: string, currentStatus: WorkflowStep, newStatus: WorkflowStep) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  importData: (data: { tickets: Ticket[]; lots: LotInfo[] }) => Promise<void>;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [lots, setLots] = useState<LotInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isSupabaseOnline = isSupabaseConfigured();

  // Hàm tải toàn bộ dữ liệu từ storage (Supabase hoặc offline fallback)
  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const [fetchedTickets, fetchedLots] = await Promise.all([
        fetchTicketsFromDB(),
        fetchLotsFromDB(),
      ]);
      setTickets(fetchedTickets);
      setLots(fetchedLots);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu:', err);
      setError(err?.message || 'Không thể đồng bộ dữ liệu');
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  // 1. Tải dữ liệu ban đầu khi mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 2. Kích hoạt Supabase Realtime Subscription để tự động đồng bộ giữa các máy
  useEffect(() => {
    if (!isSupabaseOnline) return;

    const unsubscribe = subscribeToRealtimeChanges({
      onTicketInsert: (newTicket) => {
        setTickets(prev => {
          if (prev.some(t => t.id === newTicket.id)) {
            return prev.map(t => (t.id === newTicket.id ? newTicket : t));
          }
          return [newTicket, ...prev];
        });
      },
      onTicketUpdate: (updatedTicket) => {
        setTickets(prev =>
          prev.map(t => (t.id === updatedTicket.id ? updatedTicket : t))
        );
      },
      onTicketDelete: (id) => {
        setTickets(prev => prev.filter(t => t.id !== id));
      },
      onLotInsert: (newLot) => {
        setLots(prev => {
          if (prev.some(l => l.lotNumber === newLot.lotNumber)) {
            return prev.map(l => (l.lotNumber === newLot.lotNumber ? newLot : l));
          }
          return [newLot, ...prev];
        });
      },
      onLotUpdate: (updatedLot) => {
        setLots(prev =>
          prev.map(l => (l.lotNumber === updatedLot.lotNumber ? updatedLot : l))
        );
      },
      onLotDelete: (lotNumber) => {
        setLots(prev => prev.filter(l => l.lotNumber !== lotNumber));
      },
      onFullRefreshNeeded: () => {
        refreshData();
      },
    });

    return () => {
      unsubscribe();
    };
  }, [isSupabaseOnline]);

  // Đăng ký lô hàng mới
  const registerLot = async (lot: LotInfo): Promise<void> => {
    // Optimistic UI update
    setLots(prev => {
      const exists = prev.find(l => l.lotNumber === lot.lotNumber);
      if (exists) return prev;
      return [...prev, lot];
    });

    try {
      await registerLotInDB(lot);
    } catch (err: any) {
      console.error('Lỗi khi đăng ký lô:', err);
      setError(err?.message || 'Lỗi khi lưu lô hàng');
    }
  };

  // Thêm mới 1 phiếu RMA
  const addTicket = async (
    ticketData: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    try {
      const newTicket = await createTicketInDB(ticketData, tickets);
      setTickets(prev => [newTicket, ...prev]);
    } catch (err: any) {
      console.error('Lỗi khi tạo phiếu RMA:', err);
      setError(err?.message || 'Lỗi khi tạo phiếu RMA');
      throw err;
    }
  };

  // Thêm hàng loạt phiếu RMA (ví dụ qua file Excel)
  const batchAddTickets = async (newTickets: Ticket[]): Promise<void> => {
    if (newTickets.length === 0) return;
    setTickets(prev => {
      const existingIds = new Set(newTickets.map(t => t.id));
      const filtered = prev.filter(t => !existingIds.has(t.id));
      return [...newTickets, ...filtered];
    });

    try {
      await batchCreateTicketsInDB(newTickets);
    } catch (err: any) {
      console.error('Lỗi khi thêm danh sách phiếu:', err);
      setError(err?.message || 'Lỗi khi thêm danh sách phiếu');
      throw err;
    }
  };

  // Cập nhật thông tin phiếu RMA
  const updateTicket = async (id: string, updates: Partial<Ticket>): Promise<void> => {
    const updatedAt = new Date().toISOString();
    // Optimistic update
    setTickets(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates, updatedAt } : t))
    );

    try {
      await updateTicketInDB(id, updates);
    } catch (err: any) {
      console.error('Lỗi khi cập nhật phiếu:', err);
      setError(err?.message || 'Lỗi khi cập nhật phiếu');
    }
  };

  // Chuyển trạng thái 1 phiếu
  const moveTicket = async (id: string, newStatus: WorkflowStep): Promise<void> => {
    // Optimistic update
    setTickets(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
          : t
      )
    );

    try {
      await moveTicketInDB(id, newStatus);
    } catch (err: any) {
      console.error('Lỗi khi di chuyển phiếu:', err);
      setError(err?.message || 'Lỗi khi chuyển trạng thái');
    }
  };

  // Chuyển toàn bộ lô hàng
  const moveLot = async (
    lotNumber: string,
    currentStatus: WorkflowStep,
    newStatus: WorkflowStep
  ): Promise<void> => {
    const updatedAt = new Date().toISOString();
    // Optimistic update
    setTickets(prev =>
      prev.map(t =>
        t.lotNumber === lotNumber && t.status === currentStatus
          ? { ...t, status: newStatus, updatedAt }
          : t
      )
    );

    try {
      await moveLotInDB(lotNumber, currentStatus, newStatus);
    } catch (err: any) {
      console.error('Lỗi khi chuyển lô:', err);
      setError(err?.message || 'Lỗi khi chuyển lô hàng');
    }
  };

  // Xóa phiếu RMA
  const deleteTicket = async (id: string): Promise<void> => {
    // Optimistic update
    setTickets(prev => prev.filter(t => t.id !== id));

    try {
      await deleteTicketFromDB(id);
    } catch (err: any) {
      console.error('Lỗi khi xóa phiếu:', err);
      setError(err?.message || 'Lỗi khi xóa phiếu');
    }
  };

  // Nhập dữ liệu sao lưu
  const importData = async (data: { tickets: Ticket[]; lots: LotInfo[] }): Promise<void> => {
    if (data.tickets) setTickets(data.tickets);
    if (data.lots) setLots(data.lots);

    try {
      await importDataToDB(data);
    } catch (err: any) {
      console.error('Lỗi khi khôi phục dữ liệu:', err);
      setError(err?.message || 'Lỗi khi khôi phục dữ liệu');
    }
  };

  return (
    <TicketContext.Provider
      value={{
        tickets,
        lots,
        isLoading,
        isSyncing,
        error,
        isSupabaseOnline,
        refreshData,
        addTicket,
        batchAddTickets,
        registerLot,
        updateTicket,
        moveTicket,
        moveLot,
        deleteTicket,
        importData,
      }}
    >
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => {
  const context = useContext(TicketContext);
  if (context === undefined) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};
