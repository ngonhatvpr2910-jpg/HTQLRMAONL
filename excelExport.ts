import * as XLSX from 'xlsx';
import { DowntimeReport, Worker } from './types';
import { calculateDowntimeCost } from './timeHelpers';
import { Product } from './data';

/**
 * Xuất toàn bộ dữ liệu hệ thống (Báo cáo, Sản phẩm, Nhân sự) ra file Excel để backup
 */
export function exportFullSystemDataToExcel(
  reports: DowntimeReport[], 
  products: Product[],
  workers: Worker[] = []
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Báo cáo dừng Line (Dữ liệu thô để re-import)
  const reportData = reports.map(r => ({
    'ID': r.id,
    'Ngày': r.date,
    'Ca': r.shift,
    'Chuyền': r.line,
    'Thiết bị': r.equipment,
    'Sản phẩm': r.productName,
    'Đơn giá': r.productUnitPrice,
    'Năng suất ĐM': r.standardRate,
    'Bắt đầu': r.startTime,
    'Kết thúc': r.endTime || '',
    'Thời gian': r.duration,
    'Nhóm nguyên nhân': r.reasonCategory,
    'Chi tiết': r.details,
    'Giải pháp': r.solution || '',
    'Người báo cáo': r.pic,
    'Trạng thái': r.status,
    'Ngày tạo': r.createdAt
  }));
  const wsReports = XLSX.utils.json_to_sheet(reportData);
  XLSX.utils.book_append_sheet(wb, wsReports, 'Báo cáo Dừng Line');

  // 2. Sheet Danh mục Sản phẩm
  const productData = products.map(p => ({
    'Tên Sản Phẩm': p.name,
    'Dây Chuyền': p.line,
    'Đơn Giá (VNĐ)': p.unitPrice,
    'Năng Suất Định Mức (SP/Giờ)': p.standardRate
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productData);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Danh mục Sản phẩm');

  // 3. Sheet Danh mục Nhân sự
  if (workers && workers.length > 0) {
    const workerData = workers.map(w => ({
      'ID': w.id,
      'Mã NV': w.worker_code || w.code || '',
      'Họ và Tên': w.full_name || w.name || '',
      'Phòng ban/Chuyền': w.department || '',
      'Chức vụ': w.role || 'Kỹ thuật viên',
      'Số điện thoại': w.phone || '',
      'Trạng thái': w.status || 'Đang làm việc'
    }));
    const wsWorkers = XLSX.utils.json_to_sheet(workerData);
    XLSX.utils.book_append_sheet(wb, wsWorkers, 'Danh mục Nhân sự');
  }

  // 4. Xuất file
  const fileName = `Sao_luu_he_thong_Sunhouse_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Phân tích file Excel backup để lấy lại toàn bộ dữ liệu
 */
export async function importFullSystemDataFromExcel(
  file: File
): Promise<{ reports: DowntimeReport[]; products: Product[]; workers: Worker[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        let reports: DowntimeReport[] = [];
        let products: Product[] = [];
        let workers: Worker[] = [];

        // Đọc sheet Báo cáo
        const wsReports = workbook.Sheets['Báo cáo Dừng Line'];
        if (wsReports) {
          const rawReports = XLSX.utils.sheet_to_json(wsReports) as any[];
          reports = rawReports.map(r => ({
            id: String(r['ID'] || `dt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`),
            date: String(r['Ngày']),
            shift: String(r['Ca']) as any,
            line: String(r['Chuyền']) as any,
            equipment: String(r['Thiết bị'] || ''),
            productName: String(r['Sản phẩm'] || ''),
            productUnitPrice: Number(r['Đơn giá']) || 0,
            standardRate: Number(r['Năng suất ĐM']) || 0,
            startTime: String(r['Bắt đầu'] || ''),
            endTime: r['Kết thúc'] ? String(r['Kết thúc']) : undefined,
            duration: Number(r['Thời gian']) || 0,
            reasonCategory: String(r['Nhóm nguyên nhân']) as any,
            details: String(r['Chi tiết'] || ''),
            solution: r['Giải pháp'] ? String(r['Giải pháp']) : undefined,
            pic: String(r['Người báo cáo'] || ''),
            status: String(r['Trạng thái'] || 'Đã khắc phục') as any,
            createdAt: r['Ngày tạo'] ? String(r['Ngày tạo']) : new Date().toISOString()
          }));
        }

        // Đọc sheet Sản phẩm
        const wsProducts = workbook.Sheets['Danh mục Sản phẩm'];
        if (wsProducts) {
          const rawProducts = XLSX.utils.sheet_to_json(wsProducts) as any[];
          products = rawProducts.map(p => ({
            name: String(p['Tên Sản Phẩm'] || '').trim(),
            line: String(p['Dây Chuyền']) as any,
            unitPrice: Number(p['Đơn Giá (VNĐ)']) || 0,
            standardRate: Number(p['Năng Suất Định Mức (SP/Giờ)']) || 0
          })).filter(p => !!p.name);
        }

        // Đọc sheet Nhân sự
        const wsWorkers = workbook.Sheets['Danh mục Nhân sự'];
        if (wsWorkers) {
          const rawWorkers = XLSX.utils.sheet_to_json(wsWorkers) as any[];
          workers = rawWorkers.map(w => {
            const wCode = String(w['Mã NV'] || `SH-${Math.floor(1000 + Math.random() * 9000)}`).trim();
            const wName = String(w['Họ và Tên'] || '').trim();
            return {
              id: String(w['ID'] || `w-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`),
              worker_code: wCode,
              full_name: wName,
              code: wCode,
              name: wName,
              department: String(w['Phòng ban/Chuyền'] || 'Dây chuyền LR RO'),
              role: String(w['Chức vụ'] || 'Kỹ thuật viên'),
              phone: w['Số điện thoại'] ? String(w['Số điện thoại']) : undefined,
              status: (w['Trạng thái'] || 'Đang làm việc') as any
            };
          }).filter(w => !!w.full_name);
        }

        resolve({ reports, products, workers });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

/**
 * Tải file mẫu Excel nhập báo cáo dừng Line
 */
export function downloadDowntimeReportTemplate() {
  const sampleData = [
    {
      'Ngày': new Date().toISOString().slice(0, 10),
      'Ca': 'Ca 1 (06:00 - 14:00)',
      'Chuyền': 'Dây chuyền LR RO',
      'Thiết bị': 'Máy vặn ốc tự động A1',
      'Sản phẩm': 'Máy lọc nước RO Sunhouse 9 lõi SHA8858K',
      'Đơn giá': 4500000,
      'Năng suất ĐM': 60,
      'Bắt đầu': '08:30',
      'Kết thúc': '09:00',
      'Thời gian': 30,
      'Nhóm nguyên nhân': 'Sự cố máy móc (Machine)',
      'Chi tiết': 'Kẹt vít cấp phôi trạm 2 do dị vật nhỏ',
      'Giải pháp': 'Vệ sinh rãnh trượt cấp vít, căn chỉnh lại sensor định vị',
      'Người báo cáo': 'Nguyễn Văn An',
      'Trạng thái': 'Đã khắc phục'
    },
    {
      'Ngày': new Date().toISOString().slice(0, 10),
      'Ca': 'Ca 2 (14:00 - 22:00)',
      'Chuyền': 'Dây chuyền Bếp Gas',
      'Thiết bị': 'Máy ép mặt kính',
      'Sản phẩm': 'Bếp gas đôi Sunhouse SHB3365',
      'Đơn giá': 1200000,
      'Năng suất ĐM': 120,
      'Bắt đầu': '15:10',
      'Kết thúc': '15:35',
      'Thời gian': 25,
      'Nhóm nguyên nhân': 'Khuôn gá & Dụng cụ (Tooling)',
      'Chi tiết': 'Gá kẹp lệch tâm gây xô lệch viền kính',
      'Giải pháp': 'Căn chỉnh lại dưỡng kẹp và siết chặt đai ốc định vị',
      'Người báo cáo': 'Trần Văn Bình',
      'Trạng thái': 'Đã khắc phục'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Bao_Cao');

  ws['!cols'] = [
    { wch: 14 }, // Ngày
    { wch: 22 }, // Ca
    { wch: 22 }, // Chuyền
    { wch: 25 }, // Thiết bị
    { wch: 40 }, // Sản phẩm
    { wch: 15 }, // Đơn giá
    { wch: 15 }, // Năng suất ĐM
    { wch: 12 }, // Bắt đầu
    { wch: 12 }, // Kết thúc
    { wch: 12 }, // Thời gian
    { wch: 28 }, // Nhóm nguyên nhân
    { wch: 45 }, // Chi tiết
    { wch: 45 }, // Giải pháp
    { wch: 22 }, // Người báo cáo
    { wch: 18 }, // Trạng thái
  ];

  XLSX.writeFile(wb, 'Mau_Nhap_Bao_Cao_Dung_Line_Sunhouse.xlsx');
}

/**
 * Phân tích file Excel nhập báo cáo dừng Line
 */
export async function parseDowntimeReportsExcel(file: File): Promise<DowntimeReport[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (!rawJson || rawJson.length === 0) {
          throw new Error('File Excel rỗng!');
        }

        const parsed: DowntimeReport[] = rawJson.map((row) => {
          let date = new Date().toISOString().slice(0, 10);
          let shift = 'Ca 1 (06:00 - 14:00)';
          let line = 'Dây chuyền LR RO';
          let equipment = '';
          let productName = '';
          let productUnitPrice = 0;
          let standardRate = 60;
          let startTime = '08:00';
          let endTime: string | undefined = undefined;
          let duration = 0;
          let reasonCategory = 'Sự cố máy móc (Machine)';
          let details = '';
          let solution: string | undefined = undefined;
          let pic = 'Kỹ thuật viên';
          let status = 'Đã khắc phục';

          Object.entries(row).forEach(([key, val]) => {
            const k = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const strVal = String(val).trim();

            if (k.includes('ngay') || k === 'date') date = strVal;
            else if (k.includes('ca') || k === 'shift') shift = strVal;
            else if (k.includes('chuyen') || k.includes('line')) line = strVal;
            else if (k.includes('thiet bi') || k.includes('cong doan') || k === 'equipment') equipment = strVal;
            else if (k.includes('san pham') || k === 'product') productName = strVal;
            else if (k.includes('don gia') || k === 'price') productUnitPrice = Number(val) || 0;
            else if (k.includes('nang suat') || k.includes('dinh muc')) standardRate = Number(val) || 0;
            else if (k.includes('bat dau') || k === 'start') startTime = strVal;
            else if (k.includes('ket thuc') || k === 'end') endTime = strVal || undefined;
            else if (k.includes('thoi gian') || k === 'duration') duration = Number(val) || 0;
            else if (k.includes('nguyen nhan') || k === 'reason') reasonCategory = strVal;
            else if (k.includes('chi tiet') || k === 'detail') details = strVal;
            else if (k.includes('giai phap') || k.includes('khac phuc') || k === 'solution') solution = strVal || undefined;
            else if (k.includes('bao cao') || k.includes('pic') || k.includes('nguoi')) pic = strVal;
            else if (k.includes('trang thai') || k === 'status') status = strVal;
          });

          return {
            id: `dt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            date,
            shift: (shift as any),
            line: (line as any),
            equipment: equipment || 'Thiết bị sản xuất',
            productName: productName || 'Chưa định danh',
            productUnitPrice,
            standardRate,
            startTime,
            endTime,
            duration: duration > 0 ? duration : 15,
            reasonCategory: (reasonCategory as any),
            details: details || 'Không có mô tả chi tiết',
            solution,
            pic: pic || 'Kỹ thuật viên',
            status: (status as any),
            createdAt: new Date().toISOString()
          };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Tải file mẫu Excel danh sách Nhân sự / Kỹ thuật viên
 */
export function downloadWorkerTemplate() {
  const sampleData = [
    {
      'Mã NV': 'SH-1024',
      'Họ và Tên': 'Nguyễn Văn An',
      'Phòng ban/Chuyền': 'Dây chuyền LR RO',
      'Chức vụ': 'Kỹ thuật viên Trưởng',
      'Số điện thoại': '0912345678',
      'Trạng thái': 'Đang làm việc'
    },
    {
      'Mã NV': 'SH-1088',
      'Họ và Tên': 'Trần Văn Bình',
      'Phòng ban/Chuyền': 'Dây chuyền Bếp Gas',
      'Chức vụ': 'Kỹ thuật viên Cơ điện',
      'Số điện thoại': '0987654321',
      'Trạng thái': 'Đang làm việc'
    },
    {
      'Mã NV': 'SH-2045',
      'Họ và Tên': 'Lê Thị Cúc',
      'Phòng ban/Chuyền': 'Dây chuyền LR RO',
      'Chức vụ': 'QC Chuyền',
      'Số điện thoại': '0901234567',
      'Trạng thái': 'Đang làm việc'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhan_Su');

  ws['!cols'] = [
    { wch: 15 }, // Mã NV
    { wch: 30 }, // Họ và Tên
    { wch: 25 }, // Phòng ban/Chuyền
    { wch: 25 }, // Chức vụ
    { wch: 18 }, // Số điện thoại
    { wch: 18 }, // Trạng thái
  ];

  XLSX.writeFile(wb, 'Mau_Nhan_Su_Sunhouse.xlsx');
}

/**
 * Phân tích file Excel danh sách Nhân sự
 */
export async function parseWorkersExcel(file: File): Promise<Worker[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (!rawJson || rawJson.length === 0) {
          throw new Error('File Excel nhân sự rỗng!');
        }

        const parsed: Worker[] = [];

        rawJson.forEach((row) => {
          let code = '';
          let name = '';
          let department = 'Dây chuyền LR RO';
          let role = 'Kỹ thuật viên';
          let phone = '';
          let status = 'Đang làm việc';

          Object.entries(row).forEach(([key, val]) => {
            const k = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const strVal = String(val).trim();

            if (k.includes('ma') || k === 'code') code = strVal;
            else if (k.includes('ten') || k.includes('ho') || k === 'name') name = strVal;
            else if (k.includes('phong') || k.includes('chuyen') || k.includes('department')) department = strVal;
            else if (k.includes('chuc') || k.includes('role') || k.includes('vi tri')) role = strVal;
            else if (k.includes('thoai') || k.includes('phone') || k.includes('sdt')) phone = strVal;
            else if (k.includes('trang thai') || k === 'status') status = strVal;
          });

          if (!name) return;

          const finalCode = code || `SH-${Math.floor(1000 + Math.random() * 9000)}`;

          parsed.push({
            id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            worker_code: finalCode,
            full_name: name,
            code: finalCode,
            name: name,
            department,
            role,
            phone: phone || undefined,
            status: (status as any) || 'Đang làm việc',
          });
        });

        if (parsed.length === 0) {
          throw new Error('Không tìm thấy dữ liệu nhân viên hợp lệ (cần cột Họ và Tên)');
        }

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Xuất danh sách báo cáo dừng Line ra file Excel chuyên nghiệp
 * @param reports Danh sách báo cáo cần xuất
 * @param filtersDescription Chuỗi mô tả điều kiện lọc hiện tại để ghi vào báo cáo
 */
export function exportDowntimeReportsToExcel(reports: DowntimeReport[], filtersDescription: string) {
  // 1. Chuẩn bị dữ liệu thô dạng bảng phẳng
  const rawData = reports.map((r, index) => ({
    'STT': index + 1,
    'Ngày báo cáo': r.date,
    'Ca làm việc': r.shift,
    'Line sản xuất': r.line,
    'Thiết bị/Công đoạn': r.equipment,
    'Sản phẩm đang sản xuất': r.productName || 'N/A',
    'Đơn giá sản phẩm (VNĐ)': r.productUnitPrice || 0,
    'Năng suất định mức (Sp/giờ)': r.standardRate || 0,
    'Giờ bắt đầu': r.startTime,
    'Giờ kết thúc': r.endTime || 'Chưa khắc phục',
    'Thời gian dừng (phút)': r.duration,
    'Chi phí dừng Line (VNĐ)': r.status === 'Đang xử lý' ? 0 : calculateDowntimeCost(r.duration),
    'Tổn thất Doanh thu (VNĐ)': r.status === 'Đang xử lý' ? 0 : Math.round((r.duration / 60) * (r.standardRate || 0) * (r.productUnitPrice || 0)),
    'Nhóm nguyên nhân': r.reasonCategory,
    'Chi tiết sự cố': r.details,
    'Biện pháp khắc phục': r.solution || 'Đang xử lý',
    'Người báo cáo/PIC': r.pic,
    'Trạng thái': r.status,
  }));

  // 2. Tạo workbook và worksheet trống
  const wb = XLSX.utils.book_new();
  
  // 3. Tạo tiêu đề và thông tin chung trước bảng dữ liệu chính
  const titleRows = [
    ['CÔNG TY CỔ PHẦN TẬP ĐOÀN SUNHOUSE'],
    ['BÁO CÁO THỜI GIAN DỪNG LINE SẢN XUẤT (LINE DOWNTIME REPORT)'],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`],
    [`Điều kiện lọc: ${filtersDescription}`],
    [], // Dòng trống cách biệt
  ];

  // 4. Tạo worksheet từ mảng tiêu đề trước
  const ws = XLSX.utils.aoa_to_sheet(titleRows);

  // 5. Thêm bảng dữ liệu chính tiếp nối vào dòng thứ 6 (index 5)
  XLSX.utils.sheet_add_json(ws, rawData, {
    origin: 'A6',
    skipHeader: false,
  });

  // 6. Tính toán các thông số tổng hợp để thêm vào cuối bảng
  const totalDowntime = reports.reduce((sum, r) => sum + r.duration, 0);
  const totalIncidents = reports.length;
  const avgDuration = totalIncidents > 0 ? Math.round(totalDowntime / totalIncidents) : 0;
  const activeIncidents = reports.filter(r => r.status === 'Đang xử lý').length;
  const totalCost = reports.reduce((sum, r) => sum + (r.status === 'Đang xử lý' ? 0 : calculateDowntimeCost(r.duration)), 0);
  const totalRevenueLoss = reports.reduce((sum, r) => sum + (r.status === 'Đang xử lý' ? 0 : Math.round((r.duration / 60) * (r.standardRate || 0) * (r.productUnitPrice || 0))), 0);

  const startSummaryRow = 6 + rawData.length + 2; // Cách bảng chính 2 dòng
  
  const summaryRows = [
    [],
    ['TỔNG HỢP THỐNG KÊ (SUMMARY REPORT)'],
    ['Tổng số vụ dừng Line:', totalIncidents, 'vụ'],
    ['Tổng thời gian dừng Line:', totalDowntime, 'phút'],
    ['Tổng chi phí dừng Line ước tính:', totalCost, 'VNĐ'],
    ['Tổng tổn thất doanh thu ước tính:', totalRevenueLoss, 'VNĐ'],
    ['Thời gian dừng trung bình (MTTR):', avgDuration, 'phút/vụ'],
    ['Sự cố chưa khắc phục (Đang xử lý):', activeIncidents, 'vụ'],
  ];

  XLSX.utils.sheet_add_aoa(ws, summaryRows, {
    origin: `A${startSummaryRow}`,
  });

  // 7. Cấu hình độ rộng các cột (Column Widths) tự động dựa trên nội dung
  const colWidths = [
    { wch: 6 },   // STT
    { wch: 15 },  // Ngày báo cáo
    { wch: 12 },  // Ca làm việc
    { wch: 20 },  // Line sản xuất
    { wch: 25 },  // Thiết bị/Công đoạn
    { wch: 35 },  // Sản phẩm đang sản xuất
    { wch: 22 },  // Đơn giá sản phẩm (VNĐ)
    { wch: 25 },  // Năng suất định mức (Sp/giờ)
    { wch: 12 },  // Giờ bắt đầu
    { wch: 15 },  // Giờ kết thúc
    { wch: 22 },  // Thời gian dừng (phút)
    { wch: 25 },  // Chi phí dừng Line (VNĐ)
    { wch: 25 },  // Tổn thất Doanh thu (VNĐ)
    { wch: 25 },  // Nhóm nguyên nhân
    { wch: 45 },  // Chi tiết sự cố
    { wch: 45 },  // Biện pháp khắc phục
    { wch: 25 },  // Người báo cáo/PIC
    { wch: 15 },  // Trạng thái
  ];
  ws['!cols'] = colWidths;

  // 8. Đính worksheet vào workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo Dừng Line');

  // 9. Xuất file và tải xuống trực tiếp ở trình duyệt
  const fileName = `Bao_cao_dung_line_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
