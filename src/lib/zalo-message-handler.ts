/**
 * zalo-message-handler.ts
 *
 * Xử lý TẤT CẢ tin nhắn đến từ người dùng Zalo.
 * Dùng chung cho cả Webhook và Polling Worker.
 *
 * Luồng xử lý khi nhận 1 update:
 *  1. Lưu tin nhắn vào ZaloMessage (lịch sử)
 *  2. Nếu bot_auto_reply_enabled = false → dừng
 *  3. Nếu text là số điện thoại → đăng ký nhận thông báo tự động
 *  4. Nếu chatId đã là khách thuê đã đăng ký → AI classify intent → reply
 *  5. Nếu chưa đăng ký (người lạ):
 *     a. Gửi lời chào (bot_greeting_stranger)
 *     b. Forward đến nhóm quản lý nếu bot_forward_unknown = true
 *     c. Detect tên → lưu pendingZaloChatId
 */

import prisma from '@/lib/prisma';
import { getKhachThueRepo } from '@/lib/repositories';
import NguoiDungRepository from '@/lib/repositories/pg/nguoi-dung';
import { isBotServerMode, sendMessageViaBotServer, getAllFriendsFromBotServer } from '@/lib/zalo-bot-client';
import { askAI, classifyIntent } from '@/lib/ai-chat';

// ─── Cache bạn bè — refresh mỗi khi có tin nhắn đến ─────────────────────────
// Luôn dùng cache hiện tại (không block), refresh ngầm sau mỗi tin nhắn.
// Vì vậy bạn bè vừa thêm + nhắn ngay thì tin kế tiếp sẽ nhận diện được.
let _friendsCache: Set<string> | null = null;
let _friendsRefreshing = false;

export function refreshFriendsCacheInBackground(): void {
  if (_friendsRefreshing) return;
  _friendsRefreshing = true;
  getAllFriendsFromBotServer()
    .then(result => {
      if (result.ok && result.friends) {
        _friendsCache = new Set(
          result.friends.map((f: any) => String(f.uid ?? f.id ?? f.userId ?? f.zaloId ?? '')).filter(Boolean)
        );
      }
    })
    .catch(() => {})
    .finally(() => { _friendsRefreshing = false; });
}

async function isFriend(chatId: string): Promise<boolean> {
  if (!(await isBotServerMode())) return false;
  if (!_friendsCache) {
    // Lần đầu chưa có cache → fetch đồng bộ 1 lần duy nhất
    await getAllFriendsFromBotServer().then(result => {
      if (result.ok && result.friends) {
        _friendsCache = new Set(
          result.friends.map((f: any) => String(f.uid ?? f.id ?? f.userId ?? f.zaloId ?? '')).filter(Boolean)
        );
      }
    }).catch(() => {});
  }
  return _friendsCache?.has(chatId) ?? false;
}

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

/** Lấy lịch sử gần đây của chatId để đưa vào context AI */
async function getRecentHistory(chatId: string, limit = 6): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  try {
    const msgs = await prisma.zaloMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { role: true, content: true },
    });
    return msgs.reverse().map(m => ({
      role: (m.role === 'bot' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));
  } catch {
    return [];
  }
}

/** Lấy thông tin phòng + hợp đồng hiện tại của khách thuê */
async function getTenantContext(chatId: string): Promise<string> {
  try {
    const kt = await prisma.khachThue.findFirst({
      where: { zaloChatId: chatId },
      select: {
        hoTen: true,
        hopDong: {
          where: { trangThai: 'hoatDong' },
          take: 1,
          select: {
            ngayBatDau: true,
            ngayKetThuc: true,
            tienThue: true,
            phong: {
              select: {
                maPhong: true,
                tang: true,
                toaNha: { select: { tenToaNha: true } },
              },
            },
          },
        },
      },
    });
    if (!kt) return '';
    const hd = kt.hopDong?.[0];
    if (!hd) return `Khách thuê: ${kt.hoTen} (chưa có hợp đồng hoạt động)`;
    const phong = hd.phong;
    return [
      `Khách thuê: ${kt.hoTen}`,
      `Phòng: ${phong.maPhong} - ${phong.toaNha.tenToaNha}`,
      `Tiền thuê: ${hd.tienThue?.toLocaleString('vi-VN')}đ/tháng`,
      `Hợp đồng: ${new Date(hd.ngayBatDau).toLocaleDateString('vi-VN')} – ${new Date(hd.ngayKetThuc).toLocaleDateString('vi-VN')}`,
    ].join('\n');
  } catch {
    return '';
  }
}

/**
 * Xử lý khách thuê đã đăng ký bằng AI.
 * - Classify intent → trả lời hướng dẫn phù hợp
 * - Fallback: liên hệ phụ trách hoặc zalo_tin_nhan_ho_tro
 * Trả về true nếu đã xử lý.
 */
async function handleRegisteredTenant(token: string, chatId: string, text: string): Promise<boolean> {
  const kt = await findKhachThueByZaloChatId(chatId);
  if (!kt) return false;

  // Thử AI classify + trả lời
  if (text) {
    const intent = await classifyIntent(text);
    if (intent && intent !== 'other') {
      const tenantCtx = await getTenantContext(chatId);
      const history = await getRecentHistory(chatId);
      const systemPrompt = [
        'Bạn là trợ lý ảo của nhà trọ, trả lời ngắn gọn, thân thiện bằng tiếng Việt.',
        'Chỉ trả lời về: hóa đơn, hợp đồng, sự cố, phòng trống. Không bịa thông tin.',
        'Nếu không có thông tin cụ thể, hướng dẫn liên hệ quản lý.',
        tenantCtx ? `\nThông tin khách thuê:\n${tenantCtx}` : '',
      ].filter(Boolean).join('\n');

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: text },
      ];
      const aiReply = await askAI(messages);
      if (aiReply) {
        await sendReply(token, chatId, aiReply);
        // Lưu tin nhắn bot vào lịch sử
        await prisma.zaloMessage.create({
          data: { chatId, content: aiReply, role: 'bot', eventName: 'bot_reply', rawPayload: {} },
        }).catch(() => {});
        return true;
      }
    }
  }

  // Fallback: liên hệ phụ trách của tòa nhà
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

  // Fallback: nội dung toàn cục
  const hoTroMsg = await getHoTroMessage();
  if (!hoTroMsg) return true; // đã đăng ký nhưng chưa cấu hình → im lặng
  await sendReply(token, chatId, hoTroMsg);
  return true;
}

/** Gửi lời chào cho người lạ + forward đến nhóm quản lý nếu được cấu hình */
async function handleStranger(token: string, chatId: string, displayName: string, text: string): Promise<void> {
  try {
    const rows = await prisma.caiDat.findMany({
      where: { khoa: { in: ['bot_greeting_stranger', 'bot_forward_unknown', 'bot_forward_thread_id'] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.khoa] = r.giaTri?.trim() ?? '';

    // Gửi lời chào — bỏ qua nếu người gửi đã là bạn bè Zalo
    const greeting = map['bot_greeting_stranger'];
    const alreadyFriend = await isFriend(chatId);
    if (greeting && !alreadyFriend) {
      await sendReply(token, chatId, greeting);
      await prisma.zaloMessage.create({
        data: { chatId, content: greeting, role: 'bot', eventName: 'bot_greeting', rawPayload: {} },
      }).catch(() => {});
    }

    // Forward đến nhóm quản lý
    const shouldForward = map['bot_forward_unknown'] !== 'false';
    const forwardThreadId = map['bot_forward_thread_id'];
    if (shouldForward && forwardThreadId && text) {
      const fwdMsg = [
        `📨 Tin nhắn từ người lạ`,
        `👤 Tên: ${displayName || '(không rõ)'}`,
        `🆔 ChatId: ${chatId}`,
        `💬 Nội dung: ${text}`,
      ].join('\n');
      await sendReply(token, forwardThreadId, fwdMsg);
    }
  } catch { /* fire-and-forget */ }
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
 * Lọc theo: ha_zalo_allowed_threads — JSON array [{threadId, type}] hoặc legacy comma-separated.
 *           Mỗi entry có type: 0 (người dùng) hoặc 1 (nhóm).
 * Fire-and-forget — không block xử lý chính.
 */
export async function notifyHomeAssistant(update: any): Promise<void> {
  try {
    const [urlRow, threadsRow] = await Promise.all([
      prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_notify_url' } }),
      prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_allowed_threads' } }),
    ]);

    const url = urlRow?.giaTri?.trim();
    if (!url) return;

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
    const msgTypeNum = isGroup ? 1 : 0;

    // Lọc theo danh sách thread ID + type
    const allowedThreadsRaw = threadsRow?.giaTri?.trim() || '';
    if (allowedThreadsRaw) {
      if (allowedThreadsRaw.startsWith('[')) {
        // New format: JSON array [{threadId, type}]
        try {
          const entries: { threadId: string; type: number }[] = JSON.parse(allowedThreadsRaw);
          if (entries.length > 0) {
            const match = entries.find(e => e.threadId === threadId);
            if (!match) return; // thread ID không nằm trong danh sách
            if (match.type !== msgTypeNum) return; // type không khớp (0=user, 1=group)
          }
        } catch { /* parse lỗi → bỏ qua filter */ }
      } else {
        // Legacy format: comma/newline separated (không lọc type)
        const allowed = allowedThreadsRaw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        if (allowed.length > 0 && !allowed.includes(threadId)) return;
      }
    }

    // Người gửi (uidFrom) — với nhóm khác threadId, với user trùng threadId
    const senderUid: string =
      data?.uidFrom ? String(data.uidFrom) :
      msg?.from?.id ? String(msg.from.id) :
      update?.sender?.id ? String(update.sender.id) :
      update?.uidFrom ? String(update.uidFrom) : '';

    const displayName =
      msg?.from?.display_name ||
      update?.sender?.display_name || update?.sender?.name ||
      data?.dName || data?.fromD || data?.displayName ||
      update?.dName || update?.fromD || '';

    // ID nhóm (với nhóm = threadId, với user = null)
    const groupId: string | null = isGroup ? threadId : null;
    // idTo — ID đích nhận tin (nhóm hoặc bot account)
    const idTo: string = data?.idTo ? String(data.idTo) : '';

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

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ql_tro_zalo',
        thread_id: threadId,
        type: isGroup ? 'group' : 'user',
        sender_id: senderUid,
        group_id: groupId,
        id_to: idTo,
        display_name: displayName,
        msg_type: msgType,
        message: content,
        attachment_url: attachmentUrl,
        file_name: fileName,
        event_name: eventName,
        ttl: data?.ttl ?? null,
      }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {/* bỏ qua lỗi forward */});
  } catch { /* không ảnh hưởng luồng chính */ }
}

/**
 * Điểm vào chính — gọi từ Webhook handler hoặc Polling Worker.
 * @param update  Object update từ Zalo (dạng { message: {...}, event_name: '...' })
 * @param token   Zalo Bot Access Token (dùng cho OA mode; bỏ qua khi bot server mode)
 */
export async function handleZaloUpdate(update: any, token: string): Promise<void> {
  if (!update?.message?.from?.id) return;

  const msg = update.message;
  const chatId = String(msg.from.id);
  const displayName: string = msg.from?.display_name || '';
  const text: string = msg.text?.trim() || '';

  // 1. Lưu lịch sử
  await saveMessage(update);

  // 2. Kiểm tra bot_auto_reply_enabled
  const autoReplyRow = await prisma.caiDat.findFirst({ where: { khoa: 'bot_auto_reply_enabled' } });
  if (autoReplyRow?.giaTri?.trim() === 'false') return;

  // 3. Số điện thoại → đăng ký
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text);
    if (handled) return;
  }

  // 4. Khách thuê đã đăng ký → AI reply
  const isRegistered = await handleRegisteredTenant(token, chatId, text);
  if (isRegistered) return;

  // 5. Người lạ → lời chào + forward + detect pending
  await Promise.all([
    handleStranger(token, chatId, displayName, text),
    detectAndStorePending(update),
  ]);
}

/**
 * Auto-reply handler — gọi từ webhook khi không muốn dùng handleZaloUpdate đầy đủ.
 * Bỏ qua bước lưu lịch sử (webhook đã lưu riêng).
 */
export async function handleZaloAutoReply(update: any, token = ''): Promise<void> {
  const msg = update?.message;
  const data = update?.data; // bot server (zca-js)

  const chatId: string =
    msg?.from?.id ? String(msg.from.id) :
    data?.uidFrom ? String(data.uidFrom) :
    update?.uidFrom ? String(update.uidFrom) : '';
  if (!chatId) return;

  // Nếu token không được truyền vào và đang ở OA mode, tự fetch từ DB
  if (!token && !(await isBotServerMode())) {
    token = (await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } }))?.giaTri?.trim() ?? '';
  }

  // Bỏ qua tin nhắn từ nhóm (type = 1)
  if (update?.type === 1) return;

  // Trigger refresh danh sách bạn bè ngầm ngay khi nhận tin nhắn
  // (không block, dùng kết quả ở tin nhắn kế tiếp)
  refreshFriendsCacheInBackground();

  const displayName: string =
    msg?.from?.display_name ||
    data?.dName || data?.fromD || update?.dName || '';
  const text: string =
    (msg?.text || (typeof data?.content === 'string' ? data.content : '') || update?.content || '').trim();

  // Kiểm tra bot_auto_reply_enabled
  const autoReplyRow = await prisma.caiDat.findFirst({ where: { khoa: 'bot_auto_reply_enabled' } });
  if (autoReplyRow?.giaTri?.trim() === 'false') return;

  // Số điện thoại → đăng ký
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text);
    if (handled) return;
  }

  // Khách thuê đã đăng ký → AI reply
  const isRegistered = await handleRegisteredTenant(token, chatId, text);
  if (isRegistered) return;

  // Người lạ → lời chào + forward
  await handleStranger(token, chatId, displayName, text);
}
