import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNguoiDungRepo } from '@/lib/repositories';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const createUserSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(128),
  phone: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ').optional(),
  // Chỉ cho phép role hợp lệ — không thể tạo role tùy ý
  role: z.enum(['admin', 'chuNha', 'quanLy', 'nhanVien']),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = await getNguoiDungRepo();
    const result = await repo.findMany({ limit: 1000 });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate và sanitize với Zod — thay thế kiểm tra thủ công không đầy đủ
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, phone, role } = parsed.data;

    const repo = await getNguoiDungRepo();

    // Check if user already exists
    const existingUser = await repo.findByEmail(email.toLowerCase());
    if (existingUser) {
      return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 });
    }

    // Hash password before storing
    const hashedPassword = await hash(password, 12);

    // Create user
    const newUser = await repo.create({
      ten: sanitizeText(name),
      email: email.toLowerCase(),
      matKhau: hashedPassword,
      soDienThoai: phone,
      vaiTro: role,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
