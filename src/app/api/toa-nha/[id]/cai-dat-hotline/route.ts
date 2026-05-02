/**
 * API route: /api/toa-nha/[id]/cai-dat-hotline
 *
 * Giai đoạn 4.1: Hotline multi-department routing
 * Cho phép đọc/cập nhật 3 công tắc hotline (batHotline, uyQuyenQL, uyQuyenHotline)
 * và cấu hình routing theo phòng ban.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';

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

    // Kiểm tra quyền truy cập tòa nhà
    const toaNha = await prisma.toaNha.findUnique({
      where: { id },
      select: { chuSoHuuId: true },
    });
    if (!toaNha) {
      return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 404 });
    }

    const isOwner = toaNha.chuSoHuuId === session.user.id;
    const isAdmin = session.user.role === 'admin';
    const isManager = !isOwner && !isAdmin ? await prisma.toaNhaNguoiQuanLy.findUnique({
      where: { toaNhaId_nguoiDungId: { toaNhaId: id, nguoiDungId: session.user.id } },
    }).then(Boolean) : false;

    if (!isOwner && !isAdmin && !isManager) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const settings = await prisma.caiDatToaNha.findUnique({
      where: { toaNhaId: id },
      select: {
        batHotline: true,
        uyQuyenQL: true,
        uyQuyenHotline: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        batHotline: settings?.batHotline ?? true,
        uyQuyenQL: settings?.uyQuyenQL ?? false,
        uyQuyenHotline: settings?.uyQuyenHotline ?? false,
      },
    });
  } catch (error) {
    console.error('Error fetching hotline settings:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────────

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

    // Chỉ chủ trọ hoặc admin mới được thay đổi cài đặt hotline
    const toaNha = await prisma.toaNha.findUnique({
      where: { id },
      select: { chuSoHuuId: true },
    });
    if (!toaNha) {
      return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 404 });
    }

    const isOwner = toaNha.chuSoHuuId === session.user.id;
    const isAdmin = session.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { batHotline, uyQuyenQL, uyQuyenHotline } = body;

    // Validate
    if (typeof batHotline !== 'boolean' || typeof uyQuyenQL !== 'boolean' || typeof uyQuyenHotline !== 'boolean') {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await prisma.caiDatToaNha.upsert({
      where: { toaNhaId: id },
      update: { batHotline, uyQuyenQL, uyQuyenHotline },
      create: { toaNhaId: id, batHotline, uyQuyenQL, uyQuyenHotline },
    });

    sseEmit('toa-nha', { action: 'hotline-updated', toaNhaId: id });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cài đặt hotline thành công',
      data: { batHotline, uyQuyenQL, uyQuyenHotline },
    });
  } catch (error) {
    console.error('Error updating hotline settings:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
