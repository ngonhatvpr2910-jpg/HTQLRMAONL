import { createClient } from '@supabase/supabase-js';

// URL và Key trực tiếp của dự án Supabase (Tuyệt đối không dùng window.location.origin hay proxy domain app/Vercel)
const DIRECT_SUPABASE_URL = 'https://phzqzbkycxjsjjuivnfa.supabase.co';
const DIRECT_SUPABASE_ANON_KEY = 'sb_publishable_YXa17yNODRSjW6Z-zTXTPw_6HlPxWXy';

// Đọc trực tiếp từ biến môi trường Vite của máy trạm/client, dự phòng URL Supabase trực tiếp
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Chuẩn hóa chuỗi URL trực tiếp của Supabase (loại bỏ khoảng trắng và dấu gạch chéo cuối)
export const supabaseUrl = (envUrl && envUrl.trim() !== '' ? envUrl : DIRECT_SUPABASE_URL)
  .trim()
  .replace(/\/+$/, '');

export const supabaseAnonKey = (envKey && envKey.trim() !== '' ? envKey : DIRECT_SUPABASE_ANON_KEY)
  .trim();

// Kiểm tra xem Supabase Client đã sẵn sàng kết nối trực tiếp chưa
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

/**
 * Supabase Client Singleton:
 * Kết nối TRỰC TIẾP đến endpoint Supabase (https://<project-ref>.supabase.co).
 * 
 * LƯU Ý BẢO MẬT & REALTIME:
 * - TUYỆT ĐỐI KHÔNG dùng proxy qua URL của app (như window.location.origin hay APP_URL)
 * - Khi kết nối trực tiếp, WebSocket Realtime sẽ kết nối thẳng tới:
 *   wss://phzqzbkycxjsjjuivnfa.supabase.co/realtime/v1/websocket
 * - Tránh hoàn toàn lỗi "WebSocket connection failed: 404" do Vercel/reverse-proxy chặn hoặc không xử lý /realtime
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export default supabase;
