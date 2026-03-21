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

    const userId = session.user.id;
    const role = session.user.role;

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

    // Nhân sự + khách thuê theo tòa nhà của chủ trọ
    let nhanSuStats = {
      tongQuanLy: 0,
      tongNhanVien: 0,
      tongDongChuTro: 0,
      tongKhachThue: 0,
      khachThueCoTaiKhoan: 0,
    };

    if (role === 'chuNha' || role === 'dongChuTro') {
      // Lấy danh sách tòa nhà của chủ trọ
      const myBuildingIds = await prisma.toaNha.findMany({
        where: {
          OR: [
            { chuSoHuuId: userId },
            { nguoiQuanLy: { some: { nguoiDungId: userId } } },
          ],
        },
        select: { id: true },
      }).then(rows => rows.map(r => r.id));

      if (myBuildingIds.length > 0) {
        const [staffByRole, tongKhachThue, khachThueCoTaiKhoan] = await Promise.all([
          prisma.nguoiDung.groupBy({
            by: ['vaiTro'],
            where: {
              vaiTro: { in: ['quanLy', 'nhanVien', 'dongChuTro'] },
              toaNhaQuanLy: { some: { toaNhaId: { in: myBuildingIds } } },
            },
            _count: { id: true },
          }),
          // Đếm khách thuê đang thuê trong các tòa nhà này
          prisma.khachThue.count({
            where: {
              hopDong: {
                some: {
                  trangThai: 'hoatDong',
                  phong: { toaNhaId: { in: myBuildingIds } },
                },
              },
            },
          }),
          prisma.khachThue.count({
            where: {
              matKhau: { not: null },
              hopDong: {
                some: {
                  trangThai: 'hoatDong',
                  phong: { toaNhaId: { in: myBuildingIds } },
                },
              },
            },
          }),
        ]);

        const roleMap: Record<string, number> = {};
        for (const r of staffByRole) roleMap[r.vaiTro] = r._count.id;

        nhanSuStats = {
          tongQuanLy: roleMap['quanLy'] ?? 0,
          tongNhanVien: roleMap['nhanVien'] ?? 0,
          tongDongChuTro: roleMap['dongChuTro'] ?? 0,
          tongKhachThue,
          khachThueCoTaiKhoan,
        };
      }
    }

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
      ...nhanSuStats,
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
