/**
 * zalo-auto-link.ts
 *
 * Tự động tra cứu và ghi nhớ zaloChatId cho NguoiDung / KhachThue khi mới tạo.
 * Sau khi tìm thấy, lưu vào pendingZaloChatId và gửi tin nhắn chào mừng + xác nhận.
 * Người dùng phản hồi "Đúng/Không" → xác nhận chuyển sang zaloChatId chính thức.
 *
 * Lưu trữ:
 *   zaloChatId        — chatId đã xác nhận, dùng để gửi thông báo
 *   pendingZaloChatId — chatId tìm được tự động, chờ người dùng xác nhận
 *   zaloChatIds       — JSON array ZaloChatEntry[] { ten, userId, threadId }
 *
 * Bot được chọn theo toaNhaId:
 *   - Nếu chủ trọ trao quyền cho quản lý (chuyenXxxChoQL) → dùng bot của quản lý
 *   - Ngược lại → dùng bot của chủ trọ đứng tên tòa nhà
 *   - Nếu không có toaNhaId → thử tất cả bot accounts (fallback, không gửi welcome)
 */

import prisma from '@/lib/prisma';
import {
  isBotServerMode,
  findUserViaBotServer,
  getAccountsFromBotServer,
  sendMessageViaBotServer,
  sendFriendRequestViaBotServer,
  getAllFriendsFromBotServer,
} from '@/lib/zalo-bot-client';
import type { ZaloChatEntry } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDiaChi(diaChi: any): string {
  if (!diaChi || typeof diaChi !== 'object') return '';
  const { soNha, duong, phuong, quan, thanhPho } = diaChi as Record<string, string | undefined>;
  return [soNha, duong, phuong, quan, thanhPho].filter(Boolean).join(', ');
}

/** Địa chỉ ngắn: số nhà, đường, phường, thành phố (bỏ quận) */
function formatDiaChiNgan(diaChi: any): string {
  if (!diaChi || typeof diaChi !== 'object') return '';
  const { soNha, duong, phuong, thanhPho } = diaChi as Record<string, string | undefined>;
  return [soNha, duong, phuong, thanhPho].filter(Boolean).join(', ');
}

/** Tin nhắn gửi khi đã là bạn bè — yêu cầu xác nhận */
export function buildWelcomeMessage(
  ten: string,
  entityType: 'nguoiDung' | 'khachThue',
  toaNha: { tenToaNha: string; diaChi: any } | null,
): string {
  const diaChiStr = toaNha ? formatDiaChiNgan(toaNha.diaChi) : '';
  const nhaTro = diaChiStr ? `nhà trọ ${diaChiStr}` : 'nhà trọ';

  if (entityType === 'khachThue') {
    return `Chào ${ten}, bạn đang ở ${nhaTro}. Bạn cần xác nhận "đúng" hay "không phải" để nhận thông báo qua Zalo từ bây giờ!`;
  }
  return `Chào ${ten}, bạn đang làm việc tại ${nhaTro}. Bạn cần xác nhận "đúng" hay "không phải".`;
}

/** Tin nhắn gửi thêm sau khi gửi lời kết bạn — yêu cầu xác nhận */
export function buildFollowUpMessage(
  ten: string,
  entityType: 'nguoiDung' | 'khachThue',
  toaNha: { tenToaNha: string; diaChi: any } | null,
): string {
  const diaChiStr = toaNha ? formatDiaChiNgan(toaNha.diaChi) : '';
  const nhaTro = diaChiStr ? `nhà trọ ${diaChiStr}` : 'nhà trọ';

  if (entityType === 'khachThue') {
    return `Chào ${ten}, bạn đang ở ${nhaTro}. Bạn cần xác nhận "đúng" hay "không phải" để nhận thông báo qua Zalo từ bây giờ!`;
  }
  return `Chào ${ten}, bạn đang làm việc tại ${nhaTro}. Bạn cần xác nhận "đúng" hay "không phải".`;
}

/**
 * Tin nhắn quản lý mới gửi đến toàn bộ khách thuê trong tòa nhà.
 * Dùng khi thêm hoặc thay quản lý mới cho tòa nhà.
 */
export function buildManagerGreetingMessage(
  tenQuanLy: string,
  toaNha: { tenToaNha: string; diaChi: any } | null,
): string {
  const diaChiStr = toaNha ? formatDiaChiNgan(toaNha.diaChi) : '';
  const nhaTro = diaChiStr ? `nhà trọ ${diaChiStr}` : 'nhà trọ';
  return `Chào bạn, ${tenQuanLy} là quản lý mới của ${nhaTro}. Sau này mọi thông tin xin liên hệ với mình nhé!`;
}

/**
 * Nội dung lời mời kết bạn (tối đa 150 ký tự).
 * Zalo giới hạn tin nhắn trong lời mời kết bạn là 150 ký tự.
 */
export function buildFriendRequestMessage(
  ten: string,
  entityType: 'nguoiDung' | 'khachThue',
  toaNha: { tenToaNha: string; diaChi: any } | null,
): string {
  const MAX = 150;
  const dc = toaNha?.diaChi as Record<string, string | undefined> | null;
  const soNha = dc?.soNha ?? '';
  const duong = dc?.duong ?? '';
  const diaChiNgan = [soNha, duong].filter(Boolean).join(', ');

  if (entityType === 'khachThue') {
    // Khách thuê: Chào {tên}, kết bạn với tôi để nhận thông báo từ nhà trọ {số nhà}, {đường}.
    if (diaChiNgan) {
      const full = `Chào ${ten}, kết bạn với tôi để nhận thông báo từ nhà trọ ${diaChiNgan}.`;
      if (full.length <= MAX) return full;
    }
    return `Chào ${ten}, kết bạn với tôi để nhận thông báo từ nhà trọ.`.slice(0, MAX);
  }

  // Quản lý, nhân viên: Chào {tên}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ {số nhà}, {đường}
  if (diaChiNgan) {
    const full = `Chào ${ten}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ ${diaChiNgan}.`;
    if (full.length <= MAX) return full;
  }
  return `Chào ${ten}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ.`.slice(0, MAX);
}

// ─── Gửi: ưu tiên kết bạn kèm nội dung nếu chưa là bạn ──────────────────────

/**
 * Gửi tin nhắn hoặc lời kết bạn kèm nội dung tùy trạng thái bạn bè.
 * - Nếu chưa là bạn → sendFriendRequest + gửi thêm followUpMsg
 * - Nếu đã là bạn   → sendMessage với welcomeMsg
 */
export async function sendWelcomeOrFriendRequest(
  chatId: string,
  welcomeMsg: string,
  friendRequestMsg: string,
  followUpMsg: string,
  accountSelection?: string,
): Promise<void> {
  try {
    const friendsResult = await getAllFriendsFromBotServer(accountSelection);
    const isFriend =
      friendsResult.ok &&
      Array.isArray(friendsResult.friends) &&
      friendsResult.friends.some(
        (f: any) => String(f.uid ?? f.id ?? f.userId ?? '') === chatId,
      );

    if (!isFriend) {
      console.log(`[zalo-auto-link] chatId=${chatId} chưa là bạn → gửi lời kết bạn (${friendRequestMsg.length} ký tự)`);
      const fr = await sendFriendRequestViaBotServer(chatId, friendRequestMsg, accountSelection);
      console.log(`[zalo-auto-link] Kết quả gửi kết bạn:`, fr.ok ? 'OK' : fr.error);
      // Gửi thêm tin nhắn sau khi kết bạn
      await sendMessageViaBotServer(chatId, followUpMsg, 0, accountSelection).catch((e) => {
        console.log(`[zalo-auto-link] Gửi tin nhắn sau kết bạn thất bại (chưa accept):`, e);
      });
    } else {
      console.log(`[zalo-auto-link] chatId=${chatId} đã là bạn → gửi tin nhắn`);
      await sendMessageViaBotServer(chatId, welcomeMsg, 0, accountSelection);
    }
  } catch (e) {
    console.error(`[zalo-auto-link] sendWelcomeOrFriendRequest error:`, e);
    // fallback: thử gửi tin nhắn thẳng
    await sendMessageViaBotServer(chatId, welcomeMsg, 0, accountSelection).catch(() => {});
  }
}

// ─── Bot selection theo tòa nhà ───────────────────────────────────────────────

interface BotSelection {
  /** own_id của tài khoản Zalo trên bot server, undefined = dùng mặc định */
  accountId: string | undefined;
  toaNha: { tenToaNha: string; diaChi: any } | null;
}

/**
 * Xác định bot account phù hợp cho 1 tòa nhà.
 * Ưu tiên bot của quản lý nếu chủ trọ đã trao quyền chuyển thông báo,
 * ngược lại dùng bot của chủ trọ đứng tên tòa nhà.
 */
async function getBotSelectionForBuilding(toaNhaId: string): Promise<BotSelection> {
  const toaNha = await prisma.toaNha.findUnique({
    where: { id: toaNhaId },
    select: {
      tenToaNha: true,
      diaChi: true,
      chuSoHuu: { select: { id: true, zaloAccountId: true } },
      nguoiQuanLy: {
        select: {
          nguoiDung: { select: { zaloAccountId: true } },
        },
      },
    },
  });

  if (!toaNha) return { accountId: undefined, toaNha: null };

  const { chuSoHuu, nguoiQuanLy, tenToaNha, diaChi } = toaNha;
  const toaNhaInfo = { tenToaNha, diaChi };

  // Kiểm tra cài đặt trao quyền cho quản lý
  const caiDat = await prisma.zaloThongBaoCaiDat.findUnique({
    where: { nguoiDungId_toaNhaId: { nguoiDungId: chuSoHuu.id, toaNhaId } },
    select: {
      chuyenSuCoChoQL: true,
      chuyenHoaDonChoQL: true,
      chuyenTinKhachChoQL: true,
      chuyenNguoiLaChoQL: true,
      chuyenNhacNhoChoQL: true,
    },
  });

  const hasDelegate =
    caiDat &&
    (caiDat.chuyenSuCoChoQL ||
      caiDat.chuyenHoaDonChoQL ||
      caiDat.chuyenTinKhachChoQL ||
      caiDat.chuyenNguoiLaChoQL ||
      caiDat.chuyenNhacNhoChoQL);

  if (hasDelegate) {
    const quanLy = nguoiQuanLy.find(q => q.nguoiDung.zaloAccountId);
    if (quanLy) {
      return { accountId: quanLy.nguoiDung.zaloAccountId ?? undefined, toaNha: toaNhaInfo };
    }
  }

  return { accountId: chuSoHuu.zaloAccountId ?? undefined, toaNha: toaNhaInfo };
}

// ─── Lấy tên hiển thị ─────────────────────────────────────────────────────────

async function getEntityName(entityType: 'nguoiDung' | 'khachThue', entityId: string): Promise<string> {
  if (entityType === 'nguoiDung') {
    const nd = await prisma.nguoiDung.findUnique({ where: { id: entityId }, select: { ten: true } });
    return nd?.ten ?? 'bạn';
  }
  const kt = await prisma.khachThue.findUnique({ where: { id: entityId }, select: { hoTen: true } });
  return kt?.hoTen ?? 'bạn';
}

// ─── Merge entries ────────────────────────────────────────────────────────────

function mergeZaloChatEntries(current: ZaloChatEntry[], newEntries: ZaloChatEntry[]): ZaloChatEntry[] {
  const result = [...current];
  for (const entry of newEntries) {
    const idx = result.findIndex(e => e.ten === entry.ten);
    if (idx >= 0) result[idx] = entry;
    else result.push(entry);
  }
  return result;
}

// ─── Lưu pending vào DB ───────────────────────────────────────────────────────

async function savePendingToDB(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  chatId: string,
  botTen: string,
): Promise<void> {
  if (entityType === 'nguoiDung') {
    const rec = await prisma.nguoiDung.findUnique({
      where: { id: entityId },
      select: { zaloChatIds: true },
    });
    const current: ZaloChatEntry[] = Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [];
    const merged = mergeZaloChatEntries(current, [{ ten: botTen, userId: chatId, threadId: chatId }]);
    await prisma.nguoiDung.update({
      where: { id: entityId },
      data: { pendingZaloChatId: chatId, zaloChatIds: merged as any },
    });
  } else {
    const rec = await prisma.khachThue.findUnique({
      where: { id: entityId },
      select: { zaloChatIds: true },
    });
    const current: ZaloChatEntry[] = Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [];
    const merged = mergeZaloChatEntries(current, [{ ten: botTen, userId: chatId, threadId: chatId }]);
    await prisma.khachThue.update({
      where: { id: entityId },
      data: { pendingZaloChatId: chatId, zaloChatIds: merged as any },
    });
  }
}

/** Lưu vào zaloChatIds (không thay đổi zaloChatId chính) — dùng cho fallback multi-bot */
async function saveChatIdDirectToDB(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  newEntries: ZaloChatEntry[],
): Promise<void> {
  if (entityType === 'nguoiDung') {
    const rec = await prisma.nguoiDung.findUnique({
      where: { id: entityId },
      select: { zaloChatIds: true },
    });
    const merged = mergeZaloChatEntries(
      Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [],
      newEntries,
    );
    await prisma.nguoiDung.update({
      where: { id: entityId },
      data: { zaloChatId: merged[0]?.threadId ?? null, zaloChatIds: merged as any },
    });
  } else {
    const rec = await prisma.khachThue.findUnique({
      where: { id: entityId },
      select: { zaloChatIds: true },
    });
    const merged = mergeZaloChatEntries(
      Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [],
      newEntries,
    );
    await prisma.khachThue.update({
      where: { id: entityId },
      data: {
        zaloChatId: merged[0]?.threadId ?? null,
        zaloChatIds: merged as any,
        nhanThongBaoZalo: true,
      },
    });
  }
}

// ─── Kiểm tra đã nhập tay chưa ────────────────────────────────────────────────

async function isManuallyLinked(entityType: 'nguoiDung' | 'khachThue', entityId: string): Promise<boolean> {
  if (entityType === 'nguoiDung') {
    const rec = await prisma.nguoiDung.findUnique({ where: { id: entityId }, select: { zaloChatId: true } });
    return !!rec?.zaloChatId;
  }
  const rec = await prisma.khachThue.findUnique({ where: { id: entityId }, select: { zaloChatId: true } });
  return !!rec?.zaloChatId;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Lấy threadId phù hợp cho botAccountId từ danh sách entry, fallback về zaloChatId */
export function resolveChatId(
  record: { zaloChatId?: string | null; zaloChatIds?: any },
  botAccountId: string,
): string | null {
  if (Array.isArray(record.zaloChatIds)) {
    const entries = record.zaloChatIds as ZaloChatEntry[];
    const match = entries.find(e => e.ten === botAccountId || e.userId === botAccountId);
    if (match) return match.threadId || match.userId || null;
    if (entries.length === 1) return entries[0].threadId || entries[0].userId || null;
  }
  return record.zaloChatId ?? null;
}

/**
 * Tự động tra cứu chatId qua số điện thoại.
 *
 * Nếu có toaNhaId:
 *   - Dùng bot của tòa nhà (chủ trọ hoặc quản lý được trao quyền)
 *   - Lưu vào pendingZaloChatId → chờ người dùng xác nhận
 *   - Gửi lời kết bạn kèm tin nhắn chào mừng (nếu chưa là bạn) hoặc tin nhắn thường
 *   - Bỏ qua nếu zaloChatId đã được nhập tay
 *
 * Nếu không có toaNhaId (fallback):
 *   - Thử tất cả bot accounts
 *   - Lưu thẳng vào zaloChatId (hành vi cũ, không gửi welcome)
 *
 * Fire-and-forget — gọi không cần await, lỗi bị bỏ qua.
 */
export async function autoLinkZaloChatIds(
  entityType: 'nguoiDung' | 'khachThue',
  entityId: string,
  phone: string,
  toaNhaId?: string,
): Promise<void> {
  try {
    const inBotMode = await isBotServerMode();
    if (!inBotMode) return;

    if (toaNhaId) {
      // ── Chế độ tòa nhà: dùng bot của tòa nhà, gửi welcome, lưu pending ──

      // Bỏ qua nếu đã nhập tay (zaloChatId đã có giá trị)
      if (await isManuallyLinked(entityType, entityId)) {
        console.log(`[zalo-auto-link] ${entityType} ${entityId} đã có zaloChatId, bỏ qua`);
        return;
      }

      const sel = await getBotSelectionForBuilding(toaNhaId);
      console.log(`[zalo-auto-link] Bot selection cho tòa nhà ${toaNhaId}:`, sel.accountId ?? 'default');
      const result = await findUserViaBotServer(phone, sel.accountId);
      if (!result.ok || !result.data) {
        console.log(`[zalo-auto-link] Không tìm thấy Zalo user cho SĐT ${phone}:`, result.error ?? 'no data');
        return;
      }

      const d = result.data as any;
      const uid = String(d.userId ?? d.uid ?? d.id ?? '');
      if (!uid) {
        console.log(`[zalo-auto-link] findUser trả về nhưng không có userId:`, JSON.stringify(d));
        return;
      }

      console.log(`[zalo-auto-link] Tìm thấy Zalo uid=${uid} cho SĐT ${phone}`);

      // Lưu vào pendingZaloChatId (chờ xác nhận từ người dùng)
      await savePendingToDB(entityType, entityId, uid, sel.accountId ?? 'Bot');

      // Gửi lời kết bạn hoặc tin nhắn chào mừng
      const ten = await getEntityName(entityType, entityId);
      const welcomeMsg = buildWelcomeMessage(ten, entityType, sel.toaNha);
      const frMsg = buildFriendRequestMessage(ten, entityType, sel.toaNha);
      const followUpMsg = buildFollowUpMessage(ten, entityType, sel.toaNha);
      await sendWelcomeOrFriendRequest(uid, welcomeMsg, frMsg, followUpMsg, sel.accountId).catch((e) => {
        console.error(`[zalo-auto-link] sendWelcomeOrFriendRequest lỗi:`, e);
      });
    } else {
      // ── Fallback: thử tất cả bot accounts, lưu thẳng zaloChatId ──
      const botAccounts = await getAllBotAccounts();
      const newEntries: ZaloChatEntry[] = [];

      for (const account of botAccounts) {
        try {
          const result = await findUserViaBotServer(phone, account.id || undefined);
          if (!result.ok || !result.data) continue;
          const d = result.data as any;
          const uid = String(d.userId ?? d.uid ?? d.id ?? '');
          if (!uid) continue;
          newEntries.push({ ten: account.ten, userId: uid, threadId: uid });
        } catch { continue; }
      }

      if (newEntries.length === 0) return;
      await saveChatIdDirectToDB(entityType, entityId, newEntries);
    }
  } catch { /* fire-and-forget, bỏ qua lỗi */ }
}

// ─── Gửi lời chào quản lý mới đến toàn bộ khách thuê ─────────────────────────

/**
 * Khi thêm/thay quản lý mới cho tòa nhà, gửi tin nhắn thông báo
 * đến tất cả khách thuê đang có hợp đồng (có zaloChatId).
 *
 * Dùng tài khoản quản lý nếu có quyền (hasDelegate), ngược lại dùng chủ trọ.
 * Fire-and-forget — gọi không cần await.
 */
export async function notifyTenantsOfNewManager(
  toaNhaId: string,
  nguoiQuanLyId: string,
): Promise<void> {
  try {
    const inBotMode = await isBotServerMode();
    if (!inBotMode) return;

    // Lấy thông tin quản lý
    const quanLy = await prisma.nguoiDung.findUnique({
      where: { id: nguoiQuanLyId },
      select: { ten: true, zaloAccountId: true },
    });
    if (!quanLy) return;

    // Dùng bot của quản lý cũ / chủ trọ (không dùng bot quản lý mới)
    const sel = await getBotSelectionForBuilding(toaNhaId);
    const toaNhaInfo = sel.toaNha;
    const accountId = sel.accountId;

    // Lấy tất cả khách thuê đang ở trong tòa nhà (có hợp đồng hoạt động + có zaloChatId)
    const khachThues = await prisma.khachThue.findMany({
      where: {
        hopDong: {
          some: {
            phong: { toaNhaId },
            trangThai: 'dangThue',
          },
        },
        zaloChatId: { not: null },
      },
      select: { id: true, hoTen: true, zaloChatId: true },
    });

    if (khachThues.length === 0) {
      console.log(`[zalo-auto-link] Tòa nhà ${toaNhaId}: không có khách thuê nào có zaloChatId`);
      return;
    }

    const msg = buildManagerGreetingMessage(quanLy.ten ?? 'Quản lý', toaNhaInfo);

    console.log(`[zalo-auto-link] Gửi thông báo quản lý mới đến ${khachThues.length} khách thuê`);
    for (const kt of khachThues) {
      if (!kt.zaloChatId) continue;
      await sendMessageViaBotServer(kt.zaloChatId, msg, 0, accountId).catch((e) => {
        console.log(`[zalo-auto-link] Gửi tin nhắn quản lý mới cho KT ${kt.id} thất bại:`, e);
      });
    }
  } catch (e) {
    console.error(`[zalo-auto-link] notifyTenantsOfNewManager error:`, e);
  }
}

// ─── Helpers nội bộ ───────────────────────────────────────────────────────────

async function getAllBotAccounts(): Promise<{ id: string; ten: string }[]> {
  try {
    const { accounts } = await getAccountsFromBotServer();
    return accounts
      .map((a: any) => ({
        id: String(a.id || a.name || a.phone || ''),
        ten: String(a.name || a.phone || a.id || 'Bot'),
      }))
      .filter(a => a.id);
  } catch {
    return [{ id: '', ten: 'Bot mặc định' }];
  }
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
      const rec = await prisma.nguoiDung.findUnique({
        where: { id: entityId },
        select: { zaloChatIds: true, zaloChatId: true },
      });
      const current: ZaloChatEntry[] = Array.isArray(rec?.zaloChatIds) ? (rec!.zaloChatIds as any) : [];
      const idx = current.findIndex(e => e.ten === botAccountTen);
      if (idx >= 0) current[idx] = newEntry; else current.push(newEntry);
      await prisma.nguoiDung.update({
        where: { id: entityId },
        data: { zaloChatIds: current as any, zaloChatId: rec?.zaloChatId ?? chatId },
      });
    } else {
      const rec = await prisma.khachThue.findUnique({
        where: { id: entityId },
        select: { zaloChatIds: true, zaloChatId: true },
      });
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
