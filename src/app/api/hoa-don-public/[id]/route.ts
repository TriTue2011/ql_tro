import { NextRequest, NextResponse } from 'next/server';
import { getHoaDonRepo, getThanhToanRepo } from '@/lib/repositories';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hoaDonId = params.id;

    if (!hoaDonId) {
      return NextResponse.json(
        { success: false, message: 'ID hóa đơn không hợp lệ' },
        { status: 400 }
      );
    }

    const hoaDonRepo = await getHoaDonRepo();
    const thanhToanRepo = await getThanhToanRepo();

    // Lấy thông tin hóa đơn
    const hoaDon = await hoaDonRepo.findById(hoaDonId);

    if (!hoaDon) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy hóa đơn' },
        { status: 404 }
      );
    }

    // Lấy lịch sử thanh toán của hóa đơn này
    const thanhToanList = await thanhToanRepo.findByHoaDon(hoaDonId);

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
