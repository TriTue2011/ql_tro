-- Email không bắt buộc, số điện thoại phải unique để đăng nhập bằng SĐT

-- 1. Bỏ NOT NULL trên email (giữ @unique)
ALTER TABLE "NguoiDung" ALTER COLUMN "email" DROP NOT NULL;

-- 2. Thêm unique constraint trên soDienThoai (nếu chưa có)
--    Trước tiên loại bỏ duplicate nếu có (chạy an toàn với WHERE NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "NguoiDung_soDienThoai_key" ON "NguoiDung"("soDienThoai");
