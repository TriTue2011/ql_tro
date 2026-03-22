/**
 * zalo-pending-confirm.ts
 *
 * Xử lý phản hồi xác nhận từ người dùng sau khi nhận tin nhắn chào mừng tự động.
 *
 * Khi người dùng nhắn "Đúng/Phải/Đồng ý/..." → xác nhận pendingZaloChatId → zaloChatId
 * Khi người dùng nhắn "Không/Sai/..."         → xóa pendingZaloChatId
 */

import prisma from '@/lib/prisma';
import { sendMessageViaBotServer } from '@/lib/zalo-bot-client';

// ─── Từ khóa nhận dạng ────────────────────────────────────────────────────────

const AFFIRMATIVE_KEYWORDS = [
  'đúng', 'dung', 'phải', 'phai', 'đồng ý', 'dong y', 'ok', 'okay', 'oke', 'okey',
  'yes', 'ừ', 'u', 'uh', 'uhm', 'ừm', 'có', 'co', 'vâng', 'vang', 'dạ', 'da',
  'chính xác', 'chinh xac', 'xác nhận', 'xac nhan', 'chắc rồi', 'chắc chắn', 'chac chan',
  'đúng rồi', 'dung roi', 'đúng vậy', 'dung vay', 'right', 'correct',
];

const NEGATIVE_KEYWORDS = [
  'không', 'khong', 'sai', 'không đúng', 'khong dung', 'không phải', 'khong phai',
  'nhầm', 'nham', 'không chính xác', 'khong chinh xac', 'no', 'nope',
  'không phải tôi', 'không phải mình', 'nhầm người', 'nham nguoi',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAffirmative(text: string): boolean {
  const n = normalize(text);
  return AFFIRMATIVE_KEYWORDS.some(k => n === k || n.startsWith(k + ' ') || n.endsWith(' ' + k));
}

function isNegative(text: string): boolean {
  const n = normalize(text);
  return NEGATIVE_KEYWORDS.some(k => n === k || n.startsWith(k + ' ') || n.endsWith(' ' + k));
}

// ─── Xác nhận ─────────────────────────────────────────────────────────────────

async function confirmPending(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  chatId: string,
): Promise<void> {
  if (entityType === 'nguoiDung') {
    await prisma.nguoiDung.update({
      where: { id: entityId },
      data: { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true },
    });
  } else {
    await prisma.khachThue.update({
      where: { id: entityId },
      data: { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true },
    });
  }
}

async function rejectPending(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
): Promise<void> {
  if (entityType === 'nguoiDung') {
    await prisma.nguoiDung.update({
      where: { id: entityId },
      data: { pendingZaloChatId: '' },
    });
  } else {
    await prisma.khachThue.update({
      where: { id: entityId },
      data: { pendingZaloChatId: '' },
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Kiểm tra và xử lý phản hồi xác nhận khi người dùng trả lời tin nhắn chào mừng.
 *
 * @param chatId          Zalo chatId của người gửi
 * @param text            Nội dung tin nhắn
 * @param accountSelection  Bot account dùng để gửi phản hồi
 * @returns true nếu đã xử lý (tin nhắn là phản hồi xác nhận), false nếu không liên quan
 */
export async function handlePendingConfirmation(
  chatId: string,
  text: string,
  accountSelection?: string,
): Promise<boolean> {
  if (!text.trim()) return false;

  // Tìm KhachThue hoặc NguoiDung có pendingZaloChatId = chatId
  const [kt, nd] = await Promise.all([
    prisma.khachThue.findFirst({
      where: { pendingZaloChatId: chatId },
      select: { id: true, hoTen: true },
    }),
    prisma.nguoiDung.findFirst({
      where: { pendingZaloChatId: chatId },
      select: { id: true, ten: true },
    }),
  ]);

  const matched = kt
    ? { type: 'khachThue' as const, id: kt.id, ten: kt.hoTen }
    : nd
    ? { type: 'nguoiDung' as const, id: nd.id, ten: nd.ten }
    : null;

  if (!matched) return false;

  if (isAffirmative(text)) {
    await confirmPending(matched.type, matched.id, chatId);
    await sendMessageViaBotServer(
      chatId,
      `Cảm ơn ${matched.ten} đã xác nhận!\n\n` +
        `Từ nay bạn sẽ nhận được thông báo hóa đơn và các thông tin quan trọng qua Zalo này.\n\n` +
        `Nếu cần hỗ trợ, bạn cứ nhắn tin tại đây.`,
      0,
      accountSelection,
    ).catch(() => {});
    return true;
  }

  if (isNegative(text)) {
    await rejectPending(matched.type, matched.id);
    await sendMessageViaBotServer(
      chatId,
      `Đã ghi nhận. Xin lỗi vì sự nhầm lẫn!\n\n` +
        `Nếu bạn muốn liên kết sau, hãy nhắn số điện thoại đăng ký hoặc liên hệ nhà trọ.`,
      0,
      accountSelection,
    ).catch(() => {});
    return true;
  }

  return false;
}
