-- DropForeignKey
ALTER TABLE "HoaDon" DROP CONSTRAINT "HoaDon_khachThueId_fkey";

-- AlterTable
ALTER TABLE "HoaDon" ALTER COLUMN "khachThueId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_khachThueId_fkey" FOREIGN KEY ("khachThueId") REFERENCES "KhachThue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
