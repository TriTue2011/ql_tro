-- Thêm các cột còn thiếu cho CaiDatToaNha (đã có trong schema nhưng chưa migrate)
ALTER TABLE "CaiDatToaNha" ADD COLUMN IF NOT EXISTS "haWebhookUrl" TEXT;
ALTER TABLE "CaiDatToaNha" ADD COLUMN IF NOT EXISTS "haAllowedThreads" TEXT;
ALTER TABLE "CaiDatToaNha" ADD COLUMN IF NOT EXISTS "zaloVanMau" TEXT;
