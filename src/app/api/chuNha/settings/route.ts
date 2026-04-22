/**
 * GET  /api/chuNha/settings  → Lấy cài đặt riêng của chủ trọ / quản lý
 * PUT  /api/chuNha/settings  → Lưu cài đặt riêng của chủ trọ / quản lý
 *
 * Quyền:
 *   - chuNha, dongChuTro: luôn được
 *   - quanLy: chỉ được nếu CaiDat `cho_phep_quan_ly_tai_khoan` = 'true',
 *     và chỉ được sửa các field thanh toán (ngân hàng) — không được sửa
 *     cảnh báo/hệ thống (đó là domain của chủ trọ).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const BASE_ROLES = ['chuNha', 'dongChuTro'];
const FULL_EDIT_ROLES = BASE_ROLES;
const QUAN_LY_EDITABLE_FIELDS = [
  'nganHangTen',
  'nganHangSoTaiKhoan',
  'nganHangChuTaiKhoan',
];

async function isQuanLyAllowed(): Promise<boolean> {
  const row = await prisma.caiDat.findUnique({
    where: { khoa: 'cho_phep_quan_ly_tai_khoan' },
    select: { giaTri: true },
  });
  return (row?.giaTri ?? 'false') === 'true';
}

async function resolveRoleAccess(role: string | undefined): Promise<'full' | 'bank' | null> {
  if (!role) return null;
  if (FULL_EDIT_ROLES.includes(role)) return 'full';
  if (role === 'quanLy' && (await isQuanLyAllowed())) return 'bank';
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await resolveRoleAccess(session?.user?.role);
  if (!session?.user?.id || !access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const settings = await prisma.caiDatChuNha.findUnique({
    where: { nguoiDungId: session.user.id },
  });

  return NextResponse.json({ success: true, data: settings, access });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const access = await resolveRoleAccess(session?.user?.role);
  if (!session?.user?.id || !access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();

  const fullAllowed = [
    'nganHangTen', 'nganHangSoTaiKhoan', 'nganHangChuTaiKhoan',
    'thongBaoTruocHanHopDong', 'thongBaoQuaHanHoaDon',
    'hoaDonCanhBaoLan1', 'hoaDonCanhBaoLan2', 'hoaDonCanhBaoLan3',
    'hopDongCanhBaoLan1', 'hopDongCanhBaoLan2', 'hopDongCanhBaoLan3',
    'chotChiSoNgayTrongThang', 'chotChiSoTruocNgay',
    'suCoChuaNhanGio', 'suCoChuaXuLyGio',
    'tenCongTy', 'emailLienHe', 'sdtLienHe', 'diaChiCongTy', 'appDomainUrl',
  ];

  const allowed = access === 'full' ? fullAllowed : QUAN_LY_EDITABLE_FIELDS;

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
