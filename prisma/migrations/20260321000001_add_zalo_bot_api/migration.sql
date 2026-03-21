-- Per-user bot server config overrides
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloBotServerUrl" TEXT;
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloBotUsername"  TEXT;
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloBotPassword"  TEXT;
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloBotTtl"       INTEGER;

-- Danh sách endpoint Zalo Bot Server
CREATE TABLE IF NOT EXISTS "ZaloBotApi" (
  "id"             TEXT NOT NULL,
  "endpoint"       TEXT NOT NULL,
  "method"         TEXT NOT NULL DEFAULT 'POST',
  "nhom"           TEXT NOT NULL,
  "tenNhom"        TEXT NOT NULL,
  "moTa"           TEXT,
  "defaultPayload" TEXT,
  "thuTu"          INTEGER NOT NULL DEFAULT 0,
  "ngayTao"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ZaloBotApi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ZaloBotApi_endpoint_key" ON "ZaloBotApi"("endpoint");
