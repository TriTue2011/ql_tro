/**
 * POST /api/khach-thue/[id]/kich-hoat-tai-khoan
 *   → Kích hoạt tài khoản đăng nhập cho khách thuê (đặt mật khẩu ngẫu nhiên)
 *   → Trả về mật khẩu plaintext để admin thông báo cho khách
 *
 * DELETE /api/khach-thue/[id]/kich-hoat-tai-khoan
 *   → Thu hồi quyền đăng nhập (xóa matKhau)
 *
 * Chỉ admin, chuNha, quanLy mới được thực hiện.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

const ALLOWED_ROLES = ['admin', 'chuNha', 'quanLy'];

function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // tránh ký tự dễ nhầm (0,O,I,l,1)
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('');
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;
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
  if (!session?.user?.id || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;
  await prisma.khachThue.update({ where: { id }, data: { matKhau: null } });

  return NextResponse.json({ ok: true });
}
