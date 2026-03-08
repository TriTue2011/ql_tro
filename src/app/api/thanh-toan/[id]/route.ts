import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getThanhToanRepo, getHoaDonRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

// PUT - Cập nhật thanh toán
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      hoaDonId,
      soTien,
      phuongThuc,
      thongTinChuyenKhoan,
      ngayThanhToan,
      ghiChu,
      anhBienLai
    } = body;

    // Validate required fields
    if (!hoaDonId || !soTien || !phuongThuc) {
      return NextResponse.json(
        { message: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }

    const thanhToanRepo = await getThanhToanRepo();
    const hoaDonRepo = await getHoaDonRepo();

    // Tìm thanh toán hiện tại
    const thanhToanHienTai = await thanhToanRepo.findById(id);
    if (!thanhToanHienTai) {
      return NextResponse.json(
        { message: 'Thanh toán không tồn tại' },
        { status: 404 }
      );
    }

    // Kiểm tra hóa đơn tồn tại
    const hoaDon = await hoaDonRepo.findById(hoaDonId);
    if (!hoaDon) {
      return NextResponse.json(
        { message: 'Hóa đơn không tồn tại' },
        { status: 404 }
      );
    }

    // Trước tiên, hoàn lại số tiền cũ cho hóa đơn gốc
    const hoaDonCuId = thanhToanHienTai.hoaDonId;
    const hoaDonCu = await hoaDonRepo.findById(hoaDonCuId);
    if (hoaDonCu) {
      const newDaThanhToan = Math.max(0, hoaDonCu.daThanhToan - thanhToanHienTai.soTien);
      const newConLai = hoaDonCu.tongTien - newDaThanhToan;
      let newTrangThai: 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan';
      if (newConLai <= 0) {
        newTrangThai = 'daThanhToan';
      } else if (newDaThanhToan > 0) {
        newTrangThai = 'daThanhToanMotPhan';
      } else {
        newTrangThai = 'chuaThanhToan';
      }

      await prisma.hoaDon.update({
        where: { id: hoaDonCuId },
        data: { daThanhToan: newDaThanhToan, conLai: newConLai, trangThai: newTrangThai },
      });
    }

    // Kiểm tra số tiền thanh toán mới không vượt quá số tiền còn lại
    // Lấy lại hóa đơn sau khi hoàn tiền
    const hoaDonRefreshed = await hoaDonRepo.findById(hoaDonId);
    if (hoaDonRefreshed && soTien > hoaDonRefreshed.conLai) {
      return NextResponse.json(
        { message: 'Số tiền thanh toán không được vượt quá số tiền còn lại' },
        { status: 400 }
      );
    }

    // Validate thông tin chuyển khoản nếu phương thức là chuyển khoản
    if (phuongThuc === 'chuyenKhoan' && !thongTinChuyenKhoan) {
      return NextResponse.json(
        { message: 'Thông tin chuyển khoản là bắt buộc' },
        { status: 400 }
      );
    }

    // Cập nhật thanh toán trực tiếp qua prisma
    const updatedThanhToan = await prisma.thanhToan.update({
      where: { id },
      data: {
        hoaDonId,
        soTien,
        phuongThuc,
        thongTinChuyenKhoan: phuongThuc === 'chuyenKhoan' ? thongTinChuyenKhoan : undefined,
        ngayThanhToan: ngayThanhToan ? new Date(ngayThanhToan) : new Date(),
        ghiChu,
        anhBienLai,
      },
      include: {
        hoaDon: { select: { id: true, maHoaDon: true, thang: true, nam: true, tongTien: true } },
        nguoiNhan: { select: { id: true, ten: true, email: true } },
      },
    });

    // Cập nhật hóa đơn mới
    await hoaDonRepo.addPayment(hoaDonId, soTien);

    return NextResponse.json({
      success: true,
      data: updatedThanhToan,
      message: 'Cập nhật thanh toán thành công'
    });
  } catch (error) {
    console.error('Error updating thanh toan:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Xóa thanh toán
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const thanhToanRepo = await getThanhToanRepo();
    const hoaDonRepo = await getHoaDonRepo();

    // Tìm thanh toán
    const thanhToan = await thanhToanRepo.findById(id);
    if (!thanhToan) {
      return NextResponse.json(
        { message: 'Thanh toán không tồn tại' },
        { status: 404 }
      );
    }

    // Cập nhật lại hóa đơn (hoàn lại số tiền)
    const hoaDon = await hoaDonRepo.findById(thanhToan.hoaDonId);
    if (hoaDon) {
      const newDaThanhToan = Math.max(0, hoaDon.daThanhToan - thanhToan.soTien);
      const newConLai = hoaDon.tongTien - newDaThanhToan;
      let newTrangThai: 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan';
      if (newConLai <= 0) {
        newTrangThai = 'daThanhToan';
      } else if (newDaThanhToan > 0) {
        newTrangThai = 'daThanhToanMotPhan';
      } else {
        newTrangThai = 'chuaThanhToan';
      }

      await prisma.hoaDon.update({
        where: { id: thanhToan.hoaDonId },
        data: { daThanhToan: newDaThanhToan, conLai: newConLai, trangThai: newTrangThai },
      });
    }

    // Xóa thanh toán
    await thanhToanRepo.delete(id);

    return NextResponse.json({
      success: true,
      message: 'Xóa thanh toán thành công'
    });
  } catch (error) {
    console.error('Error deleting thanh toan:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
