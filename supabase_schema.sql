-- ==============================================================================
-- SCHEMA CƠ SỞ DỮ LIỆU SUPABASE CHO HỆ THỐNG BÁO CÁO DỪNG LINE NHÀ MÁY SUNHOUSE
-- Copy toàn bộ đoạn script này và dán vào Supabase SQL Editor rồi bấm "Run".
-- ==============================================================================

-- 1. TẠO BẢNG DANH MỤC SẢN PHẨM & ĐƠN GIÁ (products)
create table if not exists public.products (
  name text primary key,
  line text not null default 'Dây chuyền LR RO',
  unit_price numeric not null default 0,
  standard_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 2. TẠO BẢNG BÁO CÁO DỪNG LINE (downtime_reports)
create table if not exists public.downtime_reports (
  id text primary key,
  date text not null,
  shift text not null default 'Ca 1',
  line text not null,
  equipment text not null default '',
  start_time text not null default '00:00',
  end_time text not null default '00:00',
  duration numeric not null default 0,
  reason_category text not null default 'Máy móc/Thiết bị',
  details text not null default '',
  solution text not null default '',
  pic text not null default '',
  status text not null default 'Đã khắc phục',
  created_at timestamptz not null default now(),
  product_name text not null default '',
  product_unit_price numeric not null default 0,
  standard_rate numeric not null default 0
);

-- Ràng buộc kiểm tra tính hợp lệ nhóm nguyên nhân 4M
alter table public.downtime_reports drop constraint if exists chk_reason_4m;
alter table public.downtime_reports add constraint chk_reason_4m 
  check (reason_category in ('Con người', 'Máy móc/Thiết bị', 'Nguyên vật liệu', 'Phương pháp/Quy trình'));

-- 3. TẠO CHỈ MỤC (INDEXES) TỐI ƯU TRUY VẤN VÀ BỘ LỌC
create index if not exists idx_downtime_date on public.downtime_reports(date desc);
create index if not exists idx_downtime_line on public.downtime_reports(line);
create index if not exists idx_downtime_reason on public.downtime_reports(reason_category);
create index if not exists idx_downtime_created_at on public.downtime_reports(created_at desc);

-- 4. KÍCH HOẠT BẢO MẬT HÀNG (ROW LEVEL SECURITY - RLS)
alter table public.products enable row level security;
alter table public.downtime_reports enable row level security;

-- 5. TẠO BẢNG DANH MỤC NHÂN SỰ & KỸ THUẬT VIÊN (workers)
create table if not exists public.workers (
  id text primary key,
  worker_code text not null default '',
  full_name text not null default '',
  department text not null default 'Dây chuyền LR RO',
  status text not null default 'Đang làm việc',
  created_at timestamptz not null default now()
);
create index if not exists idx_workers_full_name on public.workers(full_name);
create index if not exists idx_workers_worker_code on public.workers(worker_code);
alter table public.workers enable row level security;

-- Tạo chính sách cho phép ứng dụng đọc/ghi dữ liệu qua Anon Key
drop policy if exists "Cho phép anon toàn quyền truy cập products" on public.products;
create policy "Cho phép anon toàn quyền truy cập products"
  on public.products for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Cho phép anon toàn quyền truy cập downtime_reports" on public.downtime_reports;
create policy "Cho phép anon toàn quyền truy cập downtime_reports"
  on public.downtime_reports for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Cho phép anon toàn quyền truy cập workers" on public.workers;
create policy "Cho phép anon toàn quyền truy cập workers"
  on public.workers for all
  to anon
  using (true)
  with check (true);

-- 6. BẬT TÍNH NĂNG REALTIME REPLICATION TRÊN SUPABASE
-- Giúp các máy tính, điện thoại tự động đồng bộ tức thì khi có dữ liệu mới
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.downtime_reports;
alter publication supabase_realtime add table public.workers;

-- 6. NẠP DỮ LIỆU MẪU BAN ĐẦU (SEED DATA - TÙY CHỌN NHƯNG KHUYÊN DÙNG)
insert into public.products (name, line, unit_price, standard_rate) values
  ('Máy lọc nước RO Sunhouse 9 lõi SHA8858K', 'Dây chuyền LR RO', 4500000, 60),
  ('Máy lọc nước RO Sunhouse 10 lõi SHA88116K', 'Dây chuyền LR RO', 5200000, 48),
  ('Máy lọc nước RO Nóng Lạnh SHA76213CK', 'Dây chuyền LR RO', 7500000, 36),
  ('Bếp gas đôi Sunhouse SHB3365', 'Dây chuyền Bếp Gas', 1200000, 120),
  ('Bếp gas dương kính Sunhouse SHB201MT', 'Dây chuyền Bếp Gas', 1500000, 90),
  ('Bếp gas âm cao cấp SHB5536', 'Dây chuyền Bếp Gas', 2800000, 60)
on conflict (name) do nothing;

insert into public.downtime_reports (
  id, date, shift, line, equipment, start_time, end_time, duration,
  reason_category, details, solution, pic, status, created_at,
  product_name, product_unit_price, standard_rate
) values
  ('dt-1', '2026-06-21', 'Ca 1', 'Dây chuyền LR RO', 'Máy lọc màng RO #1', '08:15', '09:30', 75,
   'Máy móc/Thiết bị', 'Rò rỉ khớp nối áp lực cao tại cụm bơm màng chính.', 'Thay thế gioăng cao su chịu áp lực, quấn băng tan gia cố và xiết chặt lực đai ốc.', 'Nguyễn Minh Hoàng Khiêm', 'Đã khắc phục', '2026-06-21T09:35:00.000Z',
   'Máy lọc nước RO Sunhouse 9 lõi SHA8858K', 4500000, 60),
  ('dt-2', '2026-06-22', 'Ca 2', 'Dây chuyền Bếp Gas', 'Cụm gá lắp họng chia lửa', '14:20', '14:50', 30,
   'Phương pháp/Quy trình', 'Thay đổi gá đặt khuôn gá cụm hoa sen chia lửa cho mã bếp SHD-2026.', 'Điều chỉnh lại khoảng cách đầu đánh lửa cơ và gá kẹp giữ thân bếp.', 'Nguyễn Quốc Thịnh', 'Đã khắc phục', '2026-06-22T14:55:00.000Z',
   'Bếp gas đôi Sunhouse SHB3365', 1200000, 120),
  ('dt-3', '2026-06-23', 'Ca 1', 'Dây chuyền LR RO', 'Khu vực cấp lõi lọc thô', '10:00', '11:15', 75,
   'Nguyên vật liệu', 'Thiếu lõi lọc PP 5 micron từ kho phụ trợ do xe nâng nội bộ bị chậm giao hàng.', 'Điều động nhân sự hỗ trợ kéo hàng khẩn cấp từ kho trung tâm và đôn đốc quản lý kho.', 'Nguyễn Minh Hoàng Khiêm', 'Đã khắc phục', '2026-06-23T11:20:00.000Z',
   'Máy lọc nước RO 10 lõi SHA88116K', 5200000, 48),
  ('dt-4', '2026-06-24', 'Ca 3', 'Dây chuyền Bếp Gas', 'Máy thử độ kín van gas', '22:15', '23:45', 90,
   'Máy móc/Thiết bị', 'Sụt áp áp suất khí nén cấp cho cảm biến đo áp thử rò rỉ van gas.', 'Kiểm tra đường ống dẫn khí nén, phát hiện rò rỉ khớp nối nhanh và thay mới.', 'Nguyễn Quốc Thịnh', 'Đã khắc phục', '2026-06-24T23:50:00.000Z',
   'Bếp gas đôi Sunhouse SHB3365', 1200000, 120)
on conflict (id) do nothing;

insert into public.workers (id, worker_code, full_name, department, status) values
  ('w-1', 'SH-0102', 'Nguyễn Minh Hoàng Khiêm', 'Dây chuyền LR RO', 'Đang làm việc'),
  ('w-2', 'SH-0108', 'Nguyễn Quốc Thịnh', 'Dây chuyền Bếp Gas', 'Đang làm việc'),
  ('w-3', 'SH-0115', 'Trần Văn Hùng', 'Dây chuyền LR RO', 'Đang làm việc'),
  ('w-4', 'SH-0204', 'Lê Thị Thu Thủy', 'Phòng Quản lý Chất lượng (QC)', 'Đang làm việc')
on conflict (id) do nothing;
