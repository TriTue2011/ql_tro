/**
 * GET  /api/chuNha/settings  → Lấy cài đặt riêng của chủ trọ
 * PUT  /api/chuNha/settings  → Lưu cài đặt riêng của chủ trọ
 * Chỉ chuNha và dongChuTro truy cập được.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ALLOWED_ROLES = ['chuNha', 'dongChuTro'];

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.id || !ALLOWED_ROLES.includes(role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const settings = await prisma.caiDatChuNha.findUnique({
    where: { nguoiDungId: session.user.id },
  });

  return NextResponse.json({ success: true, data: settings });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.id || !ALLOWED_ROLES.includes(role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();

  // Chỉ cho phép cập nhật các field hợp lệ
  const allowed = [
    'nganHangTen', 'nganHangSoTaiKhoan', 'nganHangChuTaiKhoan',
    'thongBaoTruocHanHopDong', 'thongBaoQuaHanHoaDon',
    'hoaDonCanhBaoLan1', 'hoaDonCanhBaoLan2', 'hoaDonCanhBaoLan3',
    'hopDongCanhBaoLan1', 'hopDongCanhBaoLan2', 'hopDongCanhBaoLan3',
    'chotChiSoNgayTrongThang', 'chotChiSoTruocNgay',
    'suCoChuaNhanGio', 'suCoChuaXuLyGio',
    'tenCongTy', 'emailLienHe', 'sdtLienHe', 'diaChiCongTy', 'appDomainUrl',
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const settings = await prisma.caiDatChuNha.upsert({
    where: { nguoiDungId: session.user.id },
    update: data,
    create: { nguoiDungId: session.user.id, ...data },
  });

  return NextResponse.json({ success: true, data: settings });
}
