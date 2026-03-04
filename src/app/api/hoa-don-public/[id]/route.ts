import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HoaDon from '@/models/HoaDon';
import ThanhToan from '@/models/ThanhToan';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const hoaDonId = params.id;
    
    if (!hoaDonId) {
      return NextResponse.json(
        { success: false, message: 'ID hóa đơn không hợp lệ' },
        { status: 400 }
      );
    }

    // Lấy thông tin hóa đơn với populate
    const hoaDon = await HoaDon.findById(hoaDonId)
      .populate('hopDong')
      .populate('phong')
      .populate('khachThue')
      .lean();

    if (!hoaDon) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy hóa đơn' },
        { status: 404 }
      );
    }

    // Lấy lịch sử thanh toán của hóa đơn này
    const thanhToanList = await ThanhToan.find({ hoaDon: hoaDonId })
      .sort({ ngayThanhToan: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        hoaDon,
        thanhToanList
      }
    });

  } catch (error) {
    console.error('Error fetching public invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra khi tải thông tin hóa đơn' },
      { status: 500 }
    );
  }
}
