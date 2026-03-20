/**
 * zalo-notify.ts
 *
 * Dịch vụ thông báo Zalo tập trung cho toàn hệ thống.
 *
 * Các hàm:
 *  - notifyNewInvoice(hoaDonId)           — gửi hóa đơn mới kèm QR cho khách thuê
 *  - notifyInvoiceOverdue(hoaDonId)       — nhắc quá hạn cho quản lý + chủ trọ
 *  - notifyPaymentConfirmed(hoaDonId)     — thông báo đã thanh toán cho chủ trọ
 *  - notifyNewIncident(suCoId)            — báo sự cố mới cho quản lý + chủ trọ
 *  - notifyIncidentEscalate(suCoId)       — leo thang sự cố chưa xử lý
 *  - notifyIncidentUpdate(suCoId, status) — báo tiến độ xử lý cho khách thuê
 *  - notifyMeterReminder(toaNhaId)        — nhắc chốt chỉ số điện/nước
 *
 * Nguyên tắc:
 *  - Mỗi thông báo gắn đúng tòa nhà → đúng nhóm chat
 *  - Kiểm tra nhanThongBaoZalo trước khi gửi
 *  - Fire-and-forget (không block luồng chính)
 */

import prisma from '@/lib/prisma';
import { sendMessageViaBotServer, isBotServerMode } from '@/lib/zalo-bot-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZALO_API = 'https://bot-api.zaloplatforms.com';

async function getSetting(khoa: string): Promise<string> {
  const row = await prisma.caiDat.findFirst({ where: { khoa } });
  return row?.giaTri?.trim() ?? '';
}

async function sendZalo(chatId: string, text: string, token = ''): Promise<void> {
  try {
    if (await isBotServerMode()) {
      await sendMessageViaBotServer(chatId, text);
      return;
    }
    if (!token) return;
    await fetch(`${ZALO_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch { /* fire-and-forget */ }
}

/** Tạo VietQR URL cho hóa đơn */
async function buildQrUrl(hoaDon: {
  maHoaDon: string;
  conLai: number;
  thang: number;
  nam: number;
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

/**
 * Lấy thread ID nhóm chat của tòa nhà cho 1 tầng.
 * Ưu tiên: tầng cụ thể → toàn tòa → bot_forward_thread_id global.
 */
async function getBuildingGroupThreadId(toaNhaId: string, tang?: number): Promise<string | null> {
  try {
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      select: { zaloNhomChat: true },
    });
    const groups = (toaNha?.zaloNhomChat as { tang?: number | null; threadId: string }[] | null) ?? [];
    if (groups.length > 0) {
      // Tìm nhóm theo tầng
      if (tang !== undefined) {
        const floorGroup = groups.find(g => g.tang === tang);
        if (floorGroup) return floorGroup.threadId;
      }
      // Fallback: nhóm toàn tòa (tang = null)
      const buildingGroup = groups.find(g => g.tang == null);
      if (buildingGroup) return buildingGroup.threadId;
      // Fallback: nhóm đầu tiên
      return groups[0]?.threadId ?? null;
    }
  } catch { /* ignore */ }
  // Global fallback
  return getSetting('bot_forward_thread_id') || null;
}

/** Gửi tin nhắn đến nhóm chat của tòa nhà */
async function sendToGroup(toaNhaId: string, text: string, tang?: number): Promise<void> {
  const threadId = await getBuildingGroupThreadId(toaNhaId, tang);
  if (!threadId) return;
  await sendZalo(threadId, text);
}

/** Lấy toaNhaId từ phòng */
async function getToaNhaIdFromPhong(phongId: string): Promise<string | null> {
  const phong = await prisma.phong.findUnique({ where: { id: phongId }, select: { toaNhaId: true, tang: true } });
  return phong?.toaNhaId ?? null;
}

// ─── Hóa đơn ──────────────────────────────────────────────────────────────────

/**
 * Thông báo hóa đơn mới cho đúng khách thuê (kèm QR thanh toán).
 * Chỉ gửi cho người đại diện hợp đồng (nguoiDaiDien).
 */
export async function notifyNewInvoice(hoaDonId: string): Promise<void> {
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        id: true, maHoaDon: true, thang: true, nam: true,
        tongTien: true, conLai: true, daThanhToan: true,
        hanThanhToan: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } },
        hopDong: {
          select: {
            nguoiDaiDien: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } },
          },
        },
      },
    });
    if (!hd) return;

    const nguoiNhan = hd.hopDong?.nguoiDaiDien;
    if (!nguoiNhan?.nhanThongBaoZalo || !nguoiNhan.zaloChatId) return;

    const tenToa = hd.phong.toaNha.tenToaNha;
    const maPhong = hd.phong.maPhong;
    const han = new Date(hd.hanThanhToan).toLocaleDateString('vi-VN');
    const qrUrl = await buildQrUrl(hd);

    const msg = [
      `📄 Hóa đơn tháng ${hd.thang}/${hd.nam}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Khách thuê: ${hd.khachThue.hoTen}`,
      `🏠 Phòng: ${maPhong} — ${tenToa}`,
      `💰 Tổng tiền: ${hd.tongTien.toLocaleString('vi-VN')}đ`,
      hd.daThanhToan > 0 ? `✅ Đã thanh toán: ${hd.daThanhToan.toLocaleString('vi-VN')}đ` : '',
      `💳 Còn lại: ${hd.conLai.toLocaleString('vi-VN')}đ`,
      `📅 Hạn thanh toán: ${han}`,
      `🔖 Mã hóa đơn: ${hd.maHoaDon}`,
      '',
      qrUrl ? `📲 Quét QR thanh toán:\n${qrUrl}` : '',
    ].filter(Boolean).join('\n');

    await sendZalo(nguoiNhan.zaloChatId, msg);
  } catch (e) {
    console.error('[zalo-notify] notifyNewInvoice error:', e);
  }
}

/**
 * Nhắc hóa đơn quá hạn cho quản lý + chủ trọ tòa nhà đó.
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
      '',
      `Vui lòng kiểm tra và xác nhận nếu khách đã thanh toán.`,
    ].join('\n');

    await sendToGroup(hd.phong.toaNhaId, msg, hd.phong.tang);
  } catch (e) {
    console.error('[zalo-notify] notifyInvoiceOverdue error:', e);
  }
}

/**
 * Thông báo đã thanh toán cho chủ trọ (khi quản lý xác nhận).
 */
export async function notifyPaymentConfirmed(hoaDonId: string): Promise<void> {
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        maHoaDon: true, thang: true, nam: true,
        tongTien: true, daThanhToan: true,
        phong: { select: { maPhong: true, toaNhaId: true, toaNha: { select: { tenToaNha: true, chuSoHuu: { select: { zaloChatId: true, nhanThongBaoZalo: true, ten: true } } } } } },
        khachThue: { select: { hoTen: true } },
      },
    });
    if (!hd) return;

    const chu = hd.phong.toaNha.chuSoHuu;
    if (!chu?.nhanThongBaoZalo || !chu.zaloChatId) return;

    const msg = [
      `✅ Xác nhận thanh toán`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${hd.phong.maPhong} — ${hd.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${hd.khachThue.hoTen}`,
      `💰 Số tiền: ${hd.daThanhToan.toLocaleString('vi-VN')}đ`,
      `🔖 Mã hóa đơn: ${hd.maHoaDon} T${hd.thang}/${hd.nam}`,
    ].join('\n');

    await sendZalo(chu.zaloChatId, msg);
  } catch (e) {
    console.error('[zalo-notify] notifyPaymentConfirmed error:', e);
  }
}

// ─── Sự cố ────────────────────────────────────────────────────────────────────

/**
 * Thông báo sự cố mới cho quản lý + chủ trọ tòa nhà.
 */
export async function notifyNewIncident(suCoId: string): Promise<void> {
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, moTa: true, loaiSuCo: true, mucDoUuTien: true,
        ngayBaoCao: true,
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

    await sendToGroup(sc.phong.toaNhaId, msg, sc.phong.tang);
  } catch (e) {
    console.error('[zalo-notify] notifyNewIncident error:', e);
  }
}

/**
 * Leo thang sự cố chưa được xử lý (gọi từ cron/scheduler).
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

    await sendToGroup(sc.phong.toaNhaId, msg, sc.phong.tang);
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentEscalate error:', e);
  }
}

/**
 * Thông báo cập nhật sự cố cho khách thuê báo cáo.
 * Gọi khi trangThai thay đổi sang dangXuLy hoặc daXong.
 */
export async function notifyIncidentUpdate(suCoId: string, newStatus: string): Promise<void> {
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, ghiChuXuLy: true,
        phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } },
        nguoiXuLy: { select: { ten: true } },
      },
    });
    if (!sc) return;
    if (!sc.khachThue.nhanThongBaoZalo || !sc.khachThue.zaloChatId) return;

    const statusLabel: Record<string, string> = {
      dangXuLy: '🔧 Đang xử lý',
      daXong: '✅ Đã hoàn thành',
      daHuy: '❌ Đã hủy',
    };

    const msg = [
      `📢 Cập nhật sự cố của bạn`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong} — ${sc.phong.toaNha.tenToaNha}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      `📊 Trạng thái: ${statusLabel[newStatus] ?? newStatus}`,
      sc.nguoiXuLy ? `👷 Người xử lý: ${sc.nguoiXuLy.ten}` : '',
      sc.ghiChuXuLy ? `📝 Ghi chú: ${sc.ghiChuXuLy}` : '',
    ].filter(Boolean).join('\n');

    await sendZalo(sc.khachThue.zaloChatId, msg);
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentUpdate error:', e);
  }
}

// ─── Nhắc nhở ─────────────────────────────────────────────────────────────────

/**
 * Nhắc chốt chỉ số điện/nước cho tất cả tòa nhà chưa chốt.
 * Gọi từ cron/scheduler.
 */
export async function notifyMeterReminder(toaNhaId: string, tenToaNha: string): Promise<void> {
  try {
    const msg = [
      `📊 NHẮC NHỞ CHỐT CHỈ SỐ ĐIỆN/NƯỚC`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Tòa nhà: ${tenToaNha}`,
      ``,
      `Vui lòng chốt chỉ số điện/nước để phát hành hóa đơn tháng này.`,
    ].join('\n');

    await sendToGroup(toaNhaId, msg);
  } catch (e) {
    console.error('[zalo-notify] notifyMeterReminder error:', e);
  }
}
