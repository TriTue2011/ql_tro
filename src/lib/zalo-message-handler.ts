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
 *  3. Nếu chatId đã là khách thuê đã đăng ký → reply thông tin liên hệ hỗ trợ
 *     (nội dung cấu hình trong CaiDat: zalo_tin_nhan_ho_tro)
 *  4. Nếu chưa đăng ký → detect tên khớp → lưu pendingZaloChatId
 *
 * Ghi chú: bước 3 là placeholder — sau này có thể tích hợp AI xử lý.
 */

import prisma from '@/lib/prisma';
import { getKhachThueRepo } from '@/lib/repositories';
import NguoiDungRepository from '@/lib/repositories/pg/nguoi-dung';
import { isBotServerMode, sendMessageViaBotServer } from '@/lib/zalo-bot-client';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

const PHONE_REGEX = /^(\+84|0)[0-9]{9}$/;

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

async function sendReply(token: string, chatId: string, text: string): Promise<void> {
  try {
    if (await isBotServerMode()) {
      await sendMessageViaBotServer(chatId, text);
      return;
    }
    await fetch(`${ZALO_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch { /* không dừng xử lý */ }
}

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

/** Lấy nội dung tin nhắn hỗ trợ từ CaiDat */
async function getHoTroMessage(): Promise<string> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_tin_nhan_ho_tro' } });
    return s?.giaTri?.trim() || '';
  } catch {
    return '';
  }
}

/** Kiểm tra chatId có phải khách thuê đã đăng ký không */
async function findKhachThueByZaloChatId(chatId: string) {
  try {
    return await prisma.khachThue.findFirst({
      where: { zaloChatId: chatId },
      select: { id: true, hoTen: true },
    });
  } catch {
    return null;
  }
}

/** Đăng ký tự động khi khách thuê gửi số điện thoại */
async function handlePhoneRegistration(token: string, chatId: string, rawText: string): Promise<boolean> {
  const text = rawText.trim();

  const looksLikePhone = /^[\d\s+\-()]{9,15}$/.test(text);
  if (!looksLikePhone) return false;

  const phone = normalizePhone(text);

  if (!PHONE_REGEX.test(phone)) {
    await sendReply(
      token, chatId,
      '❌ Số điện thoại không đúng định dạng.\n\n' +
      'Vui lòng gửi số điện thoại 10 số bắt đầu bằng 0.\n' +
      'Ví dụ: 0912345678',
    );
    return true;
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

    if (kt.zaloChatId === chatId && kt.nhanThongBaoZalo) {
      await sendReply(
        token, chatId,
        '✅ Bạn đã đăng ký nhận thông báo Zalo rồi.\n\n' +
        'Để điều chỉnh cài đặt, đăng nhập cổng thông tin khách thuê → Thông tin cá nhân.',
      );
      return true;
    }

    await repo.update(kt.id, { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true });

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

/** Lấy danh sách liên hệ phụ trách của tòa nhà theo chatId khách thuê */
async function getBuildingContactsForTenant(chatId: string): Promise<{ ten: string; soDienThoai: string; vaiTro?: string }[]> {
  try {
    // Tìm hợp đồng đang hoạt động → phòng → tòa nhà → liên hệ phụ trách
    const hopDong = await prisma.hopDong.findFirst({
      where: {
        trangThai: 'hoatDong',
        khachThue: { some: { zaloChatId: chatId } },
      },
      select: {
        phong: {
          select: {
            toaNha: {
              select: { lienHePhuTrach: true, tenToaNha: true },
            },
          },
        },
      },
    });
    const lienHe = hopDong?.phong?.toaNha?.lienHePhuTrach;
    if (!Array.isArray(lienHe) || lienHe.length === 0) return [];
    return lienHe as { ten: string; soDienThoai: string; vaiTro?: string }[];
  } catch {
    return [];
  }
}

/**
 * Gửi thông tin liên hệ hỗ trợ cho khách thuê đã đăng ký.
 * Ưu tiên dùng danh sách liên hệ phụ trách của tòa nhà,
 * nếu không có thì dùng cài đặt toàn cục zalo_tin_nhan_ho_tro.
 * Trả về true nếu đã xử lý (dù có thông tin hay không).
 */
async function handleRegisteredTenant(token: string, chatId: string): Promise<boolean> {
  const kt = await findKhachThueByZaloChatId(chatId);
  if (!kt) return false; // chưa đăng ký → không xử lý ở đây

  // Thử lấy liên hệ của tòa nhà trước
  const contacts = await getBuildingContactsForTenant(chatId);
  if (contacts.length > 0) {
    const lines = [
      '📞 Thông tin liên hệ hỗ trợ:',
      '',
      ...contacts.map((c, i) => {
        const vaiTro = c.vaiTro ? ` (${c.vaiTro})` : '';
        return `${i + 1}. ${c.ten}${vaiTro}\n   📱 ${c.soDienThoai}`;
      }),
    ];
    await sendReply(token, chatId, lines.join('\n'));
    return true;
  }

  // Fallback: dùng nội dung toàn cục
  const hoTroMsg = await getHoTroMessage();
  if (!hoTroMsg) return true; // đã đăng ký nhưng chưa cấu hình → im lặng

  await sendReply(token, chatId, hoTroMsg);
  return true;
}

/** Detect tên → lưu pendingZaloChatId (chỉ cho người chưa đăng ký) */
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
 * Forward tin nhắn Zalo đến Home Assistant webhook nếu đã cấu hình ha_zalo_notify_url.
 * Hỗ trợ cả Zalo OA Bot API format và Bot Server (zca-js) format.
 * Lọc theo: ha_zalo_allowed_threads (danh sách thread ID, trống = tất cả)
 *           ha_zalo_type_filter ('all'/'user'/'group')
 * Fire-and-forget — không block xử lý chính.
 */
export async function notifyHomeAssistant(update: any): Promise<void> {
  try {
    const [urlRow, threadsRow, typeRow, webhookIdRow] = await Promise.all([
      prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_notify_url' } }),
      prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_allowed_threads' } }),
      prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_type_filter' } }),
      prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_trigger_webhook_id' } }),
    ]);

    const url = urlRow?.giaTri?.trim();
    const triggerWebhookId = webhookIdRow?.giaTri?.trim();
    if (!url && !triggerWebhookId) return;

    const msg = update?.message;
    const data = update?.data; // bot server (zca-js) wraps payload in .data

    // Hỗ trợ cả 3 format: OA Bot API, Zalo OA API, Bot Server
    const threadId: string =
      update?.threadId ? String(update.threadId) :
      msg?.from?.id ? String(msg.from.id) :
      update?.sender?.id ? String(update.sender.id) :
      data?.uidFrom ? String(data.uidFrom) :
      update?.uidFrom ? String(update.uidFrom) : '';

    // Type: 0 = user, 1 = group (bot server), fallback = 'user'
    const rawType = update?.type;
    const isGroup = rawType === 1;

    // Lọc theo loại (user/group)
    const typeFilter = typeRow?.giaTri?.trim() || 'all';
    if (typeFilter === 'user' && isGroup) return;
    if (typeFilter === 'group' && !isGroup) return;

    // Lọc theo thread ID whitelist
    const allowedThreadsRaw = threadsRow?.giaTri?.trim() || '';
    if (allowedThreadsRaw) {
      const allowed = allowedThreadsRaw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(threadId)) return;
    }

    const displayName =
      msg?.from?.display_name ||
      update?.sender?.display_name || update?.sender?.name ||
      data?.dName || data?.fromD || data?.displayName ||
      update?.dName || update?.fromD || '';

    const msgType = data?.msgType || 'webchat';
    let content = '';
    let attachmentUrl: string | null = null;
    let fileName: string | null = null;

    if (msgType === 'chat.photo') {
      const c = data?.content ?? {};
      attachmentUrl = typeof c === 'object' ? (c.href || c.thumb || null) : null;
      content = typeof c === 'object' ? (c.description || c.title || '[hình ảnh]') : '[hình ảnh]';
    } else if (msgType === 'share.file') {
      const c = data?.content ?? {};
      attachmentUrl = typeof c === 'object' ? (c.href || null) : null;
      fileName = typeof c === 'object' ? (c.title || 'file') : 'file';
      content = fileName;
    } else {
      content =
        msg?.text ||
        (typeof data?.content === 'string' ? data.content : '') ||
        update?.content || update?.msg || '';
    }

    const eventName = update?.event_name || update?.event || String(update?.type ?? 'message');

    const payload = JSON.stringify({
      source: 'ql_tro_zalo',
      thread_id: threadId,
      type: isGroup ? 'group' : 'user',
      display_name: displayName,
      msg_type: msgType,
      message: content,
      attachment_url: attachmentUrl,
      file_name: fileName,
      event_name: eventName,
      ttl: data?.ttl ?? null,
    });

    // Gửi đến notify URL (forward tin nhắn)
    if (url) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(8_000),
      }).catch(() => {/* bỏ qua lỗi forward */});
    }

    // Gửi đến trigger webhook ID (trigger HA automation)
    if (triggerWebhookId && url) {
      try {
        const u = new URL(url);
        const triggerUrl = `${u.protocol}//${u.host}/api/webhook/${triggerWebhookId}`;
        if (triggerUrl !== url) {
          fetch(triggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: AbortSignal.timeout(8_000),
          }).catch(() => {/* bỏ qua */});
        }
      } catch { /* URL parse error */ }
    }
  } catch { /* không ảnh hưởng luồng chính */ }
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

  // 1. Lưu lịch sử
  await saveMessage(update);

  // 2. Số điện thoại → đăng ký
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text);
    if (handled) return;
  }

  // 3. Khách thuê đã đăng ký → reply thông tin liên hệ hỗ trợ
  const isRegistered = await handleRegisteredTenant(token, chatId);
  if (isRegistered) return;

  // 4. Chưa đăng ký → detect tên → pendingZaloChatId
  await detectAndStorePending(update);
}
