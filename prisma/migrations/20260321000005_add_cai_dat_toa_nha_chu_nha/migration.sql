-- Tạo bảng cài đặt riêng cho từng tòa nhà (Home Assistant + Lưu trữ)
CREATE TABLE "CaiDatToaNha" (
  "id"                  TEXT NOT NULL,
  "toaNhaId"            TEXT NOT NULL,
  "haUrl"               TEXT,
  "haToken"             TEXT,
  "storageProvider"     TEXT NOT NULL DEFAULT 'local',
  "minioEndpoint"       TEXT,
  "minioAccessKey"      TEXT,
  "minioSecretKey"      TEXT,
  "minioBucket"         TEXT,
  "cloudinaryCloudName" TEXT,
  "cloudinaryApiKey"    TEXT,
  "cloudinaryApiSecret" TEXT,
  "cloudinaryPreset"    TEXT,
  "uploadMaxSizeMb"     INTEGER NOT NULL DEFAULT 10,
  "ngayTao"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ngayCapNhat"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaiDatToaNha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaiDatToaNha_toaNhaId_key" ON "CaiDatToaNha"("toaNhaId");

ALTER TABLE "CaiDatToaNha"
  ADD CONSTRAINT "CaiDatToaNha_toaNhaId_fkey"
  FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tạo bảng cài đặt riêng cho từng chủ trọ (Thanh toán + Cảnh báo + Hệ thống)
CREATE TABLE "CaiDatChuNha" (
  "id"                         TEXT NOT NULL,
  "nguoiDungId"                TEXT NOT NULL,
  "nganHangTen"                TEXT,
  "nganHangSoTaiKhoan"         TEXT,
  "nganHangChuTaiKhoan"        TEXT,
  "thongBaoTruocHanHopDong"    INTEGER NOT NULL DEFAULT 30,
  "thongBaoQuaHanHoaDon"       INTEGER NOT NULL DEFAULT 3,
  "hoaDonCanhBaoLan1"          INTEGER NOT NULL DEFAULT 3,
  "hoaDonCanhBaoLan2"          INTEGER NOT NULL DEFAULT 7,
  "hoaDonCanhBaoLan3"          INTEGER NOT NULL DEFAULT 14,
  "hopDongCanhBaoLan1"         INTEGER NOT NULL DEFAULT 30,
  "hopDongCanhBaoLan2"         INTEGER NOT NULL DEFAULT 15,
  "hopDongCanhBaoLan3"         INTEGER NOT NULL DEFAULT 7,
  "chotChiSoNgayTrongThang"    INTEGER NOT NULL DEFAULT 1,
  "chotChiSoTruocNgay"         INTEGER NOT NULL DEFAULT 5,
  "suCoChuaNhanGio"            INTEGER NOT NULL DEFAULT 24,
  "suCoChuaXuLyGio"            INTEGER NOT NULL DEFAULT 72,
  "tenCongTy"                  TEXT,
  "emailLienHe"                TEXT,
  "sdtLienHe"                  TEXT,
  "diaChiCongTy"               TEXT,
  "appDomainUrl"               TEXT,
  "ngayTao"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ngayCapNhat"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaiDatChuNha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaiDatChuNha_nguoiDungId_key" ON "CaiDatChuNha"("nguoiDungId");

ALTER TABLE "CaiDatChuNha"
  ADD CONSTRAINT "CaiDatChuNha_nguoiDungId_fkey"
  FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;
