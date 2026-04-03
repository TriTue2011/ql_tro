import { NextRequest, NextResponse } from 'next/server';
import { getNguoiDungRepo } from '@/lib/repositories';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { sanitizeText } from '@/lib/sanitize';

const registerSchema = z.object({
  ten: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(128),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ').optional().or(z.literal('')),
  // Chỉ cho phép role an toàn — admin không thể tự đăng ký qua endpoint này
  vaiTro: z.enum(['chuNha', 'nhanVien']),
}).refine(
  data => (data.soDienThoai && data.soDienThoai.trim() !== '') || (data.email && data.email.trim() !== ''),
  { message: 'Cần ít nhất số điện thoại hoặc email', path: ['soDienThoai'] }
);

export async function POST(request: NextRequest) {
  try {
    // Chỉ admin đã đăng nhập mới được tạo tài khoản mới.
    // Ngăn người lạ tự đăng ký tài khoản quản lý.
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Chỉ admin mới có thể tạo tài khoản mới' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    const repo = await getNguoiDungRepo();

    const cleanEmail = validatedData.email?.trim() ? validatedData.email.toLowerCase() : undefined;
    const cleanPhone = validatedData.soDienThoai?.trim() || undefined;

    // Check if user already exists by email
    if (cleanEmail) {
      const existingByEmail = await repo.findByEmail(cleanEmail);
      if (existingByEmail) {
        return NextResponse.json({ message: 'Email đã được sử dụng' }, { status: 400 });
      }
    }

    // Check by phone
    if (cleanPhone) {
      const existingBySdt = await repo.findMany({ search: cleanPhone, limit: 10 });
      if (existingBySdt.data.some(u => u.soDienThoai === cleanPhone)) {
        return NextResponse.json({ message: 'Số điện thoại đã được sử dụng' }, { status: 400 });
      }
    }

    // Hash password before storing
    const hashedPassword = await hash(validatedData.matKhau, 12);

    // Create new user
    await repo.create({
      ten: sanitizeText(validatedData.ten),
      email: cleanEmail,
      matKhau: hashedPassword,
      soDienThoai: cleanPhone,
      vaiTro: validatedData.vaiTro,
    });

    return NextResponse.json(
      { message: 'Đăng ký thành công' },
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { message: 'Email hoặc số điện thoại đã được sử dụng' },
        { status: 400 }
      );
    }

    console.error('Register error:', error);
    return NextResponse.json(
      { message: 'Đã xảy ra lỗi, vui lòng thử lại' },
      { status: 500 }
    );
  }
}
