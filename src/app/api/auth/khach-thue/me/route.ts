import { NextRequest, NextResponse } from 'next/server';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'secret');
    } catch {
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

    const repo = await getKhachThueRepo();
    const khachThue = await repo.findById(decoded.id);

    if (!khachThue) {
      return NextResponse.json(
        { success: false, message: 'Khách thuê không tồn tại' },
        { status: 404 }
      );
    }

    const now = new Date();

    const hopDongHienTai = await prisma.hopDong.findFirst({
      where: {
        khachThue: { some: { id: khachThue.id } },
        trangThai: 'hoatDong',
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
      },
      include: {
        phong: {
          include: { toaNha: { select: { tenToaNha: true, diaChi: true } } },
        },
      },
    });

    const soHoaDonChuaThanhToan = await prisma.hoaDon.count({
      where: {
        khachThueId: khachThue.id,
        trangThai: { in: ['chuaThanhToan', 'daThanhToanMotPhan', 'quaHan'] },
      },
    });

    const hoaDonGanNhat = await prisma.hoaDon.findFirst({
      where: { khachThueId: khachThue.id },
      orderBy: { ngayTao: 'desc' },
      include: { phong: { select: { maPhong: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        khachThue: {
          id: khachThue.id,
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
        hoaDonGanNhat,
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
