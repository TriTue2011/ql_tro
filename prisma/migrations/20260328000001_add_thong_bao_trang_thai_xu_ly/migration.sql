-- Thêm cột trangThaiXuLy cho bảng ThongBao (thiếu trong DB)
ALTER TABLE "ThongBao" ADD COLUMN IF NOT EXISTS "trangThaiXuLy" TEXT NOT NULL DEFAULT 'chuaXuLy';
