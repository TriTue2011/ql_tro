/**
 * GET /api/zalo/group-thread-lookup?name=AI+Camera&accountId=xxx
 *
 * Tìm threadId của nhóm Zalo theo tên từ lịch sử tin nhắn đã lưu trong DB.
 * Mỗi tài khoản Zalo (accountId) có thể có threadId khác nhau cho cùng một nhóm.
 *
 * Returns:
 *   [{ threadId, displayName, lastSeen }]
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const name = req.nextUrl.searchParams.get('name')?.trim();
  const accountId = req.nextUrl.searchParams.get('accountId')?.trim();

  if (!name) return NextResponse.json({ error: 'Thiếu tên nhóm' }, { status: 400 });

  try {
    // Tìm tất cả ZaloMessage là tin nhóm (rawPayload.type = 1 hoặc eventName = 'group_message')
    // với displayName khớp tên nhóm (case-insensitive partial match)
    const rows = await prisma.zaloMessage.findMany({
      where: {
        OR: [
          { eventName: 'group_message' },
          { rawPayload: { path: ['type'], equals: 1 } },
          { rawPayload: { path: ['data', 'type'], equals: 1 } },
        ],
        displayName: {
          contains: name,
          mode: 'insensitive',
        },
        // Nếu có accountId, ưu tiên lọc theo ownId (bot account nhận tin nhóm này)
        ...(accountId ? { ownId: accountId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['chatId'],
      select: {
        chatId: true,
        displayName: true,
        createdAt: true,
        ownId: true,
      },
      take: 10,
    });

    // Nếu không tìm thấy theo ownId, thử tìm rộng hơn
    let results = rows;
    if (results.length === 0 && accountId) {
      const fallback = await prisma.zaloMessage.findMany({
        where: {
          OR: [
            { eventName: 'group_message' },
            { rawPayload: { path: ['type'], equals: 1 } },
            { rawPayload: { path: ['data', 'type'], equals: 1 } },
          ],
          displayName: {
            contains: name,
            mode: 'insensitive',
          },
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['chatId'],
        select: {
          chatId: true,
          displayName: true,
          createdAt: true,
          ownId: true,
        },
        take: 10,
      });
      results = fallback;
    }

    return NextResponse.json({
      success: true,
      results: results.map(r => ({
        threadId: r.chatId,
        displayName: r.displayName || name,
        lastSeen: r.createdAt,
        accountId: r.ownId,
      })),
    });
  } catch (err) {
    console.error('[group-thread-lookup] Error:', err);
    return NextResponse.json({ error: 'Lỗi tra cứu' }, { status: 500 });
  }
}
