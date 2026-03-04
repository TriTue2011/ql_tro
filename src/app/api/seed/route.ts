import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import NguoiDung from '@/models/NguoiDung';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Clear existing data
    await Promise.all([
      NguoiDung.deleteMany({})
    ]);

    // Create admin user
    const admin = new NguoiDung({
      // Vietnamese fields
      ten: 'Admin',
      email: 'admin@example.com',
      matKhau: '123456',
      soDienThoai: '0326132124',
      vaiTro: 'admin',
      trangThai: 'hoatDong',
      // English fields (required for compatibility)
      name: 'Admin',
      password: '123456',
      phone: '0326132124',
      role: 'admin',
      isActive: true,
    });
    await admin.save();

 


  
   
    return NextResponse.json({
      success: true,
      message: 'Seed data đã được tạo thành công',
      data: {
        admin: admin.email
      }
    });

  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
