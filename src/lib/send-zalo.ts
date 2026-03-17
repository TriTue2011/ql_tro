/**
 * Internal Zalo notification utility — no HTTP session required.
 * Use this from server-side API routes to send Zalo messages.
 *
 * Hỗ trợ 2 chế độ (cài đặt zalo_mode):
 *   "oa"          — Zalo Official Account Bot API (mặc định)
 *   "bot_server"  — Docker Zalo Bot server (zca-js / web login cá nhân)
 */
import prisma from '@/lib/prisma';
import { isBotServerMode, sendMessageViaBotServer } from '@/lib/zalo-bot-client';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch { return null; }
}

/** Gửi text qua OA Bot API */
async function sendTextOA(token: string, chatId: string, text: string) {
  const body = { chat_id: chatId, text: text.length > 2000 ? text.slice(0, 1997) + '...' : text };
  return fetch(`${ZALO_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
}

/** Gửi text — tự chọn OA hoặc bot server theo cài đặt zalo_mode */
async function sendText(chatId: string, text: string): Promise<boolean> {
  if (await isBotServerMode()) {
    return sendMessageViaBotServer(chatId, text);
  }
  const token = await getZaloToken();
  if (!token) return false;
  const res = await sendTextOA(token, chatId, text);
  return !!res?.ok;
}

/** Gửi Zalo cho khách thuê theo ID (kiểm tra nhanThongBaoZalo) */
export async function notifyKhachThue(khachThueId: string, message: string): Promise<void> {
  try {
    const kt = await prisma.khachThue.findUnique({
      where: { id: khachThueId },
      select: { zaloChatId: true, nhanThongBaoZalo: true },
    });
    if (!kt?.nhanThongBaoZalo || !kt.zaloChatId) return;
    await sendText(kt.zaloChatId, message);
  } catch (e) {
    console.error('[zalo] notifyKhachThue error:', e);
  }
}

/** Gửi Zalo cho chủ trọ và quản lý của 1 tòa nhà */
export async function notifyAdminsOfToaNha(toaNhaId: string, message: string): Promise<void> {
  try {
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      include: {
        chuSoHuu: { select: { zaloChatId: true, nhanThongBaoZalo: true } },
        nguoiQuanLy: {
          include: { nguoiDung: { select: { zaloChatId: true, nhanThongBaoZalo: true } } },
        },
      },
    });
    if (!toaNha) return;

    const targets = [
      toaNha.chuSoHuu.nhanThongBaoZalo ? toaNha.chuSoHuu.zaloChatId : null,
      ...toaNha.nguoiQuanLy
        .filter(q => q.nguoiDung.nhanThongBaoZalo)
        .map(q => q.nguoiDung.zaloChatId),
    ].filter((c): c is string => !!c);

    await Promise.allSettled(targets.map(chatId => sendText(chatId, message)));
  } catch (e) {
    console.error('[zalo] notifyAdminsOfToaNha error:', e);
  }
}

/** Gửi Zalo cho người đứng hợp đồng của 1 hợp đồng */
export async function notifyDaiDienHopDong(hopDongId: string, message: string): Promise<void> {
  try {
    const hopDong = await prisma.hopDong.findUnique({
      where: { id: hopDongId },
      include: {
        nguoiDaiDien: { select: { id: true, zaloChatId: true, nhanThongBaoZalo: true } },
      },
    });
    if (!hopDong?.nguoiDaiDien.nhanThongBaoZalo || !hopDong.nguoiDaiDien.zaloChatId) return;
    await sendText(hopDong.nguoiDaiDien.zaloChatId, message);
  } catch (e) {
    console.error('[zalo] notifyDaiDienHopDong error:', e);
  }
}

/** Lấy tòa nhà từ khách thuê đang thuê */
export async function getToaNhaIdOfKhachThue(khachThueId: string): Promise<string | null> {
  const now = new Date();
  const hopDong = await prisma.hopDong.findFirst({
    where: {
      khachThue: { some: { id: khachThueId } },
      trangThai: 'hoatDong',
      ngayBatDau: { lte: now },
      ngayKetThuc: { gte: now },
    },
    include: { phong: { select: { toaNhaId: true } } },
  }).catch(() => null);

  return hopDong?.phong.toaNhaId ?? null;
}
