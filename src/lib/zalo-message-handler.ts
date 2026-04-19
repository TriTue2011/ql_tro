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
 *  4. Khách thuê đã đăng ký → AI trả lời dựa trên DB thực (hóa đơn/hợp đồng/sự cố)
 *     + phân tích ảnh nếu có đính kèm
 *  5. Người lạ:
 *     a. Nếu hỏi thuê phòng → AI giới thiệu phòng trống phù hợp từ DB
 *     b. Gửi lời chào (nếu người mới), forward đến nhóm quản lý
 *     c. Detect tên → lưu pendingZaloChatId
 */

import prisma from '@/lib/prisma';
import { getKhachThueRepo } from '@/lib/repositories';
import NguoiDungRepository from '@/lib/repositories/pg/nguoi-dung';
import { sendMessageViaBotServer, getAllFriendsFromBotServer, getAllGroupsFromBotServer, getGroupMembersFromBotServer, findUserViaBotServer, getUserInfoViaBotServer } from '@/lib/zalo-bot-client';
import { isFriendInDb, refreshAndCheckFriend } from '@/lib/zalo-friends';
import { emitNewMessage } from '@/lib/zalo-message-events';
import { askAI, askAIWithImage, AiMessage } from '@/lib/ai-chat';
import { buildContextForRole, buildPublicRoomContext } from '@/lib/ai-context';

// ─── Cache bạn bè + thành viên nhóm ─────────────────────────────────────────
// Refresh ngầm mỗi khi có tin nhắn đến, không block luồng xử lý.
let _friendsCache: Set<string> | null = null;
let _friendsNamesCache: Set<string> | null = null; // tên bạn bè (normalized) để match khi ID khác format
let _friendsRefreshing = false;
let _groupMembersCache: Set<string> | null = null;
let _groupMembersRefreshing = false;

function buildFriendsCache(friends: any[]): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const f of friends) {
    for (const key of ['uid', 'id', 'userId', 'userKey', 'zaloId', 'globalId']) {
      const v = f[key];
      if (v) ids.add(String(v));
    }
    // Cache tên để match khi webhook chatId khác userId format
    for (const key of ['displayName', 'zaloName', 'name']) {
      const n = f[key];
      if (n && typeof n === 'string' && n.trim()) names.add(n.trim().toLowerCase());
    }
  }
  _friendsCache = ids;
  _friendsNamesCache = names;
}

export function refreshFriendsCacheInBackground(): void {
  if (_friendsRefreshing) return;
  _friendsRefreshing = true;
  getAllFriendsFromBotServer()
    .then(result => {
      if (result.ok && result.friends) buildFriendsCache(result.friends);
    })
    .catch(() => {})
    .finally(() => { _friendsRefreshing = false; });
}

export function refreshGroupMembersCacheInBackground(): void {
  if (_groupMembersRefreshing) return;
  _groupMembersRefreshing = true;
  getAllGroupsFromBotServer()
    .then(async result => {
      if (!result.ok || !result.groups?.length) return;
      const allMemberIds = new Set<string>();
      // Tối đa 10 nhóm để tránh quá nhiều API calls
      const groups = result.groups.slice(0, 10);
      await Promise.all(groups.map(async (g: any) => {
        const groupId = String(g.id ?? g.groupId ?? g.threadId ?? '');
        if (!groupId) return;
        // Thử lấy members từ field inline trước
        const inlineMembers: any[] = g.members ?? g.memberInfos ?? g.memberIds ?? [];
        if (inlineMembers.length > 0) {
          for (const m of inlineMembers) {
            const uid = String(m.uid ?? m.id ?? m.userId ?? m ?? '');
            if (uid) allMemberIds.add(uid);
          }
          return;
        }
        // Không có inline → gọi API riêng
        const membersResult = await getGroupMembersFromBotServer(groupId).catch(() => null);
        for (const uid of membersResult?.memberIds ?? []) allMemberIds.add(uid);
      }));
      _groupMembersCache = allMemberIds;
    })
    .catch(() => {})
    .finally(() => { _groupMembersRefreshing = false; });
}

/**
 * Kiểm tra chatId có phải bạn bè của tài khoản bot (accountId) không.
 *
 * Luồng:
 *  1. Check DB (ZaloBanBe) — nhanh, dùng dữ liệu đã sync lúc đăng nhập
 *  2. Nếu không có → fetch lại friend list từ bot server 1 lần
 *     → nếu có → lưu DB + return true (bạn bè mới thêm chưa sync)
 *     → nếu không → return false (người lạ thật)
 *  3. Fallback in-memory cache (legacy) khi không có accountId
 */
async function isFriend(chatId: string, displayName?: string, accountId?: string): Promise<boolean> {
  // ── Có accountId → dùng DB (flow mới) ──
  if (accountId) {
    // Bước 1: check DB
    const inDb = await isFriendInDb(accountId, chatId);
    if (inDb) return true;

    // Bước 2: fetch lại friend list 1 lần để chắc chắn
    const afterRefresh = await refreshAndCheckFriend(accountId, chatId);
    if (afterRefresh) return true;

    return false;
  }

  // ── Không có accountId → fallback in-memory cache (legacy) ──
  if (!_friendsCache) {
    await getAllFriendsFromBotServer().then(result => {
      if (result.ok && result.friends) buildFriendsCache(result.friends);
    }).catch(() => {});
  }
  if (_friendsCache?.has(chatId)) return true;
  if (displayName && _friendsNamesCache?.has(displayName.trim().toLowerCase())) return true;

  // Fallback API real-time
  try {
    const info = await getUserInfoViaBotServer(chatId);
    if (info.ok && info.data) {
      _friendsCache?.add(chatId);
      return true;
    }
  } catch { /* ignore */ }

  return false;
}

function isGroupMember(chatId: string): boolean {
  return _groupMembersCache?.has(chatId) ?? false;
}

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

async function sendReply(_token: string, chatId: string, text: string, accountSelection?: string): Promise<void> {
  try {
    await sendMessageViaBotServer(chatId, text, 0, accountSelection);
  } catch { /* không dừng xử lý */ }
}

/**
 * Trích xuất URL ảnh từ update payload.
 * Hỗ trợ cả OA Bot API (message.attachments) và Bot Server / zca-js (data.msgType=chat.photo).
 */
function extractAttachmentUrl(update: any): string | null {
  const data = update?.data;
  const msg = update?.message;
  // Bot server (zca-js): data.msgType = 'chat.photo', data.content.href
  if (data?.msgType === 'chat.photo') {
    const c = data.content ?? {};
    return (typeof c === 'object' ? c.href || c.thumb : null) || null;
  }
  // OA Bot API: message.attachments[0].payload.url
  if (msg?.attachments?.[0]?.payload?.url) return String(msg.attachments[0].payload.url);
  // Video/file thumbnail fallback
  if (data?.msgType === 'chat.video' || data?.msgType === 'share.file') {
    const c = data.content ?? {};
    return (typeof c === 'object' ? c.thumb || c.href : null) || null;
  }
  return null;
}

async function saveMessage(update: any): Promise<void> {
  try {
    const msg = update?.message;
    if (!msg?.from?.id) return;
    const attachmentUrl = extractAttachmentUrl(update);
    const saved = await prisma.zaloMessage.create({
      data: {
        chatId: String(msg.from.id),
        displayName: msg.from.display_name || null,
        content: msg.text || msg.attachments?.[0]?.description || '[đính kèm]',
        attachmentUrl,
        role: 'user',
        eventName: update?.event_name || 'message',
        rawPayload: update as any,
      },
    });
    // Đẩy xuống SSE ngay lập tức (dùng cho polling mode)
    emitNewMessage({ ...saved, eventName: saved.eventName ?? 'message' });
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
async function handlePhoneRegistration(token: string, chatId: string, rawText: string, accountSelection?: string): Promise<boolean> {
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
      accountSelection,
    );
    return true;
  }

  try {
    // 1. Kiểm tra NguoiDung (nhân viên / chủ nhà) trước
    const nguoiDung = await prisma.nguoiDung.findFirst({
      where: { soDienThoai: phone },
      select: { id: true, ten: true, zaloChatId: true },
    });

    if (nguoiDung) {
      if (nguoiDung.zaloChatId === chatId) {
        await sendReply(token, chatId,
          `✅ Tài khoản ${nguoiDung.ten} đã liên kết Zalo này rồi.`,
          accountSelection,
        );
        return true;
      }
      await prisma.nguoiDung.update({
        where: { id: nguoiDung.id },
        data: { zaloChatId: chatId },
      });
      await sendReply(token, chatId,
        `✅ Liên kết thành công!\n\n` +
        `Xin chào ${nguoiDung.ten}, tài khoản quản lý của bạn đã được liên kết với Zalo này.\n` +
        'Từ giờ bạn sẽ nhận thông báo qua Zalo:\n' +
        '📄 Hóa đơn (quá hạn, xác nhận thanh toán)\n' +
        '🔧 Sự cố (báo cáo mới, cập nhật)\n' +
        '📊 Nhắc chỉ số điện/nước',
        accountSelection,
      );
      return true;
    }

    // 2. Kiểm tra KhachThue
    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);

    if (!kt) {
      // Không tìm thấy → để handleStranger chạy (gửi lời chào + forward cho admin)
      return false;
    }

    if (kt.zaloChatId === chatId && kt.nhanThongBaoZalo) {
      await sendReply(
        token, chatId,
        '✅ Bạn đã đăng ký nhận thông báo Zalo rồi.\n\n' +
        'Để điều chỉnh cài đặt, đăng nhập cổng thông tin khách thuê → Thông tin cá nhân.',
        accountSelection,
      );
      return true;
    }

    await repo.update(kt.id, { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true });

    await sendReply(
      token, chatId,
      `✅ Đăng ký thành công!\n\n` +
      `Xin chào ${kt.hoTen}, từ giờ bạn sẽ nhận thông báo qua Zalo này:\n` +
      '📄 Hóa đơn (tạo mới, nhắc thanh toán)\n' +
      '🔧 Sự cố (cập nhật trạng thái xử lý)\n' +
      '📋 Yêu cầu thay đổi (kết quả phê duyệt)\n\n' +
      'Để tắt thông báo hoặc thay đổi cài đặt:\n' +
      '▶ Đăng nhập cổng thông tin khách thuê\n' +
      '▶ Vào mục "Thông tin cá nhân"\n' +
      '▶ Chọn bật/tắt "Nhận thông báo qua Zalo"',
      accountSelection,
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

/**
 * Xử lý khách thuê đã đăng ký bằng AI.
 * - Dùng buildContextForRole() để lấy context DB đầy đủ (hóa đơn, hợp đồng, sự cố)
 * - Phân tích ảnh nếu có attachmentUrl
 * - Fallback: liên hệ phụ trách hoặc zalo_tin_nhan_ho_tro
 * Trả về true nếu đã xử lý.
 */
async function handleRegisteredTenant(
  token: string,
  chatId: string,
  text: string,
  attachmentUrl: string | null,
  accountSelection?: string,
): Promise<boolean> {
  const kt = await findKhachThueByZaloChatId(chatId);
  if (!kt) return false;

  // Lấy context DB đầy đủ + lịch sử gần đây
  const [ctxResult, history] = await Promise.all([
    buildContextForRole(kt.id, 'khachThue').catch(() => null),
    getRecentHistory(chatId),
  ]);

  let aiReply: string | null = null;

  if (ctxResult) {
    const { systemPrompt } = ctxResult;
    const historyMsgs = history.map(m => ({ role: m.role, content: m.content }));

    if (attachmentUrl) {
      // Phân tích ảnh + văn bản
      aiReply = await askAIWithImage(systemPrompt, text, attachmentUrl, historyMsgs).catch(() => null);
    }

    if (!aiReply && (text || attachmentUrl)) {
      // Chỉ văn bản (hoặc fallback nếu vision thất bại)
      const userContent = text || (attachmentUrl ? '[gửi ảnh]' : '');
      const messages: AiMessage[] = [
        { role: 'system', content: systemPrompt },
        ...historyMsgs,
        { role: 'user', content: userContent },
      ];
      aiReply = await askAI(messages).catch(() => null);
    }
  }

  if (aiReply) {
    await sendReply(token, chatId, aiReply, accountSelection);
    await prisma.zaloMessage.create({
      data: { chatId, content: aiReply, role: 'bot', eventName: 'bot_reply', rawPayload: {} },
    }).catch(() => {});
    return true;
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
    await sendReply(token, chatId, lines.join('\n'), accountSelection);
    return true;
  }

  // Fallback: nội dung toàn cục
  const hoTroMsg = await getHoTroMessage();
  if (!hoTroMsg) return true;
  await sendReply(token, chatId, hoTroMsg, accountSelection);
  return true;
}

/**
 * Kiểm tra tin nhắn của người lạ có liên quan đến lĩnh vực phòng trọ không.
 * Dùng AI phân tích — chỉ trả lời "yes" / "no".
 * Liên quan: thuê phòng, giá cả, tiện nghi, vị trí, xem phòng, điều kiện thuê, đặt cọc.
 * Không liên quan: mọi chủ đề khác hoàn toàn không dính đến nhà trọ.
 */
async function isRentalDomainQuery(text: string): Promise<boolean> {
  const result = await askAI([
    {
      role: 'system',
      content:
        'Bạn là bộ kiểm tra nội dung cho hệ thống quản lý nhà trọ. ' +
        'Xác định xem tin nhắn sau có liên quan đến lĩnh vực phòng trọ/nhà cho thuê không. ' +
        '"Liên quan" bao gồm: hỏi thuê phòng, giá thuê, diện tích, tiện nghi, vị trí/địa chỉ, ' +
        'xem phòng, đặt cọc, điều kiện thuê, hợp đồng thuê, phòng trống, dịch vụ đi kèm. ' +
        '"Không liên quan" là mọi chủ đề khác không dính đến nhà trọ. ' +
        'Chỉ trả về đúng 1 từ: "yes" hoặc "no".',
    },
    { role: 'user', content: text },
  ], 10).catch(() => null);
  return result?.toLowerCase().trim() === 'yes';
}

/**
 * Xử lý người lạ gửi tin nhắn liên quan đến phòng trọ.
 * - AI phân tích xem nội dung có thuộc lĩnh vực phòng trọ không
 * - Nếu có → AI tư vấn dựa trên danh sách phòng trống từ DB
 * - Nếu không liên quan → bỏ qua (để handleStranger chạy)
 * - Không tiết lộ thông tin cá nhân của bất kỳ khách thuê nào
 * Trả về true nếu đã xử lý.
 */
async function handleStrangerRentalInquiry(
  token: string,
  chatId: string,
  text: string,
  attachmentUrl: string | null,
  accountSelection?: string,
): Promise<boolean> {
  if (!text && !attachmentUrl) return false;

  // Bỏ qua ngay nếu AI chưa cấu hình (isRentalDomainQuery sẽ luôn null)
  // hoặc nội dung không liên quan đến phòng trọ
  const relevant = await isRentalDomainQuery(text || '').catch(() => false);
  if (!relevant) return false;

  const [publicCtx, history] = await Promise.all([
    buildPublicRoomContext().catch(() => ''),
    getRecentHistory(chatId),
  ]);

  const systemPrompt = [
    'Bạn là nhân viên tư vấn cho thuê phòng trọ. Nhiệm vụ: giới thiệu các phòng trống phù hợp với nhu cầu khách.',
    'Trả lời thân thiện, ngắn gọn bằng tiếng Việt. Chỉ dùng thông tin phòng được cung cấp bên dưới.',
    'Không được tiết lộ thông tin cá nhân của bất kỳ khách thuê nào.',
    'Nếu không có phòng phù hợp, lịch sự thông báo và đề nghị để lại thông tin liên hệ.',
    publicCtx ? `\nDanh sách phòng trống hiện có:\n${publicCtx}` : '\nHiện tại chưa có thông tin phòng trống.',
  ].join('\n');

  const historyMsgs = history.map(m => ({ role: m.role, content: m.content }));

  let aiReply: string | null = null;
  if (attachmentUrl) {
    aiReply = await askAIWithImage(systemPrompt, text, attachmentUrl, historyMsgs).catch(() => null);
  }
  if (!aiReply) {
    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMsgs,
      { role: 'user', content: text || '[gửi ảnh]' },
    ];
    aiReply = await askAI(messages).catch(() => null);
  }

  if (!aiReply) return false;

  await sendReply(token, chatId, aiReply, accountSelection);
  await prisma.zaloMessage.create({
    data: { chatId, content: aiReply, role: 'bot', eventName: 'bot_rental_reply', rawPayload: {} },
  }).catch(() => {});
  return true;
}

/**
 * Tự động nhận diện và liên kết người lạ bằng cách duyệt các SĐT chưa có zaloChatId.
 * Chỉ chạy khi đang ở bot server mode.
 * Trả về true nếu đã liên kết thành công (bỏ qua stranger flow).
 */
async function tryAutoLinkByPhone(token: string, chatId: string, accountSelection?: string): Promise<boolean> {

  try {
    const [unlinkedKt, unlinkedNd] = await Promise.all([
      prisma.khachThue.findMany({
        where: { zaloChatId: null },
        select: { id: true, hoTen: true, soDienThoai: true },
        take: 30,
      }),
      prisma.nguoiDung.findMany({
        where: { zaloChatId: null, soDienThoai: { not: null } },
        select: { id: true, ten: true, soDienThoai: true },
        take: 20,
      }),
    ]);

    const candidates = [
      ...unlinkedKt.map(k => ({ type: 'kt' as const, id: k.id, ten: k.hoTen, phone: k.soDienThoai! })),
      ...unlinkedNd.map(n => ({ type: 'nd' as const, id: n.id, ten: n.ten, phone: n.soDienThoai! })),
    ];

    // Lấy default accountId của bot server để lưu vào zaloChatIds
    let defaultBotAccountId = 'default';
    try {
      const { getAccountsFromBotServer } = await import('@/lib/zalo-bot-client');
      const { accounts } = await getAccountsFromBotServer();
      if (accounts?.[0]) defaultBotAccountId = String(accounts[0].id || accounts[0].name || 'default');
    } catch { /* dùng 'default' */ }

    for (const c of candidates) {
      try {
        const result = await findUserViaBotServer(c.phone);
        if (!result.ok || !result.data) continue;
        const d = result.data as any;
        const ownerUid = String(d.userId ?? d.uid ?? d.id ?? '');
        if (!ownerUid || ownerUid !== chatId) continue;

        // Khớp → liên kết (kể cả lưu vào zaloChatIds cho account hiện tại)
        const { storeChatIdForAccount } = await import('@/lib/zalo-auto-link');
        if (c.type === 'kt') {
          const repo = await getKhachThueRepo();
          await repo.update(c.id, { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true });
          storeChatIdForAccount('khachThue', c.id, defaultBotAccountId, chatId).catch(() => {});
          await sendReply(token, chatId,
            `✅ Đăng ký thành công!\n\n` +
            `Xin chào ${c.ten}, từ giờ bạn sẽ nhận thông báo hóa đơn và hợp đồng qua Zalo này.\n\n` +
            'Để điều chỉnh cài đặt, đăng nhập cổng thông tin khách thuê → Thông tin cá nhân.',
            accountSelection,
          );
        } else {
          await prisma.nguoiDung.update({ where: { id: c.id }, data: { zaloChatId: chatId } });
          storeChatIdForAccount('nguoiDung', c.id, defaultBotAccountId, chatId).catch(() => {});
          await sendReply(token, chatId,
            `✅ Liên kết thành công!\n\n` +
            `Xin chào ${c.ten}, tài khoản quản lý của bạn đã được liên kết với Zalo này.`,
            accountSelection,
          );
        }
        return true;
      } catch { continue; }
    }
  } catch { /* bỏ qua lỗi */ }

  return false;
}

/** Gửi lời chào cho người lạ + forward đến nhóm quản lý nếu được cấu hình.
 *  Chỉ gửi greeting khi:
 *   - Chủ nhà đã có zalo server (accountSelection != null)
 *   - chatId KHÔNG phải bạn bè (check DB → refresh 1 lần)
 *   - Chưa có lịch sử, chưa từng gửi greeting
 */
async function handleStranger(token: string, chatId: string, displayName: string, text: string, accountSelection?: string): Promise<void> {
  try {
    const rows = await prisma.caiDat.findMany({
      where: { khoa: { in: ['bot_greeting_stranger', 'bot_forward_unknown', 'bot_forward_thread_id'] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.khoa] = r.giaTri?.trim() ?? '';

    // Gửi lời chào — bỏ qua nếu đã là bạn bè, đã cùng nhóm, hoặc đã có lịch sử trò chuyện
    const greeting = map['bot_greeting_stranger'];
    if (greeting) {
      // Check bạn bè qua DB (accountId) hoặc fallback in-memory cache
      const alreadyFriend = await isFriend(chatId, displayName, accountSelection);
      const alreadyInGroup = isGroupMember(chatId);
      const [msgCount, alreadyGreeted] = await Promise.all([
        prisma.zaloMessage.count({ where: { chatId } }).catch(() => 0),
        prisma.zaloMessage.findFirst({
          where: { chatId, eventName: 'bot_greeting' },
          select: { id: true },
        }).catch(() => null),
      ]);
      const hasHistory = msgCount > 1;
      const isNewUser = !alreadyFriend && !alreadyInGroup && !hasHistory && !alreadyGreeted;
      if (isNewUser) {
        await sendReply(token, chatId, greeting, accountSelection);
        await prisma.zaloMessage.create({
          data: { chatId, content: greeting, role: 'bot', eventName: 'bot_greeting', rawPayload: {} },
        }).catch(() => {});
      }
    }

    // Forward đến nhóm quản lý
    const shouldForward = map['bot_forward_unknown'] !== 'false';
    const forwardThreadId = map['bot_forward_thread_id'];
    if (shouldForward && forwardThreadId && text) {
      const looksLikePhone = /^[\d\s+\-()]{9,15}$/.test(text.trim());
      const fwdMsg = [
        `📨 Tin nhắn từ người lạ`,
        `👤 Tên: ${displayName || '(không rõ)'}`,
        `🆔 ChatId: ${chatId}`,
        looksLikePhone ? `📱 SĐT gửi: ${text.trim()}` : `💬 Nội dung: ${text}`,
      ].join('\n');
      await sendReply(token, forwardThreadId, fwdMsg, accountSelection);
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
      content = fileName ?? 'file';
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

  const attachmentUrl = extractAttachmentUrl(update);

  // 3. Số điện thoại → đăng ký
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text);
    if (handled) return;
  }

  // 4. Khách thuê đã đăng ký → AI reply (hỗ trợ ảnh)
  const isRegistered = await handleRegisteredTenant(token, chatId, text, attachmentUrl);
  if (isRegistered) return;

  // 5. Người lạ → thử tự nhận diện qua SĐT chưa liên kết
  const autoLinked = await tryAutoLinkByPhone(token, chatId);
  if (autoLinked) return;

  // 6. Người lạ hỏi thuê phòng → AI tư vấn phòng trống
  const rentalHandled = await handleStrangerRentalInquiry(token, chatId, text, attachmentUrl);
  if (rentalHandled) return;

  // 7. Không nhận diện được → lời chào + forward + detect pending
  await Promise.all([
    handleStranger(token, chatId, displayName, text),
    detectAndStorePending(update),
  ]);
}

/**
 * Auto-reply handler — gọi từ webhook khi không muốn dùng handleZaloUpdate đầy đủ.
 * Bỏ qua bước lưu lịch sử (webhook đã lưu riêng).
 */
export async function handleZaloAutoReply(update: any, token = '', accountSelection?: string): Promise<void> {
  const msg = update?.message;
  const data = update?.data; // bot server (zca-js)

  const chatId: string =
    msg?.from?.id ? String(msg.from.id) :
    data?.uidFrom ? String(data.uidFrom) :
    update?.uidFrom ? String(update.uidFrom) : '';
  if (!chatId) return;

  // Bỏ qua tin nhắn từ nhóm (type = 1)
  if (update?.type === 1) return;

  // Chỉ refresh cache khi nhận đúng event liên quan (event-driven, không polling)
  const eventName: string = update?.event_name ?? update?.event ?? '';
  const isFriendEvent = /user_follow|user_unfollow|friend_request|add_friend/i.test(eventName);
  const isGroupEvent  = /join_group|leave_group|remove_member|add_member|group_member/i.test(eventName);
  if (isFriendEvent) {
    refreshFriendsCacheInBackground();
    // Sync bạn bè vào DB khi có event kết bạn/hủy bạn
    if (accountSelection) {
      import('@/lib/zalo-friends').then(m => m.syncFriendsToDb(accountSelection)).catch(() => {});
    }
  }
  if (isGroupEvent)  refreshGroupMembersCacheInBackground();

  const displayName: string =
    msg?.from?.display_name ||
    data?.dName || data?.fromD || update?.dName || '';
  const text: string =
    (msg?.text || (typeof data?.content === 'string' ? data.content : '') || update?.content || '').trim();
  const attachmentUrl = extractAttachmentUrl(update);

  // Kiểm tra bot_auto_reply_enabled
  const autoReplyRow = await prisma.caiDat.findFirst({ where: { khoa: 'bot_auto_reply_enabled' } });
  if (autoReplyRow?.giaTri?.trim() === 'false') return;

  // Số điện thoại → đăng ký
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text, accountSelection);
    if (handled) return;
  }

  // Khách thuê đã đăng ký → AI reply (hỗ trợ ảnh)
  const isRegistered = await handleRegisteredTenant(token, chatId, text, attachmentUrl, accountSelection);
  if (isRegistered) return;

  // Người lạ hỏi thuê phòng → AI tư vấn phòng trống
  const rentalHandled = await handleStrangerRentalInquiry(token, chatId, text, attachmentUrl, accountSelection);
  if (rentalHandled) return;

  // Người lạ → lời chào + forward
  await handleStranger(token, chatId, displayName, text, accountSelection);
}
