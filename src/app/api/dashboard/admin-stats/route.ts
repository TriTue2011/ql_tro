/**
 * GET /api/dashboard/admin-stats
 * Thống kê hệ thống dành riêng cho admin:
 * - Tổng tòa nhà, phân bố người dùng theo vai trò
 * - Số khách thuê đang có tài khoản đăng nhập
 * - Trạng thái hệ thống (uptime placeholder)
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

  const [
    tongToaNha,
    tongNguoiDung,
    userByRole,
    tongKhachThue,
    khachThueCoTaiKhoan,
    toaNhaMoiNhat,
  ] = await Promise.all([
    prisma.toaNha.count(),
    prisma.nguoiDung.count(),
    prisma.nguoiDung.groupBy({ by: ['vaiTro'], _count: { id: true } }),
    prisma.khachThue.count(),
    prisma.khachThue.count({ where: { matKhau: { not: null } } }),
    prisma.toaNha.findMany({
      take: 5,
      orderBy: { ngayTao: 'desc' },
      select: { id: true, tenToaNha: true, diaChi: true, ngayTao: true },
    }),
  ]);

  const roleCount: Record<string, number> = {};
  for (const r of userByRole) roleCount[r.vaiTro] = r._count.id;

  // diaChi là Json object { soNha, duong, phuong, quan, thanhPho } — chuyển thành string
  const toaNhaMoiNhatFormatted = toaNhaMoiNhat.map((tn) => {
    const d = tn.diaChi as Record<string, string> | null;
    const diaChiStr = d
      ? [d.soNha, d.duong, d.phuong, d.quan, d.thanhPho].filter(Boolean).join(', ')
      : '';
    return { id: tn.id, tenToaNha: tn.tenToaNha, diaChi: diaChiStr, ngayTao: tn.ngayTao };
  });

  return NextResponse.json({
    success: true,
    data: {
      tongToaNha,
      tongNguoiDung,
      tongChuNha: roleCount['chuNha'] ?? 0,
      tongQuanLy: roleCount['quanLy'] ?? 0,
      tongNhanVien: roleCount['nhanVien'] ?? 0,
      tongAdmin: roleCount['admin'] ?? 0,
      tongKhachThue,
      khachThueCoTaiKhoan,
      toaNhaMoiNhat: toaNhaMoiNhatFormatted,
    },
  });
}
