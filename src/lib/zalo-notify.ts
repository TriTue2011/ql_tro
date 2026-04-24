/**
 * zalo-notify.ts
 *
 * Dịch vụ thông báo Zalo tập trung cho toàn hệ thống.
 *
 * Nguyên tắc định tuyến (routing):
 *  - Hóa đơn mới        → cá nhân khách thuê (luôn)
 *  - Hóa đơn quá hạn    → chủ trọ/QL theo ZaloThongBaoCaiDat (KHÔNG gửi nhóm)
 *  - Xác nhận thanh toán→ chủ trọ (luôn, dù có ủy quyền)
 *  - Sự cố mới          → chủ trọ/QL theo ZaloThongBaoCaiDat (KHÔNG gửi nhóm)
 *  - Sự cố leo thang    → chủ trọ/QL theo ZaloThongBaoCaiDat (KHÔNG gửi nhóm)
 *  - Sự cố cập nhật     → khách thuê cá nhân
 *  - Nhắc điện nước     → chủ trọ/QL + nhóm chat
 *
 * Khi chủ trọ bật "Chuyển QL":
 *  → gửi cho tất cả quản lý tòa nhà có bật nhận mục đó
 *  → fallback về chủ trọ nếu không có QL nào nhận
 *  → với sự cố/hóa đơn hoàn tất: luôn báo lại chủ trọ dù đang ủy quyền
 */

import prisma from '@/lib/prisma';
import { sendMessageViaBotServer, getBotConfig, BotConfig } from '@/lib/zalo-bot-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSetting(khoa: string): Promise<string> {
  const row = await prisma.caiDat.findFirst({ where: { khoa } });
  return row?.giaTri?.trim() ?? '';
}

async function isAutoEnabled(khoa: string): Promise<boolean> {
  const val = await getSetting(khoa);
  return val === 'true' || val === '1';
}

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

async function sendZalo(chatId: string, text: string, toaNhaId?: string): Promise<void> {
  try {
    const botConfig = toaNhaId ? await getBotConfigForToaNha(toaNhaId) : await getBotConfig();
    await sendMessageViaBotServer(chatId, text, 0, undefined, botConfig);
  } catch { /* fire-and-forget */ }
}

/** Tạo VietQR URL cho hóa đơn */
async function buildQrUrl(hoaDon: {
  maHoaDon: string; conLai: number; thang: number; nam: number;
}): Promise<string | null> {
  const [bank, soTk, chuTk] = await Promise.all([
    getSetting('ngan_hang_ten'),
    getSetting('ngan_hang_so_tai_khoan'),
    getSetting('ngan_hang_chu_tai_khoan'),
  ]);
  if (!bank || !soTk) return null;
  const addInfo = encodeURIComponent(`Thanh toan ${hoaDon.maHoaDon} T${hoaDon.thang}/${hoaDon.nam}`);
  const accName = encodeURIComponent(chuTk || '');
  return `https://img.vietqr.io/image/${bank}-${soTk}-compact2.png?amount=${Math.round(hoaDon.conLai)}&addInfo=${addInfo}&accountName=${accName}`;
}

/** Gửi tin nhắn đến nhóm chat của tòa nhà (chỉ dùng cho nhắc nhở, không dùng cho sự cố/hóa đơn) */
async function sendToGroup(toaNhaId: string, text: string, tang?: number): Promise<void> {
  const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId }, select: { zaloNhomChat: true } });
  const groups = (toaNha?.zaloNhomChat as { tang?: number | null; threadId: string }[] | null) ?? [];
  let threadId: string | null = null;
  if (groups.length > 0) {
    if (tang !== undefined) threadId = groups.find(g => g.tang === tang)?.threadId ?? null;
    if (!threadId) threadId = groups.find(g => g.tang == null)?.threadId ?? null;
    if (!threadId) threadId = groups[0]?.threadId ?? null;
  }
  if (!threadId) threadId = await getSetting('bot_forward_thread_id') || null;
  if (threadId) await sendZalo(threadId, text, toaNhaId);
}

// ─── Notification Router ──────────────────────────────────────────────────────

type NotifCategory = 'SuCo' | 'HoaDon' | 'TinKhach' | 'NguoiLa' | 'NhacNho';

interface NotifTarget { chatId: string }

/**
 * Xác định danh sách người nhận thông báo theo ZaloThongBaoCaiDat.
 * Ưu tiên ủy quyền → quản lý; fallback → chủ trọ.
 */
async function getTargets(toaNhaId: string, category: NotifCategory): Promise<NotifTarget[]> {
  const nhanKey = `nhan${category}` as const;
  const chuyenKey = `chuyen${category}ChoQL` as const;

  const toaNha = await prisma.toaNha.findUnique({
    where: { id: toaNhaId },
    select: {
      chuSoHuu: { select: { id: true, zaloChatId: true } },
      nguoiQuanLy: { select: { nguoiDung: { select: { id: true, zaloChatId: true } } } },
    },
  });
  if (!toaNha) return [];

  const chu = toaNha.chuSoHuu;
  const quanLys = toaNha.nguoiQuanLy.map(q => q.nguoiDung);

  // Lấy settings chủ trọ
  const chuSettings = await prisma.zaloThongBaoCaiDat.findFirst({
    where: { nguoiDungId: chu.id, toaNhaId },
  });

  const chuNhan: boolean = chuSettings ? !!(chuSettings as any)[nhanKey] : true;
  const chuyenChoQL: boolean = chuSettings ? !!(chuSettings as any)[chuyenKey] : false;

  // "Chuyển QL" và "Nhận" độc lập nhau: ủy quyền cho QL không phụ thuộc vào chuNha có bật nhận hay không
  if (chuyenChoQL && quanLys.length > 0) {
    const qlTargets: NotifTarget[] = [];
    for (const ql of quanLys) {
      if (!ql.zaloChatId) continue;
      const qlSettings = await prisma.zaloThongBaoCaiDat.findFirst({
        where: { nguoiDungId: ql.id, toaNhaId },
      });
      const qlNhan: boolean = qlSettings ? !!(qlSettings as any)[nhanKey] : true;
      if (qlNhan) qlTargets.push({ chatId: ql.zaloChatId });
    }
    if (qlTargets.length > 0) return qlTargets;
    // Fallback: không có QL nhận → gửi chủ trọ nếu chủ trọ bật nhận
  }

  // Gửi chủ trọ chỉ khi họ bật nhận loại thông báo này
  if (chuNhan && chu.zaloChatId) return [{ chatId: chu.zaloChatId }];
  return [];
}

// ─── Hóa đơn ──────────────────────────────────────────────────────────────────

/**
 * Thông báo hóa đơn mới cho đúng khách thuê (kèm QR thanh toán).
 * Chỉ gửi nếu cài đặt auto_zalo_hoa_don_tao = true.
 */
export async function notifyNewInvoice(hoaDonId: string): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_hoa_don_tao')) return;
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        id: true, maHoaDon: true, thang: true, nam: true,
        tongTien: true, conLai: true, daThanhToan: true, hanThanhToan: true, nguoiTaoId: true,
        phong: { select: { id: true, maPhong: true, tang: true, dienTich: true, giaThue: true, toaNhaId: true, toaNha: { select: { tenToaNha: true, diaChi: true } } } },
        khachThue: { select: { hoTen: true, soDienThoai: true, zaloChatId: true, nhanThongBaoZalo: true } },
        hopDong: { select: { nguoiDaiDien: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } } } },
      },
    });
    if (!hd) return;

    const nguoiNhan = hd.hopDong?.nguoiDaiDien;
    if (!nguoiNhan?.nhanThongBaoZalo || !nguoiNhan.zaloChatId) return;

    const han = new Date(hd.hanThanhToan).toLocaleDateString('vi-VN');
    const qrUrl = await buildQrUrl(hd);
    const chatId = nguoiNhan.zaloChatId;
    const toaNhaId = hd.phong.toaNhaId;

    // 1. Gửi text summary (không kèm QR link nữa — QR gửi bằng ảnh)
    const msg = [
      `📄 Hóa đơn tháng ${hd.thang}/${hd.nam}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Khách thuê: ${hd.khachThue.hoTen}`,
      `🏠 Phòng: ${hd.phong.maPhong} — ${hd.phong.toaNha.tenToaNha}`,
      `💰 Tổng tiền: ${hd.tongTien.toLocaleString('vi-VN')}đ`,
      hd.daThanhToan > 0 ? `✅ Đã thanh toán: ${hd.daThanhToan.toLocaleString('vi-VN')}đ` : '',
      `💳 Còn lại: ${hd.conLai.toLocaleString('vi-VN')}đ`,
      `📅 Hạn thanh toán: ${han}`,
      `🔖 Mã hóa đơn: ${hd.maHoaDon}`,
    ].filter(Boolean).join('\n');

    await sendZalo(chatId, msg, toaNhaId);

    // 2. Gửi PDF hóa đơn
    sendInvoicePdf(hd, chatId, toaNhaId).catch(e => console.error('[zalo-notify] sendInvoicePdf error:', e));

    // 3. Gửi ảnh QR (còn nợ) — dùng sendImageViaBotServer với URL trực tiếp
    if (qrUrl && hd.conLai > 0) {
      sendQrImage(chatId, qrUrl, toaNhaId).catch(e => console.error('[zalo-notify] sendQrImage error:', e));
    }
  } catch (e) {
    console.error('[zalo-notify] notifyNewInvoice error:', e);
  }
}

/** Tạo PDF hóa đơn rồi gửi qua Zalo */
async function sendInvoicePdf(hd: any, chatId: string, toaNhaId: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { buildInvoiceHTML } = await import('@/lib/invoice-pdf-template');
  const { renderPdf } = await import('@/lib/puppeteer-browser');
  const { resolveInvoiceBankInfo } = await import('@/lib/invoice-bank-resolver');
  const { sendFileViaBotServer, getActiveMode } = await import('@/lib/zalo-bot-client');

  const cauHinh = await resolveInvoiceBankInfo(hd.nguoiTaoId);
  const html = buildInvoiceHTML({
    hoaDon: hd as any,
    phong: hd.phong,
    khachThue: hd.khachThue,
    cauHinh,
  });
  const pdfBuffer = await renderPdf(html);

  const TEMP_DIR = path.join(process.cwd(), 'tmp', 'zalo');
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tempPath = path.join(TEMP_DIR, `invoice_${hd.maHoaDon}_${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, pdfBuffer as Buffer);

  try {
    const botConfig = await getBotConfigForToaNha(toaNhaId);
    const caption = `Hóa đơn ${hd.maHoaDon} — T${hd.thang}/${hd.nam}`;
    const activeMode = await getActiveMode();
    if (activeMode === 'direct') {
      const { sendFile: directSendFile } = await import('@/lib/zalo-direct/service');
      await directSendFile(chatId, tempPath, caption, 0, 0);
    } else {
      await sendFileViaBotServer(chatId, tempPath, caption, 0, undefined, botConfig);
    }
  } finally {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  }
}

/** Tải ảnh QR về rồi gửi kèm qua Zalo (vì URL vietqr.io có thể không ổn định với bot server) */
async function sendQrImage(chatId: string, qrUrl: string, toaNhaId: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { sendImageViaBotServer, getActiveMode } = await import('@/lib/zalo-bot-client');

  const res = await fetch(qrUrl);
  if (!res.ok) throw new Error(`QR fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const TEMP_DIR = path.join(process.cwd(), 'tmp', 'zalo');
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tempPath = path.join(TEMP_DIR, `qr_${Date.now()}.png`);
  fs.writeFileSync(tempPath, buf);

  try {
    const botConfig = await getBotConfigForToaNha(toaNhaId);
    const activeMode = await getActiveMode();
    if (activeMode === 'direct') {
      const { sendImage: directSendImage } = await import('@/lib/zalo-direct/service');
      await directSendImage(chatId, tempPath, '📲 Quét QR để thanh toán', 0, 0);
    } else {
      await sendImageViaBotServer(chatId, tempPath, '📲 Quét QR để thanh toán', 0, undefined, botConfig);
    }
  } finally {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  }
}

/**
 * Nhắc hóa đơn quá hạn — gửi cá nhân theo routing (KHÔNG gửi nhóm).
 */
export async function notifyInvoiceOverdue(hoaDonId: string): Promise<void> {
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        maHoaDon: true, thang: true, nam: true, conLai: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, soDienThoai: true } },
      },
    });
    if (!hd) return;

    const msg = [
      `⚠️ Hóa đơn QUÁ HẠN`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${hd.phong.maPhong} — ${hd.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${hd.khachThue.hoTen} (${hd.khachThue.soDienThoai})`,
      `💳 Còn lại: ${hd.conLai.toLocaleString('vi-VN')}đ`,
      `🔖 Mã HD: ${hd.maHoaDon} T${hd.thang}/${hd.nam}`,
      ``,
      `Vui lòng kiểm tra và xác nhận nếu khách đã thanh toán.`,
    ].join('\n');

    const targets = await getTargets(hd.phong.toaNhaId, 'HoaDon');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msg, hd.phong.toaNhaId)));
  } catch (e) {
    console.error('[zalo-notify] notifyInvoiceOverdue error:', e);
  }
}

/**
 * Xác nhận thanh toán — gửi cho khách thuê nếu cài đặt auto_zalo_hoa_don_thanh_toan = true.
 */
export async function notifyPaymentConfirmed(hoaDonId: string, soTienVừaThanhToan?: number): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_hoa_don_thanh_toan')) return;
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        maHoaDon: true, thang: true, nam: true, tongTien: true, daThanhToan: true, conLai: true,
        phong: { select: { maPhong: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } },
        hopDong: { select: { nguoiDaiDien: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } } } },
      },
    });
    if (!hd) return;

    const nguoiNhan = hd.hopDong?.nguoiDaiDien?.nhanThongBaoZalo ? hd.hopDong.nguoiDaiDien
      : hd.khachThue?.nhanThongBaoZalo ? hd.khachThue : null;
    if (!nguoiNhan?.zaloChatId) return;

    const soTien = soTienVừaThanhToan ?? hd.daThanhToan;
    const msg = [
      `✅ Xác nhận thanh toán`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${hd.phong.maPhong} — ${hd.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${hd.khachThue.hoTen}`,
      `💰 Đã thanh toán: ${soTien.toLocaleString('vi-VN')}đ`,
      hd.conLai > 0 ? `💳 Còn lại: ${hd.conLai.toLocaleString('vi-VN')}đ` : `🎉 Đã thanh toán đầy đủ!`,
      `🔖 Mã hóa đơn: ${hd.maHoaDon} T${hd.thang}/${hd.nam}`,
    ].filter(Boolean).join('\n');

    await sendZalo(nguoiNhan.zaloChatId, msg, hd.phong.toaNhaId);
  } catch (e) {
    console.error('[zalo-notify] notifyPaymentConfirmed error:', e);
  }
}

// ─── Sự cố ────────────────────────────────────────────────────────────────────

/**
 * Gửi Zalo cho khách thuê xác nhận đã ghi nhận sự cố.
 * Chỉ gửi nếu auto_zalo_su_co_ghi_nhan = true.
 */
export async function notifyIncidentGhiNhan(suCoId: string): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_su_co_ghi_nhan')) return;
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, moTa: true,
        phong: { select: { maPhong: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } },
      },
    });
    if (!sc || !sc.khachThue.nhanThongBaoZalo || !sc.khachThue.zaloChatId) return;

    const msg = [
      `📋 ĐÃ GHI NHẬN SỰ CỐ`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong} — ${sc.phong.toaNha.tenToaNha}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      `📝 Mô tả: ${sc.moTa}`,
      ``,
      `Chúng tôi đã ghi nhận sự cố và sẽ xử lý trong thời gian sớm nhất. Cảm ơn bạn đã phản ánh!`,
    ].join('\n');

    await sendZalo(sc.khachThue.zaloChatId, msg, sc.phong.toaNhaId);
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentGhiNhan error:', e);
  }
}

/**
 * Thông báo sự cố mới cho chủ trọ/QL — gửi cá nhân theo routing (KHÔNG gửi nhóm).
 */
export async function notifyNewIncident(suCoId: string): Promise<void> {
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, moTa: true, loaiSuCo: true, mucDoUuTien: true, ngayBaoCao: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, soDienThoai: true } },
      },
    });
    if (!sc) return;

    const mucDo: Record<string, string> = { thapUuTien: '🟢 Thấp', trungBinh: '🟡 Trung bình', caoUuTien: '🔴 Cao', khancap: '🆘 Khẩn cấp' };
    const loai: Record<string, string> = { dienNuoc: '💡 Điện/Nước', noiThat: '🪑 Nội thất', vesinh: '🚿 Vệ sinh', anNinh: '🔒 An ninh', khac: '📋 Khác' };

    const msg = [
      `🚨 SỰ CỐ MỚI`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong} — ${sc.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${sc.khachThue.hoTen} (${sc.khachThue.soDienThoai})`,
      `📌 Tiêu đề: ${sc.tieuDe}`,
      `📝 Mô tả: ${sc.moTa}`,
      `🏷️ Loại: ${loai[sc.loaiSuCo] ?? sc.loaiSuCo}`,
      `⚡ Mức độ: ${mucDo[sc.mucDoUuTien] ?? sc.mucDoUuTien}`,
      `🕐 Báo cáo: ${new Date(sc.ngayBaoCao).toLocaleString('vi-VN')}`,
    ].join('\n');

    const targets = await getTargets(sc.phong.toaNhaId, 'SuCo');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msg, sc.phong.toaNhaId)));
  } catch (e) {
    console.error('[zalo-notify] notifyNewIncident error:', e);
  }
}

/**
 * Leo thang sự cố — gửi cá nhân theo routing (KHÔNG gửi nhóm).
 */
export async function notifyIncidentEscalate(suCoId: string, reason: 'chua_nhan' | 'chua_xu_ly'): Promise<void> {
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, trangThai: true, ngayBaoCao: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true } },
      },
    });
    if (!sc) return;

    const label = reason === 'chua_nhan' ? 'CHƯA ĐƯỢC TIẾP NHẬN' : 'CHƯA ĐƯỢC XỬ LÝ';
    const msg = [
      `⏰ NHẮC NHỞ SỰ CỐ ${label}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong} — ${sc.phong.toaNha.tenToaNha}`,
      `👤 Khách: ${sc.khachThue.hoTen}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      `🕐 Báo cáo: ${new Date(sc.ngayBaoCao).toLocaleString('vi-VN')}`,
      ``,
      `Vui lòng kiểm tra và cập nhật trạng thái sự cố.`,
    ].join('\n');

    const targets = await getTargets(sc.phong.toaNhaId, 'SuCo');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msg, sc.phong.toaNhaId)));
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentEscalate error:', e);
  }
}

/**
 * Thông báo cập nhật trạng thái sự cố cho khách thuê.
 * Mỗi trạng thái có setting riêng; daXong gửi kèm ảnh nếu có.
 */
export async function notifyIncidentUpdate(suCoId: string, newStatus: string, ghiChuXuLy?: string): Promise<void> {
  const settingKey: Record<string, string> = {
    dangXuLy: 'auto_zalo_su_co_tiep_nhan',
    daXong: 'auto_zalo_su_co_xu_ly_xong',
    daHuy: 'auto_zalo_su_co_huy',
  };
  const key = settingKey[newStatus];
  if (!key || !await isAutoEnabled(key)) return;

  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, ghiChuXuLy: true, anhSuCo: true,
        phong: { select: { maPhong: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } },
        nguoiXuLy: { select: { ten: true } },
      },
    });
    if (!sc || !sc.khachThue.nhanThongBaoZalo || !sc.khachThue.zaloChatId) return;

    const ghiChu = ghiChuXuLy ?? sc.ghiChuXuLy ?? '';
    const toaNhaId = sc.phong.toaNhaId;
    const chatId = sc.khachThue.zaloChatId;

    const headerMap: Record<string, string> = {
      dangXuLy: `🔧 ĐÃ TIẾP NHẬN VÀ ĐANG XỬ LÝ SỰ CỐ`,
      daXong: `✅ ĐÃ XỬ LÝ XONG SỰ CỐ`,
      daHuy: `❌ ĐÃ HỦY SỰ CỐ`,
    };

    const lines = [
      headerMap[newStatus],
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong} — ${sc.phong.toaNha.tenToaNha}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      sc.nguoiXuLy ? `👷 Người xử lý: ${sc.nguoiXuLy.ten}` : '',
      ghiChu ? (newStatus === 'daHuy' ? `📝 Lý do: ${ghiChu}` : `📝 Ghi chú: ${ghiChu}`) : '',
    ].filter(Boolean);

    const msg = lines.join('\n');
    const botConfig = await getBotConfigForToaNha(toaNhaId);

    await sendZalo(chatId, msg, toaNhaId);

    // Gửi kèm ảnh khi daXong
    if (newStatus === 'daXong' && sc.anhSuCo?.length) {
      const { sendImageViaBotServer } = await import('@/lib/zalo-bot-client');
      for (const imgUrl of sc.anhSuCo.slice(0, 5)) {
        await sendImageViaBotServer(chatId, imgUrl, '', 0, undefined, botConfig).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentUpdate error:', e);
  }
}

// ─── Nhắc nhở ─────────────────────────────────────────────────────────────────

/**
 * Nhắc chốt chỉ số điện/nước — gửi nhóm chat + cá nhân theo routing.
 */
export async function notifyMeterReminder(toaNhaId: string, tenToaNha: string): Promise<void> {
  try {
    const msgAdmin = [
      `📊 NHẮC NHỞ CHỐT CHỈ SỐ ĐIỆN/NƯỚC`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Tòa nhà: ${tenToaNha}`,
      ``,
      `Vui lòng chốt chỉ số điện/nước để phát hành hóa đơn tháng này.`,
    ].join('\n');

    // Gửi nhóm chat (nhắc nhở chung vẫn gửi nhóm)
    await sendToGroup(toaNhaId, msgAdmin);

    // Gửi cá nhân cho chủ trọ/quản lý theo routing
    const targets = await getTargets(toaNhaId, 'NhacNho');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msgAdmin, toaNhaId)));

    // Gửi nhắc nhở cho khách thuê đang có hợp đồng
    const msgKhachThue = [
      `📊 NHẮC NHỞ CHỐT CHỈ SỐ ĐIỆN/NƯỚC`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Tòa nhà: ${tenToaNha}`,
      ``,
      `Đã đến kỳ chốt chỉ số điện/nước. Vui lòng kiểm tra và báo chỉ số cho quản lý.`,
    ].join('\n');

    const khachThues = await prisma.khachThue.findMany({
      where: {
        hopDong: { some: { phong: { toaNhaId }, trangThai: 'dangThue' } },
        nhanThongBaoZalo: true,
        zaloChatId: { not: null },
      },
      select: { zaloChatId: true },
    });
    await Promise.all(
      khachThues
        .filter(kt => kt.zaloChatId)
        .map(kt => sendZalo(kt.zaloChatId!, msgKhachThue, toaNhaId))
    );
  } catch (e) {
    console.error('[zalo-notify] notifyMeterReminder error:', e);
  }
}
