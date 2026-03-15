import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNguoiDungRepo } from '@/lib/repositories';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  matKhauHienTai: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
  matKhauMoi: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .max(128)
    .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Phải có ít nhất 1 chữ số'),
  xacNhanMatKhau: z.string().min(1, 'Xác nhận mật khẩu là bắt buộc'),
}).refine(d => d.matKhauMoi === d.xacNhanMatKhau, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['xacNhanMatKhau'],
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { matKhauHienTai, matKhauMoi } = parsed.data;

    const repo = await getNguoiDungRepo();
    const user = await repo.findByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });
    }

    const isValid = await compare(matKhauHienTai, user.matKhau);
    if (!isValid) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    }

    if (matKhauHienTai === matKhauMoi) {
      return NextResponse.json({ error: 'Mật khẩu mới không được trùng mật khẩu cũ' }, { status: 400 });
    }

    const hashed = await hash(matKhauMoi, 12);
    await repo.update(user.id, { matKhau: hashed });

    return NextResponse.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
