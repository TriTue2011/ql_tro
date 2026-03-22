/**
 * zalo-auto-link.ts
 *
 * Tự động tra cứu và ghi nhớ zaloChatId cho NguoiDung / KhachThue khi mới tạo.
 * Hỗ trợ nhiều tài khoản bot: mỗi bot account có chatId riêng cho cùng 1 người.
 *
 * Lưu trữ:
 *   zaloChatId  — threadId của tài khoản bot đầu tiên (backward compat)
 *   zaloChatIds — JSON array ZaloChatEntry[] { ten, userId, threadId }
 */

import prisma from '@/lib/prisma';
import { isBotServerMode, findUserViaBotServer, getAccountsFromBotServer } from '@/lib/zalo-bot-client';
import type { ZaloChatEntry } from '@/types';

/** Lấy danh sách tài khoản bot đang chạy từ bot server */
async function getAllBotAccounts(): Promise<{ id: string; ten: string }[]> {
  try {
    const { accounts } = await getAccountsFromBotServer();
    return accounts.map((a: any) => ({
      id: String(a.id || a.name || a.phone || ''),
      ten: String(a.name || a.phone || a.id || 'Bot'),
    })).filter(a => a.id);
  } catch {
    return [{ id: '', ten: 'Bot mặc định' }];
  }
}

/** Lấy threadId phù hợp cho botAccountId từ danh sách entry, fallback về zaloChatId */
export function resolveChatId(
  record: { zaloChatId?: string | null; zaloChatIds?: any },
  botAccountId: string,
): string | null {
  if (Array.isArray(record.zaloChatIds)) {
    const entries = record.zaloChatIds as ZaloChatEntry[];
    // Tìm entry khớp với botAccountId (so sánh theo ten hoặc userId)
    const match = entries.find(e => e.ten === botAccountId || e.userId === botAccountId);
    if (match) return match.threadId || match.userId || null;
    // Nếu không khớp nhưng chỉ có 1 entry, dùng luôn
    if (entries.length === 1) return entries[0].threadId || entries[0].userId || null;
  }
  return record.zaloChatId ?? null;
}

/**
 * Tự động tra cứu chatId cho từng tài khoản bot qua số điện thoại.
 * Fire-and-forget — gọi không cần await, lỗi bị bỏ qua.
 */
export async function autoLinkZaloChatIds(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  phone: string,
): Promise<void> {
  try {
    const inBotMode = await isBotServerMode();
    if (!inBotMode) return;

    const botAccounts = await getAllBotAccounts();
    const newEntries: ZaloChatEntry[] = [];

    for (const account of botAccounts) {
      try {
        const result = await findUserViaBotServer(phone, account.id || undefined);
        if (!result.ok || !result.data) continue;
        const d = result.data as any;
        const uid = String(d.userId ?? d.uid ?? d.id ?? '');
        if (!uid) continue;

        newEntries.push({
          ten: account.ten,
          userId: uid,
          threadId: uid, // Với chat 1-1, threadId = userId
        });
      } catch { continue; }
    }

    if (newEntries.length === 0) return;

    // Merge với entries hiện có (không ghi đè entry đã có cùng ten)
    const mergeEntries = async (existing: any): Promise<ZaloChatEntry[]> => {
      const current: ZaloChatEntry[] = Array.isArray(existing) ? existing : [];
      const result = [...current];
      for (const entry of newEntries) {
        const idx = result.findIndex(e => e.ten === entry.ten);
        if (idx >= 0) {
          result[idx] = entry; // cập nhật
        } else {
          result.push(entry);
        }
      }
      return result;
    };

    if (entityType === 'nguoiDung') {
      const rec = await prisma.nguoiDung.findUnique({ where: { id: entityId }, select: { zaloChatIds: true } });
      const merged = await mergeEntries(rec?.zaloChatIds);
      await prisma.nguoiDung.update({
        where: { id: entityId },
        data: {
          zaloChatId: merged[0]?.threadId ?? null,
          zaloChatIds: merged as any,
        },
      });
    } else {
      const rec = await prisma.khachThue.findUnique({ where: { id: entityId }, select: { zaloChatIds: true } });
      const merged = await mergeEntries(rec?.zaloChatIds);
      await prisma.khachThue.update({
        where: { id: entityId },
        data: {
          zaloChatId: merged[0]?.threadId ?? null,
          zaloChatIds: merged as any,
          nhanThongBaoZalo: true,
        },
      });
    }
  } catch { /* fire-and-forget, bỏ qua lỗi */ }
}

/**
 * Cập nhật / thêm 1 entry vào zaloChatIds khi nhận được chatId từ webhook/chat.
 */
export async function storeChatIdForAccount(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  botAccountTen: string,
  chatId: string,
): Promise<void> {
  try {
    const newEntry: ZaloChatEntry = { ten: botAccountTen, userId: chatId, threadId: chatId };

    if (entityType === 'nguoiDung') {
      const rec = await prisma.nguoiDung.findUnique({ where: { id: entityId }, select: { zaloChatIds: true, zaloChatId: true } });
      const current: ZaloChatEntry[] = Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [];
      const idx = current.findIndex(e => e.ten === botAccountTen);
      if (idx >= 0) current[idx] = newEntry; else current.push(newEntry);
      await prisma.nguoiDung.update({
        where: { id: entityId },
        data: { zaloChatIds: current as any, zaloChatId: rec?.zaloChatId ?? chatId },
      });
    } else {
      const rec = await prisma.khachThue.findUnique({ where: { id: entityId }, select: { zaloChatIds: true, zaloChatId: true } });
      const current: ZaloChatEntry[] = Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [];
      const idx = current.findIndex(e => e.ten === botAccountTen);
      if (idx >= 0) current[idx] = newEntry; else current.push(newEntry);
      await prisma.khachThue.update({
        where: { id: entityId },
        data: { zaloChatIds: current as any, zaloChatId: rec?.zaloChatId ?? chatId },
      });
    }
  } catch { /* bỏ qua */ }
}
