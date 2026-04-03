/**
 * POST /api/khach-thue/[id]/kich-hoat-tai-khoan
 *   → Kích hoạt tài khoản đăng nhập cho khách thuê (đặt mật khẩu ngẫu nhiên)
 *   → Trả về mật khẩu plaintext để admin thông báo cho khách
 *
 * DELETE /api/khach-thue/[id]/kich-hoat-tai-khoan
 *   → Thu hồi quyền đăng nhập (xóa matKhau)
 *
 * Quyền truy cập:
 *   - admin: luôn được
 *   - chuNha: luôn được (với khách thuê trong tòa nhà của mình)
 *   - quanLy: chỉ khi được chuNha trao quyền (quyenKichHoatTaiKhoan = true)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // tránh ký tự dễ nhầm (0,O,I,l,1)
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('');
}

/**
 * Tìm toaNhaId của khách thuê qua hợp đồng (ưu tiên hợp đồng đang hoạt động).
 */
async function getToaNhaIdOfKhachThue(khachThueId: string): Promise<string | null> {
  const hopDong = await prisma.hopDong.findFirst({
    where: {
      khachThue: { some: { id: khachThueId } },
      trangThai: 'hoatDong',
    },
    select: { phong: { select: { toaNhaId: true } } },
  });
  if (hopDong?.phong?.toaNhaId) return hopDong.phong.toaNhaId;

  // Fallback: bất kỳ hợp đồng nào
  const anyHopDong = await prisma.hopDong.findFirst({
    where: { khachThue: { some: { id: khachThueId } } },
    orderBy: { ngayTao: 'desc' },
    select: { phong: { select: { toaNhaId: true } } },
  });
  return anyHopDong?.phong?.toaNhaId ?? null;
}

/**
 * Kiểm tra quyền: trả về true nếu user có thể kích hoạt/thu hồi tài khoản khachThueId.
 * - admin: luôn true
 * - chuNha: chỉ khi admin đã bật adminBatDangNhapKT VÀ chủ trọ đã bật chuTroBatDangNhapKT cho tòa nhà
 * - quanLy: phải có quyenKichHoatTaiKhoan = true + tòa nhà đã bật đăng nhập KT
 */
async function hasPermission(userId: string, role: string, khachThueId: string): Promise<boolean> {
  if (role === 'admin') return true;

  const toaNhaId = await getToaNhaIdOfKhachThue(khachThueId);
  if (!toaNhaId) return false;

  // Kiểm tra cài đặt tòa nhà: admin đã bật + chủ trọ đã bật
  const caiDat = await prisma.caiDatToaNha.findUnique({
    where: { toaNhaId },
    select: { adminBatDangNhapKT: true, chuTroBatDangNhapKT: true },
  });
  // Phải cả admin lẫn chủ trọ đều bật thì mới cho phép kích hoạt
  const dangNhapDuocPhep = caiDat?.adminBatDangNhapKT === true && caiDat?.chuTroBatDangNhapKT === true;

  if (role === 'chuNha') return dangNhapDuocPhep;

  if (role !== 'quanLy') return false;

  if (!dangNhapDuocPhep) return false;

  const perm = await prisma.toaNhaNguoiQuanLy.findUnique({
    where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId: userId } },
    select: { quyenKichHoatTaiKhoan: true },
  });
  return perm?.quyenKichHoatTaiKhoan === true;
}

/**
 * Kiểm tra giới hạn số khách thuê đã được kích hoạt đăng nhập trong tòa nhà.
 */
async function kiemTraGioiHan(toaNhaId: string): Promise<{ ok: boolean; message?: string }> {
  const caiDat = await prisma.caiDatToaNha.findUnique({
    where: { toaNhaId },
    select: { gioiHanDangNhapKT: true },
  });
  const gioiHan = caiDat?.gioiHanDangNhapKT;
  if (gioiHan === null || gioiHan === undefined) return { ok: true }; // không giới hạn

  // Đếm số khách thuê đã có matKhau trong tòa nhà này
  const soLuongDaBat = await prisma.khachThue.count({
    where: {
      matKhau: { not: null },
      hopDong: {
        some: {
          phong: { toaNhaId },
          trangThai: 'hoatDong',
        },
      },
    },
  });

  if (soLuongDaBat >= gioiHan) {
    return { ok: false, message: `Đã đạt giới hạn ${gioiHan} khách thuê được đăng nhập web cho tòa nhà này` };
  }
  return { ok: true };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const { id } = await params;

  const allowed = await hasPermission(session.user.id, session.user.role, id);
  if (!allowed) {
    return NextResponse.json({ error: 'Không có quyền kích hoạt tài khoản khách thuê' }, { status: 403 });
  }

  const kt = await prisma.khachThue.findUnique({ where: { id }, select: { id: true, soDienThoai: true, email: true } });
  if (!kt) return NextResponse.json({ error: 'Không tìm thấy khách thuê' }, { status: 404 });

  // Kiểm tra giới hạn số khách thuê được đăng nhập web
  const toaNhaId = await getToaNhaIdOfKhachThue(id);
  if (toaNhaId) {
    const gioiHan = await kiemTraGioiHan(toaNhaId);
    if (!gioiHan.ok) {
      return NextResponse.json({ error: gioiHan.message }, { status: 400 });
    }
  }

  const plainPassword = generatePassword();
  const hashed = await hash(plainPassword, 12);
  await prisma.khachThue.update({ where: { id }, data: { matKhau: hashed, batDangNhapWeb: true } });

  return NextResponse.json({ matKhau: plainPassword, soDienThoai: kt.soDienThoai, email: kt.email });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const { id } = await params;

  const allowed = await hasPermission(session.user.id, session.user.role, id);
  if (!allowed) {
    return NextResponse.json({ error: 'Không có quyền thu hồi tài khoản khách thuê' }, { status: 403 });
  }

  await prisma.khachThue.update({ where: { id }, data: { matKhau: null, batDangNhapWeb: false } });
  return NextResponse.json({ ok: true });
}
