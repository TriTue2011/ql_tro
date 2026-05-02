/**
 * API route: /api/kho/vat-tu/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';
import { z } from 'zod';

const updateSchema = z.object({
  maVatTu: z.string().min(1).optional(),
  tenVatTu: z.string().min(1).optional(),
  donViTinh: z.string().min(1).optional(),
  moTa: z.string().optional().nullable(),
  nhomVatTu: z.string().min(1).optional(),
  phanTichABC: z.enum(['A', 'B', 'C']).optional(),
  tonKhoToiThieu: z.number().int().min(0).optional(),
  anhVatTu: z.array(z.string()).optional(),
  maQR: z.string().optional().nullable(),
  giaMua: z.number().min(0).optional(),
  giaBan: z.number().min(0).optional(),
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

    const updated = await prisma.vatTu.update({ where: { id }, data: validated });
    sseEmit('kho', { action: 'vat-tu-updated', id });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error updating vat tu:', error);
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
    await prisma.vatTu.delete({ where: { id } });
    sseEmit('kho', { action: 'vat-tu-deleted', id });
    return NextResponse.json({ success: true, message: 'Đã xóa vật tư' });
  } catch (error) {
    console.error('Error deleting vat tu:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
