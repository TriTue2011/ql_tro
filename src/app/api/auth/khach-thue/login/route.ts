import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const loginSchema = z.object({
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ'),
  matKhau: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    await dbConnect();

    // Tìm khách thuê theo số điện thoại và lấy cả mật khẩu
    const khachThue = await KhachThue.findOne({ 
      soDienThoai: validatedData.soDienThoai 
    }).select('+matKhau');

    if (!khachThue) {
      return NextResponse.json(
        { success: false, message: 'Số điện thoại hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    // Kiểm tra xem khách thuê đã có mật khẩu chưa
    if (!khachThue.matKhau) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản lý để tạo mật khẩu.' },
        { status: 401 }
      );
    }

    // So sánh mật khẩu
    const isPasswordValid = await khachThue.comparePassword(validatedData.matKhau);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Số điện thoại hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    // Tạo JWT token
    const token = jwt.sign(
      { 
        id: khachThue._id,
        soDienThoai: khachThue.soDienThoai,
        hoTen: khachThue.hoTen,
        role: 'khachThue'
      },
      process.env.NEXTAUTH_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    // Trả về thông tin khách thuê (không bao gồm mật khẩu)
    const khachThueData = {
      _id: khachThue._id,
      hoTen: khachThue.hoTen,
      soDienThoai: khachThue.soDienThoai,
      email: khachThue.email,
      cccd: khachThue.cccd,
      trangThai: khachThue.trangThai,
    };

    return NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        khachThue: khachThueData,
        token
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error logging in:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra khi đăng nhập' },
      { status: 500 }
    );
  }
}

