-- AlterTable: Thêm nhanThongBaoZalo cho NguoiDung và KhachThue
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "nhanThongBaoZalo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "nhanThongBaoZalo" BOOLEAN NOT NULL DEFAULT false;
