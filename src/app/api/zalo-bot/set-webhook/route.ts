/**
 * POST /api/zalo-bot/set-webhook
 * Cài đặt webhook trên bot server để nhận tin nhắn Zalo.
 * Body: { ownId?: string, webhookUrl?: string }
 * Chỉ admin / chuNha.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { setWebhookOnBotServer, getBotConfig } from '@/lib/zalo-bot-client';
import prisma from '@/lib/prisma';

function getPublicBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/$/, '');
}

async function getLocalBaseUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'app_local_url' } });
    const val = row?.giaTri?.trim();
    return val ? val.replace(/\/$/, '') : null;
  } catch { return null; }
}

async function getSavedWebhookUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_url' } });
    return row?.giaTri?.trim() || null;
  } catch { return null; }
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

  // Ưu tiên: 1) URL do user nhập, 2) URL đã lưu trong DB, 3) app_local_url (IP LAN), 4) NEXTAUTH_URL
  const localBase = await getLocalBaseUrl();
  const base = localBase || getPublicBaseUrl() || 'http://localhost:3000';
  const saved = await getSavedWebhookUrl();
  const webhookUrl: string =
    (body?.webhookUrl?.trim()) ||
    saved ||
    `${base}/api/zalo/webhook`;

  const result = await setWebhookOnBotServer(ownId, webhookUrl);

  // Lưu URL vào DB để form load lại đúng
  if (result.ok) {
    await prisma.caiDat.upsert({
      where: { khoa: 'zalo_webhook_url' },
      update: { giaTri: webhookUrl },
      create: { khoa: 'zalo_webhook_url', giaTri: webhookUrl },
    }).catch(() => {});
  }

  return NextResponse.json({ ...result, webhookUrl, ownId });
}
