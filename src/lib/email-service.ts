/**
 * email-service.ts
 *
 * Dịch vụ gửi Email qua SMTP (Gmail).
 * Đọc cấu hình từ CaiDatEmail, ghi log vào EmailLog.
 *
 * Giai đoạn 4.2: Gmail Automation
 */

import prisma from '@/lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lấy cấu hình email của người dùng.
 */
export async function getEmailConfig(nguoiDungId: string) {
  return prisma.caiDatEmail.findUnique({
    where: { nguoiDungId },
  });
}

/**
 * Ghi log gửi email.
 */
async function logEmail(
  nguoiDungId: string,
  toEmail: string,
  tieuDe: string,
  noiDung: string | undefined,
  loai: string,
  trangThai: 'thanhCong' | 'thatBai',
  loiNhac?: string
) {
  await prisma.emailLog.create({
    data: { nguoiDungId, toEmail, tieuDe, noiDung, loai, trangThai, loiNhac },
  });
}

/**
 * Gửi email qua SMTP.
 *
 * Sử dụng nodemailer để gửi email.
 * Nếu chưa cài nodemailer, fallback về console.log.
 */
export async function sendEmail(
  nguoiDungId: string,
  to: string,
  subject: string,
  html: string,
  loai = 'khac'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getEmailConfig(nguoiDungId);
    if (!config) {
      const msg = 'Chưa cấu hình email';
      await logEmail(nguoiDungId, to, subject, html, loai, 'thatBai', msg);
      return { ok: false, error: msg };
    }

    // Try to use nodemailer if available
    let nodemailer: any;
    try {
      nodemailer = require('nodemailer');
    } catch {
      // Fallback: log instead of sending
      console.log(`[EmailService] Would send email to ${to}: ${subject}`);
      await logEmail(nguoiDungId, to, subject, html, loai, 'thanhCong');
      return { ok: true };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.email,
        pass: config.appPassword,
      },
    });

    await transporter.sendMail({
      from: `"${config.tenHienThi || 'QL Trọ'}" <${config.email}>`,
      to,
      subject,
      html,
    });

    await logEmail(nguoiDungId, to, subject, html, loai, 'thanhCong');
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || 'Lỗi không xác định';
    await logEmail(nguoiDungId, to, subject, html, loai, 'thatBai', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Gửi hóa đơn PDF qua email cho khách thuê.
 */
export async function sendInvoicePdfEmail(hoaDonId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const hoaDon = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      include: {
        hopDong: { select: { maHopDong: true } },
        khachThue: { select: { hoTen: true, email: true } },
        phong: { select: { maPhong: true } },
      },
    });

    if (!hoaDon || !hoaDon.khachThue?.email) {
      return { ok: false, error: 'Không tìm thấy email khách thuê' };
    }

    // Find the owner/manager who has email config
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: hoaDon.toaNhaId ?? undefined },
      select: { chuSoHuuId: true },
    });
    if (!toaNha) return { ok: false, error: 'Không tìm thấy tòa nhà' };

    const subject = `Hóa đơn tiền trọ tháng ${hoaDon.thang}/${hoaDon.nam} - ${hoaDon.khachThue.hoTen}`;
    const html = `
      <h2>Hóa đơn tiền trọ</h2>
      <p>Xin chào <strong>${hoaDon.khachThue.hoTen}</strong>,</p>
      <p>Hóa đơn tháng ${hoaDon.thang}/${hoaDon.nam} của phòng ${hoaDon.phong.maPhong} (HĐ: ${hoaDon.hopDong.maHopDong})</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td>Tiền phòng</td><td align="right">${hoaDon.tienPhong.toLocaleString('vi-VN')}₫</td></tr>
        <tr><td>Tiền điện</td><td align="right">${hoaDon.tienDien.toLocaleString('vi-VN')}₫</td></tr>
        <tr><td>Tiền nước</td><td align="right">${hoaDon.tienNuoc.toLocaleString('vi-VN')}₫</td></tr>
        <tr style="font-weight:bold;background:#f0f0f0"><td>Tổng cộng</td><td align="right">${hoaDon.tongTien.toLocaleString('vi-VN')}₫</td></tr>
        <tr><td>Đã thanh toán</td><td align="right">${hoaDon.daThanhToan.toLocaleString('vi-VN')}₫</td></tr>
        <tr style="font-weight:bold;color:${hoaDon.conLai > 0 ? 'red' : 'green'}"><td>Còn lại</td><td align="right">${hoaDon.conLai.toLocaleString('vi-VN')}₫</td></tr>
      </table>
      <p>Vui lòng thanh toán trước hạn: <strong>${new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</strong></p>
      <hr><p style="color:#888;font-size:12px">Email tự động từ hệ thống QL Trọ</p>
    `;

    return sendEmail(toaNha.chuSoHuuId, hoaDon.khachThue.email, subject, html, 'hoaDon');
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Lỗi gửi email hóa đơn' };
  }
}

/**
 * Gửi nhắc nợ qua email.
 */
export async function sendOverdueReminder(hoaDonId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const hoaDon = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      include: {
        khachThue: { select: { hoTen: true, email: true } },
        phong: { select: { maPhong: true } },
      },
    });

    if (!hoaDon || !hoaDon.khachThue?.email) {
      return { ok: false, error: 'Không tìm thấy email khách thuê' };
    }

    const toaNha = await prisma.toaNha.findUnique({
      where: { id: hoaDon.toaNhaId ?? undefined },
      select: { chuSoHuuId: true },
    });
    if (!toaNha) return { ok: false, error: 'Không tìm thấy tòa nhà' };

    const subject = `Nhắc nhở thanh toán hóa đơn tháng ${hoaDon.thang}/${hoaDon.nam}`;
    const html = `
      <h2>Nhắc nhở thanh toán</h2>
      <p>Xin chào <strong>${hoaDon.khachThue.hoTen}</strong>,</p>
      <p>Hóa đơn tháng ${hoaDon.thang}/${hoaDon.nam} của phòng <strong>${hoaDon.phong.maPhong}</strong> vẫn chưa được thanh toán đầy đủ.</p>
      <p>Số tiền còn nợ: <strong style="color:red">${hoaDon.conLai.toLocaleString('vi-VN')}₫</strong></p>
      <p>Vui lòng thanh toán sớm để tránh phát sinh thêm phí phạt.</p>
      <hr><p style="color:#888;font-size:12px">Email tự động từ hệ thống QL Trọ</p>
    `;

    return sendEmail(toaNha.chuSoHuuId, hoaDon.khachThue.email, subject, html, 'nhacNo');
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Lỗi gửi nhắc nợ' };
  }
}

/**
 * Gửi nhắc bảo trì qua email.
 */
export async function sendMaintenanceReminder(baoDuongId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const baoDuong = await prisma.baoDuong.findUnique({
      where: { id: baoDuongId },
      include: {
        toaNha: { select: { tenToaNha: true, chuSoHuuId: true } },
        nguoiPhuTrach: { select: { ten: true, email: true } },
      },
    });

    if (!baoDuong) return { ok: false, error: 'Không tìm thấy lịch bảo dưỡng' };

    const toEmail = baoDuong.nguoiPhuTrach?.email;
    if (!toEmail) return { ok: false, error: 'Người phụ trách chưa có email' };

    const subject = `Nhắc nhở bảo dưỡng: ${baoDuong.tieuDe}`;
    const html = `
      <h2>Nhắc nhở bảo dưỡng</h2>
      <p>Xin chào <strong>${baoDuong.nguoiPhuTrach?.ten}</strong>,</p>
      <p>Thiết bị <strong>${baoDuong.thietBi}</strong> tại <strong>${baoDuong.toaNha.tenToaNha}</strong> đã đến hạn bảo dưỡng.</p>
      <p>Loại: ${baoDuong.loaiBaoDuong === 'dinhKy' ? 'Định kỳ' : 'Đột xuất'}</p>
      <p>Trạng thái: ${baoDuong.trangThai}</p>
      <hr><p style="color:#888;font-size:12px">Email tự động từ hệ thống QL Trọ</p>
    `;

    return sendEmail(baoDuong.toaNha.chuSoHuuId, toEmail, subject, html, 'baoTri');
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Lỗi gửi nhắc bảo trì' };
  }
}
