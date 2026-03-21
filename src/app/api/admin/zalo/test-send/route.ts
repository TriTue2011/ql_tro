/**
 * POST /api/admin/zalo/test-send
 * Gửi tin nhắn test qua Zalo Bot.
 * Chỉ admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMessageViaBotServer } from '@/lib/zalo-bot-client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.chatId || !body?.message) {
    return NextResponse.json({ ok: false, error: 'Cần chatId và message' }, { status: 400 });
  }

  const { chatId, message } = body as { chatId: string; message: string };

  try {
    const result = await sendMessageViaBotServer(chatId, message);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
    return NextResponse.json({ ok: false, error: msg });
  }
}
