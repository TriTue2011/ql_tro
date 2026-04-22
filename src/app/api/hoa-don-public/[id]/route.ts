// Endpoint công khai — dùng cho link chia sẻ hóa đơn gửi khách thuê.
// ID hóa đơn (cuid) đóng vai trò access token ngầm; không cần session.
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHoaDonRepo, getThanhToanRepo } from '@/lib/repositories';
import { resolveInvoiceBankInfo } from '@/lib/invoice-bank-resolver';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hoaDonId } = await params;

    if (!hoaDonId) {
      return NextResponse.json(
        { success: false, message: 'ID hóa đơn không hợp lệ' },
        { status: 400 }
      );
    }

    const hoaDonRepo = await getHoaDonRepo();
    const thanhToanRepo = await getThanhToanRepo();

    const hoaDon = await hoaDonRepo.findById(hoaDonId);

    if (!hoaDon) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy hóa đơn' },
        { status: 404 }
      );
    }

    // Phụ trợ cho template PDF: lấy thêm thông tin phòng, tòa nhà, khách thuê
    const [phong, khachThue, cauHinh] = await Promise.all([
      hoaDon.phongId ? prisma.phong.findUnique({
        where: { id: hoaDon.phongId },
        select: {
          id: true, maPhong: true, tang: true, dienTich: true, giaThue: true,
          toaNha: { select: { tenToaNha: true, diaChi: true, lienHePhuTrach: true } },
        },
      }) : null,
      hoaDon.khachThueId ? prisma.khachThue.findUnique({
        where: { id: hoaDon.khachThueId },
        select: { hoTen: true, soDienThoai: true, email: true, cccd: true },
      }) : null,
      resolveInvoiceBankInfo(hoaDon.nguoiTaoId),
    ]);

    const thanhToanList = await thanhToanRepo.findByHoaDon(hoaDonId);

    return NextResponse.json({
      success: true,
      data: {
        hoaDon,
        thanhToanList,
        phong,
        khachThue,
        cauHinh,
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
