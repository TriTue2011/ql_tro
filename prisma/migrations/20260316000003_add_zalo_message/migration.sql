-- CreateTable: Lịch sử tin nhắn Zalo (inbound từ user + outbound từ bot)
CREATE TABLE IF NOT EXISTS "ZaloMessage" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "chatId"      TEXT NOT NULL,
  "displayName" TEXT,
  "content"     TEXT NOT NULL,
  "role"        TEXT NOT NULL DEFAULT 'user',
  "eventName"   TEXT,
  "rawPayload"  JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ZaloMessage_chatId_createdAt_idx" ON "ZaloMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "ZaloMessage_createdAt_idx" ON "ZaloMessage"("createdAt");
