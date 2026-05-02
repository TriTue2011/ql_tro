/**
 * API route: /api/bao-duong
 *
 * Giai đoạn 6: Maintenance - Bảo dưỡng/Bảo trì
 * Quản lý lịch bảo dưỡng thiết bị.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';
import { z } from 'zod';

const baoDuongSchema = z.object({
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc'),
  moTa: z.string().optional().nullable(),
  toaNhaId: z.string().min(1),
  phongId: z.string().optional().nullable(),
  thietBi: z.string().min(1, 'Tên thiết bị là bắt buộc'),
  loaiBaoDuong: z.enum(['dinhKy', 'dotXuat']).default('dinhKy'),
  chuKyNgay: z.number().int().positive().default(30),
  ngayBaoDuongTruoc: z.string().datetime().optional().nullable(),
  ngayBaoDuongSau: z.string().datetime().optional().nullable(),
  nguoiPhuTrachId: z.string().optional().nullable(),
  trangThai: z.enum(['sapDen', 'quaHan', 'daHoanThanh', 'tamHoan']).default('sapDen'),
  ketQua: z.string().optional().nullable(),
  vatTuDaDung: z.any().optional(),
});

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const toaNhaId = searchParams.get('toaNhaId');
    const trangThai = searchParams.get('trangThai');

    const where: any = {};
    if (toaNhaId) where.toaNhaId = toaNhaId;
    if (trangThai) where.trangThai = trangThai;

    const items = await prisma.baoDuong.findMany({
      where,
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        phong: { select: { id: true, maPhong: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
        lichSu: {
          include: { nguoiThucHien: { select: { id: true, ten: true } } },
          orderBy: { ngayTao: 'desc' },
        },
      },
      orderBy: { ngayTao: 'desc' },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching bao duong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const validated = baoDuongSchema.parse(body);

    const item = await prisma.baoDuong.create({
      data: {
        ...validated,
        ngayBaoDuongTruoc: validated.ngayBaoDuongTruoc ? new Date(validated.ngayBaoDuongTruoc) : null,
        ngayBaoDuongSau: validated.ngayBaoDuongSau ? new Date(validated.ngayBaoDuongSau) : null,
        vatTuDaDung: validated.vatTuDaDung || [],
      },
      include: {
        toaNha: { select: { id: true, tenToaNha: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
    });

    sseEmit('bao-duong', { action: 'created', id: item.id });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating bao duong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
