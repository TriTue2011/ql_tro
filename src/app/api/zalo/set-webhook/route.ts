/**
 * POST /api/zalo/set-webhook
 * Quản lý Webhook Zalo Bot: đăng ký, xóa, kiểm tra trạng thái.
 * Chỉ admin và chuNha được phép.
 *
 * Body: { action: 'setWebhook', webhookUrl: string }
 *     | { action: 'deleteWebhook' }
 *     | { action: 'getWebhookInfo' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setWebhook'),
    webhookUrl: z.string().url('webhookUrl phải là URL hợp lệ'),
  }),
  z.object({ action: z.literal('deleteWebhook') }),
  z.object({ action: z.literal('getWebhookInfo') }),
]);

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

async function getWebhookSecret(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_secret' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'chuNha'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json({ error: 'Chưa cấu hình zalo_access_token' }, { status: 503 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { action } = parsed.data;

    if (action === 'setWebhook') {
      const secret = await getWebhookSecret();
      if (!secret) {
        return NextResponse.json(
          { error: 'Chưa cấu hình zalo_webhook_secret. Hãy lưu Secret Token trước khi đăng ký webhook.' },
          { status: 400 }
        );
      }

      const res = await fetch(`${ZALO_API}/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: parsed.data.webhookUrl,
          secret_token: secret,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, action, result: data });
    }

    if (action === 'deleteWebhook') {
      const res = await fetch(`${ZALO_API}/bot${token}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, action, result: data });
    }

    if (action === 'getWebhookInfo') {
      const res = await fetch(`${ZALO_API}/bot${token}/getWebhookInfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, action, result: data });
    }

    return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout khi gọi Zalo API' }, { status: 504 });
    }
    console.error('[zalo/set-webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
