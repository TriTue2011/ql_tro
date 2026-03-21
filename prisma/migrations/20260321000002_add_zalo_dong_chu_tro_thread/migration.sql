-- Thread ID Zalo của đồng chủ trọ — mỗi threadId có 1 bảng cài đặt thông báo riêng
CREATE TABLE IF NOT EXISTS "ZaloDongChuTroThread" (
  "id"          TEXT NOT NULL,
  "nguoiDungId" TEXT NOT NULL,
  "toaNhaId"    TEXT NOT NULL,
  "threadId"    TEXT NOT NULL,
  "ten"         TEXT,
  "loai"        TEXT NOT NULL DEFAULT 'user',
  "nhanSuCo"     BOOLEAN NOT NULL DEFAULT true,
  "nhanHoaDon"   BOOLEAN NOT NULL DEFAULT true,
  "nhanTinKhach" BOOLEAN NOT NULL DEFAULT true,
  "nhanNguoiLa"  BOOLEAN NOT NULL DEFAULT true,
  "nhanNhacNho"  BOOLEAN NOT NULL DEFAULT true,
  "ngayTao"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ngayCapNhat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ZaloDongChuTroThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ZaloDongChuTroThread_nguoiDungId_fkey"
    FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ZaloDongChuTroThread_toaNhaId_fkey"
    FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ZaloDongChuTroThread_nguoiDungId_toaNhaId_threadId_key"
  ON "ZaloDongChuTroThread"("nguoiDungId", "toaNhaId", "threadId");
