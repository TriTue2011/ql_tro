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
    ];

    for (const m of migrations) {
      try {
        await prisma.$executeRawUnsafe(m.sql);
      } catch (e: any) {
        console.warn(`[migration] ${m.name}: ${e.message}`);
      }
    }
    console.log('[migration] Schema migrations checked ✓');

    // Auto-start Zalo polling khi server khởi động
    // Mặc định: dùng Webhook (polling KHÔNG tự start)
    // Chỉ start polling khi user đã bật tường minh (zalo_polling_autostart = 'true')
    try {
      const autostartRow = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_polling_autostart' } });
      if (autostartRow?.giaTri === 'true') {
        const { startPolling } = await import('@/lib/zalo-polling-worker');
        const result = await startPolling();
        console.log(`[zalo-polling] Auto-start: ${result.message}`);
      } else {
        console.log('[zalo-polling] Chế độ Webhook — polling không chạy');
      }
    } catch (e: any) {
      console.warn(`[zalo-polling] Auto-start failed: ${e.message}`);
    }
  }
}
