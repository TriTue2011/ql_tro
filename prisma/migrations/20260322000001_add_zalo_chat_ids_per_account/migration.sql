-- Add zaloChatIds JSON column to NguoiDung and KhachThue
-- Stores { [botAccountId]: chatId } mapping for multi-bot-account support

ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloChatIds" JSONB;
ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "zaloChatIds" JSONB;
