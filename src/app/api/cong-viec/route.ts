/**
 * API route: /api/cong-viec
 *
 * Giai đoạn 5: Task Workflow/Kanban
 * CRUD công việc (tasks) với phân quyền theo tòa nhà.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';
import { z } from 'zod';

const createCongViecSchema = z.object({
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc'),
  moTa: z.string().optional(),
  loai: z.enum(['baoTri', 'suCo', 'hoaDon', 'khac']).default('khac'),
  mucDoUuTien: z.enum(['thap', 'trungBinh', 'cao', 'khanCap']).default('trungBinh'),
  deadline: z.string().datetime().optional().nullable(),
  toaNhaId: z.string().optional().nullable(),
  phongId: z.string().optional().nullable(),
  nguoiXuLyId: z.string().optional().nullable(),
  suCoId: z.string().optional().nullable(),
  hoaDonId: z.string().optional().nullable(),
});

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const toaNhaId = searchParams.get('toaNhaId');
    const nguoiXuLyId = searchParams.get('nguoiXuLyId');
    const trangThai = searchParams.get('trangThai');
    const loai = searchParams.get('loai');

    const where: any = {};

    if (toaNhaId) where.toaNhaId = toaNhaId;
    if (nguoiXuLyId) where.nguoiXuLyId = nguoiXuLyId;
    if (trangThai) where.trangThai = trangThai;
    if (loai) where.loai = loai;

    // Nếu không phải admin, chỉ xem công việc của tòa nhà mình quản lý
    if (session.user.role !== 'admin') {
      const toaNhaIds = await prisma.toaNhaNguoiQuanLy.findMany({
        where: { nguoiDungId: session.user.id },
        select: { toaNhaId: true },
      });
      const buildingIds = toaNhaIds.map(t => t.toaNhaId);

      // Nếu là chủ trọ, thêm tòa nhà của mình
      if (session.user.role === 'chuNha' || session.user.role === 'dongChuTro') {
        const ownedBuildings = await prisma.toaNha.findMany({
          where: { chuSoHuuId: session.user.id },
          select: { id: true },
        });
        buildingIds.push(...ownedBuildings.map(b => b.id));
      }

      if (buildingIds.length > 0) {
        where.toaNhaId = { in: [...new Set(buildingIds)] };
      } else {
        // Không có tòa nhà nào → trả về rỗng
        return NextResponse.json({ success: true, data: [] });
      }
    }

    const tasks = await prisma.congViec.findMany({
      where,
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        phong: { select: { id: true, maPhong: true } },
        nguoiTao: { select: { id: true, ten: true } },
        nguoiXuLy: { select: { id: true, ten: true } },
      },
      orderBy: { ngayTao: 'desc' },
    });

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createCongViecSchema.parse(body);

    const task = await prisma.congViec.create({
      data: {
        ...validated,
        deadline: validated.deadline ? new Date(validated.deadline) : null,
        nguoiTaoId: session.user.id,
        trangThai: 'choTiepNhan',
      },
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        phong: { select: { id: true, maPhong: true } },
        nguoiTao: { select: { id: true, ten: true } },
      },
    });

    // Ghi lịch sử
    await prisma.congViecLichSu.create({
      data: {
        congViecId: task.id,
        nguoiThayDoiId: session.user.id,
        thayDoi: { action: 'created', old: null, new: task },
      },
    });

    sseEmit('cong-viec', { action: 'created', id: task.id });
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating task:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
