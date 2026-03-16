/**
 * zalo-message-handler.ts
 *
 * Xử lý TẤT CẢ tin nhắn đến từ người dùng Zalo.
 * Dùng chung cho cả Webhook và Polling Worker.
 *
 * Luồng xử lý khi nhận 1 update:
 *  1. Lưu tin nhắn vào ZaloMessage (lịch sử)
 *  2. Nếu text là số điện thoại → đăng ký nhận thông báo tự động
 *     a. Tìm khách thuê theo SĐT
 *     b. Nếu tìm thấy  → lưu zaloChatId + bật nhanThongBaoZalo → reply thành công
 *     c. Nếu không tìm → reply "không tìm thấy"
 *     d. Nếu sai định dạng → reply "gửi đúng định dạng"
 *  3. Nếu không phải SĐT → detect tên khớp khách thuê/người dùng (pendingZaloChatId)
 */

import prisma from '@/lib/prisma';
import { getKhachThueRepo } from '@/lib/repositories';
import NguoiDungRepository from '@/lib/repositories/pg/nguoi-dung';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

// Regex số điện thoại VN: bắt đầu 0 hoặc +84, tổng 10-11 ký tự số
const PHONE_REGEX = /^(\+84|0)[0-9]{9}$/;

/** Chuẩn hoá SĐT → luôn dạng 0xxxxxxxxx */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
  return cleaned;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gửi tin nhắn phản hồi về cho người nhắn */
async function sendReply(token: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`${ZALO_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // Không dừng xử lý chỉ vì reply thất bại
  }
}

/** Lưu tin nhắn vào DB */
async function saveMessage(update: any): Promise<void> {
  try {
    const msg = update?.message;
    if (!msg?.from?.id) return;
    await prisma.zaloMessage.create({
      data: {
        chatId: String(msg.from.id),
        displayName: msg.from.display_name || null,
        content: msg.text || msg.attachments?.[0]?.description || '[đính kèm]',
        role: 'user',
        eventName: update?.event_name || 'message',
        rawPayload: update as any,
      },
    });
  } catch { /* không dừng vì lỗi log */ }
}

/** Đăng ký tự động khi khách thuê gửi số điện thoại */
async function handlePhoneRegistration(
  token: string,
  chatId: string,
  rawText: string,
): Promise<boolean> {
  const text = rawText.trim();

  // Kiểm tra có dạng số điện thoại không (chỉ chứa số, +, khoảng trắng)
  const looksLikePhone = /^[\d\s+\-()]{9,15}$/.test(text);
  if (!looksLikePhone) return false; // Không phải SĐT → để detectAndStorePending xử lý

  const phone = normalizePhone(text);

  if (!PHONE_REGEX.test(phone)) {
    // Trông như muốn nhập SĐT nhưng sai định dạng
    await sendReply(
      token, chatId,
      '❌ Số điện thoại không đúng định dạng.\n\n' +
      'Vui lòng gửi số điện thoại 10 số bắt đầu bằng 0.\n' +
      'Ví dụ: 0912345678',
    );
    return true; // Đã xử lý (dù thất bại)
  }

  try {
    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);

    if (!kt) {
      await sendReply(
        token, chatId,
        `❌ Không tìm thấy hồ sơ với số điện thoại ${phone}.\n\n` +
        'Vui lòng kiểm tra lại số điện thoại đã đăng ký với chủ trọ.',
      );
      return true;
    }

    // Đã liên kết chatId này rồi
    if (kt.zaloChatId === chatId && kt.nhanThongBaoZalo) {
      await sendReply(
        token, chatId,
        '✅ Bạn đã đăng ký nhận thông báo Zalo rồi.\n\n' +
        'Để điều chỉnh cài đặt, đăng nhập cổng thông tin khách thuê → Thông tin cá nhân.',
      );
      return true;
    }

    // Lưu chatId + bật thông báo
    await repo.update(kt.id, {
      zaloChatId: chatId,
      pendingZaloChatId: '',
      nhanThongBaoZalo: true,
    });

    await sendReply(
      token, chatId,
      `✅ Đăng ký thành công!\n\n` +
      `Xin chào ${kt.hoTen}, từ giờ bạn sẽ nhận thông báo hóa đơn và hợp đồng qua Zalo này.\n\n` +
      'Để tắt thông báo hoặc thay đổi cài đặt:\n' +
      '▶ Đăng nhập cổng thông tin khách thuê\n' +
      '▶ Vào mục "Thông tin cá nhân"\n' +
      '▶ Chọn bật/tắt "Nhận thông báo qua Zalo"',
    );
    return true;
  } catch (err) {
    console.error('[zalo-handler] handlePhoneRegistration error:', err);
    return false;
  }
}

/** Detect tên → lưu pendingZaloChatId (fallback khi không phải SĐT) */
async function detectAndStorePending(update: any): Promise<void> {
  const msg = update?.message;
  if (!msg?.from?.id) return;

  const chatId = String(msg.from.id);
  const displayName: string = msg.from.display_name || '';
  if (!displayName) return;

  const normalizedSender = normalizeName(displayName);

  try {
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

/**
 * Điểm vào chính — gọi từ Webhook handler hoặc Polling Worker.
 * @param update  Object update từ Zalo (dạng { message: {...}, event_name: '...' })
 * @param token   Zalo Bot Access Token
 */
export async function handleZaloUpdate(update: any, token: string): Promise<void> {
  if (!update?.message?.from?.id) return;

  const msg = update.message;
  const chatId = String(msg.from.id);
  const text: string = msg.text?.trim() || '';

  // 1. Lưu tin nhắn vào lịch sử
  await saveMessage(update);

  // 2. Nếu là số điện thoại → đăng ký tự động, không cần detect tên
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text);
    if (handled) return;
  }

  // 3. Detect tên → pending chatId
  await detectAndStorePending(update);
}
