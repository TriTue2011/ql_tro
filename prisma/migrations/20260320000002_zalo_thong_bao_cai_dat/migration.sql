-- Add zaloAccountId to NguoiDung
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloAccountId" TEXT;

-- Create ZaloThongBaoCaiDat
CREATE TABLE IF NOT EXISTS "ZaloThongBaoCaiDat" (
  "id"                    TEXT NOT NULL,
  "nguoiDungId"           TEXT NOT NULL,
  "toaNhaId"              TEXT NOT NULL,
  "nhanSuCo"              BOOLEAN NOT NULL DEFAULT true,
  "nhanHoaDon"            BOOLEAN NOT NULL DEFAULT true,
  "nhanTinKhach"          BOOLEAN NOT NULL DEFAULT true,
  "nhanNguoiLa"           BOOLEAN NOT NULL DEFAULT true,
  "nhanNhacNho"           BOOLEAN NOT NULL DEFAULT true,
  "chuyenSuCoChoQL"       BOOLEAN NOT NULL DEFAULT false,
  "chuyenHoaDonChoQL"     BOOLEAN NOT NULL DEFAULT false,
  "chuyenTinKhachChoQL"   BOOLEAN NOT NULL DEFAULT false,
  "chuyenNguoiLaChoQL"    BOOLEAN NOT NULL DEFAULT false,
  "chuyenNhacNhoChoQL"    BOOLEAN NOT NULL DEFAULT false,
  "ngayTao"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ngayCapNhat"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ZaloThongBaoCaiDat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ZaloThongBaoCaiDat_nguoiDung_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE,
  CONSTRAINT "ZaloThongBaoCaiDat_toaNha_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ZaloThongBaoCaiDat_nguoiDungId_toaNhaId_key"
  ON "ZaloThongBaoCaiDat"("nguoiDungId", "toaNhaId");
