/**
 * API route: /api/bao-duong/[id]
 *
 * Giai đoạn 6: Maintenance - Cập nhật/xóa lịch bảo dưỡng
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';
import { z } from 'zod';

const updateSchema = z.object({
  tieuDe: z.string().min(1).optional(),
  moTa: z.string().optional().nullable(),
  thietBi: z.string().min(1).optional(),
  loaiBaoDuong: z.enum(['dinhKy', 'dotXuat']).optional(),
  chuKyNgay: z.number().int().positive().optional(),
  ngayBaoDuongTruoc: z.string().datetime().optional().nullable(),
  ngayBaoDuongSau: z.string().datetime().optional().nullable(),
  nguoiPhuTrachId: z.string().optional().nullable(),
  trangThai: z.enum(['sapDen', 'quaHan', 'daHoanThanh', 'tamHoan']).optional(),
  ketQua: z.string().optional().nullable(),
  vatTuDaDung: z.any().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const validated = updateSchema.parse(body);

    const updateData: any = { ...validated };
    if (validated.ngayBaoDuongTruoc !== undefined) {
      updateData.ngayBaoDuongTruoc = validated.ngayBaoDuongTruoc ? new Date(validated.ngayBaoDuongTruoc) : null;
    }
    if (validated.ngayBaoDuongSau !== undefined) {
      updateData.ngayBaoDuongSau = validated.ngayBaoDuongSau ? new Date(validated.ngayBaoDuongSau) : null;
    }

    const updated = await prisma.baoDuong.update({
      where: { id },
      data: updateData,
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
    });

    // Ghi lịch sử nếu có thay đổi trạng thái
    if (validated.trangThai || validated.ketQua) {
      await prisma.baoDuongLichSu.create({
        data: {
          baoDuongId: id,
          nguoiThucHienId: session.user.id,
          noiDung: validated.ketQua || `Chuyển trạng thái: ${validated.trangThai}`,
          ketQua: validated.ketQua,
        },
      });
    }

    sseEmit('bao-duong', { action: 'updated', id });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error updating bao duong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await prisma.baoDuongLichSu.deleteMany({ where: { baoDuongId: id } });
    await prisma.baoDuong.delete({ where: { id } });

    sseEmit('bao-duong', { action: 'deleted', id });
    return NextResponse.json({ success: true, message: 'Đã xóa lịch bảo dưỡng' });
  } catch (error) {
    console.error('Error deleting bao duong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
