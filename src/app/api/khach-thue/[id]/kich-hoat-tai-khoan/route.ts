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
 * Kiểm tra quyền: trả về true nếu user có thể kích hoạt/thu hồi tài khoản khachThueId.
 * - admin: luôn true
 * - chuNha: true (không cần kiểm tra building — chuNha tự chịu trách nhiệm)
 * - quanLy: phải có quyenKichHoatTaiKhoan = true trong ToaNhaNguoiQuanLy
 *           cho tòa nhà chứa phòng đang thuê của khách
 */
async function hasPermission(userId: string, role: string, khachThueId: string): Promise<boolean> {
  if (role === 'admin' || role === 'chuNha') return true;
  if (role !== 'quanLy') return false;

  // Lấy tòa nhà của khách thuê qua hợp đồng đang hoạt động
  const hopDong = await prisma.hopDong.findFirst({
    where: {
      khachThue: { some: { id: khachThueId } },
      trangThai: 'hoatDong',
    },
    select: { phong: { select: { toaNhaId: true } } },
  });

  const toaNhaId = hopDong?.phong?.toaNhaId;
  if (!toaNhaId) {
    // Khách chưa có hợp đồng — thử qua bất kỳ hợp đồng nào
    const anyHopDong = await prisma.hopDong.findFirst({
      where: { khachThue: { some: { id: khachThueId } } },
      orderBy: { ngayTao: 'desc' },
      select: { phong: { select: { toaNhaId: true } } },
    });
    const tid = anyHopDong?.phong?.toaNhaId;
    if (!tid) return false;
    const perm = await prisma.toaNhaNguoiQuanLy.findUnique({
      where: { toaNhaId_nguoiDungId: { toaNhaId: tid, nguoiDungId: userId } },
      select: { quyenKichHoatTaiKhoan: true },
    });
    return perm?.quyenKichHoatTaiKhoan === true;
  }

  const perm = await prisma.toaNhaNguoiQuanLy.findUnique({
    where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId: userId } },
    select: { quyenKichHoatTaiKhoan: true },
  });
  return perm?.quyenKichHoatTaiKhoan === true;
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

  const kt = await prisma.khachThue.findUnique({ where: { id }, select: { id: true, soDienThoai: true } });
  if (!kt) return NextResponse.json({ error: 'Không tìm thấy khách thuê' }, { status: 404 });

  const plainPassword = generatePassword();
  const hashed = await hash(plainPassword, 12);
  await prisma.khachThue.update({ where: { id }, data: { matKhau: hashed } });

  return NextResponse.json({ matKhau: plainPassword, soDienThoai: kt.soDienThoai });
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

  await prisma.khachThue.update({ where: { id }, data: { matKhau: null } });
  return NextResponse.json({ ok: true });
}
