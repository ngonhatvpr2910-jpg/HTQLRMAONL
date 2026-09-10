export interface DowntimeReport {
  id: string;
  date: string; // YYYY-MM-DD
  shift: 'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca HC';
  line: string; // e.g., "Line A1", "Line A2", etc.
  equipment: string; // Tên máy / công đoạn bị dừng (e.g., "Máy đùn", "Băng tải")
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  duration: number; // Thời gian dừng (phút), tính tự động hoặc nhập vào
  reasonCategory: ReasonCategory;
  details: string; // Chi tiết sự cố / nguyên nhân cụ thể
  solution: string; // Biện pháp khắc phục
  pic: string; // Người chịu trách nhiệm / Báo cáo
  status: 'Đang xử lý' | 'Đã khắc phục';
  createdAt: string;
  productName: string; // Sản phẩm đang sản xuất
  productUnitPrice: number; // Đơn giá sản phẩm (VNĐ)
  standardRate: number; // Năng suất tiêu chuẩn (sản phẩm/giờ)
}

export type ReasonCategory =
  | 'Con người'
  | 'Máy móc/Thiết bị'
  | 'Nguyên vật liệu'
  | 'Phương pháp/Quy trình';

export interface DowntimeFilters {
  startDate: string;
  endDate: string;
  line: string;
  reasonCategory: string;
  status: string;
  search: string;
}

export interface KPIStats {
  totalDowntime: number; // Tổng phút dừng
  totalIncidents: number; // Tổng số vụ dừng Line
  averageDuration: number; // Thời gian dừng trung bình mỗi vụ (MTTR)
  mostAffectedLine: {
    name: string;
    duration: number;
  };
  mostCommonReason: {
    category: ReasonCategory | '';
    count: number;
  };
}

export interface Worker {
  id: string;
  worker_code?: string;
  full_name?: string;
  name: string;
  code?: string;
  department?: string;
  role?: string;
  phone?: string;
  status?: 'Đang làm việc' | 'Nghỉ phép' | 'Đã nghỉ' | string;
  created_at?: string;
}
