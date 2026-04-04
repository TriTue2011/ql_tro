/**
 * GET  /api/toa-nha/[id]/dang-nhap-khach-thue
 *   → Lấy trạng thái cài đặt đăng nhập khách thuê của tòa nhà
 *   → Admin: thấy tất cả | ChuNha/QuanLy: chỉ thấy khi admin đã bật
 *
 * PUT  /api/toa-nha/[id]/dang-nhap-khach-thue
 *   → Chủ trọ bật/tắt đăng nhập khách thuê cho tòa nhà của mình
 *   → Chỉ hoạt động khi admin đã bật adminBatDangNhapKT cho tòa nhà
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id: toaNhaId } = await params;
    const role = session.user.role;

    // Kiểm tra quyền truy cập tòa nhà
    if (role === 'chuNha') {
      const toaNha = await prisma.toaNha.findFirst({
        where: { id: toaNhaId, chuSoHuuId: session.user.id },
        select: { id: true },
      });
      if (!toaNha) {
        return NextResponse.json({ error: 'Không có quyền truy cập tòa nhà này' }, { status: 403 });
      }
    } else if (role === 'quanLy') {
      const perm = await prisma.toaNhaNguoiQuanLy.findUnique({
        where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId: session.user.id } },
      });
      if (!perm) {
        return NextResponse.json({ error: 'Không có quyền truy cập tòa nhà này' }, { status: 403 });
      }
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    }

    const caiDat = await prisma.caiDatToaNha.findUnique({
      where: { toaNhaId },
      select: {
        adminBatDangNhapKT: true,
        gioiHanDangNhapKT: true,
        chuTroBatDangNhapKT: true,
      },
    });

    // Đếm số khách thuê đã kích hoạt đăng nhập trong tòa nhà
    const soLuongDaBat = await prisma.khachThue.count({
      where: {
        matKhau: { not: null },
        hopDong: {
          some: {
            phong: { toaNhaId },
            trangThai: 'hoatDong',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        adminBatDangNhapKT: caiDat?.adminBatDangNhapKT ?? false,
        gioiHanDangNhapKT: caiDat?.gioiHanDangNhapKT ?? null,
        chuTroBatDangNhapKT: caiDat?.chuTroBatDangNhapKT ?? true,
        soLuongDaBat,
      },
    });
  } catch (error) {
    console.error('[dang-nhap-khach-thue GET]', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id: toaNhaId } = await params;
    const role = session.user.role;

    // Chỉ chủ trọ (chủ sở hữu tòa nhà) mới được bật/tắt
    if (role === 'chuNha') {
      const toaNha = await prisma.toaNha.findFirst({
        where: { id: toaNhaId, chuSoHuuId: session.user.id },
        select: { id: true },
      });
      if (!toaNha) {
        return NextResponse.json({ error: 'Không có quyền thao tác tòa nhà này' }, { status: 403 });
      }
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ chủ trọ hoặc admin mới có quyền thao tác' }, { status: 403 });
    }

    // Kiểm tra admin đã bật tính năng cho tòa nhà này chưa
    const caiDat = await prisma.caiDatToaNha.findUnique({
      where: { toaNhaId },
      select: { adminBatDangNhapKT: true },
    });
    if (!caiDat?.adminBatDangNhapKT) {
      return NextResponse.json(
        { error: 'Admin chưa bật tính năng đăng nhập khách thuê cho tòa nhà này' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { chuTroBatDangNhapKT } = body;

    const updated = await prisma.caiDatToaNha.update({
      where: { toaNhaId },
      data: { chuTroBatDangNhapKT: Boolean(chuTroBatDangNhapKT) },
      select: {
        adminBatDangNhapKT: true,
        gioiHanDangNhapKT: true,
        chuTroBatDangNhapKT: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[dang-nhap-khach-thue PUT]', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
