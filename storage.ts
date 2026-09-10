import { DowntimeReport, ReasonCategory, Worker } from './types';
import { Product, INITIAL_DOWNTIME_REPORTS, PRODUCTS, INITIAL_WORKERS } from './data';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const LOCAL_STORAGE_REPORTS_KEY = 'sunhouse_downtime_reports';
const LOCAL_STORAGE_PRODUCTS_KEY = 'sunhouse_products';
const LOCAL_STORAGE_WORKERS_KEY = 'sunhouse_workers';

// ============================================================================
// TỐI ƯU HÓA EGRESS: Chỉ định đích danh các cột cần thiết cho giao diện
// Tuyệt đối không dùng SELECT * để tiết kiệm tối đa băng thông cho gói Free.
// ============================================================================
export const DOWNTIME_COLUMNS = 
  'id, date, shift, line, equipment, start_time, end_time, duration, reason_category, details, solution, pic, status, created_at, product_name, product_unit_price, standard_rate' as const;

export const PRODUCT_COLUMNS = 
  'name, line, unit_price, standard_rate' as const;

export const WORKER_COLUMNS = 
  'id, worker_code, full_name, department, status' as const;

// Bản đồ chuyển đổi các nhóm nguyên nhân cũ sang mô hình 4M chuẩn hóa
const OLD_CATEGORY_MAP: Record<string, ReasonCategory> = {
  'Sự cố máy móc/thiết bị': 'Máy móc/Thiết bị',
  'Thiếu nguyên vật liệu': 'Nguyên vật liệu',
  'Thay đổi mã hàng/Gá đặt': 'Phương pháp/Quy trình',
  'Chờ kiểm tra chất lượng': 'Phương pháp/Quy trình',
  'Sự cố vận hành/Nhân sự': 'Con người',
  'Sự cố điện/nước/khí nén': 'Máy móc/Thiết bị',
  'Lý do khác': 'Con người',
};

export const normalizeReasonCategory = (category: string): ReasonCategory => {
  if (OLD_CATEGORY_MAP[category]) {
    return OLD_CATEGORY_MAP[category];
  }
  const valid: ReasonCategory[] = [
    'Con người',
    'Máy móc/Thiết bị',
    'Nguyên vật liệu',
    'Phương pháp/Quy trình',
  ];
  if (valid.includes(category as ReasonCategory)) {
    return category as ReasonCategory;
  }
  return 'Máy móc/Thiết bị';
};

// ==========================================
// DATA CONVERSION HELPERS (Database <-> Model)
// ==========================================

export const mapDbRowToReport = (row: any): DowntimeReport => {
  return {
    id: String(row.id),
    date: String(row.date || new Date().toISOString().split('T')[0]),
    shift: row.shift || 'Ca 1',
    line: row.line || 'Dây chuyền LR RO',
    equipment: row.equipment || '',
    startTime: row.start_time ?? row.startTime ?? '00:00',
    endTime: row.end_time ?? row.endTime ?? '00:00',
    duration: Number(row.duration || 0),
    reasonCategory: normalizeReasonCategory(row.reason_category ?? row.reasonCategory ?? ''),
    details: row.details || '',
    solution: row.solution || '',
    pic: row.pic || '',
    status: row.status === 'Đang xử lý' ? 'Đang xử lý' : 'Đã khắc phục',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    productName: row.product_name ?? row.productName ?? '',
    productUnitPrice: Number(row.product_unit_price ?? row.productUnitPrice ?? 0),
    standardRate: Number(row.standard_rate ?? row.standardRate ?? 0),
  };
};

export const mapReportToDbRow = (report: Partial<DowntimeReport>) => {
  const row: Record<string, any> = {};
  if (report.id !== undefined) row.id = report.id;
  if (report.date !== undefined) row.date = report.date;
  if (report.shift !== undefined) row.shift = report.shift;
  if (report.line !== undefined) row.line = report.line;
  if (report.equipment !== undefined) row.equipment = report.equipment;
  if (report.startTime !== undefined) row.start_time = report.startTime;
  if (report.endTime !== undefined) row.end_time = report.endTime;
  if (report.duration !== undefined) row.duration = report.duration;
  if (report.reasonCategory !== undefined) row.reason_category = report.reasonCategory;
  if (report.details !== undefined) row.details = report.details;
  if (report.solution !== undefined) row.solution = report.solution;
  if (report.pic !== undefined) row.pic = report.pic;
  if (report.status !== undefined) row.status = report.status;
  if (report.createdAt !== undefined) row.created_at = report.createdAt;
  if (report.productName !== undefined) row.product_name = report.productName;
  if (report.productUnitPrice !== undefined) row.product_unit_price = report.productUnitPrice;
  if (report.standardRate !== undefined) row.standard_rate = report.standardRate;
  return row;
};

export const mapDbRowToProduct = (row: any): Product => {
  return {
    name: String(row.name || ''),
    line: row.line || 'Dây chuyền LR RO',
    unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
    standardRate: Number(row.standard_rate ?? row.standardRate ?? 0),
  };
};

export const mapProductToDbRow = (product: Product) => {
  return {
    name: product.name,
    line: product.line,
    unit_price: product.unitPrice,
    standard_rate: product.standardRate,
  };
};

// ==========================================
// LOCAL STORAGE CACHE HELPERS (Dự phòng offline)
// ==========================================

const getLocalReports = (): DowntimeReport[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
    if (!raw) return INITIAL_DOWNTIME_REPORTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(mapDbRowToReport) : INITIAL_DOWNTIME_REPORTS;
  } catch {
    return INITIAL_DOWNTIME_REPORTS;
  }
};

const setLocalReports = (reports: DowntimeReport[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    console.warn('Không thể lưu reports vào localStorage:', e);
  }
};

const getLocalProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (!raw) return PRODUCTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(mapDbRowToProduct) : PRODUCTS;
  } catch {
    return PRODUCTS;
  }
};

const setLocalProducts = (products: Product[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    console.warn('Không thể lưu products vào localStorage:', e);
  }
};

export const mapDbRowToWorker = (row: any): Worker => {
  const full_name = String(row.full_name || row.name || '');
  const worker_code = String(row.worker_code || row.code || '');
  return {
    id: String(row.id || ''),
    worker_code,
    full_name,
    name: full_name,
    code: worker_code,
    department: String(row.department || 'Dây chuyền LR RO'),
    role: row.role || 'Kỹ thuật viên',
    phone: row.phone || '',
    status: row.status || 'Đang làm việc',
    created_at: row.created_at || new Date().toISOString(),
  };
};

export const mapWorkerToDbRow = (worker: Partial<Worker>) => {
  const row: Record<string, any> = {};
  if (worker.id !== undefined) row.id = worker.id;
  if (worker.worker_code !== undefined) row.worker_code = worker.worker_code;
  else if (worker.code !== undefined) row.worker_code = worker.code;

  if (worker.full_name !== undefined) row.full_name = worker.full_name;
  else if (worker.name !== undefined) row.full_name = worker.name;

  if (worker.department !== undefined) row.department = worker.department;
  if (worker.status !== undefined) row.status = worker.status;
  return row;
};

const getLocalWorkers = (): Worker[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_WORKERS_KEY);
    if (!raw) return INITIAL_WORKERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(mapDbRowToWorker) : INITIAL_WORKERS;
  } catch {
    return INITIAL_WORKERS;
  }
};

const setLocalWorkers = (workers: Worker[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_WORKERS_KEY, JSON.stringify(workers));
  } catch (e) {
    console.warn('Không thể lưu workers vào localStorage:', e);
  }
};

// ============================================================================
// ASYNC DOWNTIME REPORTS CRUD (Tối ưu hóa Egress với .select() cụ thể và .limit(100))
// ============================================================================

/**
 * Lấy danh sách báo cáo dừng Line gần nhất từ Supabase.
 * MẶC ĐỊNH GIỚI HẠN .limit(100) để tiết kiệm tối đa Egress cho gói Supabase Free,
 * không load hàng ngàn bản ghi cũ không cần thiết về máy trạm.
 */
export async function fetchReports(limit: number = 100): Promise<DowntimeReport[]> {
  if (!isSupabaseConfigured) {
    return getLocalReports().slice(0, limit);
  }

  try {
    let query = supabase
      .from('downtime_reports')
      .select(DOWNTIME_COLUMNS)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false });

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Lỗi khi truy vấn Supabase downtime_reports, sử dụng bộ nhớ cục bộ:', error.message);
      return getLocalReports().slice(0, limit);
    }

    if (!data || data.length === 0) {
      const local = getLocalReports();
      if (local.length > 0) {
        await bulkImportReports(local).catch(() => {});
        return local.slice(0, limit);
      }
      return [];
    }

    const formatted = data.map(mapDbRowToReport);
    setLocalReports(formatted);
    return formatted;
  } catch (err) {
    console.error('Lỗi ngoại lệ khi fetchReports:', err);
    return getLocalReports().slice(0, limit);
  }
}

/**
 * Lấy toàn bộ báo cáo khi cần Export Backup Excel toàn diện hệ thống
 */
export async function fetchAllReportsForBackup(): Promise<DowntimeReport[]> {
  return fetchReports(0); // 0 = Không giới hạn limit để backup đầy đủ
}

/**
 * Thêm mới một báo cáo dừng Line
 * Chỉ SELECT lại đúng các cột giao diện cần thiết
 */
export async function addReport(
  formData: Omit<DowntimeReport, 'id' | 'createdAt'> & { id?: string }
): Promise<DowntimeReport> {
  const newReport: DowntimeReport = {
    ...formData,
    id: formData.id || `dt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    createdAt: new Date().toISOString(),
    reasonCategory: normalizeReasonCategory(formData.reasonCategory),
  };

  if (!isSupabaseConfigured) {
    const current = getLocalReports();
    const updated = [newReport, ...current];
    setLocalReports(updated);
    return newReport;
  }

  try {
    const dbPayload = mapReportToDbRow(newReport);
    // TỐI ƯU EGRESS: Không dùng .select() để Supabase không gửi ngược dữ liệu về client
    const { error } = await supabase
      .from('downtime_reports')
      .insert([dbPayload]);

    if (error) {
      console.error('Lỗi Supabase addReport:', error);
      throw error;
    }

    const current = getLocalReports().filter((r) => r.id !== newReport.id);
    setLocalReports([newReport, ...current]);
    return newReport;
  } catch (err) {
    const current = getLocalReports();
    setLocalReports([newReport, ...current]);
    throw err;
  }
}

/**
 * Cập nhật báo cáo dừng Line đã có
 * TỐI ƯU EGRESS: Không dùng .select() để tiết kiệm băng thông tối đa
 */
export async function updateReport(report: DowntimeReport): Promise<DowntimeReport> {
  const updatedReport: DowntimeReport = {
    ...report,
    reasonCategory: normalizeReasonCategory(report.reasonCategory),
  };

  if (!isSupabaseConfigured) {
    const current = getLocalReports().map((r) => (r.id === updatedReport.id ? updatedReport : r));
    setLocalReports(current);
    return updatedReport;
  }

  try {
    const dbPayload = mapReportToDbRow(updatedReport);
    const { error } = await supabase
      .from('downtime_reports')
      .update(dbPayload)
      .eq('id', updatedReport.id);

    if (error) {
      console.error('Lỗi Supabase updateReport:', error);
      throw error;
    }

    const current = getLocalReports().map((r) => (r.id === updatedReport.id ? updatedReport : r));
    setLocalReports(current);
    return updatedReport;
  } catch (err) {
    const current = getLocalReports().map((r) => (r.id === updatedReport.id ? updatedReport : r));
    setLocalReports(current);
    throw err;
  }
}

/**
 * Xóa một báo cáo dừng Line theo ID
 */
export async function deleteReport(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const current = getLocalReports().filter((r) => r.id !== id);
    setLocalReports(current);
    return;
  }

  try {
    const { error } = await supabase
      .from('downtime_reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Lỗi Supabase deleteReport:', error);
      throw error;
    }

    const current = getLocalReports().filter((r) => r.id !== id);
    setLocalReports(current);
  } catch (err) {
    const current = getLocalReports().filter((r) => r.id !== id);
    setLocalReports(current);
    throw err;
  }
}

/**
 * Xóa hàng loạt báo cáo dừng Line theo danh sách IDs
 */
export async function deleteMultipleReports(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  if (!isSupabaseConfigured) {
    const current = getLocalReports().filter((r) => !ids.includes(r.id));
    setLocalReports(current);
    return;
  }

  try {
    const { error } = await supabase
      .from('downtime_reports')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Lỗi Supabase deleteMultipleReports:', error);
      throw error;
    }

    const current = getLocalReports().filter((r) => !ids.includes(r.id));
    setLocalReports(current);
  } catch (err) {
    const current = getLocalReports().filter((r) => !ids.includes(r.id));
    setLocalReports(current);
    throw err;
  }
}

/**
 * Đặt lại dữ liệu báo cáo về mặc định ban đầu
 */
export async function resetReportsToDefault(
  initialReports: DowntimeReport[] = INITIAL_DOWNTIME_REPORTS
): Promise<DowntimeReport[]> {
  setLocalReports(initialReports);

  if (!isSupabaseConfigured) {
    return initialReports;
  }

  try {
    await supabase.from('downtime_reports').delete().neq('id', '___NEVER_MATCH___');
    await bulkImportReports(initialReports);
    return initialReports;
  } catch (err) {
    console.warn('Lỗi resetReportsToDefault trên Supabase:', err);
    return initialReports;
  }
}

/**
 * Lưu danh sách báo cáo hàng loạt (dùng khi Import Excel / Restore)
 * TỐI ƯU EGRESS: Không dùng .select(), xử lý theo từng khối 50 bản ghi
 */
export async function bulkImportReports(reports: DowntimeReport[]): Promise<void> {
  const normalized = reports.map((r) => ({
    ...r,
    reasonCategory: normalizeReasonCategory(r.reasonCategory),
  }));

  setLocalReports(normalized);

  if (!isSupabaseConfigured || normalized.length === 0) {
    return;
  }

  try {
    const rows = normalized.map(mapReportToDbRow);
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('downtime_reports')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.error('Lỗi Supabase bulkImportReports chunk:', error);
        throw error;
      }
    }
  } catch (err) {
    console.error('Ngoại lệ khi bulkImportReports:', err);
    throw err;
  }
}

// ============================================================================
// ASYNC PRODUCTS CRUD (Tối ưu hóa Egress - Thêm, Sửa, Xóa, Import)
// ============================================================================

/**
 * Lấy danh sách sản phẩm và định mức
 * Chỉ SELECT đúng: name, line, unit_price, standard_rate
 */
export async function fetchProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured) {
    return getLocalProducts();
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Lỗi khi truy vấn Supabase products:', error.message);
      return getLocalProducts();
    }

    if (!data || data.length === 0) {
      const local = getLocalProducts();
      if (local.length > 0) {
        await saveProducts(local).catch(() => {});
        return local;
      }
      return PRODUCTS;
    }

    const formatted = data.map(mapDbRowToProduct);
    setLocalProducts(formatted);
    return formatted;
  } catch (err) {
    console.error('Lỗi fetchProducts:', err);
    return getLocalProducts();
  }
}

/**
 * Thêm mới 1 sản phẩm lên Supabase
 * TỐI ƯU EGRESS: Không dùng .select()
 */
export async function addProduct(product: Product): Promise<Product> {
  const cleanProduct: Product = {
    ...product,
    name: product.name.trim(),
    unitPrice: Number(product.unitPrice) || 0,
    standardRate: Number(product.standardRate) || 0,
  };

  if (isSupabaseConfigured) {
    const row = mapProductToDbRow(cleanProduct);
    const { error } = await supabase
      .from('products')
      .insert([row]);

    if (error) {
      console.error('Lỗi Supabase addProduct:', error);
      throw error;
    }
  }

  const current = getLocalProducts().filter((p) => p.name !== cleanProduct.name);
  setLocalProducts([cleanProduct, ...current]);
  return cleanProduct;
}

/**
 * Cập nhật thông tin 1 sản phẩm trên Supabase
 * TỐI ƯU EGRESS: Không dùng .select()
 */
export async function updateProduct(oldName: string, product: Product): Promise<Product> {
  const cleanProduct: Product = {
    ...product,
    name: product.name.trim(),
    unitPrice: Number(product.unitPrice) || 0,
    standardRate: Number(product.standardRate) || 0,
  };

  if (isSupabaseConfigured) {
    const row = mapProductToDbRow(cleanProduct);
    if (oldName === cleanProduct.name) {
      const { error } = await supabase
        .from('products')
        .update(row)
        .eq('name', oldName);
      if (error) {
        console.error('Lỗi Supabase updateProduct:', error);
        throw error;
      }
    } else {
      // Trường hợp đổi tên sản phẩm (Primary key)
      const { error: insError } = await supabase
        .from('products')
        .insert([row]);
      if (insError) throw insError;

      await supabase
        .from('products')
        .delete()
        .eq('name', oldName);
    }
  }

  const current = getLocalProducts().map((p) => (p.name === oldName ? cleanProduct : p));
  setLocalProducts(current);
  return cleanProduct;
}

/**
 * Xóa 1 sản phẩm khỏi Supabase
 * TỐI ƯU EGRESS: Xóa theo khóa chính name
 */
export async function deleteProduct(name: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('name', name);

    if (error) {
      console.error('Lỗi Supabase deleteProduct:', error);
      throw error;
    }
  }

  const current = getLocalProducts().filter((p) => p.name !== name);
  setLocalProducts(current);
}

/**
 * Lưu/Cập nhật danh sách sản phẩm hàng loạt (dùng khi Import Excel)
 * TỐI ƯU EGRESS: Không dùng .select(), xử lý theo khối 50 bản ghi
 */
export async function saveProducts(products: Product[]): Promise<void> {
  setLocalProducts(products);

  if (!isSupabaseConfigured || products.length === 0) {
    return;
  }

  try {
    const rows = products.map(mapProductToDbRow);
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('products')
        .upsert(chunk, { onConflict: 'name' });

      if (error) {
        console.error('Lỗi Supabase saveProducts chunk:', error);
        throw error;
      }
    }
  } catch (err) {
    console.error('Ngoại lệ khi saveProducts:', err);
    throw err;
  }
}

/**
 * Đặt lại danh mục sản phẩm về mặc định Sunhouse
 */
export async function resetProductsToDefault(
  defaultProducts: Product[] = PRODUCTS
): Promise<Product[]> {
  setLocalProducts(defaultProducts);

  if (!isSupabaseConfigured) {
    return defaultProducts;
  }

  try {
    await supabase.from('products').delete().neq('name', '___NEVER_MATCH___');
    await saveProducts(defaultProducts);
    return defaultProducts;
  } catch (err) {
    console.warn('Lỗi resetProductsToDefault trên Supabase:', err);
    return defaultProducts;
  }
}

// ============================================================================
// TỐI ƯU REALTIME SUBSCRIPTIONS (Báo Cáo, Sản Phẩm, Nhân Sự)
// 1. Delta updates: Dùng trực tiếp payload.new / payload.old mà KHÔNG re-fetch
// 2. Tiết kiệm 100% Egress cho mọi sự kiện Thêm, Sửa, Xóa, Upfile Excel
// ============================================================================

export type RealtimeReportEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new?: DowntimeReport;
  oldId?: string;
};

/**
 * Lắng nghe thay đổi dữ liệu realtime trên bảng downtime_reports
 */
export function subscribeToReports(
  onDataChange: (event: RealtimeReportEvent) => void
): { unsubscribe: () => void } & (() => void) {
  if (!isSupabaseConfigured) {
    const noop = () => {};
    (noop as any).unsubscribe = noop;
    return noop as any;
  }

  const channelId = `realtime_downtime_reports_${Date.now()}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'downtime_reports' 
      },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        const newRecord = payload.new && Object.keys(payload.new).length > 0 
          ? mapDbRowToReport(payload.new) 
          : undefined;
        const oldId = (payload.old as any)?.id ? String((payload.old as any).id) : undefined;

        onDataChange({
          eventType,
          new: newRecord,
          oldId,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug('[Supabase Realtime] Đã kết nối kênh downtime_reports');
      }
    });

  const cleanup = () => {
    supabase.removeChannel(channel);
  };
  (cleanup as any).unsubscribe = cleanup;
  return cleanup as any;
}

export type RealtimeProductEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new?: Product;
  old?: { name?: string };
};

/**
 * Lắng nghe thay đổi dữ liệu realtime trên bảng products
 * TỐI ƯU EGRESS: Cập nhật delta state trực tiếp, không re-fetch
 */
export function subscribeToProducts(
  onDataChange: (event: RealtimeProductEvent) => void
): { unsubscribe: () => void } & (() => void) {
  if (!isSupabaseConfigured) {
    const noop = () => {};
    (noop as any).unsubscribe = noop;
    return noop as any;
  }

  const channelId = `realtime_products_${Date.now()}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
      },
      (payload) => {
        const newRecord =
          payload.new && Object.keys(payload.new).length > 0
            ? mapDbRowToProduct(payload.new)
            : undefined;

        onDataChange({
          eventType: payload.eventType,
          new: newRecord,
          old: payload.old as { name?: string },
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug('[Supabase Realtime] Đã kết nối kênh products');
      }
    });

  const cleanup = () => {
    supabase.removeChannel(channel);
  };
  (cleanup as any).unsubscribe = cleanup;
  return cleanup as any;
}

// ============================================================================
// ASYNC WORKERS CRUD & REALTIME (Quản lý Nhân sự / Kỹ thuật viên kết nối Supabase)
// ============================================================================

export type RealtimeWorkerEvent = {
  eventType: string;
  new?: Worker;
  old?: { id?: string };
};

/**
 * Lấy danh sách nhân sự từ Supabase
 * TỐI ƯU EGRESS: Chỉ select đúng 5 cột cần thiết cho bảng hiển thị
 */
export async function fetchWorkers(limit: number = 100): Promise<Worker[]> {
  if (!isSupabaseConfigured) {
    return getLocalWorkers().slice(0, limit);
  }

  try {
    let query = supabase
      .from('workers')
      .select('id, worker_code, full_name, department, status');

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Lỗi khi truy vấn Supabase workers:', error.message);
      return getLocalWorkers().slice(0, limit);
    }

    if (!data || data.length === 0) {
      const local = getLocalWorkers();
      return local.slice(0, limit);
    }

    const formatted = data.map(mapDbRowToWorker);
    setLocalWorkers(formatted);
    return formatted;
  } catch (err) {
    console.error('Lỗi ngoại lệ khi fetchWorkers:', err);
    return getLocalWorkers().slice(0, limit);
  }
}

/**
 * THÊM MỚI (INSERT):
 * Gọi trực tiếp supabase.from('workers').insert([data])
 * Không dùng .select() để tiết kiệm băng thông egress
 */
export async function addWorker(
  workerData: Partial<Worker> & { id?: string }
): Promise<Worker> {
  const newId = workerData.id || `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const workerCode = workerData.worker_code || workerData.code || `SH-${Math.floor(1000 + Math.random() * 9000)}`;
  const fullName = workerData.full_name || workerData.name || '';

  const newWorker: Worker = {
    ...workerData,
    id: newId,
    worker_code: workerCode,
    full_name: fullName,
    code: workerCode,
    name: fullName,
    department: workerData.department || 'Dây chuyền LR RO',
    status: workerData.status || 'Đang làm việc',
  };

  const dbPayload = mapWorkerToDbRow(newWorker);

  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('workers')
      .insert([dbPayload]);

    if (error) {
      console.error('Lỗi Supabase addWorker:', error);
      throw new Error(error.message || 'Lỗi khi thêm nhân viên lên Supabase');
    }
  }

  const current = getLocalWorkers().filter((w) => w.id !== newId);
  setLocalWorkers([newWorker, ...current]);
  return newWorker;
}

/**
 * SỬA / CẬP NHẬT (UPDATE):
 * Gọi trực tiếp supabase.from('workers').update(data).eq('id', id)
 */
export async function updateWorker(
  id: string, 
  data: Partial<Worker>
): Promise<Worker> {
  const dbPayload = mapWorkerToDbRow(data);

  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('workers')
      .update(dbPayload)
      .eq('id', id);

    if (error) {
      console.error('Lỗi Supabase updateWorker:', error);
      throw new Error(error.message || 'Lỗi khi cập nhật nhân viên trên Supabase');
    }
  }

  const current = getLocalWorkers();
  const index = current.findIndex((w) => w.id === id);
  const fullName = data.full_name || data.name || (index >= 0 ? current[index].full_name : '');
  const workerCode = data.worker_code || data.code || (index >= 0 ? current[index].worker_code : '');

  const updatedWorker: Worker = {
    ...(index >= 0 ? current[index] : ({} as Worker)),
    ...data,
    id,
    full_name: fullName,
    name: fullName || '',
    worker_code: workerCode,
    code: workerCode,
  };

  if (index >= 0) {
    current[index] = updatedWorker;
    setLocalWorkers([...current]);
  }
  return updatedWorker;
}

/**
 * XÓA (DELETE):
 * Gọi trực tiếp supabase.from('workers').delete().eq('id', id)
 */
export async function deleteWorker(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Lỗi Supabase deleteWorker:', error);
      throw new Error(error.message || 'Lỗi khi xóa nhân viên trên Supabase');
    }
  }

  const current = getLocalWorkers().filter((w) => w.id !== id);
  setLocalWorkers(current);
}

/**
 * Lưu danh sách nhân viên hàng loạt (Seeding / Restore)
 */
export async function bulkImportWorkers(workers: Worker[]): Promise<void> {
  setLocalWorkers(workers);

  if (!isSupabaseConfigured || workers.length === 0) {
    return;
  }

  try {
    const rows = workers.map(mapWorkerToDbRow);
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('workers')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.error('Lỗi Supabase bulkImportWorkers chunk:', error);
        throw error;
      }
    }
  } catch (err) {
    console.error('Ngoại lệ khi bulkImportWorkers:', err);
    throw err;
  }
}

/**
 * Đặt lại danh sách nhân sự về mặc định Sunhouse
 */
export async function resetWorkersToDefault(
  initialWorkers: Worker[] = INITIAL_WORKERS
): Promise<Worker[]> {
  setLocalWorkers(initialWorkers);

  if (!isSupabaseConfigured) {
    return initialWorkers;
  }

  try {
    await supabase.from('workers').delete().neq('id', '___NEVER_MATCH___');
    await bulkImportWorkers(initialWorkers);
    return initialWorkers;
  } catch (err) {
    console.warn('Lỗi resetWorkersToDefault trên Supabase:', err);
    return initialWorkers;
  }
}

/**
 * ĐỒNG BỘ REALTIME TỐI ƯU EGRESS:
 * Lắng nghe sự kiện (INSERT, UPDATE, DELETE) và chuyển delta payload trực tiếp.
 * Trả về đối tượng có phương thức .unsubscribe() để cleanup khi component unmount.
 */
export function subscribeToWorkers(
  onEvent: (event: RealtimeWorkerEvent) => void
): { unsubscribe: () => void } {
  if (!isSupabaseConfigured) {
    return {
      unsubscribe: () => {},
    };
  }

  const channel = supabase
    .channel('workers-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workers' },
      (payload) => {
        console.info('[Realtime Workers] Delta event:', payload.eventType);
        const newRecord =
          payload.new && Object.keys(payload.new).length > 0
            ? mapDbRowToWorker(payload.new)
            : undefined;

        onEvent({
          eventType: payload.eventType,
          new: newRecord,
          old: payload.old as { id?: string },
        });
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

