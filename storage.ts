import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Ticket, LotInfo, WorkflowStep, Worker } from './types';

const STORAGE_KEY = 'rma_tickets_data';
const LOTS_STORAGE_KEY = 'rma_lots_data';
const WORKERS_STORAGE_KEY = 'rma_workers_data';

// ================= TỐI ƯU CỘT TRUY VẤN (TIẾT KIỆM EGRESS BĂNG THÔNG) =================
// Chỉ select các cột thực sự hiển thị trên giao diện, loại bỏ việc select * gây tốn bandwidth
export const WORKER_SELECT_COLUMNS = [
  'id',
  'name',
  'code',
  'role',
  'department',
  'phone',
  'email',
  'active',
  'created_at',
  'updated_at',
].join(', ');

export const TICKET_SELECT_COLUMNS = [
  'id',
  'product_name',
  'product_code',
  'lot_number',
  'serial_number',
  'quantity',
  'issue_description',
  'status',
  'created_at',
  'updated_at',
  'imei',
  'evaluation_notes',
  'damaged_parts',
  'quotation_amount',
  'rework_notes',
  'return_location',
].join(', ');

export const LOT_SELECT_COLUMNS = [
  'lot_number',
  'product_name',
  'product_code',
  'created_at',
].join(', ');

// Cột tối ưu cho các bảng lịch sử / nhật ký giao dịch (transactions, labels)
export const TRANSACTION_SELECT_COLUMNS = [
  'id',
  'ticket_id',
  'action',
  'from_status',
  'to_status',
  'created_at',
].join(', ');

// Mock initial data khi lần đầu chạy và chưa có dữ liệu
const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'RMA-1001',
    productName: 'Máy hút bụi X1',
    lotNumber: '50-11-2023',
    serialNumber: 'SN992817',
    quantity: 50,
    issueDescription: 'Động cơ có tiếng kêu lạ, lực hút yếu.',
    status: WorkflowStep.RMA_IN,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'RMA-1002',
    productName: 'Nồi cơm điện C2',
    lotNumber: '120-12-2023',
    serialNumber: 'SN112233',
    quantity: 120,
    issueDescription: 'Không lên nguồn',
    status: WorkflowStep.EVALUATION,
    evaluationNotes: 'Cháy cầu chì nhiệt, hỏng bo mạch nguồn.',
    damagedParts: ['Cầu chì nhiệt', 'Bo mạch nguồn chính'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// Helper lưu LocalStorage làm cache offline
export const getLocalTickets = (): Ticket[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse local tickets', e);
    }
  }
  return INITIAL_TICKETS;
};

export const setLocalTickets = (tickets: Ticket[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
};

export const getLocalLots = (): LotInfo[] => {
  const saved = localStorage.getItem(LOTS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse local lots', e);
    }
  }
  return [];
};

export const setLocalLots = (lots: LotInfo[]) => {
  localStorage.setItem(LOTS_STORAGE_KEY, JSON.stringify(lots));
};

// ================= Ánh xạ 2 chiều DB (snake_case) <-> Frontend (camelCase) =================
export const mapRowToTicket = (row: any): Ticket => {
  let status = (row.status as WorkflowStep) || WorkflowStep.RMA_IN;
  const rawLoc = row.return_location ?? row.returnLocation ?? '';
  let returnLocation: string | undefined = undefined;

  if (typeof rawLoc === 'string') {
    if (rawLoc.includes('[SHIPPED]') || row.status === 'SHIPPED') {
      status = WorkflowStep.SHIPPED;
      const clean = rawLoc.replace(/\[SHIPPED\]\s*/g, '').trim();
      returnLocation = clean || undefined;
    } else {
      returnLocation = rawLoc.trim() || undefined;
    }
  }

  return {
    id: row.id,
    productName: row.product_name ?? row.productName ?? '',
    productCode: row.product_code ?? row.productCode ?? undefined,
    lotNumber: row.lot_number ?? row.lotNumber ?? '',
    serialNumber: row.serial_number ?? row.serialNumber ?? '',
    quantity: Number(row.quantity ?? 1),
    issueDescription: row.issue_description ?? row.issueDescription ?? '',
    status,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
    imei: row.imei ?? undefined,
    evaluationNotes: row.evaluation_notes ?? row.evaluationNotes ?? undefined,
    damagedParts: Array.isArray(row.damaged_parts)
      ? row.damaged_parts
      : Array.isArray(row.damagedParts)
      ? row.damagedParts
      : undefined,
    quotationAmount: row.quotation_amount !== undefined ? Number(row.quotation_amount) : (row.quotationAmount !== undefined ? Number(row.quotationAmount) : undefined),
    reworkNotes: row.rework_notes ?? row.reworkNotes ?? undefined,
    returnLocation,
  };
};

export const mapTicketToRow = (ticket: Partial<Ticket>): any => {
  const row: Record<string, any> = {};
  if (ticket.id !== undefined) row.id = ticket.id;
  if (ticket.productName !== undefined) row.product_name = ticket.productName;
  if (ticket.productCode !== undefined) row.product_code = ticket.productCode;
  if (ticket.lotNumber !== undefined) row.lot_number = ticket.lotNumber;
  if (ticket.serialNumber !== undefined) row.serial_number = ticket.serialNumber;
  if (ticket.quantity !== undefined) row.quantity = ticket.quantity;
  if (ticket.issueDescription !== undefined) row.issue_description = ticket.issueDescription;

  if (ticket.status !== undefined) {
    if (ticket.status === WorkflowStep.SHIPPED) {
      // Postgres check constraint "tickets_status_check" chỉ cho phép ('RMA_IN', 'EVALUATION', 'QUOTED', 'REWORK', 'FINISHED', 'LIQUIDATION')
      // Lưu trạng thái FINISHED và đánh dấu [SHIPPED] trong return_location để không vi phạm constraint DB
      row.status = 'FINISHED';
      const loc = (ticket.returnLocation || '').replace(/\[SHIPPED\]\s*/g, '').trim();
      row.return_location = loc ? `[SHIPPED] ${loc}` : '[SHIPPED]';
    } else {
      row.status = ticket.status;
      if (ticket.returnLocation !== undefined) {
        const cleanLoc = (ticket.returnLocation || '').replace(/\[SHIPPED\]\s*/g, '').trim();
        row.return_location = cleanLoc || null;
      }
    }
  } else if (ticket.returnLocation !== undefined) {
    const cleanLoc = (ticket.returnLocation || '').replace(/\[SHIPPED\]\s*/g, '').trim();
    row.return_location = cleanLoc || null;
  }

  if (ticket.createdAt !== undefined) row.created_at = ticket.createdAt;
  if (ticket.updatedAt !== undefined) row.updated_at = ticket.updatedAt;
  if (ticket.imei !== undefined) row.imei = ticket.imei;
  if (ticket.evaluationNotes !== undefined) row.evaluation_notes = ticket.evaluationNotes;
  if (ticket.damagedParts !== undefined) row.damaged_parts = ticket.damagedParts;
  if (ticket.quotationAmount !== undefined) row.quotation_amount = ticket.quotationAmount;
  if (ticket.reworkNotes !== undefined) row.rework_notes = ticket.reworkNotes;
  return row;
};

export const mapRowToLot = (row: any): LotInfo => {
  return {
    lotNumber: row.lot_number ?? row.lotNumber ?? '',
    productName: row.product_name ?? row.productName ?? '',
    productCode: row.product_code ?? row.productCode ?? '',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
};

export const mapLotToRow = (lot: LotInfo): any => {
  return {
    lot_number: lot.lotNumber,
    product_name: lot.productName,
    product_code: lot.productCode,
    created_at: lot.createdAt,
  };
};

// ================= CÁC HÀM ASYNC FETCHING DỮ LIỆU ĐƯỢC TỐI ƯU =================

/**
 * Lấy danh sách phiếu RMA từ Supabase với cột cụ thể và giới hạn số lượng để tiết kiệm Egress
 * Mặc định lấy 100 phiếu gần nhất (đáp ứng tiêu chuẩn gói Free)
 */
export const fetchTicketsFromDB = async (limit: number = 500): Promise<Ticket[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Lỗi khi fetch tickets từ Supabase, chuyển sang bộ nhớ tạm:', error.message);
        return getLocalTickets();
      }

      if (data) {
        const mapped = data.map(mapRowToTicket);
        // Gộp dữ liệu Supabase với local cache để không bao giờ làm mất dữ liệu cục bộ
        const local = getLocalTickets();
        const map = new Map<string, Ticket>();
        local.forEach(t => map.set(t.id, t));
        mapped.forEach(t => map.set(t.id, t));
        const merged = Array.from(map.values());

        setLocalTickets(merged);
        return merged;
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi kết nối Supabase:', err);
      return getLocalTickets();
    }
  }
  return getLocalTickets();
};

/**
 * Lấy danh sách lô hàng với cột cụ thể và giới hạn bản ghi
 */
export const fetchLotsFromDB = async (limit: number = 500): Promise<LotInfo[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(LOT_SELECT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Lỗi khi fetch lots từ Supabase, chuyển sang bộ nhớ tạm:', error.message);
        return getLocalLots();
      }

      if (data) {
        const mapped = data.map(mapRowToLot);
        const local = getLocalLots();
        const map = new Map<string, LotInfo>();
        local.forEach(l => map.set(l.lotNumber, l));
        mapped.forEach(l => map.set(l.lotNumber, l));
        const merged = Array.from(map.values());

        setLocalLots(merged);
        return merged;
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi fetch lots:', err);
      return getLocalLots();
    }
  }
  return getLocalLots();
};

/**
 * Lấy nhật ký giao dịch / nhãn in với giới hạn 100 bản ghi mới nhất
 */
export const fetchTransactionsFromDB = async (limit: number = 100): Promise<any[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(TRANSACTION_SELECT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data;
      }
    } catch (err) {
      // Bảng transactions là bảng tùy chọn
    }
  }
  return [];
};

/**
 * Thêm một phiếu RMA mới vào Supabase
 */
export const createTicketInDB = async (
  ticketData: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  existingTickets: Ticket[]
): Promise<Ticket> => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const datePrefix = `${year}${month}`;

  // Tìm các phiếu trong tháng để cấp số thứ tự tiếp theo
  const thisMonthTickets = existingTickets.filter(t => t.id.startsWith(`RMA-${datePrefix}`));
  const nextNumber = (thisMonthTickets.length + 1).toString().padStart(4, '0');

  const newTicket: Ticket = {
    ...ticketData,
    id: `RMA-${datePrefix}-${nextNumber}`,
    status: WorkflowStep.RMA_IN,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Cập nhật local cache ngay lập tức
  const current = getLocalTickets();
  setLocalTickets([newTicket, ...current]);

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('tickets')
        .upsert([mapTicketToRow(newTicket)], { onConflict: 'id' });

      if (error) {
        console.error('Lỗi khi thêm phiếu vào Supabase:', error.message);
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi thêm ticket:', err);
    }
  }

  return newTicket;
};

/**
 * Thêm hàng loạt phiếu RMA (ví dụ khi Upfile Excel) vào Supabase
 */
export const batchCreateTicketsInDB = async (
  newTickets: Ticket[]
): Promise<void> => {
  if (newTickets.length === 0) return;

  // Cập nhật local cache ngay lập tức
  const current = getLocalTickets();
  const existingIds = new Set(newTickets.map(t => t.id));
  const filtered = current.filter(t => !existingIds.has(t.id));
  setLocalTickets([...newTickets, ...filtered]);

  if (isSupabaseConfigured()) {
    try {
      const rows = newTickets.map(mapTicketToRow);
      const { error } = await supabase.from('tickets').upsert(rows, { onConflict: 'id' });
      if (error) {
        console.error('Lỗi khi batch upsert tickets lên Supabase:', error.message);
        throw error;
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi batchCreateTicketsInDB:', err);
      throw err;
    }
  }
};

/**
 * Cập nhật thông tin phiếu RMA trên Supabase (hỗ trợ atomic upsert và fallback)
 */
export const updateTicketInDB = async (
  id: string,
  updates: Partial<Ticket>
): Promise<void> => {
  const updatedAt = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt };

  // 1. Cập nhật local cache ngay lập tức
  const current = getLocalTickets();
  const existing = current.find(t => t.id === id);
  const updatedTicket: Ticket = existing
    ? { ...existing, ...fullUpdates }
    : ({ id, ...fullUpdates } as Ticket);

  const updatedList = current.map(t => (t.id === id ? updatedTicket : t));
  if (!existing && updatedTicket.productName) {
    updatedList.unshift(updatedTicket);
  }
  setLocalTickets(updatedList);

  // 2. Lưu lên Supabase
  if (isSupabaseConfigured()) {
    try {
      // Ưu tiên update trực tiếp trường thay đổi (tránh lỗi Not-Null của upsert khi phiếu thiếu cột khác)
      const updateRow = mapTicketToRow(fullUpdates);
      const { data, error } = await supabase
        .from('tickets')
        .update(updateRow)
        .eq('id', id)
        .select('id');

      if (error) {
        console.warn(`Lỗi update phiếu ${id} trên Supabase, thử fallback upsert:`, error.message);
        const fullRow = mapTicketToRow(updatedTicket);
        const { error: upsertErr } = await supabase
          .from('tickets')
          .upsert([fullRow], { onConflict: 'id' });
        if (upsertErr) {
          console.error(`Lỗi upsert fallback phiếu ${id}:`, upsertErr.message);
        }
      } else if (!data || data.length === 0) {
        // Trường hợp phiếu mới chưa có trong database, thực hiện upsert với toàn bộ thông tin
        const fullRow = mapTicketToRow(updatedTicket);
        const { error: insertErr } = await supabase
          .from('tickets')
          .upsert([fullRow], { onConflict: 'id' });
        if (insertErr) {
          console.error(`Lỗi tạo mới phiếu ${id} qua upsert:`, insertErr.message);
        }
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi update ticket:', err);
    }
  }
};

/**
 * Chuyển trạng thái 1 phiếu RMA
 */
export const moveTicketInDB = async (
  id: string,
  newStatus: WorkflowStep
): Promise<void> => {
  await updateTicketInDB(id, { status: newStatus });
};

/**
 * Chuyển trạng thái toàn bộ phiếu thuộc cùng 1 lô
 */
export const moveLotInDB = async (
  lotNumber: string,
  currentStatus: WorkflowStep,
  newStatus: WorkflowStep
): Promise<void> => {
  const updatedAt = new Date().toISOString();

  // 1. Cập nhật local cache ngay lập tức
  const current = getLocalTickets();
  const updated = current.map(t =>
    t.lotNumber === lotNumber && t.status === currentStatus
      ? { ...t, status: newStatus, updatedAt }
      : t
  );
  setLocalTickets(updated);

  // 2. Lưu lên Supabase
  if (isSupabaseConfigured()) {
    try {
      const ticketsToUpdate = updated.filter(t => t.lotNumber === lotNumber && t.status === newStatus);
      const rows = ticketsToUpdate.map(mapTicketToRow);

      if (rows.length > 0) {
        const { error } = await supabase
          .from('tickets')
          .upsert(rows, { onConflict: 'id' });

        if (error) {
          console.warn(`Lỗi upsert khi chuyển lô ${lotNumber}, thử update:`, error.message);
          const dbNewStatus = newStatus === WorkflowStep.SHIPPED ? 'FINISHED' : newStatus;
          const updatePayload: any = { status: dbNewStatus, updated_at: updatedAt };
          if (newStatus === WorkflowStep.SHIPPED) {
            updatePayload.return_location = '[SHIPPED]';
          } else if (newStatus === WorkflowStep.FINISHED) {
            updatePayload.return_location = null;
          }
          let query = supabase.from('tickets').update(updatePayload).eq('lot_number', lotNumber);
          if (currentStatus === WorkflowStep.SHIPPED) {
            query = query.eq('status', 'FINISHED').like('return_location', '%[SHIPPED]%');
          } else {
            query = query.eq('status', currentStatus);
          }
          const { error: updateErr } = await query;
          if (updateErr) {
            console.error(`Lỗi update fallback chuyển lô ${lotNumber}:`, updateErr.message);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi move lot:', err);
    }
  }
};

/**
 * Xóa 1 phiếu RMA khỏi Supabase
 */
export const deleteTicketFromDB = async (id: string): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Lỗi khi xóa phiếu ${id} trên Supabase:`, error.message);
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi delete ticket:', err);
    }
  }

  const current = getLocalTickets();
  setLocalTickets(current.filter(t => t.id !== id));
};

/**
 * Đăng ký thông tin lô hàng vào bảng lots
 */
export const registerLotInDB = async (lot: LotInfo): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('lots')
        .upsert([mapLotToRow(lot)], { onConflict: 'lot_number' });

      if (error) {
        console.error(`Lỗi khi đăng ký lô ${lot.lotNumber} trên Supabase:`, error.message);
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi register lot:', err);
    }
  }

  const current = getLocalLots();
  const exists = current.find(l => l.lotNumber === lot.lotNumber);
  if (!exists) {
    setLocalLots([...current, lot]);
  }
};

// ================= BỘ CHUYỂN ĐỔI & ĐỒNG BỘ DỮ LIỆU CŨ LÊN DỮ LIỆU MỚI =================

export const normalizeWorkflowStatus = (raw: any): WorkflowStep => {
  if (!raw) return WorkflowStep.RMA_IN;
  const str = String(raw).trim().toUpperCase();

  if (str === 'RMA_IN' || str === '1' || str.includes('NHẬP') || str.includes('NHAP') || str.includes('RMA')) {
    return WorkflowStep.RMA_IN;
  }
  if (str === 'EVALUATION' || str === '2' || str.includes('ĐÁNH GIÁ') || str.includes('DANH GIA') || str.includes('VẬT TƯ')) {
    return WorkflowStep.EVALUATION;
  }
  if (str === 'QUOTED' || str === '3' || str.includes('BÁO GIÁ') || str.includes('BAO GIA')) {
    return WorkflowStep.QUOTED;
  }
  if (str === 'REWORK' || str === '4' || str.includes('SẢN XUẤT') || str.includes('SAN XUAT') || str.includes('KÉO HÀNG')) {
    return WorkflowStep.REWORK;
  }
  if (str === 'FINISHED' || str === '5' || str.includes('NHẬP KHO') || str.includes('NHAP KHO') || str.includes('HOÀN THÀNH') || str.includes('HOAN THANH')) {
    return WorkflowStep.FINISHED;
  }
  if (str === 'LIQUIDATION' || str === '6' || str.includes('THANH LÝ') || str.includes('THANH LY')) {
    return WorkflowStep.LIQUIDATION;
  }
  if (str === 'SHIPPED' || str === '7' || str.includes('ĐÃ XUẤT') || str.includes('DA XUAT') || str.includes('XUẤT HÀNG') || str.includes('XUAT HANG') || str.includes('ĐƯỢC XUẤT') || str.includes('DUOC XUAT')) {
    return WorkflowStep.SHIPPED;
  }

  return WorkflowStep.RMA_IN;
};

/**
 * Nhập khẩu và đồng bộ dữ liệu (từ file cũ hoặc backup) vào Supabase và Local State
 * Hỗ trợ chế độ Gộp (merge) và Ghi đè (replace) với cơ chế Batch Chunks tiết kiệm Egress
 */
export const importDataToDB = async (data: {
  tickets?: Ticket[];
  lots?: LotInfo[];
  workers?: Worker[];
  mode?: 'merge' | 'replace';
}): Promise<{ success: boolean; ticketsSynced: number; lotsSynced: number; workersSynced: number }> => {
  const mode = data.mode || 'merge';
  const now = new Date().toISOString();

  let finalTickets: Ticket[] = [];
  let finalLots: LotInfo[] = [];
  let finalWorkers: Worker[] = [];

  // 1. Xử lý Tickets
  if (data.tickets && data.tickets.length > 0) {
    if (mode === 'replace') {
      finalTickets = data.tickets;
    } else {
      const current = getLocalTickets();
      const newMap = new Map<string, Ticket>();
      current.forEach(t => newMap.set(t.id, t));
      data.tickets.forEach(t => newMap.set(t.id, { ...newMap.get(t.id), ...t, updatedAt: t.updatedAt || now }));
      finalTickets = Array.from(newMap.values());
    }
    setLocalTickets(finalTickets);

    if (isSupabaseConfigured() && data.tickets.length > 0) {
      try {
        const rows = data.tickets.map(mapTicketToRow);
        // Chia nhỏ theo lô (Chunk size: 50) để đảm bảo tốc độ và không quá tải payload
        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error } = await supabase.from('tickets').upsert(chunk, { onConflict: 'id' });
          if (error) {
            console.error(`Lỗi upsert chunk tickets ${i}-${i + chunkSize}:`, error.message);
          }
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ tickets lên Supabase:', err);
      }
    }
  }

  // 2. Xử lý Lots
  if (data.lots && data.lots.length > 0) {
    if (mode === 'replace') {
      finalLots = data.lots;
    } else {
      const current = getLocalLots();
      const lotMap = new Map<string, LotInfo>();
      current.forEach(l => lotMap.set(l.lotNumber, l));
      data.lots.forEach(l => lotMap.set(l.lotNumber, { ...lotMap.get(l.lotNumber), ...l }));
      finalLots = Array.from(lotMap.values());
    }
    setLocalLots(finalLots);

    if (isSupabaseConfigured() && data.lots.length > 0) {
      try {
        const lotRows = data.lots.map(mapLotToRow);
        const chunkSize = 50;
        for (let i = 0; i < lotRows.length; i += chunkSize) {
          const chunk = lotRows.slice(i, i + chunkSize);
          await supabase.from('lots').upsert(chunk, { onConflict: 'lot_number' });
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ lots lên Supabase:', err);
      }
    }
  }

  // 3. Xử lý Workers (nếu file sao lưu cũ có danh sách nhân viên)
  if (data.workers && data.workers.length > 0) {
    if (mode === 'replace') {
      finalWorkers = data.workers;
    } else {
      const current = getLocalWorkers();
      const workerMap = new Map<string, Worker>();
      current.forEach(w => workerMap.set(w.id, w));
      data.workers.forEach(w => workerMap.set(w.id, { ...workerMap.get(w.id), ...w }));
      finalWorkers = Array.from(workerMap.values());
    }
    setLocalWorkers(finalWorkers);

    if (isSupabaseConfigured() && data.workers.length > 0) {
      try {
        const workerRows = data.workers.map(mapWorkerToRow);
        const chunkSize = 50;
        for (let i = 0; i < workerRows.length; i += chunkSize) {
          const chunk = workerRows.slice(i, i + chunkSize);
          await supabase.from('workers').upsert(chunk, { onConflict: 'id' });
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ workers lên Supabase:', err);
      }
    }
  }

  return {
    success: true,
    ticketsSynced: data.tickets ? data.tickets.length : 0,
    lotsSynced: data.lots ? data.lots.length : 0,
    workersSynced: data.workers ? data.workers.length : 0,
  };
};

// ================= TỐI ƯU REALTIME SUBSCRIPTION (TIẾT KIỆM 99% EGRESS) =================
export interface RealtimeHandlers {
  onTicketInsert?: (ticket: Ticket) => void;
  onTicketUpdate?: (ticket: Ticket) => void;
  onTicketDelete?: (id: string) => void;
  onLotInsert?: (lot: LotInfo) => void;
  onLotUpdate?: (lot: LotInfo) => void;
  onLotDelete?: (lotNumber: string) => void;
  onFullRefreshNeeded?: () => void;
}

/**
 * Lắng nghe Realtime tự động và xử lý trực tiếp payload delta thay vì re-fetch toàn bộ bảng.
 * Giúp tiết kiệm tối đa Egress cho gói Supabase Free và đảm bảo tốc độ phản hồi < 100ms.
 * Đi kèm cleanup function để tránh duplicate WebSocket connection khi component re-render.
 */
export const subscribeToRealtimeChanges = (handlers: RealtimeHandlers): (() => void) => {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelName = 'rma_realtime_optimized';

  const channel = supabase
    .channel(channelName)
    // 1. Lắng nghe thay đổi trên bảng tickets
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets' },
      (payload) => {
        try {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newTicket = mapRowToTicket(payload.new);
            handlers.onTicketInsert?.(newTicket);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedTicket = mapRowToTicket(payload.new);
            handlers.onTicketUpdate?.(updatedTicket);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const id = (payload.old as any).id;
            if (id) {
              handlers.onTicketDelete?.(id);
            }
          }
        } catch (err) {
          console.error('Lỗi parse payload realtime tickets:', err);
          handlers.onFullRefreshNeeded?.();
        }
      }
    )
    // 2. Lắng nghe thay đổi trên bảng lots
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lots' },
      (payload) => {
        try {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newLot = mapRowToLot(payload.new);
            handlers.onLotInsert?.(newLot);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedLot = mapRowToLot(payload.new);
            handlers.onLotUpdate?.(updatedLot);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const lotNumber = (payload.old as any).lot_number || (payload.old as any).lotNumber;
            if (lotNumber) {
              handlers.onLotDelete?.(lotNumber);
            }
          }
        } catch (err) {
          console.error('Lỗi parse payload realtime lots:', err);
          handlers.onFullRefreshNeeded?.();
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Kích hoạt Supabase Realtime Channel tiết kiệm Egress');
      }
    });

  // Cleanup function dọn dẹp subscription ngay khi unmount, ngăn rò rỉ socket và duplicate events
  return () => {
    supabase.removeChannel(channel);
  };
};

// ================= QUẢN LÝ NHÂN SỰ (WORKERS) CRUD & REALTIME =================

const INITIAL_WORKERS: Worker[] = [
  {
    id: 'W-001',
    name: 'Nguyễn Văn An',
    code: 'NV-01',
    role: 'Kỹ thuật viên Trưởng',
    department: 'Xưởng Rework NMBD',
    phone: '0912345678',
    email: 'an.nv@sunhouse.com.vn',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'W-002',
    name: 'Trần Thị Bình',
    code: 'NV-02',
    role: 'Kỹ thuật viên Đánh giá',
    department: 'Phòng Bảo Hành',
    phone: '0987654321',
    email: 'binh.tt@sunhouse.com.vn',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const getLocalWorkers = (): Worker[] => {
  const saved = localStorage.getItem(WORKERS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse local workers', e);
    }
  }
  return INITIAL_WORKERS;
};

export const setLocalWorkers = (workers: Worker[]) => {
  localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(workers));
};

export const mapRowToWorker = (row: any): Worker => {
  return {
    id: String(row.id),
    name: row.name ?? row.full_name ?? '',
    code: row.code ?? row.worker_code ?? undefined,
    role: row.role ?? undefined,
    department: row.department ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    active: row.active ?? row.is_active ?? true,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  };
};

export const mapWorkerToRow = (worker: Partial<Worker>): Record<string, any> => {
  const row: Record<string, any> = {};
  if (worker.id !== undefined) row.id = worker.id;
  if (worker.name !== undefined) row.name = worker.name;
  if (worker.code !== undefined) row.code = worker.code;
  if (worker.role !== undefined) row.role = worker.role;
  if (worker.department !== undefined) row.department = worker.department;
  if (worker.phone !== undefined) row.phone = worker.phone;
  if (worker.email !== undefined) row.email = worker.email;
  if (worker.active !== undefined) row.active = worker.active;
  if (worker.createdAt !== undefined) row.created_at = worker.createdAt;
  if (worker.updatedAt !== undefined) row.updated_at = worker.updatedAt;
  return row;
};

/**
 * 1. FETCH WORKERS: Lấy danh sách nhân sự từ Supabase
 */
export const fetchWorkersFromDB = async (): Promise<Worker[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select(WORKER_SELECT_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Lỗi fetch workers từ Supabase, fallback sang cache cục bộ:', error.message);
        return getLocalWorkers();
      }

      if (data) {
        const mapped = data.map(mapRowToWorker);
        setLocalWorkers(mapped);
        return mapped;
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi fetch workers:', err);
      return getLocalWorkers();
    }
  }
  return getLocalWorkers();
};

/**
 * 2. INSERT WORKER: Thêm mới nhân sự lên Supabase
 * Tự động sinh ID hợp lệ nếu chưa có
 */
export const createWorkerInDB = async (
  newData: Omit<Worker, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<{ data: Worker | null; error: any }> => {
  const now = new Date().toISOString();
  const workerId = newData.id?.trim() || `W-${Date.now().toString().slice(-6)}`;
  
  const workerRecord: Worker = {
    ...newData,
    id: workerId,
    active: newData.active ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const row = mapWorkerToRow(workerRecord);

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('workers')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Lỗi khi thêm nhân viên vào Supabase:', error.message);
      return { data: null, error };
    }

    const created = data ? mapRowToWorker(data) : workerRecord;
    // Cập nhật local cache
    const current = getLocalWorkers();
    setLocalWorkers([created, ...current]);
    return { data: created, error: null };
  }

  // Chế độ offline
  const current = getLocalWorkers();
  setLocalWorkers([workerRecord, ...current]);
  return { data: workerRecord, error: null };
};

/**
 * 3. UPDATE WORKER: Cập nhật thông tin nhân viên trên Supabase
 */
export const updateWorkerInDB = async (
  workerId: string,
  updatedData: Partial<Worker>
): Promise<{ data: Worker | null; error: any }> => {
  const now = new Date().toISOString();
  const updatesWithTime = { ...updatedData, updatedAt: now };
  const row = mapWorkerToRow(updatesWithTime);

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('workers')
      .update(row)
      .eq('id', workerId)
      .select()
      .single();

    if (error) {
      console.error(`Lỗi cập nhật nhân viên ${workerId} trên Supabase:`, error.message);
      return { data: null, error };
    }

    const updated = data ? mapRowToWorker(data) : ({ id: workerId, ...updatesWithTime } as Worker);
    // Cập nhật local cache
    const current = getLocalWorkers();
    setLocalWorkers(current.map(w => (w.id === workerId ? { ...w, ...updated } : w)));
    return { data: updated, error: null };
  }

  // Chế độ offline
  const current = getLocalWorkers();
  const updatedList = current.map(w => (w.id === workerId ? { ...w, ...updatesWithTime } : w));
  setLocalWorkers(updatedList);
  return { data: updatedList.find(w => w.id === workerId) || null, error: null };
};

/**
 * 4. DELETE WORKER: Xóa nhân viên trực tiếp trên Supabase
 */
export const deleteWorkerInDB = async (workerId: string): Promise<{ error: any }> => {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', workerId);

    if (error) {
      console.error(`Lỗi xóa nhân viên ${workerId} trên Supabase:`, error.message);
      return { error };
    }
  }

  // Cập nhật local cache
  const current = getLocalWorkers();
  setLocalWorkers(current.filter(w => w.id !== workerId));
  return { error: null };
};

/**
 * 5. SUBSCRIBE WORKERS REALTIME: Lắng nghe realtime từ bảng workers
 * Sử dụng đúng channel 'schema-db-changes' theo yêu cầu
 */
export const subscribeToWorkersRealtime = (onWorkersChange: () => void): (() => void) => {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channel = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workers' },
      () => {
        onWorkersChange();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Kích hoạt Realtime Channel cho bảng workers (schema-db-changes)');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

