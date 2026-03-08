import { NextRequest, NextResponse } from 'next/server';
import { getNguoiDungRepo } from '@/lib/repositories';
import { z } from 'zod';

const registerSchema = z.object({
  ten: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ'),
  vaiTro: z.enum(['chuNha', 'nhanVien']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    const repo = await getNguoiDungRepo();

    // Check if user already exists by email
    const existingByEmail = await repo.findByEmail(validatedData.email.toLowerCase());

    if (existingByEmail) {
      return NextResponse.json(
        { message: 'Email hoặc số điện thoại đã được sử dụng' },
        { status: 400 }
      );
    }

    // Check by phone using findMany search
    const existingBySdt = await repo.findMany({ search: validatedData.soDienThoai, limit: 10 });
    const sdtExists = existingBySdt.data.some(u => u.soDienThoai === validatedData.soDienThoai);

    if (sdtExists) {
      return NextResponse.json(
        { message: 'Email hoặc số điện thoại đã được sử dụng' },
        { status: 400 }
      );
    }

    // Create new user
    await repo.create({
      ten: validatedData.ten,
      email: validatedData.email.toLowerCase(),
      matKhau: validatedData.matKhau,
      soDienThoai: validatedData.soDienThoai,
      vaiTro: validatedData.vaiTro,
    });

    return NextResponse.json(
      { message: 'Đăng ký thành công' },
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
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
