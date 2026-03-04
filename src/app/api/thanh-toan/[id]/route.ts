import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ThanhToan from '@/models/ThanhToan';
import HoaDon from '@/models/HoaDon';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

    await connectToDatabase();

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

    // Tìm thanh toán hiện tại
    const thanhToanHienTai = await ThanhToan.findById(id);
    if (!thanhToanHienTai) {
      return NextResponse.json(
        { message: 'Thanh toán không tồn tại' },
        { status: 404 }
      );
    }

    // Kiểm tra hóa đơn tồn tại
    const hoaDon = await HoaDon.findById(hoaDonId);
    if (!hoaDon) {
      return NextResponse.json(
        { message: 'Hóa đơn không tồn tại' },
        { status: 404 }
      );
    }

    // Tính toán lại số tiền còn lại của hóa đơn
    // Trước tiên, hoàn lại số tiền cũ
    const hoaDonCu = await HoaDon.findById(thanhToanHienTai.hoaDon);
    if (hoaDonCu) {
      hoaDonCu.daThanhToan -= thanhToanHienTai.soTien;
      hoaDonCu.conLai = hoaDonCu.tongTien - hoaDonCu.daThanhToan;
      
      if (hoaDonCu.conLai <= 0) {
        hoaDonCu.trangThai = 'daThanhToan';
      } else if (hoaDonCu.daThanhToan > 0) {
        hoaDonCu.trangThai = 'daThanhToanMotPhan';
      } else {
        hoaDonCu.trangThai = 'chuaThanhToan';
      }
      
      await hoaDonCu.save();
    }

    // Kiểm tra số tiền thanh toán mới không vượt quá số tiền còn lại
    if (soTien > hoaDon.conLai) {
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

    // Cập nhật thanh toán
    thanhToanHienTai.hoaDon = hoaDonId;
    thanhToanHienTai.soTien = soTien;
    thanhToanHienTai.phuongThuc = phuongThuc;
    thanhToanHienTai.thongTinChuyenKhoan = phuongThuc === 'chuyenKhoan' ? thongTinChuyenKhoan : undefined;
    thanhToanHienTai.ngayThanhToan = ngayThanhToan ? new Date(ngayThanhToan) : new Date();
    thanhToanHienTai.ghiChu = ghiChu;
    thanhToanHienTai.anhBienLai = anhBienLai;

    await thanhToanHienTai.save();

    // Cập nhật hóa đơn mới
    hoaDon.daThanhToan += soTien;
    hoaDon.conLai = hoaDon.tongTien - hoaDon.daThanhToan;
    
    if (hoaDon.conLai <= 0) {
      hoaDon.trangThai = 'daThanhToan';
    } else if (hoaDon.daThanhToan > 0) {
      hoaDon.trangThai = 'daThanhToanMotPhan';
    }

    await hoaDon.save();

    // Populate để trả về dữ liệu đầy đủ
    await thanhToanHienTai.populate([
      { path: 'hoaDon', select: 'maHoaDon thang nam tongTien' },
      { path: 'nguoiNhan', select: 'hoTen email' }
    ]);

    return NextResponse.json({
      success: true,
      data: thanhToanHienTai,
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

    await connectToDatabase();

    const { id } = params;

    // Tìm thanh toán
    const thanhToan = await ThanhToan.findById(id);
    if (!thanhToan) {
      return NextResponse.json(
        { message: 'Thanh toán không tồn tại' },
        { status: 404 }
      );
    }

    // Cập nhật lại hóa đơn (hoàn lại số tiền)
    const hoaDon = await HoaDon.findById(thanhToan.hoaDon);
    if (hoaDon) {
      hoaDon.daThanhToan -= thanhToan.soTien;
      hoaDon.conLai = hoaDon.tongTien - hoaDon.daThanhToan;
      
      if (hoaDon.conLai <= 0) {
        hoaDon.trangThai = 'daThanhToan';
      } else if (hoaDon.daThanhToan > 0) {
        hoaDon.trangThai = 'daThanhToanMotPhan';
      } else {
        hoaDon.trangThai = 'chuaThanhToan';
      }
      
      await hoaDon.save();
    }

    // Xóa thanh toán
    await ThanhToan.findByIdAndDelete(id);

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
