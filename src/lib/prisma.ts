import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  migrationDone: boolean;
};

function createPrismaClient() {
  const connectionString = process.env.POSTGRESQL_URI;
  if (!connectionString) {
    throw new Error('Environment variable POSTGRESQL_URI is not set');
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ── Auto-migration: chạy 1 lần khi khởi động để đảm bảo schema đồng bộ ──
if (!globalForPrisma.migrationDone) {
  globalForPrisma.migrationDone = true;
  prisma.$executeRawUnsafe(`
    ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT
  `).catch(() => {});
  prisma.$executeRawUnsafe(`
    ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT
  `).catch(() => {});
  prisma.$executeRawUnsafe(`
    ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT
  `).catch(() => {});
  prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ZaloMessage" (
      "id"          TEXT NOT NULL PRIMARY KEY,
      "chatId"      TEXT NOT NULL,
      "displayName" TEXT,
      "content"     TEXT NOT NULL,
      "role"        TEXT NOT NULL DEFAULT 'user',
      "eventName"   TEXT,
      "rawPayload"  JSONB,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ZaloMessage_chatId_createdAt_idx"
    ON "ZaloMessage"("chatId", "createdAt")
  `).catch(() => {});
}

export default prisma;
