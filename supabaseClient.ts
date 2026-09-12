import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * CẤU HÌNH KẾT NỐI TRỰC TIẾP ĐẾN SUPABASE CLOUD
 * 
 * QUY TẮC QUAN TRỌNG:
 * 1. Sử dụng trực tiếp URL của Supabase từ import.meta.env.VITE_SUPABASE_URL.
 * 2. TUYỆT ĐỐI KHÔNG dùng proxy qua URL của app (như window.location.origin, APP_URL, hay đường dẫn tương đối '/'),
 *    vì điều đó sẽ khiến kết nối WebSocket Realtime (/realtime/v1/websocket) bị gọi nhầm vào domain máy chủ web (Vercel/Cloud Run)
 *    gây ra lỗi "WebSocket connection failed: 404".
 * 3. WebSocket Realtime bắt buộc phải trỏ trực tiếp đến máy chủ của Supabase (*.supabase.co).
 */

const DEFAULT_SUPABASE_URL = 'https://ceucxnrwzeaafqspdjyi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_aFb2LCHTTx6Ic4EdWLQfKw_SG6bpSOu';

// Đọc từ biến môi trường của Vite (hỗ trợ an toàn cả môi trường Node và Vite)
const envUrl = typeof import.meta !== 'undefined' && import.meta?.env ? import.meta.env.VITE_SUPABASE_URL : process?.env?.VITE_SUPABASE_URL;
const envKey = typeof import.meta !== 'undefined' && import.meta?.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : process?.env?.VITE_SUPABASE_ANON_KEY;

// Kiểm tra và bảo đảm URL là địa chỉ tuyệt đối trực tiếp của Supabase
const resolveDirectSupabaseUrl = (url: string | undefined): string => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return DEFAULT_SUPABASE_URL;
  }
  const cleanUrl = url.trim();

  // Ngăn chặn việc cấu hình nhầm domain của ứng dụng (Vercel, Cloud Run, localhost, origin...)
  if (
    cleanUrl.startsWith('/') ||
    cleanUrl.includes('localhost') ||
    cleanUrl.includes('127.0.0.1') ||
    cleanUrl.includes('vercel.app') ||
    cleanUrl.includes('run.app')
  ) {
    console.warn(
      `[SupabaseClient] Cảnh báo: URL cấu hình "${cleanUrl}" là domain của web app, không phải Supabase! ` +
      `Đang tự động chuyển hướng kết nối trực tiếp đến "${DEFAULT_SUPABASE_URL}" để bảo vệ WebSocket Realtime khỏi lỗi 404.`
    );
    return DEFAULT_SUPABASE_URL;
  }

  return cleanUrl;
};

export const supabaseUrl: string = resolveDirectSupabaseUrl(envUrl);
export const supabaseAnonKey: string = (envKey && envKey.trim()) ? envKey.trim() : DEFAULT_SUPABASE_ANON_KEY;

/**
 * Kiểm tra cấu hình Supabase hợp lệ
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseUrl.includes('supabase.co')
  );
};

/**
 * SINGLETON INSTANCE:
 * Khởi tạo duy nhất 1 Supabase client cho toàn bộ ứng dụng và các kênh Realtime.
 * Đảm bảo các hàm supabase.channel(...) luôn tái sử dụng đúng kết nối WebSocket này.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
