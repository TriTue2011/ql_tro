import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';
import HopDong from '@/models/HopDong';
import HoaDon from '@/models/HoaDon';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    // Lấy token từ header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'secret');
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Token không hợp lệ' },
        { status: 401 }
      );
    }

    if (decoded.role !== 'khachThue') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    await dbConnect();

    // Lấy thông tin khách thuê
    const khachThue = await KhachThue.findById(decoded.id);
    
    if (!khachThue) {
      return NextResponse.json(
        { success: false, message: 'Khách thuê không tồn tại' },
        { status: 404 }
      );
    }

    // Lấy hợp đồng hiện tại
    const hopDongHienTai = await HopDong.findOne({
      khachThueId: khachThue._id,
      trangThai: 'hoatDong',
      ngayBatDau: { $lte: new Date() },
      ngayKetThuc: { $gte: new Date() }
    })
    .populate('phong', 'maPhong dienTich giaThue tienCoc toaNha')
    .populate({
      path: 'phong',
      populate: {
        path: 'toaNha',
        select: 'tenToaNha diaChi'
      }
    });

    // Đếm số hóa đơn chưa thanh toán
    const soHoaDonChuaThanhToan = await HoaDon.countDocuments({
      khachThue: khachThue._id,
      trangThai: { $in: ['chuaThanhToan', 'daThanhToanMotPhan', 'quaHan'] }
    });

    // Lấy hóa đơn gần nhất
    const hoaDonGanNhat = await HoaDon.findOne({
      khachThue: khachThue._id
    })
    .sort({ ngayTao: -1 })
    .populate('phong', 'maPhong');

    return NextResponse.json({
      success: true,
      data: {
        khachThue: {
          _id: khachThue._id,
          hoTen: khachThue.hoTen,
          soDienThoai: khachThue.soDienThoai,
          email: khachThue.email,
          cccd: khachThue.cccd,
          ngaySinh: khachThue.ngaySinh,
          gioiTinh: khachThue.gioiTinh,
          queQuan: khachThue.queQuan,
          ngheNghiep: khachThue.ngheNghiep,
          trangThai: khachThue.trangThai,
        },
        hopDongHienTai,
        soHoaDonChuaThanhToan,
        hoaDonGanNhat
      }
    });

  } catch (error) {
    console.error('Error fetching khach thue info:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

