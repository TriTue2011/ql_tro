-- AlterTable: Thêm zaloChatId và pendingZaloChatId cho NguoiDung (chủ trọ/admin)
ALTER TABLE "NguoiDung" ADD COLUMN "zaloChatId" TEXT;
ALTER TABLE "NguoiDung" ADD COLUMN "pendingZaloChatId" TEXT;

-- AlterTable: Thêm pendingZaloChatId cho KhachThue
ALTER TABLE "KhachThue" ADD COLUMN "pendingZaloChatId" TEXT;
