import { NextRequest, NextResponse } from 'next/server';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const loginSchema = z.object({
  taiKhoan: z.string().min(1, 'Vui lòng nhập số điện thoại hoặc email'),
  matKhau: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    const repo = await getKhachThueRepo();
    const taiKhoan = validatedData.taiKhoan.trim();

    // Tìm khách thuê bằng SĐT hoặc email
    let khachThue: Awaited<ReturnType<typeof repo.findBySoDienThoai>>;
    const isPhone = /^[0-9]{10,11}$/.test(taiKhoan);
    if (isPhone) {
      khachThue = await repo.findBySoDienThoai(taiKhoan);
    } else {
      khachThue = await repo.findByEmail(taiKhoan);
    }

    if (!khachThue) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    if (!khachThue.matKhau) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản chưa được tạo mật khẩu. Vui lòng liên hệ quản lý.' },
        { status: 401 }
      );
    }

    // Kiểm tra tòa nhà có cho phép khách thuê đăng nhập web không
    const hopDong = await prisma.hopDong.findFirst({
      where: {
        khachThue: { some: { id: khachThue.id } },
        trangThai: 'hoatDong',
      },
      select: { phong: { select: { toaNhaId: true } } },
    });
    if (hopDong?.phong?.toaNhaId) {
      const caiDat = await prisma.caiDatToaNha.findUnique({
        where: { toaNhaId: hopDong.phong.toaNhaId },
        select: { adminBatDangNhapKT: true, chuTroBatDangNhapKT: true },
      });
      // Cần cả admin lẫn chủ trọ đều bật thì mới cho phép
      if (!caiDat?.adminBatDangNhapKT || !caiDat?.chuTroBatDangNhapKT) {
        return NextResponse.json(
          { success: false, message: 'Tính năng đăng nhập web cho khách thuê chưa được bật tại tòa nhà này. Vui lòng liên hệ quản lý.' },
          { status: 403 }
        );
      }
    } else {
      // Không tìm thấy hợp đồng hoạt động → không cho đăng nhập
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy hợp đồng đang hoạt động. Vui lòng liên hệ quản lý.' },
        { status: 403 }
      );
    }

    // Kiểm tra per-tenant: khách thuê có được bật đăng nhập web không
    if (!khachThue.batDangNhapWeb) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản của bạn chưa được bật đăng nhập web. Vui lòng liên hệ quản lý.' },
        { status: 403 }
      );
    }

    const isPasswordValid = await bcrypt.compare(validatedData.matKhau, khachThue.matKhau);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      {
        id: khachThue.id,
        soDienThoai: khachThue.soDienThoai || '',
        email: khachThue.email || '',
        hoTen: khachThue.hoTen,
        role: 'khachThue'
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '7d' }
    );

    const khachThueData = {
      id: khachThue.id,
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
