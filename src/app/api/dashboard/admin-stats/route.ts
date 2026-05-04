/**
 * GET /api/dashboard/admin-stats
 * Thống kê hệ thống dành riêng cho admin:
 * - Tổng tòa nhà (mỗi tòa nhà có 1 chủ trọ)
 * - Danh sách tòa nhà mới nhất
 * - Danh sách admin (không phải admin tổng) để quản lý
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [tongToaNha, danhSachToaNha, danhSachAdmin] = await Promise.all([
    prisma.toaNha.count(),
    prisma.toaNha.findMany({
      orderBy: { ngayTao: 'desc' },
      select: {
        id: true,
        tenToaNha: true,
        diaChi: true,
        ngayTao: true,
        chuSoHuu: {
          select: {
            id: true,
            ten: true,
            soDienThoai: true,
            email: true,
          },
        },
      },
    }),
    // Lấy danh sách admin (không phải admin tổng - người đang đăng nhập)
    prisma.nguoiDung.findMany({
      where: {
        vaiTro: 'admin',
        id: { not: session.user.id },
      },
      orderBy: { ngayTao: 'desc' },
      select: {
        id: true,
        ten: true,
        soDienThoai: true,
        email: true,
        trangThai: true,
        ngayTao: true,
        toaNhaQuanLy: {
          select: {
            toaNha: {
              select: {
                id: true,
                tenToaNha: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // diaChi là Json object { soNha, duong, phuong, quan, thanhPho } — chuyển thành string
  const danhSachToaNhaFormatted = danhSachToaNha.map((tn) => {
    const d = tn.diaChi as Record<string, string> | null;
    const diaChiStr = d
      ? [d.soNha, d.duong, d.phuong, d.quan, d.thanhPho].filter(Boolean).join(', ')
      : '';
    const chuTro = tn.chuSoHuu
      ? {
          id: tn.chuSoHuu.id,
          ten: tn.chuSoHuu.ten,
          soDienThoai: tn.chuSoHuu.soDienThoai,
          email: tn.chuSoHuu.email,
        }
      : null;
    return { id: tn.id, tenToaNha: tn.tenToaNha, diaChi: diaChiStr, ngayTao: tn.ngayTao, chuTro };
  });

  const danhSachAdminFormatted = danhSachAdmin.map((a) => ({
    id: a.id,
    ten: a.ten,
    soDienThoai: a.soDienThoai,
    email: a.email,
    trangThai: a.trangThai,
    ngayTao: a.ngayTao,
    toaNha: a.toaNhaQuanLy.map((q) => ({
      id: q.toaNha.id,
      tenToaNha: q.toaNha.tenToaNha,
    })),
  }));

  return NextResponse.json({
    success: true,
    data: {
      tongToaNha,
      danhSachToaNha: danhSachToaNhaFormatted,
      danhSachAdmin: danhSachAdminFormatted,
    },
  });
}
