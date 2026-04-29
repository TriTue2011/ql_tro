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
    .catch(() => { })
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
    .catch(() => { })
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
    }).catch(() => { });
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

// Số điện thoại hợp lệ — đầu số thuộc nhà mạng VN chính thức
// Viettel: 032-039, 086, 096, 097, 098
// Mobifone: 070,079,077,076,078, 089, 090, 093
// Vinaphone: 081-086, 088, 091, 094
// Vietnamobile: 052,056,058,092
// Gmobile: 059,099
// Reddi: 055
const VN_CARRIER_PREFIXES = [
  '032', '033', '034', '035', '036', '037', '038', '039',
  '086', '096', '097', '098', // Viettel
  '070', '076', '077', '078', '079', '089', '090', '093', // Mobifone
  '081', '082', '083', '084', '085', '088', '091', '094', // Vinaphone
  '052', '056', '058', '092', // Vietnamobile
  '055', // Reddi
  '059', '099', // Gmobile
];
const PHONE_REGEX = /^(\+84|0)[0-9]{9}$/;

/** Kiểm tra số điện thoại có thuộc nhà mạng VN hợp lệ không */
function isValidVnCarrierPhone(phone: string): boolean {
  const normalized = phone.replace(/^\+84/, '0').replace(/\D/g, '');
  if (!PHONE_REGEX.test(normalized)) return false;
  const prefix = normalized.slice(0, 3);
  return VN_CARRIER_PREFIXES.includes(prefix);
}

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

/** Tìm người dùng (Chủ nhà/Quản lý) hoặc khách thuê theo Zalo ChatId */
async function findUserByZaloChatId(chatId: string): Promise<{ id: string; ten: string; vaiTro: string } | null> {
  if (!chatId) return null;
  const sId = String(chatId).trim();

  try {
    // 1. Kiểm tra NguoiDung (Chủ nhà / Quản lý)
    const nd = await prisma.nguoiDung.findFirst({
      where: {
        OR: [
          { zaloChatId: sId },
          { zaloChatId: chatId } // Phòng trường hợp lưu kiểu khác
        ]
      },
      select: { id: true, ten: true, vaiTro: true },
    });
    if (nd) return { id: nd.id, ten: nd.ten, vaiTro: nd.vaiTro };

    // 2. Kiểm tra KhachThue
    const kt = await prisma.khachThue.findFirst({
      where: {
        OR: [
          { zaloChatId: sId },
          { zaloChatId: chatId }
        ]
      },
      select: { id: true, hoTen: true },
    });
    if (kt) return { id: kt.id, ten: kt.hoTen, vaiTro: 'khachThue' };

    return null;
  } catch {
    return null;
  }
}

/** Đăng ký tự động khi khách thuê gửi số điện thoại VN hợp lệ */
async function handlePhoneRegistration(token: string, chatId: string, rawText: string, accountSelection?: string): Promise<boolean> {
  const text = rawText.trim();

  // Chỉ xử lý nếu trông giống số điện thoại (9-15 ký tự số/dấu)
  const looksLikePhone = /^[\d\s+\-()]{9,15}$/.test(text);
  if (!looksLikePhone) return false;

  const phone = normalizePhone(text);

  // Phải là số nhà mạng VN hợp lệ — không phản hồi nếu là chuỗi số ngẫu nhiên
  if (!isValidVnCarrierPhone(phone)) return false;

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
      // Số VN hợp lệ nhưng không trùng khớp bất kỳ khách thuê nào
      // → im lặng hoàn toàn (không chào hỏi, không forward, không phản hồi)
      return true;
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
/** Xử lý người dùng đã đăng ký (Chủ nhà/Quản lý/Khách thuê) → AI reply 
 * Trả về true nếu đã xử lý.
 */
async function handleRegisteredUser(
  token: string,
  chatId: string,
  text: string,
  attachmentUrl: string | null,
  accountSelection?: string,
): Promise<boolean> {
  const user = await findUserByZaloChatId(chatId);
  if (!user) return false;

  // Lấy context DB đầy đủ + lịch sử gần đây
  const [ctxResult, history] = await Promise.all([
    buildContextForRole(user.id, user.vaiTro as any).catch(() => null),
    getRecentHistory(chatId),
  ]);

  let aiReply: string | null = null;

  if (ctxResult) {
    // Xây dựng câu chào mẫu dựa trên vai trò và tòa nhà
    let greetingInstruction = '';
    if (user.vaiTro === 'khachThue') {
      const ktDetails = await prisma.khachThue.findUnique({
        where: { id: user.id },
        include: { hopDong: { where: { trangThai: 'hoatDong' }, include: { phong: { include: { toaNha: true } } }, take: 1 } }
      });
      const phong = ktDetails?.hopDong[0]?.phong;
      const toaNha = phong?.toaNha;
      const roomInfo = phong ? `Phòng ${phong.maPhong}${phong.tang > 0 ? ` Tầng ${phong.tang}` : ''}` : '';
      const toaInfo = toaNha ? ` của tòa nhà ${toaNha.tenToaNha}` : '';

      greetingInstruction = `Bạn đang trò chuyện với Khách thuê: ${user.ten}${roomInfo ? ` (${roomInfo}${toaInfo})` : ''}. 
MẪU CHÀO (Quan trọng): "Dạ, em chào Anh/Chị ${user.ten} ở ${roomInfo}${toaInfo} ạ, em có thể giúp được gì cho mình không ạ?"`;
    } else {
      const roleLabel = user.vaiTro === 'chuNha' ? 'Chủ trọ' : user.vaiTro === 'quanLy' ? 'Quản lý' : 'Cộng tác viên';

      // Tìm tên tòa nhà liên quan
      let buildingInfo = '';
      if (user.vaiTro === 'quanLy') {
        const managedBuilding = await prisma.toaNhaNguoiQuanLy.findFirst({
          where: { nguoiDungId: user.id },
          include: { toaNha: { select: { tenToaNha: true } } }
        });
        if (managedBuilding) buildingInfo = ` của tòa nhà ${managedBuilding.toaNha.tenToaNha}`;
      } else if (user.vaiTro === 'chuNha') {
        const ownBuildings = await prisma.toaNha.findMany({
          where: { chuSoHuuId: user.id },
          select: { tenToaNha: true },
          take: 2
        });
        if (ownBuildings.length === 1) {
          buildingInfo = ` sở hữu tòa nhà ${ownBuildings[0].tenToaNha}`;
        } else if (ownBuildings.length > 1) {
          buildingInfo = ` quản lý hệ thống tòa nhà`;
        }
      }

      greetingInstruction = `Bạn đang trò chuyện với ${roleLabel}: ${user.ten}.
MẪU CHÀO (Quan trọng): "Dạ, em chào Anh/Chị ${roleLabel} ${user.ten}${buildingInfo} ạ, Anh/Chị cần em giúp gì cho hệ thống của mình hôm nay ạ?"`;
    }

    const systemPrompt = `${greetingInstruction}\n\n${ctxResult.systemPrompt}`;
    const historyMsgs = history.map(m => ({ role: m.role, content: m.content }));

    if (attachmentUrl) {
      console.log(`[zalo-handler] [Registered] Processing image + text for ${user.ten} (${chatId})`);
      aiReply = await askAIWithImage(systemPrompt, text, attachmentUrl, historyMsgs).catch(() => null);
    }

    if (!aiReply && (text || attachmentUrl)) {
      console.log(`[zalo-handler] [Tenant] Calling askAI for ${chatId}`);
      // Chỉ văn bản (hoặc fallback nếu vision thất bại)
      const fallbackUserContent = attachmentUrl
        ? (text
          ? `${text}\n\n[Khách gửi kèm 1 hình ảnh — hệ thống nhận diện ảnh tạm thời không khả dụng. Hãy phản hồi dựa trên văn bản và ngữ cảnh hội thoại; nếu cần, lịch sự đề nghị khách mô tả bằng lời hoặc gửi lại ảnh sau.]`
          : `[Khách gửi 1 hình ảnh mà không kèm văn bản. Hệ thống nhận diện ảnh tạm thời không khả dụng. Dựa vào ngữ cảnh hội thoại gần nhất (ví dụ: báo sự cố, hỏi hóa đơn, hỏi hợp đồng), hãy phản hồi giúp khách và hỏi thêm: "Ảnh bạn gửi là về vấn đề gì cụ thể?". Nếu context là báo sự cố thì hỏi rõ: phòng nào, tình trạng hỏng hóc gì, đã xảy ra từ khi nào.]`)
        : text;
      const messages: AiMessage[] = [
        { role: 'system', content: systemPrompt },
        ...historyMsgs,
        { role: 'user', content: fallbackUserContent },
      ];
      aiReply = await askAI(messages).catch(() => null);
    }
  }

  if (aiReply) {
    console.log(`[zalo-handler] [Tenant] AI Replied for ${chatId}`);
    // Xử lý chặn mã lệnh CREATE_INCIDENT (dùng [\s\S] thay cho cờ s để tương thích với ES cũ)
    const incidentRegex = /\[CREATE_INCIDENT:\s*({[\s\S]*?})\s*\]/;
    const match = aiReply.match(incidentRegex);
    let finalReply = aiReply;

    if (match && match[1]) {
      try {
        const incidentData = JSON.parse(match[1]);

        // Chỉ khách thuê mới có thể tự động tạo sự cố cho phòng của họ
        if (user.vaiTro === 'khachThue') {
          // Tìm hợp đồng đang hoạt động của khách thuê để lấy phongId
          const ktDetails = await prisma.khachThue.findUnique({
            where: { id: user.id },
            include: { hopDong: { where: { trangThai: 'hoatDong' }, take: 1 } }
          });

          const phongId = ktDetails?.hopDong[0]?.phongId;
          if (phongId && incidentData.tieuDe) {
            await prisma.suCo.create({
              data: {
                tieuDe: incidentData.tieuDe,
                moTa: incidentData.moTa || 'Báo cáo từ Zalo AI',
                loaiSuCo: incidentData.loaiSuCo || 'khac',
                mucDoUuTien: incidentData.mucDoUuTien || 'trungBinh',
                trangThai: 'moi',
                phongId,
                khachThueId: user.id,
              }
            });
            finalReply = aiReply.replace(incidentRegex, '').trim();
            finalReply += '\n\n✅ Đã tự động tạo sự cố trên hệ thống thành công. Quản lý sẽ sớm kiểm tra và hỗ trợ bạn!';
          } else {
            finalReply = aiReply.replace(incidentRegex, '').trim();
          }
        } else {
          // Nếu không phải khách thuê (Chủ trọ/Quản lý), chỉ xóa tag lệnh
          finalReply = aiReply.replace(incidentRegex, '').trim();
        }
      } catch (e) {
        console.error('[zalo-handler] Error parsing CREATE_INCIDENT JSON:', e);
        finalReply = aiReply.replace(incidentRegex, '').trim();
      }
    }

    await sendReply(token, chatId, finalReply, accountSelection);
    const botSaved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId: accountSelection || null,
        content: finalReply,
        role: 'bot',
        eventName: 'bot_reply',
        rawPayload: {}
      },
    }).catch(() => null);
    if (botSaved) {
      const { sseEmit } = await import('@/lib/sse-emitter');
      emitNewMessage({ ...botSaved, eventName: botSaved.eventName ?? 'bot_reply' });
      sseEmit('zalo-message', { chatId: botSaved.chatId });
    }
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
 * Kiểm tra tin nhắn của người lạ có THỰC SỰ liên quan đến phòng trọ không.
 * Dùng AI phân tích — chỉ trả lời "yes" / "no".
 *
 * Quy tắc nghiêm ngặt:
 * - "yes": chỉ khi rõ ràng, cụ thể đang hỏi về thuê phòng, giá, tiện nghi, xem phòng, đặt cọc.
 * - "no": chào hỏi, câu ngắn mơ hồ, chuỗi số, chủ đề không liên quan nhà trọ.
 */
async function isRentalDomainQuery(text: string): Promise<boolean> {
  const cleaned = text.trim();
  if (!cleaned) return false;

  // Nếu TOÀN là số/ký hiệu → không phải câu hỏi thuê phòng
  if (/^[\d\s+\-().]+$/.test(cleaned)) return false;

  // ── Blacklist cứng: chào hỏi xã giao thuần túy → im lặng ngay, không gọi AI ──
  const socialOnlyPatterns = /^(alo+|xin chào|chào|hello+|hi+|hey+|ờ|ừ|ok|okay|vâng|dạ|đúng|haha|hehe|hihi|thế à|vậy à|oke+|👋|😊|🙂|😄)\s*[!?.]*$/i;
  if (socialOnlyPatterns.test(cleaned)) {
    console.log(`[isRentalDomainQuery] Blocked social greeting: "${cleaned}"`);
    return false;
  }

  const result = await askAI([
    {
      role: 'system',
      content:
        'Bạn là bộ lọc tin nhắn cho hệ thống cho thuê phòng trọ. ' +
        'Nhiệm vụ: xác định tin nhắn có liên quan đến việc THUÊ PHÒNG TRỌ hay không.\n\n' +
        'TRẢ VỀ "yes" KHI tin nhắn THỰC SỰ hỏi về:\n' +
        '- Còn phòng không, giá thuê bao nhiêu, xem phòng, đặt cọc\n' +
        '- Tiện nghi, vị trí, diện tích, khu vực muốn thuê\n' +
        '- Bất kỳ câu hỏi cụ thể nào về việc tìm/thuê phòng\n\n' +
        'TRẢ VỀ "no" VỚI:\n' +
        '- Lời chào hỏi đơn thuần: "Xin chào", "Alo", "Hi", "Hello", "Chào bạn", "Ad ơi"\n' +
        '- Phản hồi ngắn: "Ok", "Vâng", "Dạ", "Ừ", "Hehe", "Thế à"\n' +
        '- Hỏi về hóa đơn/thanh toán: "Tôi có hóa đơn không", "tiền tháng này"\n' +
        '- Hỏi về sự cố/bảo trì: "điện hỏng", "nước mất", "hỏng", "sửa chữa"\n' +
        '- Nội dung không liên quan đến nhà trọ, link URL, sticker\n\n' +
        'Chỉ trả về đúng 1 từ: "yes" hoặc "no". Không giải thích.',
    },
    { role: 'user', content: cleaned },
  ], 10).catch(() => null);
  return result?.toLowerCase().trim() === 'yes';
}

/**
 * Xử lý người lạ gửi tin nhắn liên quan đến phòng trọ.
 * Chỉ phản hồi khi AI xác nhận tin nhắn THỰC SỰ liên quan đến hỏi thuê phòng.
 * - Tin nhắn mơ hồ, chào hỏi, chuỗi số không hợp lệ → im lặng hoàn toàn
 * - Nếu có → AI tư vấn dựa trên danh sách phòng trống từ DB
 * - Không tiết lộ thông tin cá nhân của bất kỳ khách thuê nào
 * Trả về true nếu đã xử lý.
 */
async function handleStrangerRentalInquiry(
  token: string,
  chatId: string,
  text: string,
  attachmentUrl: string | null,
  accountSelection?: string,
  managerId?: string,
): Promise<boolean> {
  // Không có nội dung → bỏ qua
  if (!text && !attachmentUrl) return false;

  // Xử lý tất cả những ai chưa được nhận diện trong DB (kể cả đã là bạn bè Zalo)
  // để bắt đầu luồng tư vấn thuê phòng.

  // Nếu nội dung là chuỗi số thuần túy → kiểm tra SĐT nhà mạng VN
  // Nếu không phải SĐT VN hợp lệ → im lặng (không phản hồi)
  if (text && /^[\d\s+\-().]{7,15}$/.test(text.trim())) {
    const phone = normalizePhone(text.trim());
    if (!isValidVnCarrierPhone(phone)) {
      // Chuỗi số không phải SĐT VN → bỏ qua
      return false;
    }
    // Là SĐT hợp lệ → đã được handlePhoneRegistration xử lý trước đó, bỏ qua ở đây
    return false;
  }

  // Phân tích ngữ nghĩa: nội dung có THỰC SỰ hỏi về phòng trọ không?
  const relevant = await isRentalDomainQuery(text || '').catch(() => false);
  console.log(`[zalo-handler] [Stranger] Rental query check for "${text}": ${relevant}`);
  if (!relevant) {
    // Không liên quan phòng trọ → im lặng hoàn toàn, không greeting, không forward
    return false;
  }

  const [publicCtx, history] = await Promise.all([
    buildPublicRoomContext(managerId).catch(() => ''),
    getRecentHistory(chatId),
  ]);

  const systemPrompt = [
    'Bạn là nhân viên tư vấn cho thuê phòng trọ chuyên nghiệp. Luôn dùng "Dạ/Vâng", xưng hô Anh/Chị/Bạn lễ phép, nhẹ nhàng.',
    'QUY TRÌNH TƯ VẤN 3 BƯỚC:',
    '1. Bước 1 (Hỏi vị trí): Chào khách lễ phép. Nếu khách chưa nói rõ khu vực muốn thuê, hãy liệt kê các Quận đang có phòng (từ DANH SÁCH KHU VỰC bên dưới) và hỏi khách ưu tiên khu vực nào.',
    '2. Bước 2 (Lọc nhu cầu): Khi đã có vị trí, hỏi thêm về ngân sách hoặc tiện nghi quan trọng nhất (thang máy, ban công, nuôi pet...).',
    '3. Bước 3 (Đề xuất & Chốt): Chỉ đưa ra tối đa 3 lựa chọn tốt nhất kèm câu giới thiệu highlight điểm mạnh của từng căn. Kết thúc bằng lời mời xem thực tế hoặc xin SĐT để quản lý gọi lại.',
    '',
    'QUY TẮC BỔ SUNG:',
    '- Chỉ dùng thông tin phòng được cung cấp — không bịa thông tin.',
    '- Không tiết lộ thông tin cá nhân của khách thuê hiện tại.',
    '- Xử lý từ chối: Nếu khách chê giá cao, hãy nhẹ nhàng giải thích về giá trị (vị trí, an ninh, tiện ích).',
    publicCtx ? `\n${publicCtx}` : '\nHiện tại chưa có thông tin phòng trống cụ thể. Hãy lịch sự hỏi nhu cầu khách và mời để lại số điện thoại.',
  ].join('\n');

  const historyMsgs = history.map(m => ({ role: m.role, content: m.content }));

  let aiReply: string | null = null;
  if (attachmentUrl) {
    aiReply = await askAIWithImage(systemPrompt, text, attachmentUrl, historyMsgs).catch(() => null);
  }
  if (!aiReply) {
    const fallbackUserContent = attachmentUrl
      ? (text
        ? `${text}\n\n[Khách gửi kèm ảnh phòng/căn hộ — hệ thống nhận diện ảnh tạm chưa khả dụng. Hãy phản hồi dựa trên văn bản và lịch sự đề nghị khách mô tả bằng lời nếu cần.]`
        : `[Khách gửi ảnh không kèm văn bản. Có thể khách muốn tìm phòng giống ảnh hoặc hỏi về phòng trống. Hãy chào hỏi, giới thiệu danh sách phòng trống và mời khách để lại SĐT/yêu cầu cụ thể.]`)
      : text;
    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMsgs,
      { role: 'user', content: fallbackUserContent },
    ];
    aiReply = await askAI(messages).catch(() => null);
  }

  if (!aiReply) return false;

  await sendReply(token, chatId, aiReply, accountSelection);
  const botSaved = await prisma.zaloMessage.create({
    data: {
      chatId,
      ownId: accountSelection || null,
      content: aiReply,
      role: 'bot',
      eventName: 'bot_rental_reply',
      rawPayload: {}
    },
  }).catch(() => null);
  if (botSaved) {
    const { sseEmit } = await import('@/lib/sse-emitter');
    emitNewMessage({ ...botSaved, eventName: botSaved.eventName ?? 'bot_rental_reply' });
    sseEmit('zalo-message', { chatId: botSaved.chatId });
  }
  return true;
}

/**
 * Tự động nhận diện và liên kết người lạ.
 *
 * Ưu tiên (O(1) — nhanh, đáng tin):
 *   getUserInfo(chatId) → lấy phoneNumber → so khớp SĐT với DB → gán zaloChatId
 *
 * Fallback (O(N) — chỉ dùng khi getUserInfo không trả về SĐT):
 *   Duyệt từng người chưa liên kết → findUser(sdt) → so chatId trả về
 *
 * Chỉ chạy khi đang ở bot server mode.
 * Trả về true nếu đã liên kết thành công (bỏ qua stranger flow).
 */
async function tryAutoLinkByPhone(token: string, chatId: string, accountSelection?: string): Promise<boolean> {
  try {
    let defaultBotAccountId = accountSelection || 'default';
    try {
      const { getAccountsFromBotServer } = await import('@/lib/zalo-bot-client');
      const { accounts } = await getAccountsFromBotServer();
      if (accounts?.[0]) defaultBotAccountId = String(accounts[0].id || accounts[0].name || 'default');
    } catch { /* dùng 'default' */ }

    // ── Bước 1: Reverse lookup — getUserInfo(chatId) → lấy SĐT → so DB ──────
    try {
      const info = await getUserInfoViaBotServer(chatId, accountSelection);
      if (info.ok && info.data) {
        const d = info.data as any;
        const profile = d.changed_profiles?.[chatId] ?? d;
        const rawPhone = profile.phoneNumber || profile.phone || d.phoneNumber || d.phone || '';

        if (rawPhone) {
          const phone = rawPhone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
          console.log(`[zalo-handler] autoLink reverse: chatId=${chatId} → SĐT=${phone}`);

          const linked = await linkByPhone(phone, chatId, defaultBotAccountId, token, accountSelection);
          if (linked) return true;
        }
      }
    } catch { /* getUserInfo thất bại → thử forward lookup */ }

    // ── Bước 2: Forward lookup — duyệt từng SĐT chưa liên kết ───────────────
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
    ].filter(c => !!c.phone);

    for (const c of candidates) {
      try {
        const result = await findUserViaBotServer(c.phone);
        if (!result.ok || !result.data) continue;
        const d = result.data as any;
        const ownerUid = String(d.userId ?? d.uid ?? d.id ?? '');
        if (!ownerUid || ownerUid !== chatId) continue;

        // Khớp → liên kết
        console.log(`[zalo-handler] autoLink forward: phone=${c.phone} → chatId=${chatId} matched`);
        const { storeChatIdForAccount } = await import('@/lib/zalo-auto-link');
        if (c.type === 'kt') {
          const repo = await getKhachThueRepo();
          await repo.update(c.id, { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true });
          storeChatIdForAccount('khachThue', c.id, defaultBotAccountId, chatId).catch(() => { });
          await sendReply(token, chatId,
            `✅ Đăng ký thành công!\n\n` +
            `Xin chào ${c.ten}, từ giờ bạn sẽ nhận thông báo hóa đơn và hợp đồng qua Zalo này.\n\n` +
            'Để điều chỉnh cài đặt, đăng nhập cổng thông tin khách thuê → Thông tin cá nhân.',
            accountSelection,
          );
        } else {
          await prisma.nguoiDung.update({ where: { id: c.id }, data: { zaloChatId: chatId } });
          storeChatIdForAccount('nguoiDung', c.id, defaultBotAccountId, chatId).catch(() => { });
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

/**
 * Helper: gán zaloChatId cho KhachThue hoặc NguoiDung theo SĐT.
 * Trả về true nếu tìm thấy và gán thành công.
 */
async function linkByPhone(
  phone: string,
  chatId: string,
  botAccountId: string,
  token: string,
  accountSelection?: string,
): Promise<boolean> {
  // Kiểm tra KhachThue
  const kt = await prisma.khachThue.findFirst({
    where: { soDienThoai: phone },
    select: { id: true, hoTen: true, zaloChatId: true },
  });
  if (kt && kt.zaloChatId !== chatId) {
    const repo = await getKhachThueRepo();
    await repo.update(kt.id, { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true });
    const { storeChatIdForAccount } = await import('@/lib/zalo-auto-link');
    storeChatIdForAccount('khachThue', kt.id, botAccountId, chatId).catch(() => { });
    console.log(`[zalo-handler] linkByPhone: KhachThue ${kt.id} (${phone}) → chatId=${chatId}`);
    await sendReply(token, chatId,
      `✅ Đăng ký thành công!\n\n` +
      `Xin chào ${kt.hoTen}, từ giờ bạn sẽ nhận thông báo hóa đơn và hợp đồng qua Zalo này.\n\n` +
      'Để điều chỉnh cài đặt, đăng nhập cổng thông tin khách thuê → Thông tin cá nhân.',
      accountSelection,
    );
    return true;
  }

  // Kiểm tra NguoiDung
  const nd = await prisma.nguoiDung.findFirst({
    where: { soDienThoai: phone, trangThai: 'hoatDong' },
    select: { id: true, ten: true, zaloChatId: true },
  });
  if (nd && nd.zaloChatId !== chatId) {
    await prisma.nguoiDung.update({ where: { id: nd.id }, data: { zaloChatId: chatId, pendingZaloChatId: '' } });
    const { storeChatIdForAccount } = await import('@/lib/zalo-auto-link');
    storeChatIdForAccount('nguoiDung', nd.id, botAccountId, chatId).catch(() => { });
    console.log(`[zalo-handler] linkByPhone: NguoiDung ${nd.id} (${phone}) → chatId=${chatId}`);
    await sendReply(token, chatId,
      `✅ Liên kết thành công!\n\n` +
      `Xin chào ${nd.ten}, tài khoản của bạn đã được liên kết với Zalo này.`,
      accountSelection,
    );
    return true;
  }

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
        }).catch(() => { });
      }
    }

    // Forward đến nhóm quản lý — chỉ forward nếu tin nhắn có nội dung thực sự
    // (không forward tin nhắn chào xã giao hay chuỗi số không hợp lệ)
    const shouldForward = map['bot_forward_unknown'] !== 'false';
    const forwardThreadId = map['bot_forward_thread_id'];
    if (shouldForward && forwardThreadId && text && text.trim().length > 3) {
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
    }).catch(() => {/* bỏ qua lỗi forward */ });
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

  // 4. Người dùng đã đăng ký (Chủ nhà / Quản lý / Khách thuê) → AI reply
  const isRegistered = await handleRegisteredUser(token, chatId, text, attachmentUrl);
  if (isRegistered) return;

  // 5. Người lạ → thử tự nhận diện qua SĐT chưa liên kết
  const autoLinked = await tryAutoLinkByPhone(token, chatId);
  if (autoLinked) return;

  // 6. Người lạ hỏi thuê phòng → AI tư vấn phòng trống
  const rentalHandled = await handleStrangerRentalInquiry(token, chatId, text, attachmentUrl);
  if (rentalHandled) return;

  // 7. Không nhận diện được → lời chào + forward
  // Lưu ý: detectAndStorePending (so khớp tên Zalo với tên DB) đã bị loại bỏ
  // vì tên hiển thị Zalo có thể là biệt danh, không đáng tin. 
  // Việc nhận diện khách mới CHỈ nên qua số điện thoại (bước 5 đã xử lý).
  await handleStranger(token, chatId, displayName, text);
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
  const isGroupEvent = /join_group|leave_group|remove_member|add_member|group_member/i.test(eventName);
  if (isFriendEvent) {
    refreshFriendsCacheInBackground();
    // Sync bạn bè vào DB khi có event kết bạn/hủy bạn
    if (accountSelection) {
      import('@/lib/zalo-friends').then(m => m.syncFriendsToDb(accountSelection)).catch(() => { });
    }
  }
  if (isGroupEvent) refreshGroupMembersCacheInBackground();

  const displayName: string =
    msg?.from?.display_name ||
    data?.dName || data?.fromD || update?.dName || '';
  const text: string =
    (msg?.text || (typeof data?.content === 'string' ? data.content : '') || update?.content || '').trim();
  const attachmentUrl = extractAttachmentUrl(update);

  // Kiểm tra bot_auto_reply_enabled
  const autoReplyRow = await prisma.caiDat.findFirst({ where: { khoa: 'bot_auto_reply_enabled' } });
  if (autoReplyRow?.giaTri?.trim() === 'false') return;

  // Xác định managerId từ accountSelection để cô lập dữ liệu theo từng tòa nhà
  // Bot thuộc Chủ nhà/Quản lý nào → chỉ dùng dữ liệu của tòa nhà đó
  let managerId: string | undefined;
  if (accountSelection) {
    const owner = await prisma.nguoiDung.findFirst({
      where: { zaloAccountId: accountSelection },
      select: { id: true },
    });
    if (owner) managerId = owner.id;
  }

  // Số điện thoại → đăng ký (luôn cho phép mọi người đăng ký)
  if (text) {
    const handled = await handlePhoneRegistration(token, chatId, text, accountSelection);
    if (handled) return;
  }

  // Kiểm tra bạn bè (Danh bạ)
  const friend = await isFriend(chatId, displayName, accountSelection);

  if (friend) {
    // ── TRONG DANH BẠ ──────────────────────────────────────────────────────
    const user = await findUserByZaloChatId(chatId);

    if (user?.vaiTro === 'khachThue') {
      // RULE: Khách thuê → AI hỗ trợ, NHƯNG phải thuộc đúng tòa nhà của Bot này
      if (managerId) {
        const ktBelongs = await prisma.khachThue.findFirst({
          where: {
            id: user.id,
            hopDong: {
              some: {
                trangThai: 'hoatDong',
                phong: {
                  OR: [
                    { toaNha: { chuSoHuuId: managerId } },
                    { toaNha: { nguoiQuanLy: { some: { nguoiDungId: managerId } } } },
                  ],
                },
              },
            },
          },
          select: { id: true },
        });
        if (!ktBelongs) {
          // Khách thuê của tòa nhà khác → im lặng hoàn toàn, không lẫn dữ liệu
          console.log(`[zalo-handler] Tenant ${user.id} không thuộc tòa nhà của Bot ${managerId}. Bỏ qua.`);
          return;
        }
      }
      const isRegistered = await handleRegisteredUser(token, chatId, text, attachmentUrl, accountSelection);
      if (isRegistered) return;

    } else {
      // RULE: Người trong danh bạ nhưng không phải khách thuê (Chủ nhà, Quản lý, Bạn bè)
      // → Không trả lời tự động, chỉ tư vấn nếu hỏi thuê phòng trong tòa của mình
      const rentalHandled = await handleStrangerRentalInquiry(token, chatId, text, attachmentUrl, accountSelection, managerId);
      if (rentalHandled) return;
    }

  } else {
    // ── NGOÀI DANH BẠ (Người lạ) ───────────────────────────────────────────
    // RULE: Chỉ tư vấn thuê phòng, và chỉ dùng phòng trống thuộc tòa của Bot này
    const rentalHandled = await handleStrangerRentalInquiry(token, chatId, text, attachmentUrl, accountSelection, managerId);
    if (rentalHandled) return;

    // Không liên quan thuê phòng → im lặng hoàn toàn
    console.log(`[zalo-handler] Stranger silent (ngoài phạm vi): "${text}" from ${chatId}`);
  }
}
