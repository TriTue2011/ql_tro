/**
 * GET  /api/zalo/messages?chatId=xxx&limit=50&before=<cursor_id>
 *   → Lấy tin nhắn của 1 cuộc hội thoại
 *
 * GET  /api/zalo/messages?conversations=1
 *   → Lấy danh sách cuộc hội thoại (tin nhắn cuối mỗi chatId)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);

  // Danh sách cuộc hội thoại
  if (searchParams.get('conversations') === '1') {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON ("chatId")
        "id", "chatId", "displayName", "content", "attachmentUrl", "role", "createdAt"
      FROM "ZaloMessage"
      ORDER BY "chatId", "createdAt" DESC
    `;
    // Sắp xếp theo tin nhắn mới nhất
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ data: rows });
  }

  // Tin nhắn theo chatId
  const chatId = searchParams.get('chatId');
  if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
  const before = searchParams.get('before'); // cursor: createdAt ISO

  const messages = await prisma.zaloMessage.findMany({
    where: {
      chatId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ data: messages.reverse() });
}
