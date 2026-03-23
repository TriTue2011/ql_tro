/**
 * GET  /api/zalo/debug         → chẩn đoán toàn bộ pipeline Zalo
 * POST /api/zalo/debug         → inject tin nhắn test (không gửi Zalo thật)
 *
 * Chỉ dành cho admin/chuNha trong môi trường dev/debug.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { emitNewMessage, zaloMessageEmitter } from '@/lib/zalo-message-events';

function requireAdmin(session: any) {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

/** GET: chẩn đoán */
export async function GET() {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  // Config
  const [webhookRow, botServerRow] = await Promise.all([
    prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_url' } }),
    prisma.caiDat.findFirst({ where: { khoa: 'zalo_bot_server_url' } }),
  ]);

  // Số tin nhắn trong DB
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [totalMessages, messages24h, recentMessages] = await Promise.all([
    prisma.zaloMessage.count(),
    prisma.zaloMessage.count({ where: { createdAt: { gte: since24h } } }),
    prisma.zaloMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, chatId: true, displayName: true, content: true, role: true, createdAt: true },
    }),
  ]);

  // Số SSE listener đang kết nối
  const sseListeners = zaloMessageEmitter.listenerCount('message');

  return NextResponse.json({
    ok: true,
    config: {
      webhookUrl: webhookRow?.giaTri?.trim() || null,
      botServerUrl: botServerRow?.giaTri?.trim() || null,
    },
    database: {
      totalMessages,
      last24hMessages: messages24h,
      last5Messages: recentMessages,
    },
    sse: {
      activeListeners: sseListeners,
      note: 'activeListeners > 0 nghĩa là có tab đang mở SSE stream',
    },
  });
}

/** POST: inject tin nhắn test vào DB + emit SSE */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  let body: any = {};
  try { body = await request.json(); } catch { /* optional */ }

  const chatId: string = body?.chatId || 'test-debug-chat';
  const displayName: string = body?.displayName || 'Test User (Debug)';
  const content: string = body?.content || `Tin nhắn test lúc ${new Date().toLocaleTimeString('vi-VN')}`;

  const saved = await prisma.zaloMessage.create({
    data: {
      chatId,
      displayName,
      content,
      role: 'user',
      eventName: 'debug_inject',
      rawPayload: { debug: true, injectedAt: new Date().toISOString() },
    },
  });

  // Emit qua EventEmitter → SSE stream → UI
  emitNewMessage({ ...saved });

  return NextResponse.json({
    ok: true,
    message: 'Đã inject tin nhắn test. Kiểm tra UI xem có hiện không.',
    saved,
  });
}
