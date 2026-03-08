import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPhongRepo, getHoaDonRepo, getSuCoRepo, getHopDongRepo } from '@/lib/repositories';
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
    const hoaDonRepo = await getHoaDonRepo();
    const suCoRepo = await getSuCoRepo();
    const hopDongRepo = await getHopDongRepo();

    // Get room stats
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

    const [doanhThuThangResult, doanhThuNamResult] = await Promise.all([
      prisma.thanhToan.aggregate({
        _sum: { soTien: true },
        where: { ngayThanhToan: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.thanhToan.aggregate({
        _sum: { soTien: true },
        where: { ngayThanhToan: { gte: startOfYear, lte: endOfYear } },
      }),
    ]);

    // Get pending invoices (due in next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const hoaDonSapDenHanResult = await hoaDonRepo.findMany({ limit: 10000 });
    const hoaDonSapDenHan = hoaDonSapDenHanResult.data.filter(hd =>
      new Date(hd.hanThanhToan) <= nextWeek &&
      (hd.trangThai === 'chuaThanhToan' || hd.trangThai === 'daThanhToanMotPhan')
    ).length;

    // Get pending issues
    const suCoResult = await suCoRepo.findMany({ limit: 10000 });
    const suCoCanXuLy = suCoResult.data.filter(
      sc => sc.trangThai === 'moi' || sc.trangThai === 'dangXuLy'
    ).length;

    // Get contracts expiring in next 30 days
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    const hopDongResult = await hopDongRepo.findMany({ trangThai: 'hoatDong', limit: 10000 });
    const hopDongSapHetHan = hopDongResult.data.filter(
      hd => new Date(hd.ngayKetThuc) <= nextMonth
    ).length;

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
