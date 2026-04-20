/**
 * /api/admin/ai-accounts
 *
 * Quản lý kích hoạt AI per tài khoản — chỉ admin.
 * GET  → Danh sách NguoiDung với trạng thái aiEnabled
 * PUT  → { userId, aiEnabled } — bật/tắt AI cho 1 tài khoản
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const VAI_TRO_LABEL: Record<string, string> = {
  admin: 'Quản trị viên',
  chuNha: 'Chủ nhà',
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const accounts = await prisma.nguoiDung.findMany({
    where: { vaiTro: { not: 'admin' } },
    select: {
      id: true,
      ten: true,
      email: true,
      soDienThoai: true,
      vaiTro: true,
      trangThai: true,
      aiEnabled: true,
    },
    orderBy: [{ vaiTro: 'asc' }, { ten: 'asc' }],
  });

  return NextResponse.json({
    success: true,
    data: accounts.map(a => ({
      ...a,
      vaiTroLabel: VAI_TRO_LABEL[a.vaiTro] ?? a.vaiTro,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { userId, aiEnabled } = body ?? {};

  if (!userId || typeof aiEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  await prisma.nguoiDung.update({
    where: { id: userId },
    data: { aiEnabled },
  });

  return NextResponse.json({ success: true });
}
