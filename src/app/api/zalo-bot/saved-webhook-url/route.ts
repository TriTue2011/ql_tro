/**
 * GET /api/zalo-bot/saved-webhook-url
 * Trả về webhook URL đã lưu trong DB từ lần cài bot webhook thành công trước.
 * Chỉ trả URL dạng /api/webhook/ hoặc /api/zalowebhook/ (đúng cho bot server).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_url' } });
    const saved = row?.giaTri?.trim() || null;
    const isBotUrl = saved && (saved.includes('/api/webhook/') || saved.includes('/api/zalowebhook/'));
    return NextResponse.json({ webhookUrl: isBotUrl ? saved : null });
  } catch {
    return NextResponse.json({ webhookUrl: null });
  }
}
