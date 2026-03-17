/**
 * Singleton EventEmitter để thông báo real-time khi có tin nhắn Zalo mới.
 *
 * Flow:
 *   webhook / polling-worker lưu tin → emitNewMessage()
 *   SSE stream lắng nghe → đẩy xuống client ngay lập tức
 *
 * Vì Next.js dùng cùng Node.js process, module-level singleton này
 * hoạt động ổn định giữa các route handler.
 */
import { EventEmitter } from 'events';
import prisma from '@/lib/prisma';

export interface ZaloMessageEvent {
  id: string;
  chatId: string;
  displayName: string | null;
  content: string;
  role: string;
  eventName: string;
  createdAt: Date;
  rawPayload?: unknown;
}

class ZaloMessageEmitter extends EventEmitter {}

// Singleton — dùng globalThis để tránh hot-reload tạo nhiều instance
const globalKey = '__zaloMessageEmitter__';
let emitter: ZaloMessageEmitter;

if ((globalThis as any)[globalKey]) {
  emitter = (globalThis as any)[globalKey];
} else {
  emitter = new ZaloMessageEmitter();
  emitter.setMaxListeners(200); // nhiều SSE client mở cùng lúc
  (globalThis as any)[globalKey] = emitter;
}

export const zaloMessageEmitter = emitter;

/** Gọi sau khi lưu tin nhắn vào DB */
export function emitNewMessage(msg: ZaloMessageEvent): void {
  zaloMessageEmitter.emit('message', msg);
  zaloMessageEmitter.emit(`message:${msg.chatId}`, msg); // channel riêng theo chatId
}

// ─── Cleanup tin nhắn cũ hơn 48h ─────────────────────────────────────────────

const RETENTION_MS = 48 * 60 * 60 * 1000; // 48 giờ
let lastCleanupAt = 0;

/**
 * Xóa ZaloMessage cũ hơn 48h.
 * Throttled: chạy tối đa 1 lần/giờ để không tốn DB.
 * Gọi từ webhook (mỗi tin nhắn đến) và polling worker (mỗi vòng lặp).
 */
export async function cleanupOldMessages(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < 60 * 60 * 1000) return; // chưa đến 1 giờ → bỏ qua
  lastCleanupAt = now;

  try {
    const cutoff = new Date(now - RETENTION_MS);
    const { count } = await prisma.zaloMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      console.log(`[zalo] cleanup: đã xóa ${count} tin nhắn cũ hơn 48h`);
    }
  } catch (err) {
    console.error('[zalo] cleanup error:', err);
  }
}
