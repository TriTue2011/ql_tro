/**
 * GET /api/zalo/debug/raw
 * Trả về rawPayload của 5 tin nhắn gần nhất để xem cấu trúc JSON Zalo gửi sang.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = await prisma.zaloMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, chatId: true, displayName: true, content: true, createdAt: true, rawPayload: true },
  });

  return NextResponse.json({ data: messages });
}
