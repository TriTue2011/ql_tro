/**
 * API route: /api/cron/email-daily
 *
 * Giai đoạn 4.2: Gmail Automation - Cron job gửi email tự động hàng ngày.
 * Gửi hóa đơn, nhắc nợ, nhắc bảo trì dựa trên cấu hình tự động.
 *
 * Được gọi bởi cron job (Vercel Cron, systemd timer, hoặc external scheduler).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendInvoicePdfEmail, sendOverdueReminder, sendMaintenanceReminder } from '@/lib/email-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 phút timeout

export async function GET() {
  try {
    const results: string[] = [];

    // 1. Gửi hóa đơn tự động cho các tòa nhà có bật tính năng
    const autoInvoiceConfigs = await prisma.caiDatEmail.findMany({
      where: { tuDongGuiHoaDon: true },
      select: { nguoiDungId: true },
    });

    if (autoInvoiceConfigs.length > 0) {
      // Tìm hóa đơn mới tạo trong 24h qua chưa gửi email
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const newInvoices = await prisma.hoaDon.findMany({
        where: {
          ngayTao: { gte: yesterday },
          khachThue: { email: { not: null } },
        },
        select: { id: true },
      });

      for (const inv of newInvoices) {
        const r = await sendInvoicePdfEmail(inv.id);
        results.push(`Hóa đơn ${inv.id}: ${r.ok ? 'OK' : 'FAIL - ' + r.error}`);
      }
    }

    // 2. Gửi nhắc nợ cho hóa đơn quá hạn
    const autoRemindConfigs = await prisma.caiDatEmail.findMany({
      where: { tuDongGuiNhacNo: true },
      select: { nguoiDungId: true },
    });

    if (autoRemindConfigs.length > 0) {
      const overdueInvoices = await prisma.hoaDon.findMany({
        where: {
          conLai: { gt: 0 },
          hanThanhToan: { lt: new Date() },
          khachThue: { email: { not: null } },
        },
        select: { id: true },
      });

      for (const inv of overdueInvoices) {
        const r = await sendOverdueReminder(inv.id);
        results.push(`Nhắc nợ ${inv.id}: ${r.ok ? 'OK' : 'FAIL - ' + r.error}`);
      }
    }

    // 3. Gửi nhắc bảo trì cho các thiết bị sắp đến hạn
    const autoMaintainConfigs = await prisma.caiDatEmail.findMany({
      where: { tuDongGuiBaoTri: true },
      select: { nguoiDungId: true },
    });

    if (autoMaintainConfigs.length > 0) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const upcomingMaintenance = await prisma.baoDuong.findMany({
        where: {
          trangThai: { in: ['sapDen', 'quaHan'] },
          ngayBaoDuongSau: { lte: tomorrow },
          nguoiPhuTrachId: { not: null },
        },
        select: { id: true },
      });

      for (const bd of upcomingMaintenance) {
        const r = await sendMaintenanceReminder(bd.id);
        results.push(`Bảo trì ${bd.id}: ${r.ok ? 'OK' : 'FAIL - ' + r.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cron executed. ${results.length} tasks.`,
      results,
    });
  } catch (error) {
    console.error('Cron email-daily error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
