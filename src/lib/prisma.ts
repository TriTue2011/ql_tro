import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  migrationDone: boolean;
};

function createPrismaClient() {
  const connectionString = process.env.POSTGRESQL_URI || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Environment variable POSTGRESQL_URI or DATABASE_URL is not set');
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
  
  // Các cột cũ
  prisma.$executeRawUnsafe(`ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT`).catch(() => {});
  
  // Cột toaNhaId mới cho Hợp đồng và Hóa đơn (để cho phép trùng mã theo tòa)
  prisma.$executeRawUnsafe(`ALTER TABLE "HopDong" ADD COLUMN IF NOT EXISTS "toaNhaId" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "HoaDon" ADD COLUMN IF NOT EXISTS "toaNhaId" TEXT`).catch(() => {});

  // Xóa bỏ ràng buộc UNIQUE cũ trên toàn bảng (nếu có) để cho phép trùng mã khác tòa
  // Lưu ý: Tên ràng buộc mặc định của Prisma thường là "HopDong_maHopDong_key"
  prisma.$executeRawUnsafe(`ALTER TABLE "HopDong" DROP CONSTRAINT IF EXISTS "HopDong_maHopDong_key"`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "HoaDon" DROP CONSTRAINT IF EXISTS "HoaDon_maHoaDon_key"`).catch(() => {});

  // Tạo index UNIQUE mới kết hợp mã + tòa nhà
  prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HopDong_maHopDong_toaNhaId_key" ON "HopDong"("maHopDong", "toaNhaId")`).catch(() => {});
  prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HoaDon_maHoaDon_toaNhaId_key" ON "HoaDon"("maHoaDon", "toaNhaId")`).catch(() => {});

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
  prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ZaloMessage_chatId_createdAt_idx" ON "ZaloMessage"("chatId", "createdAt")`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "CaiDatToaNha" ADD COLUMN IF NOT EXISTS "haWebhookUrl" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "CaiDatToaNha" ADD COLUMN IF NOT EXISTS "haAllowedThreads" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "nguoiTaoId" TEXT`).catch(() => {});
  prisma.$executeRawUnsafe(`ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "nguoiTaoId" TEXT`).catch(() => {});
}

export default prisma;
