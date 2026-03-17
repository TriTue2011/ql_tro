/**
 * GET  /api/zalo/set-webhook  → trả về webhook URL gợi ý (từ NEXTAUTH_URL)
 * POST /api/zalo/set-webhook  → đăng ký / xóa / kiểm tra webhook Zalo Bot
 * Chỉ admin và chuNha được phép.
 *
 * POST body: { action: 'setWebhook', webhookUrl?: string }
 *          | { action: 'deleteWebhook' }
 *          | { action: 'getWebhookInfo' }
 *
 * Nếu không truyền webhookUrl, server tự dùng NEXTAUTH_URL + /api/zalo/webhook
 * → hoạt động đúng với Cloudflare Tunnel (NEXTAUTH_URL = public tunnel URL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

/** Lấy base URL công khai từ NEXTAUTH_URL (ưu tiên) hoặc APP_URL. */
function getPublicBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.APP_URL || '';
  return url.replace(/\/$/, '');
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setWebhook'),
    // Optional — nếu không truyền, server dùng NEXTAUTH_URL
    webhookUrl: z.string().url('webhookUrl phải là URL hợp lệ').optional(),
  }),
  z.object({ action: z.literal('deleteWebhook') }),
  z.object({ action: z.literal('getWebhookInfo') }),
  z.object({ action: z.literal('testWebhook') }),
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

/** GET: Trả về webhook URL gợi ý dựa trên NEXTAUTH_URL (server-side) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const base = getPublicBaseUrl();
  return NextResponse.json({
    webhookUrl: base ? `${base}/api/zalo/webhook` : '',
    baseUrl: base,
    source: base ? (process.env.NEXTAUTH_URL ? 'NEXTAUTH_URL' : 'APP_URL') : 'unknown',
  });
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

      // Dùng URL do client gửi, hoặc tự tính từ NEXTAUTH_URL
      const base = getPublicBaseUrl();
      const finalUrl = parsed.data.webhookUrl || (base ? `${base}/api/zalo/webhook` : null);
      if (!finalUrl) {
        return NextResponse.json(
          { error: 'Không xác định được Webhook URL. Hãy cấu hình NEXTAUTH_URL hoặc nhập URL thủ công.' },
          { status: 400 }
        );
      }

      const res = await fetch(`${ZALO_API}/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: finalUrl,
          secret_token: secret,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();

      if (data?.error_code === 0 || data?.ok) {
        // Webhook đăng ký thành công → tắt auto-start polling để server
        // restart không xóa mất webhook
        await prisma.caiDat.upsert({
          where: { khoa: 'zalo_polling_autostart' },
          update: { giaTri: 'false' },
          create: { khoa: 'zalo_polling_autostart', giaTri: 'false' },
        });
        // Dừng polling đang chạy (nếu có) để không conflict với webhook
        const { stopPolling } = await import('@/lib/zalo-polling-worker');
        await stopPolling(false);
      }

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

    if (action === 'testWebhook') {
      const secret = await getWebhookSecret();
      if (!secret) {
        return NextResponse.json({ error: 'Chưa cấu hình zalo_webhook_secret' }, { status: 400 });
      }

      // Gửi POST giả lập đến chính webhook endpoint (qua localhost)
      const base = getPublicBaseUrl() || 'http://localhost:3000';
      const webhookUrl = `${base}/api/zalo/webhook`;
      const fakePayload = {
        event_name: 'message',
        message: {
          from: { id: 'test_000', display_name: 'Webhook Test' },
          text: `[TEST] kiểm tra webhook lúc ${new Date().toLocaleTimeString('vi-VN')}`,
        },
      };

      let sendOk = false;
      let sendStatus = 0;
      let sendBody = '';
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bot-Api-Secret-Token': secret,
          },
          body: JSON.stringify(fakePayload),
          signal: AbortSignal.timeout(10000),
        });
        sendStatus = res.status;
        sendBody = await res.text();
        sendOk = res.ok;
      } catch (err: any) {
        sendBody = err?.message || String(err);
      }

      if (!sendOk) {
        return NextResponse.json({
          success: false,
          webhookUrl,
          status: sendStatus,
          response: sendBody,
          hint: sendStatus === 401
            ? 'Secret token không khớp — kiểm tra lại zalo_webhook_secret'
            : sendStatus === 503
            ? 'Webhook secret chưa cấu hình trên server'
            : 'Webhook không phản hồi OK',
        });
      }

      return NextResponse.json({
        success: true,
        webhookUrl,
        status: sendStatus,
        message: 'Webhook nhận tin thành công — tin nhắn test đã được lưu vào DB',
      });
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
