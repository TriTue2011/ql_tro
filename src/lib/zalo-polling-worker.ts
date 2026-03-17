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
import { getKhachThueRepo } from '@/lib/repositories';
import NguoiDungRepository from '@/lib/repositories/pg/nguoi-dung';
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

// ─── Module-level state ───────────────────────────────────────────────────────

interface WorkerState {
  running: boolean;
  startedAt: Date | null;
  messagesProcessed: number;
  lastMessageAt: Date | null;
  lastError: string | null;
  timerId: ReturnType<typeof setTimeout> | null;
  webhookWasActive: string | null; // URL webhook cũ để restore sau
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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

async function saveMessage(update: any): Promise<void> {
  try {
    const msg = update?.message;
    if (!msg?.from?.id) return;
    const chatId = String(msg.from.id);
    const displayName: string = msg.from.display_name || '';
    const content: string = msg.text || msg.attachments?.[0]?.description || '[đính kèm]';
    const eventName: string = update?.event_name || 'message';
    const saved = await prisma.zaloMessage.create({
      data: { chatId, displayName: displayName || null, content, role: 'user', eventName, rawPayload: update as any },
    });
    emitNewMessage({ ...saved });
  } catch {
    // Không dừng worker vì lỗi lưu message
  }
}

async function detectAndStorePending(update: any): Promise<void> {
  const msg = update?.message;
  if (!msg?.from?.id) return;

  const chatId = String(msg.from.id);
  const displayName: string = msg.from.display_name || '';
  if (!displayName) return;

  const normalizedSender = normalizeName(displayName);

  try {
    // Khách thuê
    const ktRepo = await getKhachThueRepo();
    const allKt = await ktRepo.findMany({ limit: 1000 });
    const matchedKt = allKt.data.find(kt => {
      const norm = normalizeName(kt.hoTen);
      const lastWord = norm.split(' ').pop() ?? '';
      return norm === normalizedSender || normalizedSender.includes(lastWord) || norm.includes(normalizedSender);
    });
    if (matchedKt && matchedKt.zaloChatId !== chatId && matchedKt.pendingZaloChatId !== chatId) {
      await ktRepo.update(matchedKt.id, { pendingZaloChatId: chatId });
    }
  } catch { /* bỏ qua */ }

  try {
    // Người dùng (admin/nhân viên)
    const ndRepo = new NguoiDungRepository();
    const allNd = await ndRepo.findMany({ limit: 100 });
    const matchedNd = allNd.data.find(nd => {
      const norm = normalizeName(nd.ten);
      const lastWord = norm.split(' ').pop() ?? '';
      return norm === normalizedSender || normalizedSender.includes(lastWord) || norm.includes(normalizedSender);
    });
    if (matchedNd && matchedNd.zaloChatId !== chatId && matchedNd.pendingZaloChatId !== chatId) {
      await ndRepo.update(matchedNd.id, { pendingZaloChatId: chatId });
    }
  } catch { /* bỏ qua */ }
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
    // Long-poll 5s → trả ngay nếu có tin, chờ 5s nếu không có
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
      await Promise.all([saveMessage(update), detectAndStorePending(update), cleanupOldMessages()]);
      // Có tin → poll ngay (có thể còn tin tiếp)
      scheduleNext(0);
    } else {
      // Không có tin → poll lại sau 500ms
      cleanupOldMessages(); // chạy nền, không await để không trì hoãn polling
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

  // Lưu vào DB để auto-restart sau khi server reboot
  prisma.caiDat.upsert({
    where: { khoa: 'zalo_polling_autostart' },
    update: { giaTri: 'true' },
    create: { khoa: 'zalo_polling_autostart', giaTri: 'true' },
  }).catch(() => {});

  // Bắt đầu loop
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

  // Đăng ký lại webhook nếu cần
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

  // Xóa flag auto-restart
  prisma.caiDat.upsert({
    where: { khoa: 'zalo_polling_autostart' },
    update: { giaTri: 'false' },
    create: { khoa: 'zalo_polling_autostart', giaTri: 'false' },
  }).catch(() => {});

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
