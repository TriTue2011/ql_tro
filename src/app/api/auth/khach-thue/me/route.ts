import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

/** Lấy KhachThue ID từ NextAuth session hoặc Bearer token (backward compat) */
async function getKhachThueId(request: NextRequest): Promise<string | null> {
  // 1. NextAuth session (ưu tiên)
  const session = await getServerSession(authOptions);
  if (session?.user?.role === 'khachThue') {
    return session.user.id;
  }

  // 2. Bearer token (legacy — backward compat)
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
      if (decoded.role === 'khachThue') return decoded.id;
    }
  } catch { /* bỏ qua token lỗi */ }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const khachThueId = await getKhachThueId(request);
    if (!khachThueId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const repo = await getKhachThueRepo();
    const khachThue = await repo.findById(khachThueId);

    if (!khachThue) {
      return NextResponse.json({ success: false, message: 'Khách thuê không tồn tại' }, { status: 404 });
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
          zaloChatId: khachThue.zaloChatId ?? null,
          pendingZaloChatId: khachThue.pendingZaloChatId ?? null,
          nhanThongBaoZalo: khachThue.nhanThongBaoZalo,
        },
        hopDongHienTai,
        soHoaDonChuaThanhToan,
        hoaDonGanNhat,
      }
    });

  } catch (error) {
    console.error('Error fetching khach thue info:', error);
    return NextResponse.json({ success: false, message: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
