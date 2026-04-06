-- AlterTable
ALTER TABLE "KhachThue" ADD COLUMN "nguoiTaoId" TEXT;

-- AddForeignKey
ALTER TABLE "KhachThue" ADD CONSTRAINT "KhachThue_nguoiTaoId_fkey" FOREIGN KEY ("nguoiTaoId") REFERENCES "NguoiDung"("id") ON DELETE SET NULL ON UPDATE CASCADE;
