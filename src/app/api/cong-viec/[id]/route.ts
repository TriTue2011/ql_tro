/**
 * API route: /api/cong-viec/[id]
 *
 * Giai đoạn 5: Task Workflow/Kanban
 * Cập nhật, xóa công việc, chuyển trạng thái Kanban.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';
import { z } from 'zod';

const updateCongViecSchema = z.object({
  tieuDe: z.string().min(1).optional(),
  moTa: z.string().optional().nullable(),
  loai: z.enum(['baoTri', 'suCo', 'hoaDon', 'khac']).optional(),
  trangThai: z.enum(['choTiepNhan', 'dangXuLy', 'tamHoan', 'choXacNhan', 'daHoanThanh', 'daHuy']).optional(),
  mucDoUuTien: z.enum(['thap', 'trungBinh', 'cao', 'khanCap']).optional(),
  deadline: z.string().datetime().optional().nullable(),
  nguoiXuLyId: z.string().optional().nullable(),
  ghiChuXuLy: z.string().optional().nullable(),
  ketQua: z.string().optional().nullable(),
});

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.congViec.findUnique({
      where: { id },
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        phong: { select: { id: true, maPhong: true } },
        nguoiTao: { select: { id: true, ten: true } },
        nguoiXuLy: { select: { id: true, ten: true } },
        lichSu: {
          include: { nguoiThayDoi: { select: { id: true, ten: true } } },
          orderBy: { ngayTao: 'desc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ message: 'Công việc không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateCongViecSchema.parse(body);

    // Lấy task cũ để ghi lịch sử
    const oldTask = await prisma.congViec.findUnique({ where: { id } });
    if (!oldTask) {
      return NextResponse.json({ message: 'Công việc không tồn tại' }, { status: 404 });
    }

    // Nếu chuyển trạng thái sang đã hoàn thành, ghi ngày hoàn thành
    const updateData: any = { ...validated };
    if (validated.trangThai === 'daHoanThanh') {
      updateData.ngayHoanThanh = new Date();
    }

    const updated = await prisma.congViec.update({
      where: { id },
      data: updateData,
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        phong: { select: { id: true, maPhong: true } },
        nguoiTao: { select: { id: true, ten: true } },
        nguoiXuLy: { select: { id: true, ten: true } },
      },
    });

    // Ghi lịch sử thay đổi
    await prisma.congViecLichSu.create({
      data: {
        congViecId: id,
        nguoiThayDoiId: session.user.id,
        thayDoi: { action: 'updated', old: oldTask, new: updated },
      },
    });

    sseEmit('cong-viec', { action: 'updated', id });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error updating task:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.congViec.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ message: 'Công việc không tồn tại' }, { status: 404 });
    }

    // Xóa lịch sử trước
    await prisma.congViecLichSu.deleteMany({ where: { congViecId: id } });
    await prisma.congViec.delete({ where: { id } });

    sseEmit('cong-viec', { action: 'deleted', id });
    return NextResponse.json({ success: true, message: 'Đã xóa công việc' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
