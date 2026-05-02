/**
 * API route: /api/kho/phieu-nhap
 *
 * Giai đoạn 6: Warehouse - Phiếu nhập kho
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const toaNhaId = searchParams.get('toaNhaId');

    const where: any = {};
    if (toaNhaId) where.toaNhaId = toaNhaId;

    const phieuNhap = await prisma.phieuNhapKho.findMany({
      where,
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        nguoiNhap: { select: { id: true, ten: true } },
        chiTiet: {
          include: { vatTu: { select: { id: true, tenVatTu: true, donViTinh: true } } },
        },
      },
      orderBy: { ngayNhap: 'desc' },
    });

    return NextResponse.json({ success: true, data: phieuNhap });
  } catch (error) {
    console.error('Error fetching phieu nhap:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { toaNhaId, nhaCungCap, ghiChu, chiTiet } = body;

    if (!toaNhaId || !chiTiet || !Array.isArray(chiTiet) || chiTiet.length === 0) {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    // Tạo mã phiếu tự động
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await prisma.phieuNhapKho.count();
    const maPhieu = `NK-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Tính tổng tiền
    const tongTien = chiTiet.reduce((sum: number, ct: any) => sum + (ct.soLuong * ct.donGia), 0);

    const phieuNhap = await prisma.phieuNhapKho.create({
      data: {
        maPhieu,
        toaNhaId,
        nguoiNhapId: session.user.id,
        nhaCungCap,
        ghiChu,
        tongTien,
        chiTiet: {
          create: chiTiet.map((ct: any) => ({
            vatTuId: ct.vatTuId,
            soLuong: ct.soLuong,
            donGia: ct.donGia,
            thanhTien: ct.soLuong * ct.donGia,
          })),
        },
      },
      include: {
        chiTiet: { include: { vatTu: { select: { id: true, tenVatTu: true } } } },
      },
    });

    // Cập nhật tồn kho
    for (const ct of chiTiet) {
      await prisma.tonKho.upsert({
        where: { vatTuId_toaNhaId: { vatTuId: ct.vatTuId, toaNhaId } },
        update: { soLuong: { increment: ct.soLuong } },
        create: { vatTuId: ct.vatTuId, toaNhaId, soLuong: ct.soLuong },
      });
    }

    sseEmit('kho', { action: 'phieu-nhap-created', id: phieuNhap.id });
    return NextResponse.json({ success: true, data: phieuNhap }, { status: 201 });
  } catch (error) {
    console.error('Error creating phieu nhap:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
