/**
 * GET  /api/zalo/messages?chatId=xxx&limit=50&before=<cursor_id>
 *   → Lấy tin nhắn của 1 cuộc hội thoại
 *
 * GET  /api/zalo/messages?conversations=1
 *   → Lấy danh sách cuộc hội thoại (tin nhắn cuối mỗi chatId)
 *
 * DELETE /api/zalo/messages
 *   → Xóa tất cả tin nhắn (Xóa tất cả trong theo dõi)
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
        "id", "chatId", "displayName", "content", "attachmentUrl", "role", "createdAt", "rawPayload", "eventName"
      FROM "ZaloMessage"
      ORDER BY "chatId", "createdAt" DESC
    `;
    // Sắp xếp theo tin nhắn mới nhất
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Bổ sung thông tin phòng/tòa nhà từ KhachThue → HopDong → Phong → ToaNha
    const chatIds = rows.map(r => r.chatId).filter(Boolean);
    if (chatIds.length > 0) {
      const tenantRooms = await prisma.khachThue.findMany({
        where: {
          OR: [
            { zaloChatId: { in: chatIds } },
            { pendingZaloChatId: { in: chatIds } },
          ],
        },
        select: {
          zaloChatId: true,
          pendingZaloChatId: true,
          hoTen: true,
          hopDong: {
            where: { trangThai: 'hoatDong' },
            take: 1,
            select: {
              phong: {
                select: {
                  maPhong: true,
                  tang: true,
                  toaNha: {
                    select: { tenToaNha: true, diaChi: true },
                  },
                },
              },
            },
          },
        },
      });

      // Map chatId → room info
      const roomMap = new Map<string, { tenKhach: string; maPhong: string; tang: number; tenToaNha: string; diaChi: any }>();
      for (const kt of tenantRooms) {
        const hd = kt.hopDong[0];
        if (!hd) continue;
        const info = {
          tenKhach: kt.hoTen,
          maPhong: hd.phong.maPhong,
          tang: hd.phong.tang,
          tenToaNha: hd.phong.toaNha.tenToaNha,
          diaChi: hd.phong.toaNha.diaChi,
        };
        if (kt.zaloChatId) roomMap.set(kt.zaloChatId, info);
        if (kt.pendingZaloChatId) roomMap.set(kt.pendingZaloChatId, info);
      }

      // Gắn room info vào từng row
      for (const row of rows) {
        const info = roomMap.get(row.chatId);
        if (info) {
          row.roomInfo = info;
        }
      }
    }

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

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { count } = await prisma.zaloMessage.deleteMany({});
  return NextResponse.json({ success: true, deleted: count });
}
