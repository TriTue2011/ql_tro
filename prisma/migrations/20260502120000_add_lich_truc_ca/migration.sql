-- Migration: Add LichTrucCa (Shift Schedule) model
-- Giai đoạn 3: Shift Schedule (Lịch trực ca)

-- Create LichTrucCa table
CREATE TABLE "LichTrucCa" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "toaNhaId" TEXT NOT NULL,
    "ngay" TIMESTAMP(3) NOT NULL,
    "ca" TEXT NOT NULL, -- C1 (Sáng 06-14) | C2 (Chiều 14-22) | C3 (Đêm 22-06) | HC (Hành chính 08-17)
    "ghiChu" TEXT,
    "nguoiTaoId" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LichTrucCa_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LichTrucCa_nguoiDungId_toaNhaId_ngay_key" UNIQUE ("nguoiDungId", "toaNhaId", "ngay")
);

-- Create indexes
CREATE INDEX "LichTrucCa_toaNhaId_ngay_idx" ON "LichTrucCa"("toaNhaId", "ngay");
CREATE INDEX "LichTrucCa_nguoiDungId_idx" ON "LichTrucCa"("nguoiDungId");

-- Add foreign key constraints
ALTER TABLE "LichTrucCa" ADD CONSTRAINT "LichTrucCa_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LichTrucCa" ADD CONSTRAINT "LichTrucCa_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LichTrucCa" ADD CONSTRAINT "LichTrucCa_nguoiTaoId_fkey" FOREIGN KEY ("nguoiTaoId") REFERENCES "NguoiDung"("id") ON DELETE SET NULL ON UPDATE CASCADE;
