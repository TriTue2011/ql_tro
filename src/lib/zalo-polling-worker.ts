/**
 * Zalo Polling Worker - chạy nền trong Node.js process
 *
 * Tại sao dùng polling thay vì webhook?
 *   - Webhook cần server public URL (hoặc Cloudflare Tunnel) - dễ bị lỗi cấu hình
 *   - getUpdates chạy ổn định hơn, không cần public URL
 *   - Vẫn handle được nhiều người gửi cùng lúc vì Zalo queue tin nhắn server-side
 *     → loop nhanh sẽ drain queue tuần tự
 *
 * Giới hạn:
 *   - Zalo chỉ trả 1 tin/lần gọi → throughput ~30-60 msg/phút (đủ cho trọ nhỏ)
 *   - Worker dừng khi Next.js process restart (dev hot-reload, server restart)
 *   - KHÔNG thể chạy đồng thời với webhook
 */

import prisma from '@/lib/prisma';
import { handleZaloUpdate } from '@/lib/zalo-message-handler';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

// ─── Module-level state ───────────────────────────────────────────────────────

interface WorkerState {
  running: boolean;
  startedAt: Date | null;
  messagesProcessed: number;
  lastMessageAt: Date | null;
  lastError: string | null;
  timerId: ReturnType<typeof setTimeout> | null;
  webhookWasActive: string | null;
}

const state: WorkerState = {
  running: false,
  startedAt: null,
  messagesProcessed: 0,
  lastMessageAt: null,
  lastError: null,
  timerId: null,
  webhookWasActive: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
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
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } catch {
    return null;
  }
}

// ─── Core polling loop ────────────────────────────────────────────────────────

async function pollOnce(): Promise<void> {
  if (!state.running) return;

  const token = await getZaloToken();
  if (!token) {
    state.lastError = 'Chưa cấu hình zalo_access_token';
    scheduleNext(5000);
    return;
  }

  try {
    const res = await fetch(`${ZALO_API}/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout: 5 }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      state.lastError = `Zalo API lỗi: ${res.status}`;
      scheduleNext(3000);
      return;
    }

    const data = await res.json();
    const update = data?.result;

    if (update?.message) {
      state.messagesProcessed++;
      state.lastMessageAt = new Date();
      state.lastError = null;
      await handleZaloUpdate(update, token);
      // Có tin → poll ngay (có thể còn tin tiếp)
      scheduleNext(0);
    } else {
      // Không có tin → poll lại sau 500ms
      scheduleNext(500);
    }
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError';
    state.lastError = isTimeout ? null : `Lỗi kết nối: ${err?.message || ''}`;
    scheduleNext(isTimeout ? 0 : 3000);
  }
}

function scheduleNext(delayMs: number): void {
  if (!state.running) return;
  if (state.timerId) clearTimeout(state.timerId);
  state.timerId = setTimeout(pollOnce, delayMs);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startPolling(): Promise<{ ok: boolean; message: string }> {
  if (state.running) {
    return { ok: true, message: 'Worker đã đang chạy' };
  }

  const token = await getZaloToken();
  if (!token) {
    return { ok: false, message: 'Chưa cấu hình zalo_access_token' };
  }

  // Xóa webhook (bắt buộc để getUpdates hoạt động)
  try {
    const infoRes = await callZalo(token, 'getWebhookInfo', {});
    const existingUrl: string | null = infoRes?.result?.url || null;
    if (existingUrl) {
      state.webhookWasActive = existingUrl;
      await callZalo(token, 'deleteWebhook', {});
    } else {
      state.webhookWasActive = null;
    }
  } catch {
    state.webhookWasActive = null;
  }

  state.running = true;
  state.startedAt = new Date();
  state.messagesProcessed = 0;
  state.lastMessageAt = null;
  state.lastError = null;

  scheduleNext(0);

  return { ok: true, message: 'Polling worker đã khởi động' };
}

export async function stopPolling(restoreWebhook = false): Promise<{ ok: boolean; message: string }> {
  if (!state.running) {
    return { ok: true, message: 'Worker không chạy' };
  }

  state.running = false;
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }

  if (restoreWebhook && state.webhookWasActive) {
    try {
      const token = await getZaloToken();
      if (token) {
        const secret = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_secret' } });
        if (secret?.giaTri) {
          await callZalo(token, 'setWebhook', { url: state.webhookWasActive, secret_token: secret.giaTri.trim() });
        }
      }
    } catch { /* bỏ qua lỗi restore */ }
  }

  const processed = state.messagesProcessed;
  state.startedAt = null;
  state.webhookWasActive = null;

  return { ok: true, message: `Đã dừng polling. Đã xử lý ${processed} tin nhắn.` };
}

export function getPollingStatus() {
  return {
    running: state.running,
    startedAt: state.startedAt?.toISOString() ?? null,
    messagesProcessed: state.messagesProcessed,
    lastMessageAt: state.lastMessageAt?.toISOString() ?? null,
    lastError: state.lastError,
    webhookWillRestore: !!state.webhookWasActive,
  };
}
