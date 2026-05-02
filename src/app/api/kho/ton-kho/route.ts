/**
 * API route: /api/kho/ton-kho
 *
 * Giai đoạn 6: Warehouse - Tồn kho
 * Xem và cập nhật tồn kho theo tòa nhà.
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
    const vatTuId = searchParams.get('vatTuId');

    const where: any = {};
    if (toaNhaId) where.toaNhaId = toaNhaId;
    if (vatTuId) where.vatTuId = vatTuId;

    const items = await prisma.tonKho.findMany({
      where,
      include: {
        vatTu: true,
        toaNha: { select: { id: true, tenToaNha: true } },
      },
      orderBy: { vatTu: { tenVatTu: 'asc' } },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching ton kho:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Nhập kho ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { vatTuId, toaNhaId, soLuong, viTri } = body;

    if (!vatTuId || !toaNhaId || typeof soLuong !== 'number') {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    // Upsert tồn kho
    const tonKho = await prisma.tonKho.upsert({
      where: { vatTuId_toaNhaId: { vatTuId, toaNhaId } },
      update: { soLuong: { increment: soLuong }, viTri: viTri ?? undefined },
      create: { vatTuId, toaNhaId, soLuong, viTri },
    });

    sseEmit('kho', { action: 'ton-kho-updated' });
    return NextResponse.json({ success: true, data: tonKho });
  } catch (error) {
    console.error('Error updating ton kho:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
