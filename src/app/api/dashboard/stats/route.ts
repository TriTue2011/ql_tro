import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPhongRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const role = session.user.role;
    const isAdmin = role === 'admin';

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // ── Bước 1: Lấy danh sách tòa nhà của user (scope tất cả stats) ──────────
    // QUY TẮC MỚI: Chỉ lấy từ bảng ToaNhaNguoiQuanLy cho mọi vai trò trừ Admin
    let myBuildingIds: string[] | undefined = undefined;
    
    if (!isAdmin) {
      const rows = await prisma.toaNhaNguoiQuanLy.findMany({
        where: { nguoiDungId: userId },
        select: { toaNhaId: true },
      });
      myBuildingIds = rows.map(r => r.toaNhaId);

      // Fallback cho Landlord nếu bảng assignment trống (dữ liệu cũ chưa migrate)
      if (myBuildingIds.length === 0 && role === 'chuNha') {
         const legacyRows = await prisma.toaNha.findMany({
           where: { chuSoHuuId: userId },
           select: { id: true },
         });
         myBuildingIds = legacyRows.map(r => r.id);
      }

      // Nếu vẫn không có tòa nhà nào → trả 0 tất cả
      if (myBuildingIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            tongSoPhong: 0, phongTrong: 0, phongDangThue: 0, phongBaoTri: 0,
            doanhThuThang: 0, doanhThuNam: 0, hoaDonSapDenHan: 0,
            suCoCanXuLy: 0, hopDongSapHetHan: 0,
            tongQuanLy: 0, tongNhanVien: 0, tongDongChuTro: 0,
            tongKhachThue: 0, khachThueCoTaiKhoan: 0,
          },
        });
      }
    }

    const phongRepo = await getPhongRepo();

    // ── Bước 2: Phòng — scope theo myBuildingIds ──────────────────────────────
    const [totalPhongResult, phongTrongResult, phongDangThueResult, phongBaoTriResult] = await Promise.all([
      phongRepo.findMany({ toaNhaIds: myBuildingIds, limit: 1 }),
      phongRepo.findMany({ toaNhaIds: myBuildingIds, trangThai: 'trong', limit: 1 }),
      phongRepo.findMany({ toaNhaIds: myBuildingIds, trangThai: 'dangThue', limit: 1 }),
      phongRepo.findMany({ toaNhaIds: myBuildingIds, trangThai: 'baoTri', limit: 1 }),
    ]);

    const totalPhong = totalPhongResult.pagination.total;
    const phongTrong = phongTrongResult.pagination.total;
    const phongDangThue = phongDangThueResult.pagination.total;
    const phongBaoTri = phongBaoTriResult.pagination.total;

    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(); nextMonth.setDate(nextMonth.getDate() + 30);

    // ── Bước 3: Tài chính + cảnh báo — scope theo myBuildingIds ──────────────
    const buildingFilter = myBuildingIds ? { toaNhaId: { in: myBuildingIds } } : {};
    
    const [
      doanhThuThangResult,
      doanhThuNamResult,
      hoaDonSapDenHan,
      suCoCanXuLy,
      hopDongSapHetHan,
    ] = await Promise.all([
      prisma.thanhToan.aggregate({
        _sum: { soTien: true },
        where: {
          ngayThanhToan: { gte: startOfMonth, lte: endOfMonth },
          hoaDon: { phong: buildingFilter },
        },
      }),
      prisma.thanhToan.aggregate({
        _sum: { soTien: true },
        where: {
          ngayThanhToan: { gte: startOfYear, lte: endOfYear },
          hoaDon: { phong: buildingFilter },
        },
      }),
      prisma.hoaDon.count({
        where: {
          hanThanhToan: { lte: nextWeek },
          trangThai: { in: ['chuaThanhToan', 'daThanhToanMotPhan'] },
          phong: buildingFilter,
        },
      }),
      prisma.suCo.count({
        where: {
          trangThai: { in: ['moi', 'dangXuLy'] },
          phong: buildingFilter,
        },
      }),
      prisma.hopDong.count({
        where: {
          trangThai: 'hoatDong',
          ngayKetThuc: { lte: nextMonth },
          phong: buildingFilter,
        },
      }),
    ]);

    // ── Bước 4: Nhân sự + khách thuê (chỉ chuNha/dongChuTro/admin) ───────────
    let nhanSuStats = {
      tongQuanLy: 0, tongNhanVien: 0, tongDongChuTro: 0,
      tongKhachThue: 0, khachThueCoTaiKhoan: 0,
    };

    if (isAdmin || role === 'chuNha' || role === 'dongChuTro') {
      const staffFilter = myBuildingIds ? { toaNhaQuanLy: { some: { toaNhaId: { in: myBuildingIds } } } } : {};
      const tenantFilter = myBuildingIds ? { some: { trangThai: 'hoatDong', phong: { toaNhaId: { in: myBuildingIds } } } } : { some: { trangThai: 'hoatDong' } };

      const [staffByRole, tongKhachThue, khachThueCoTaiKhoan] = await Promise.all([
        prisma.nguoiDung.groupBy({
          by: ['vaiTro'],
          where: {
            vaiTro: { in: ['quanLy', 'nhanVien', 'dongChuTro'] },
            ...staffFilter,
          },
          _count: { id: true },
        }),
        prisma.khachThue.count({
          where: {
            hopDong: tenantFilter,
          },
        }),
        prisma.khachThue.count({
          where: {
            matKhau: { not: null },
            hopDong: tenantFilter,
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

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
