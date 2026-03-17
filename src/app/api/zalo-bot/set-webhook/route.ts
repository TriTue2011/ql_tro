/**
 * POST /api/zalo-bot/set-webhook
 * Cài đặt webhook trên bot server để nhận tin nhắn Zalo.
 * Body: { ownId?: string }  — nếu không truyền, dùng zalo_bot_account_id từ DB.
 * Chỉ admin / chuNha.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { setWebhookOnBotServer, getBotConfig } from '@/lib/zalo-bot-client';

function getPublicBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const config = await getBotConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình zalo_bot_server_url' });
  }

  const body = await request.json().catch(() => ({}));
  const ownId: string = body?.ownId || config.accountId;
  if (!ownId) {
    return NextResponse.json({ ok: false, error: 'Cần nhập Zalo Account ID (zalo_bot_account_id) trong Cài đặt' });
  }

  const base = getPublicBaseUrl() || `http://localhost:3000`;
  const webhookUrl = `${base}/api/zalo/webhook`;

  const result = await setWebhookOnBotServer(ownId, webhookUrl);
  return NextResponse.json({
    ...result,
    webhookUrl,
    ownId,
  });
}
