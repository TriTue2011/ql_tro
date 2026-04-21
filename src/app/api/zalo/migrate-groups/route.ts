/**
 * POST /api/zalo/migrate-groups (admin only)
 *
 * Gộp tất cả tin nhắn nhóm cũ (chatId = senderId) về đúng chatId = threadId.
 * Chạy 1 lần sau khi deploy fix webhook.
 *
 * Điều kiện gộp: rawPayload có threadId VÀ threadId != chatId hiện tại.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  // Bước 1: Cập nhật chatId = threadId cho tất cả tin nhắn nhóm cũ
  const updated = await prisma.$executeRaw`
    UPDATE "ZaloMessage"
    SET "chatId" = ("rawPayload"->>'threadId')
    WHERE
      "rawPayload"->>'threadId' IS NOT NULL
      AND "rawPayload"->>'threadId' != ''
      AND "rawPayload"->>'threadId' != "chatId"
  `;

  // Bước 2: Lấy tất cả threadId duy nhất vừa được cập nhật
  const groups = await prisma.$queryRaw<{ threadId: string }[]>`
    SELECT DISTINCT ("rawPayload"->>'threadId') AS "threadId"
    FROM "ZaloMessage"
    WHERE
      "rawPayload"->>'threadId' IS NOT NULL
      AND "rawPayload"->>'threadId' != ''
      AND "chatId" = ("rawPayload"->>'threadId')
  `;

  // Bước 3: Với mỗi nhóm, nếu có tên trong CaiDat thì gán displayName
  let namedCount = 0;
  for (const { threadId } of groups) {
    const key = `zalo_group_name_${threadId}`;
    const row = await prisma.caiDat.findUnique({ where: { khoa: key } });
    if (row?.giaTri) {
      await prisma.zaloMessage.updateMany({
        where: { chatId: threadId, OR: [{ displayName: null }, { displayName: '' }] },
        data: { displayName: row.giaTri },
      });
      namedCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    updatedMessages: Number(updated),
    groupsFound: groups.length,
    groupsNamed: namedCount,
  });
}
