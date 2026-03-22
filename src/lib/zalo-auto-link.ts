/**
 * zalo-auto-link.ts
 *
 * Tự động tra cứu và ghi nhớ zaloChatId cho NguoiDung / KhachThue khi mới tạo.
 * Hỗ trợ nhiều tài khoản bot: mỗi bot account có chatId riêng cho cùng 1 người.
 *
 * Lưu trữ:
 *   zaloChatId  — chatId của tài khoản bot mặc định (backward compat)
 *   zaloChatIds — JSON map { [botAccountId]: chatId } cho tất cả bot accounts
 */

import prisma from '@/lib/prisma';
import { isBotServerMode, findUserViaBotServer, getAccountsFromBotServer } from '@/lib/zalo-bot-client';

/** Lấy danh sách tất cả botAccountId đang được cấu hình trong hệ thống */
async function getAllBotAccountIds(): Promise<string[]> {
  const { accounts } = await getAccountsFromBotServer();
  const ids = accounts
    .map((a: any) => String(a.id || a.name || ''))
    .filter(Boolean);
  return ids.length > 0 ? ids : [''];
}

/** Trả về chatId từ zaloChatIds JSON cho đúng botAccountId, fallback về zaloChatId */
export function resolveChatId(
  record: { zaloChatId?: string | null; zaloChatIds?: any },
  botAccountId: string,
): string | null {
  if (record.zaloChatIds && typeof record.zaloChatIds === 'object') {
    const map = record.zaloChatIds as Record<string, string>;
    if (map[botAccountId]) return map[botAccountId];
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

    const botAccounts = await getAllBotAccountIds();
    const chatIdsMap: Record<string, string> = {};
    let defaultChatId: string | null = null;

    for (const accountId of botAccounts) {
      try {
        const result = await findUserViaBotServer(phone, accountId || undefined);
        if (!result.ok || !result.data) continue;
        const d = result.data as any;
        const uid = String(d.userId ?? d.uid ?? d.id ?? '');
        if (!uid) continue;

        chatIdsMap[accountId || 'default'] = uid;
        if (!defaultChatId) defaultChatId = uid;
      } catch { continue; }
    }

    if (!defaultChatId) return; // Không tìm thấy ở bất kỳ account nào

    if (entityType === 'nguoiDung') {
      await prisma.nguoiDung.update({
        where: { id: entityId },
        data: {
          zaloChatId: defaultChatId,
          zaloChatIds: chatIdsMap,
        },
      });
    } else {
      await prisma.khachThue.update({
        where: { id: entityId },
        data: {
          zaloChatId: defaultChatId,
          zaloChatIds: chatIdsMap,
          nhanThongBaoZalo: true,
        },
      });
    }
  } catch { /* fire-and-forget, bỏ qua lỗi */ }
}

/**
 * Cập nhật zaloChatIds cho 1 record khi nhận được chatId mới từ webhook/chat.
 * Gọi này khi người dùng thực sự nhắn tin (xác nhận chatId đúng cho account đó).
 */
export async function storeChatIdForAccount(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  botAccountId: string,
  chatId: string,
): Promise<void> {
  try {
    if (entityType === 'nguoiDung') {
      const rec = await prisma.nguoiDung.findUnique({ where: { id: entityId }, select: { zaloChatIds: true, zaloChatId: true } });
      const existing = (rec?.zaloChatIds as Record<string, string>) ?? {};
      existing[botAccountId || 'default'] = chatId;
      await prisma.nguoiDung.update({
        where: { id: entityId },
        data: { zaloChatIds: existing, zaloChatId: rec?.zaloChatId ?? chatId },
      });
    } else {
      const rec = await prisma.khachThue.findUnique({ where: { id: entityId }, select: { zaloChatIds: true, zaloChatId: true } });
      const existing = (rec?.zaloChatIds as Record<string, string>) ?? {};
      existing[botAccountId || 'default'] = chatId;
      await prisma.khachThue.update({
        where: { id: entityId },
        data: { zaloChatIds: existing, zaloChatId: rec?.zaloChatId ?? chatId },
      });
    }
  } catch { /* bỏ qua */ }
}
