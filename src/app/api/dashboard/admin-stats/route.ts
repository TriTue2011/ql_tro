/**
 * GET /api/dashboard/admin-stats
 * Thống kê hệ thống dành riêng cho admin:
 * - Tổng tòa nhà (mỗi tòa nhà có 1 chủ trọ)
 * - Danh sách tòa nhà mới nhất
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

  const [tongToaNha, toaNhaMoiNhat] = await Promise.all([
    prisma.toaNha.count(),
    prisma.toaNha.findMany({
      take: 5,
      orderBy: { ngayTao: 'desc' },
      select: { id: true, tenToaNha: true, diaChi: true, ngayTao: true },
    }),
  ]);

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
      toaNhaMoiNhat: toaNhaMoiNhatFormatted,
    },
  });
}
