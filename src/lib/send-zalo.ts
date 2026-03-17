/**
 * Internal Zalo notification utility — no HTTP session required.
 * Use this from server-side API routes to send Zalo messages.
 */
import prisma from '@/lib/prisma';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch { return null; }
}

async function sendText(token: string, chatId: string, text: string) {
  const body = { chat_id: chatId, text: text.length > 2000 ? text.slice(0, 1997) + '...' : text };
  return fetch(`${ZALO_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
}

/** Gửi Zalo cho khách thuê theo ID (kiểm tra nhanThongBaoZalo) */
export async function notifyKhachThue(khachThueId: string, message: string): Promise<void> {
  try {
    const token = await getZaloToken();
    if (!token) return;

    const kt = await prisma.khachThue.findUnique({
      where: { id: khachThueId },
      select: { zaloChatId: true, nhanThongBaoZalo: true },
    });

    if (!kt?.nhanThongBaoZalo || !kt.zaloChatId) return;
    await sendText(token, kt.zaloChatId, message);
  } catch (e) {
    console.error('[zalo] notifyKhachThue error:', e);
  }
}

/** Gửi Zalo cho chủ trọ và quản lý của 1 tòa nhà */
export async function notifyAdminsOfToaNha(toaNhaId: string, message: string): Promise<void> {
  try {
    const token = await getZaloToken();
    if (!token) return;

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

    const targets: (string | null | undefined)[] = [
      toaNha.chuSoHuu.nhanThongBaoZalo ? toaNha.chuSoHuu.zaloChatId : null,
      ...toaNha.nguoiQuanLy
        .filter(q => q.nguoiDung.nhanThongBaoZalo)
        .map(q => q.nguoiDung.zaloChatId),
    ];

    await Promise.allSettled(
      targets.filter((c): c is string => !!c).map(chatId => sendText(token, chatId, message))
    );
  } catch (e) {
    console.error('[zalo] notifyAdminsOfToaNha error:', e);
  }
}

/** Gửi Zalo cho người đứng hợp đồng của 1 hợp đồng */
export async function notifyDaiDienHopDong(hopDongId: string, message: string): Promise<void> {
  try {
    const token = await getZaloToken();
    if (!token) return;

    const hopDong = await prisma.hopDong.findUnique({
      where: { id: hopDongId },
      include: {
        nguoiDaiDien: { select: { id: true, zaloChatId: true, nhanThongBaoZalo: true } },
      },
    });

    if (!hopDong?.nguoiDaiDien.nhanThongBaoZalo || !hopDong.nguoiDaiDien.zaloChatId) return;
    await sendText(token, hopDong.nguoiDaiDien.zaloChatId, message);
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
