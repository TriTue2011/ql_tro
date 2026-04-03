-- AlterTable: thêm cột batDangNhapWeb cho KhachThue (mặc định tắt)
ALTER TABLE "KhachThue" ADD COLUMN "batDangNhapWeb" BOOLEAN NOT NULL DEFAULT false;
