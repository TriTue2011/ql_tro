/**
 * GET /api/zalo/updates
 * Lấy tin nhắn mới nhất gửi tới bot để tra cứu chat_id.
 *
 * LƯU Ý ZALO: getUpdates KHÔNG hoạt động khi Webhook đã được đăng ký.
 * Flow tự động:
 *   1. deleteWebhook  → xóa webhook hiện tại
 *   2. getUpdates     → long-poll 30s lấy tin nhắn
 *   3. setWebhook     → đăng ký lại webhook (nếu trước đó đã có)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

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

/** Lấy webhook URL hiện tại từ Zalo (để đăng ký lại sau khi getUpdates xong). */
async function getCurrentWebhookUrl(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${ZALO_API}/bot${token}/getWebhookInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return data?.result?.url || null;
  } catch {
    return null;
  }
}

async function callZalo(token: string, endpoint: string, body: object): Promise<any> {
  try {
    const res = await fetch(`${ZALO_API}/bot${token}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } catch (e) {
    console.error(`[callZalo] ${endpoint} error:`, e);
    return null;
  }
}

/** Chuẩn hóa tên để so sánh gần đúng (bỏ dấu, chữ thường). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function detectAndStorePending(update: any): Promise<{ detected: number; details: any[] }> {
  const msg = update?.message;
  if (!msg?.from?.id) return { detected: 0, details: [] };

  const chatId = String(msg.from.id);
  const displayName: string = msg.from.display_name || '';
  if (!displayName) return { detected: 0, details: [] };

  const repo = await getKhachThueRepo();
  const allTenants = await repo.findMany({ limit: 1000 });

  const normalizedSender = normalizeName(displayName);

  const matched = allTenants.data.find(kt => {
    const normalizedKt = normalizeName(kt.hoTen);
    const lastWordKt = normalizedKt.split(' ').pop() ?? '';
    return normalizedKt === normalizedSender ||
      normalizedSender.includes(lastWordKt) ||
      normalizedKt.includes(normalizedSender);
  });

  if (!matched) return { detected: 0, details: [] };
  if (matched.zaloChatId === chatId) return { detected: 0, details: [] };
  if (matched.pendingZaloChatId === chatId) return { detected: 0, details: [] };

  await repo.update(matched.id, { pendingZaloChatId: chatId });

  return {
    detected: 1,
    details: [{
      khachThueId: matched.id,
      hoTen: matched.hoTen,
      soDienThoai: matched.soDienThoai,
      currentZaloChatId: matched.zaloChatId ?? null,
      pendingZaloChatId: chatId,
      zaloDisplayName: displayName,
    }],
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json({ error: 'Chưa cấu hình zalo_access_token' }, { status: 503 });
    }

    // ── Bước 1: Lấy webhook URL hiện tại (để đăng ký lại sau) ──────────────
    const existingWebhookUrl = await getCurrentWebhookUrl(token);

    // ── Bước 2: Xóa webhook (bắt buộc trước khi getUpdates) ─────────────────
    if (existingWebhookUrl) {
      try {
        await callZalo(token, 'deleteWebhook', {});
      } catch {
        // Bỏ qua lỗi xóa webhook — vẫn thử getUpdates
      }
    }

    // ── Bước 3: getUpdates (long-poll 30s) ───────────────────────────────────
    let data: any = null;
    let getUpdatesError: string | null = null;
    try {
      const response = await fetch(`${ZALO_API}/bot${token}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 30 }),
        signal: AbortSignal.timeout(40000),
      });

      if (!response.ok) {
        const txt = await response.text();
        getUpdatesError = `Zalo API lỗi: ${response.status} — ${txt.slice(0, 200)}`;
      } else {
        data = await response.json();
      }
    } catch (err: any) {
      getUpdatesError = err?.name === 'TimeoutError' ? 'Timeout khi gọi Zalo API' : 'Lỗi kết nối Zalo';
    }

    // ── Bước 4: Đăng ký lại webhook (nếu trước đó đã có) ────────────────────
    let webhookRestored = false;
    let webhookRestoreError: string | null = null;
    if (existingWebhookUrl) {
      const secret = await getWebhookSecret();
      if (secret) {
        try {
          await callZalo(token, 'setWebhook', { url: existingWebhookUrl, secret_token: secret });
          webhookRestored = true;
        } catch {
          webhookRestoreError = 'Không thể đăng ký lại Webhook tự động. Hãy vào tab Webhook để đăng ký lại.';
        }
      } else {
        webhookRestoreError = 'Thiếu webhook_secret — không thể đăng ký lại Webhook tự động.';
      }
    }

    // ── Trả về lỗi nếu getUpdates thất bại ──────────────────────────────────
    if (getUpdatesError) {
      return NextResponse.json(
        {
          error: getUpdatesError,
          webhookRestored,
          webhookRestoreError,
        },
        { status: 502 }
      );
    }

    // ── Xử lý kết quả ────────────────────────────────────────────────────────
    const update = data?.result ?? null;
    const pendingInfo = update?.message
      ? await detectAndStorePending(update)
      : { detected: 0, details: [] };

    return NextResponse.json({
      success: true,
      data,
      pendingDetected: pendingInfo.detected,
      pendingDetails: pendingInfo.details,
      webhookWasActive: !!existingWebhookUrl,
      webhookRestored,
      webhookRestoreError,
    });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('[zalo/updates] Lỗi không xử lý được:', msg);
    if (error?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout khi gọi Zalo API' }, { status: 504 });
    }
    return NextResponse.json({ error: `Lỗi máy chủ: ${msg}` }, { status: 500 });
  }
}
