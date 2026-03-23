/**
 * Internal Zalo notification utility — no HTTP session required.
 * Use this from server-side API routes to send Zalo messages.
 *
 * Gửi tin nhắn qua Docker Zalo Bot server (zca-js / web login cá nhân).
 */
import prisma from '@/lib/prisma';
import { sendMessageViaBotServer, getBotConfig, BotConfig } from '@/lib/zalo-bot-client';

/** Lấy bot config riêng từ chủ sở hữu tòa nhà, fallback sang global */
async function getBotConfigForToaNha(toaNhaId: string): Promise<BotConfig | null> {
  try {
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      include: {
        chuSoHuu: {
          select: { zaloBotServerUrl: true, zaloBotUsername: true, zaloBotPassword: true, zaloBotTtl: true, zaloAccountId: true },
        },
      },
    });
    const owner = toaNha?.chuSoHuu;
    if (owner?.zaloBotServerUrl) {
      return {
        serverUrl: owner.zaloBotServerUrl.replace(/\/$/, ''),
        username: owner.zaloBotUsername || 'admin',
        password: owner.zaloBotPassword || 'admin',
        accountId: owner.zaloAccountId || '',
        ttl: owner.zaloBotTtl ?? 0,
      };
    }
  } catch { /* ignore */ }
  return getBotConfig();
}

/** Gửi text qua bot server */
async function sendText(chatId: string, text: string, configOverride?: BotConfig | null): Promise<boolean> {
  return sendMessageViaBotServer(chatId, text, 0, undefined, configOverride).then(r => r.ok);
}

/** Gửi Zalo cho khách thuê theo ID (kiểm tra nhanThongBaoZalo) */
export async function notifyKhachThue(khachThueId: string, message: string): Promise<void> {
  try {
    const kt = await prisma.khachThue.findUnique({
      where: { id: khachThueId },
      select: { zaloChatId: true, nhanThongBaoZalo: true },
    });
    if (!kt?.nhanThongBaoZalo || !kt.zaloChatId) return;
    const toaNhaId = await getToaNhaIdOfKhachThue(khachThueId);
    const botConfig = toaNhaId ? await getBotConfigForToaNha(toaNhaId) : await getBotConfig();
    await sendText(kt.zaloChatId, message, botConfig);
  } catch (e) {
    console.error('[zalo] notifyKhachThue error:', e);
  }
}

/** Gửi Zalo cho chủ trọ và quản lý của 1 tòa nhà */
export async function notifyAdminsOfToaNha(toaNhaId: string, message: string): Promise<void> {
  try {
    const botConfig = await getBotConfigForToaNha(toaNhaId);
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

    await Promise.allSettled(targets.map(chatId => sendText(chatId, message, botConfig)));
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
        phong: { select: { toaNhaId: true } },
      },
    });
    if (!hopDong?.nguoiDaiDien.nhanThongBaoZalo || !hopDong.nguoiDaiDien.zaloChatId) return;
    const botConfig = hopDong.phong?.toaNhaId
      ? await getBotConfigForToaNha(hopDong.phong.toaNhaId)
      : await getBotConfig();
    await sendText(hopDong.nguoiDaiDien.zaloChatId, message, botConfig);
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
