-- AlterTable: soDienThoai thành optional, email thêm unique
-- PostgreSQL cho phép nhiều NULL trong cột unique

-- Bỏ NOT NULL cho soDienThoai
ALTER TABLE "KhachThue" ALTER COLUMN "soDienThoai" DROP NOT NULL;

-- Thêm unique index cho email (cho phép NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "KhachThue_email_key" ON "KhachThue"("email");
