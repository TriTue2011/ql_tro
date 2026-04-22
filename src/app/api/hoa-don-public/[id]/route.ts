// Endpoint công khai — dùng cho link chia sẻ hóa đơn gửi khách thuê.
// ID hóa đơn (cuid) đóng vai trò access token ngầm; không cần session.
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHoaDonRepo, getThanhToanRepo } from '@/lib/repositories';

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
      prisma.caiDat.findMany({
        where: {
          khoa: {
            in: [
              'ten_cong_ty',
              'ngan_hang_so_tai_khoan',
              'ngan_hang_ten',
              'ngan_hang_chu_tai_khoan',
              'logo_url',
            ],
          },
        },
        select: { khoa: true, giaTri: true },
      }),
    ]);

    const thanhToanList = await thanhToanRepo.findByHoaDon(hoaDonId);

    const rawCfg = Object.fromEntries(cauHinh.map(r => [r.khoa, r.giaTri ?? '']));
    return NextResponse.json({
      success: true,
      data: {
        hoaDon,
        thanhToanList,
        phong,
        khachThue,
        cauHinh: {
          tenChuNha: rawCfg['ten_cong_ty'] ?? '',
          soTaiKhoan: rawCfg['ngan_hang_so_tai_khoan'] ?? '',
          nganHang: rawCfg['ngan_hang_ten'] ?? '',
          chuTaiKhoan: rawCfg['ngan_hang_chu_tai_khoan'] ?? '',
          logoUrl: rawCfg['logo_url'] ?? '',
        },
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
