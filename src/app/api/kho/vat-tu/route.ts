/**
 * API route: /api/kho/vat-tu
 *
 * Giai đoạn 6: Warehouse - Vật tư
 * CRUD danh mục vật tư.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';
import { z } from 'zod';

const vatTuSchema = z.object({
  maVatTu: z.string().min(1, 'Mã vật tư là bắt buộc'),
  tenVatTu: z.string().min(1, 'Tên vật tư là bắt buộc'),
  donViTinh: z.string().min(1, 'Đơn vị tính là bắt buộc'),
  moTa: z.string().optional().nullable(),
  nhomVatTu: z.string().min(1, 'Nhóm vật tư là bắt buộc'),
  phanTichABC: z.enum(['A', 'B', 'C']).default('C'),
  tonKhoToiThieu: z.number().int().min(0).default(0),
  anhVatTu: z.array(z.string()).optional().default([]),
  maQR: z.string().optional().nullable(),
  giaMua: z.number().min(0).default(0),
  giaBan: z.number().min(0).default(0),
});

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nhomVatTu = searchParams.get('nhomVatTu');
    const search = searchParams.get('search');

    const where: any = {};
    if (nhomVatTu) where.nhomVatTu = nhomVatTu;
    if (search) {
      where.OR = [
        { tenVatTu: { contains: search, mode: 'insensitive' } },
        { maVatTu: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.vatTu.findMany({
      where,
      orderBy: { tenVatTu: 'asc' },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching vat tu:', error);
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
    const validated = vatTuSchema.parse(body);

    const item = await prisma.vatTu.create({ data: validated });

    sseEmit('kho', { action: 'vat-tu-created', id: item.id });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating vat tu:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
