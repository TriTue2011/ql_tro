/**
 * API route: /api/kho/phieu-xuat
 *
 * Giai đoạn 6: Warehouse - Phiếu xuất kho
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

    const phieuXuat = await prisma.phieuXuatKho.findMany({
      where,
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        nguoiXuat: { select: { id: true, ten: true } },
        phong: { select: { id: true, maPhong: true } },
        chiTiet: {
          include: { vatTu: { select: { id: true, tenVatTu: true, donViTinh: true } } },
        },
      },
      orderBy: { ngayXuat: 'desc' },
    });

    return NextResponse.json({ success: true, data: phieuXuat });
  } catch (error) {
    console.error('Error fetching phieu xuat:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { toaNhaId, lyDo, phongId, suCoId, ghiChu, chiTiet } = body;

    if (!toaNhaId || !lyDo || !chiTiet || !Array.isArray(chiTiet) || chiTiet.length === 0) {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    // Kiểm tra tồn kho đủ không
    for (const ct of chiTiet) {
      const tonKho = await prisma.tonKho.findUnique({
        where: { vatTuId_toaNhaId: { vatTuId: ct.vatTuId, toaNhaId } },
      });
      if (!tonKho || tonKho.soLuong < ct.soLuong) {
        const vatTu = await prisma.vatTu.findUnique({ where: { id: ct.vatTuId } });
        return NextResponse.json({
          message: `Không đủ tồn kho cho vật tư: ${vatTu?.tenVatTu || ct.vatTuId}. Còn: ${tonKho?.soLuong || 0}, cần: ${ct.soLuong}`,
        }, { status: 400 });
      }
    }

    // Tạo mã phiếu tự động
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await prisma.phieuXuatKho.count();
    const maPhieu = `XK-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const phieuXuat = await prisma.phieuXuatKho.create({
      data: {
        maPhieu,
        toaNhaId,
        nguoiXuatId: session.user.id,
        lyDo,
        phongId,
        suCoId,
        ghiChu,
        chiTiet: {
          create: chiTiet.map((ct: any) => ({
            vatTuId: ct.vatTuId,
            soLuong: ct.soLuong,
            donGia: ct.donGia || 0,
            thanhTien: (ct.soLuong * (ct.donGia || 0)),
          })),
        },
      },
      include: {
        chiTiet: { include: { vatTu: { select: { id: true, tenVatTu: true } } } },
      },
    });

    // Trừ tồn kho
    for (const ct of chiTiet) {
      await prisma.tonKho.update({
        where: { vatTuId_toaNhaId: { vatTuId: ct.vatTuId, toaNhaId } },
        data: { soLuong: { decrement: ct.soLuong } },
      });
    }

    sseEmit('kho', { action: 'phieu-xuat-created', id: phieuXuat.id });
    return NextResponse.json({ success: true, data: phieuXuat }, { status: 201 });
  } catch (error) {
    console.error('Error creating phieu xuat:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
