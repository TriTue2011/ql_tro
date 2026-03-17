import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const khachThueId = session.user.id;
  const now = new Date();

  const [khachThue, hopDongHienTai] = await Promise.all([
    prisma.khachThue.findUnique({
      where: { id: khachThueId },
      select: {
        id: true, hoTen: true, soDienThoai: true, email: true,
        trangThai: true, nhanThongBaoZalo: true,
      },
    }),
    prisma.hopDong.findFirst({
      where: {
        khachThue: { some: { id: khachThueId } },
        trangThai: 'hoatDong',
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
      },
      include: {
        phong: {
          include: {
            toaNha: {
              select: {
                tenToaNha: true, diaChi: true, lienHePhuTrach: true,
                chuSoHuu: { select: { ten: true, soDienThoai: true, email: true } },
                nguoiQuanLy: {
                  select: { nguoiDung: { select: { ten: true, soDienThoai: true, email: true } } },
                  take: 1,
                },
              },
            },
          },
        },
        nguoiDaiDien: { select: { id: true, hoTen: true, soDienThoai: true } },
      },
    }),
  ]);

  // Các số liệu song song
  const [
    soHoaDonChuaThanhToan,
    soSuCoMoi,
    soSuCoDangXuLy,
    yeuCauChoDuyet,
    hoaDonList,
    suCoList,
  ] = await Promise.all([
    prisma.hoaDon.count({
      where: {
        khachThueId,
        trangThai: { in: ['chuaThanhToan', 'daThanhToanMotPhan', 'quaHan'] },
      },
    }),
    prisma.suCo.count({ where: { khachThueId, trangThai: 'moi' } }),
    prisma.suCo.count({ where: { khachThueId, trangThai: 'dangXuLy' } }),
    prisma.yeuCauThayDoi.count({ where: { khachThueId, trangThai: 'choPheduyet' } }),
    // Hóa đơn 12 tháng gần nhất cho biểu đồ
    prisma.hoaDon.findMany({
      where: { khachThueId },
      select: { thang: true, nam: true, tongTien: true, tienDien: true, tienNuoc: true, soDien: true, soNuoc: true },
      orderBy: [{ nam: 'desc' }, { thang: 'desc' }],
      take: 24,
    }),
    // Sự cố gần nhất
    prisma.suCo.findMany({
      where: { khachThueId },
      orderBy: { ngayTao: 'desc' },
      take: 5,
      select: { id: true, tieuDe: true, trangThai: true, loaiSuCo: true, ngayBaoCao: true },
    }),
  ]);

  // Hóa đơn gần nhất
  const hoaDonGanNhat = hoaDonList[0] ?? null;

  // Ngày hết hạn hợp đồng
  const daysUntilExpiry = hopDongHienTai
    ? Math.ceil((new Date(hopDongHienTai.ngayKetThuc).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Build biểu đồ hóa đơn theo tháng (12 tháng gần nhất có dữ liệu)
  const currentYear = now.getFullYear();
  const chartData: { month: number; year: number; label: string; tongTien: number; tienDien: number; tienNuoc: number; soDien: number; soNuoc: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const found = hoaDonList.find(h => h.thang === m && h.nam === y);
    chartData.push({
      month: m, year: y,
      label: `T${m}/${y !== currentYear ? y : ''}`,
      tongTien: found?.tongTien ?? 0,
      tienDien: found?.tienDien ?? 0,
      tienNuoc: found?.tienNuoc ?? 0,
      soDien: found?.soDien ?? 0,
      soNuoc: found?.soNuoc ?? 0,
    });
  }

  // Thông tin liên hệ: ưu tiên quản lý, nếu không có thì chủ trọ
  let lienHeQuanLy: { ten: string; soDienThoai?: string | null; email?: string | null } | null = null;
  if (hopDongHienTai) {
    const toaNha = (hopDongHienTai.phong as any)?.toaNha;
    const quanLy = toaNha?.nguoiQuanLy?.[0]?.nguoiDung;
    if (quanLy && (quanLy.soDienThoai || quanLy.email)) {
      lienHeQuanLy = { ten: quanLy.ten, soDienThoai: quanLy.soDienThoai, email: quanLy.email };
    } else {
      const chu = toaNha?.chuSoHuu;
      if (chu && (chu.soDienThoai || chu.email)) {
        lienHeQuanLy = { ten: chu.ten, soDienThoai: chu.soDienThoai, email: chu.email };
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      khachThue,
      hopDongHienTai,
      soHoaDonChuaThanhToan,
      soSuCoMoi,
      soSuCoDangXuLy,
      yeuCauChoDuyet,
      daysUntilExpiry,
      chartData,
      suCoGanNhat: suCoList,
      hoaDonGanNhat,
      lienHeQuanLy,
    },
  });
}
