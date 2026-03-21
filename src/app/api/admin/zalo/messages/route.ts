/**
 * GET /api/admin/zalo/messages
 * Lấy 20 tin nhắn Zalo gần nhất.
 * Chỉ admin.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = await prisma.zaloMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      chatId: true,
      displayName: true,
      content: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, messages });
}
