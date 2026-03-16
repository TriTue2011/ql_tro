-- AlterTable: Thêm zaloChatId cho KhachThue (bị thiếu trong migration trước)
ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT;
