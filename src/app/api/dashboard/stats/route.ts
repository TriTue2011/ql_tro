import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPhongRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const phongRepo = await getPhongRepo();

    // Get room stats (use pagination total, not full data)
    const [totalPhongResult, phongTrongResult, phongDangThueResult, phongBaoTriResult] = await Promise.all([
      phongRepo.findMany({ limit: 1 }),
      phongRepo.findMany({ trangThai: 'trong', limit: 1 }),
      phongRepo.findMany({ trangThai: 'dangThue', limit: 1 }),
      phongRepo.findMany({ trangThai: 'baoTri', limit: 1 }),
    ]);

    const totalPhong = totalPhongResult.pagination.total;
    const phongTrong = phongTrongResult.pagination.total;
    const phongDangThue = phongDangThueResult.pagination.total;
    const phongBaoTri = phongBaoTriResult.pagination.total;

    // Get revenue stats using prisma aggregation
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    // All counts via DB aggregation — no client-side filtering
    const [
      doanhThuThangResult,
      doanhThuNamResult,
      hoaDonSapDenHan,
      suCoCanXuLy,
      hopDongSapHetHan,
    ] = await Promise.all([
      prisma.thanhToan.aggregate({
        _sum: { soTien: true },
        where: { ngayThanhToan: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.thanhToan.aggregate({
        _sum: { soTien: true },
        where: { ngayThanhToan: { gte: startOfYear, lte: endOfYear } },
      }),
      prisma.hoaDon.count({
        where: {
          hanThanhToan: { lte: nextWeek },
          trangThai: { in: ['chuaThanhToan', 'daThanhToanMotPhan'] },
        },
      }),
      prisma.suCo.count({
        where: { trangThai: { in: ['moi', 'dangXuLy'] } },
      }),
      prisma.hopDong.count({
        where: {
          trangThai: 'hoatDong',
          ngayKetThuc: { lte: nextMonth },
        },
      }),
    ]);

    const stats = {
      tongSoPhong: totalPhong,
      phongTrong,
      phongDangThue,
      phongBaoTri,
      doanhThuThang: doanhThuThangResult._sum.soTien || 0,
      doanhThuNam: doanhThuNamResult._sum.soTien || 0,
      hoaDonSapDenHan,
      suCoCanXuLy,
      hopDongSapHetHan,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
