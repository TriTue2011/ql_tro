/**
 * zalo-friends.ts
 *
 * Quản lý danh sách bạn bè Zalo lưu trong DB (ZaloBanBe).
 *
 * Luồng:
 *  1. Khi đăng nhập bot server → syncFriendsToDb(accountId) → lưu toàn bộ friend list vào DB
 *  2. Khi có tin nhắn → isFriendInDb(accountId, chatId) → check DB
 *  3. Nếu không có trong DB → refreshAndCheckFriend(accountId, chatId) → fetch lại 1 lần
 *     → nếu có → lưu DB + return true
 *     → nếu không → return false (người lạ thật)
 */

import prisma from '@/lib/prisma';
import { getAllFriendsFromBotServer } from '@/lib/zalo-bot-client';

// ─── Extract tất cả ID có thể từ friend object ────────────────────────────────

const ID_KEYS = ['uid', 'id', 'userId', 'userKey', 'zaloId', 'globalId'] as const;

function extractFriendIds(friend: any): string[] {
  const ids: string[] = [];
  for (const key of ID_KEYS) {
    const v = friend[key];
    if (v) ids.push(String(v));
  }
  return ids;
}

// ─── Sync toàn bộ friend list vào DB ──────────────────────────────────────────

/**
 * Fetch friend list từ bot server và lưu/cập nhật vào ZaloBanBe.
 * Gọi khi: đăng nhập bot server, set webhook, hoặc cần refresh toàn bộ.
 * @returns Số bạn bè đã sync
 */
export async function syncFriendsToDb(accountId: string): Promise<number> {
  if (!accountId) return 0;

  const result = await getAllFriendsFromBotServer(accountId);
  if (!result.ok || !result.friends?.length) return 0;

  let count = 0;
  // Batch upsert — mỗi friend có thể có nhiều ID, lấy ID đầu tiên làm primary
  for (const f of result.friends) {
    const ids = extractFriendIds(f);
    if (ids.length === 0) continue;

    const displayName = f.displayName || f.zaloName || f.name || null;
    const zaloName = f.zaloName || null;
    const phone = f.phoneNumber || f.phone || null;

    // Upsert cho mỗi ID variant (để match được dù webhook gửi ID nào)
    for (const friendId of ids) {
      try {
        await prisma.zaloBanBe.upsert({
          where: {
            zaloAccountId_friendUserId: { zaloAccountId: accountId, friendUserId: friendId },
          },
          create: {
            zaloAccountId: accountId,
            friendUserId: friendId,
            displayName,
            zaloName,
            phone,
          },
          update: {
            displayName,
            zaloName,
            phone,
          },
        });
      } catch { /* duplicate or constraint — bỏ qua */ }
    }
    count++;
  }

  return count;
}

// ─── Check bạn bè trong DB ───────────────────────────────────────────────────

/**
 * Kiểm tra chatId có phải bạn bè của accountId không (chỉ check DB).
 */
export async function isFriendInDb(accountId: string, chatId: string): Promise<boolean> {
  if (!accountId || !chatId) return false;
  const found = await prisma.zaloBanBe.findFirst({
    where: { zaloAccountId: accountId, friendUserId: chatId },
    select: { id: true },
  });
  return !!found;
}

/**
 * Nếu chatId không có trong DB → fetch lại friend list từ bot server 1 lần.
 * Nếu sau khi fetch lại mà có → lưu DB + return true.
 * Nếu vẫn không có → return false (người lạ thật).
 */
export async function refreshAndCheckFriend(
  accountId: string,
  chatId: string,
): Promise<boolean> {
  if (!accountId || !chatId) return false;

  // Fetch lại toàn bộ friend list
  const result = await getAllFriendsFromBotServer(accountId);
  if (!result.ok || !result.friends?.length) return false;

  // Tìm xem chatId có trong friend list mới không
  let matched: any = null;
  for (const f of result.friends) {
    const ids = extractFriendIds(f);
    if (ids.includes(chatId)) {
      matched = f;
      break;
    }
  }

  if (!matched) return false;

  // Có trong friend list → lưu vào DB
  const displayName = matched.displayName || matched.zaloName || matched.name || null;
  const zaloName = matched.zaloName || null;
  const phone = matched.phoneNumber || matched.phone || null;

  const ids = extractFriendIds(matched);
  for (const friendId of ids) {
    try {
      await prisma.zaloBanBe.upsert({
        where: {
          zaloAccountId_friendUserId: { zaloAccountId: accountId, friendUserId: friendId },
        },
        create: {
          zaloAccountId: accountId,
          friendUserId: friendId,
          displayName,
          zaloName,
          phone,
        },
        update: { displayName, zaloName, phone },
      });
    } catch { /* bỏ qua */ }
  }

  // Sync toàn bộ luôn (background) để lần sau check nhanh
  syncFriendsToDb(accountId).catch(() => {});

  return true;
}
