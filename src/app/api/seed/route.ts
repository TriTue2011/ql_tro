import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import NguoiDung from '@/models/NguoiDung';
import { hash } from 'bcryptjs';

export async function POST(_request: NextRequest) {
  // Chỉ cho phép trong môi trường development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { message: 'Endpoint này chỉ khả dụng trong môi trường development' },
      { status: 403 }
    );
  }

  try {
    await dbConnect();

    await Promise.all([
      NguoiDung.deleteMany({})
    ]);

    const hashedPassword = await hash('123456', 12);

    const admin = new NguoiDung({
      ten: 'Admin',
      email: 'admin@example.com',
      matKhau: hashedPassword,
      soDienThoai: '0326132124',
      vaiTro: 'admin',
      trangThai: 'hoatDong',
      name: 'Admin',
      password: hashedPassword,
      phone: '0326132124',
      role: 'admin',
      isActive: true,
    });
    await admin.save();

    return NextResponse.json({
      success: true,
      message: 'Seed data đã được tạo thành công',
      data: { admin: admin.email }
    });

  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
