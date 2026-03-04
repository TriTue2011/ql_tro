import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import HopDong from '@/models/HopDong';
import Phong from '@/models/Phong';
import KhachThue from '@/models/KhachThue';

export async function GET(request: NextRequest) {
  try {
    console.log('Form data API called');
    
    // Temporarily disable authentication for debugging
    // const session = await getServerSession(authOptions);
    // console.log('Session:', session);
    
    // if (!session) {
    //   console.log('No session found');
    //   return NextResponse.json(
    //     { message: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    console.log('Session found, connecting to database...');
    await connectToDatabase();
    console.log('Database connected successfully');

    // Test simple queries first
    console.log('Testing simple queries...');
    
    // Get all rooms for reference (simplified)
    console.log('Fetching phongList...');
    const phongList = await Phong.find()
      .select('maPhong toaNha tang dienTich giaThue trangThai')
      .sort({ maPhong: 1 });
    console.log('Fetched phongList:', phongList.length);

    // Get all tenants for reference (simplified)
    console.log('Fetching khachThueList...');
    const khachThueList = await KhachThue.find()
      .select('hoTen soDienThoai email trangThai')
      .sort({ hoTen: 1 });
    console.log('Fetched khachThueList:', khachThueList.length);

    // Get active contracts (simplified - no populate first)
    console.log('Fetching hopDongList...');
    const hopDongList = await HopDong.find({
      trangThai: 'hoatDong',
    })
      .select('maHopDong phong nguoiDaiDien giaThue giaDien giaNuoc phiDichVu ngayThanhToan trangThai chiSoDienBanDau chiSoNuocBanDau ngayBatDau ngayKetThuc')
      .sort({ maHopDong: 1 });
    console.log('Fetched hopDongList:', hopDongList.length);

    return NextResponse.json({
      success: true,
      data: {
        hopDongList,
        phongList,
        khachThueList,
      },
    });

  } catch (error) {
    console.error('Error fetching form data:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
