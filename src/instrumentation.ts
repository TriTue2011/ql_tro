/**
 * Next.js Instrumentation — chạy 1 lần khi server khởi động.
 * Tự động áp dụng các migration SQL còn thiếu (idempotent).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: prisma } = await import('@/lib/prisma');

    const migrations: { name: string; sql: string }[] = [
      {
        name: 'KhachThue.pendingZaloChatId',
        sql: `ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT`,
      },
      {
        name: 'NguoiDung.zaloChatId',
        sql: `ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT`,
      },
      {
        name: 'NguoiDung.pendingZaloChatId',
        sql: `ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT`,
      },
      {
        name: 'ZaloMessage table',
        sql: `CREATE TABLE IF NOT EXISTS "ZaloMessage" (
          "id"          TEXT NOT NULL PRIMARY KEY,
          "chatId"      TEXT NOT NULL,
          "displayName" TEXT,
          "content"     TEXT NOT NULL,
          "role"        TEXT NOT NULL DEFAULT 'user',
          "eventName"   TEXT,
          "rawPayload"  JSONB,
          "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      },
      {
        name: 'ZaloMessage.chatId index',
        sql: `CREATE INDEX IF NOT EXISTS "ZaloMessage_chatId_createdAt_idx" ON "ZaloMessage"("chatId", "createdAt")`,
      },
      {
        name: 'ToaNha.lienHePhuTrach',
        sql: `ALTER TABLE "ToaNha" ADD COLUMN IF NOT EXISTS "lienHePhuTrach" JSONB NOT NULL DEFAULT '[]'::jsonb`,
      },
      {
        name: 'ZaloMessage.attachmentUrl',
        sql: `ALTER TABLE "ZaloMessage" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT`,
      },
      {
        name: 'ZaloMessage.ownId',
        sql: `ALTER TABLE "ZaloMessage" ADD COLUMN IF NOT EXISTS "ownId" TEXT`,
      },
      {
        name: 'ZaloMessage.ownId index',
        sql: `CREATE INDEX IF NOT EXISTS "ZaloMessage_ownId_createdAt_idx" ON "ZaloMessage"("ownId", "createdAt")`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.quyenZalo',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "quyenZalo" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.quyenZaloMonitor',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "quyenZaloMonitor" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.anNavTabHopDong',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "anNavTabHopDong" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.anNavTabHoaDon',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "anNavTabHoaDon" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.anNavTabThanhToan',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "anNavTabThanhToan" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.anNavTabSuCo',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "anNavTabSuCo" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.anNavTabZalo',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "anNavTabZalo" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'ToaNhaNguoiQuanLy.anNavTabZaloMonitor',
        sql: `ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN IF NOT EXISTS "anNavTabZaloMonitor" BOOLEAN NOT NULL DEFAULT false`,
      },
      {
        name: 'NguoiDung.nguoiTaoId',
        sql: `ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "nguoiTaoId" TEXT`,
      },
    ];

    for (const m of migrations) {
      try {
        await prisma.$executeRawUnsafe(m.sql);
      } catch (e: any) {
        console.warn(`[migration] ${m.name}: ${e.message}`);
      }
    }
    console.log('[migration] Schema migrations checked ✓');

    // Auto-login tất cả tài khoản Zalo direct đã lưu cookies
    try {
      const { autoLoginAll } = await import('@/lib/zalo-direct/service');
      autoLoginAll().then(() => {
        console.log('[ZaloDirect] Auto-login on startup completed ✓');
      }).catch((err: any) => {
        console.warn('[ZaloDirect] Auto-login on startup error:', err.message);
      });
    } catch (err: any) {
      console.warn('[ZaloDirect] Failed to init auto-login:', err.message);
    }

    // Lên lịch dọn dẹp storage hàng ngày
    try {
      const { runStorageCleanup } = await import('@/lib/storage-cleanup');
      runStorageCleanup().then(r => {
        console.log(`[cleanup] Khởi động: xóa ${r.zaloDeleted} tin nhắn Zalo, ${r.invoiceCleared} ảnh hóa đơn`);
      }).catch(() => {});
      setInterval(() => {
        runStorageCleanup().catch(() => {});
      }, 24 * 60 * 60 * 1000);
    } catch (err: any) {
      console.warn('[cleanup] Failed to init storage cleanup:', err.message);
    }
  }
}
