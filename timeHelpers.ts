/**
 * Tính toán thời gian dừng (phút) từ giờ bắt đầu và kết thúc
 * Hỗ trợ trường hợp sự cố dừng Line kéo dài qua nửa đêm (ví dụ từ 23:00 đến 01:30 hôm sau)
 */
export function calculateDowntimeDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return 0;
  }

  // Chuyển tất cả về phút kể từ 00:00 của ngày bắt đầu
  let startTotalMinutes = startH * 60 + startM;
  let endTotalMinutes = endH * 60 + endM;

  // Nếu thời điểm kết thúc nhỏ hơn bắt đầu, coi như sự cố kéo dài sang ngày hôm sau (+ 24 tiếng)
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  return endTotalMinutes - startTotalMinutes;
}

/**
 * Định dạng số phút thành chuỗi đọc được (e.g. 105 phút -> "1 giờ 45 phút")
 */
export function formatDurationToReadable(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} giờ`;
  }
  return `${hours}g ${remainingMinutes}p`;
}

/**
 * Hằng số chi phí dừng sản xuất: 80 triệu đồng / ngày 8 giờ (480 phút)
 */
export const COST_PER_MINUTE = 80000000 / 480; // ~166.666,67 VNĐ/phút

/**
 * Tính toán chi phí dừng sản xuất (VND) từ số phút dừng
 */
export function calculateDowntimeCost(minutes: number): number {
  return Math.round(minutes * COST_PER_MINUTE);
}

/**
 * Định dạng tiền tệ VND đẹp mắt và gọn gàng (hỗ trợ hiển thị "triệu đ")
 */
export function formatVND(value: number): string {
  if (value >= 1000000) {
    const million = value / 1000000;
    return `${million.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu đ`;
  }
  return `${value.toLocaleString('vi-VN')} đ`;
}

/**
 * Lấy danh sách các ngày trong phạm vi để làm nhãn cho trục biểu đồ xu hướng
 */
export function getLastNDaysList(n: number = 7): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}
