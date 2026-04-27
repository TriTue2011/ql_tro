/**
 * GET  /api/toa-nha/[id]/zalo-nhom-chat  → Danh sách nhóm Zalo của tòa nhà
 * PUT  /api/toa-nha/[id]/zalo-nhom-chat  → Cập nhật danh sách nhóm Zalo
 *
 * Quyền: admin hoặc chủ sở hữu tòa nhà.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Validation function thay thế cho Zod để tránh lỗi '_zod'
function validateNhomChat(data: any): any[] {
  if (!data || !Array.isArray(data.zaloNhomChat)) {
    throw new Error('Dữ liệu zaloNhomChat không hợp lệ');
  }
  return data.zaloNhomChat.map((g: any, index: number) => {
    if (!g.name || typeof g.name !== 'string') {
      throw new Error(`Tên nhóm tại dòng ${index + 1} không hợp lệ`);
    }
    if (!g.threadIds || typeof g.threadIds !== 'object') {
      throw new Error(`Thread IDs của nhóm "${g.name}" không hợp lệ`);
    }
    return {
      name: g.name.trim(),
      threadIds: g.threadIds,
      tang: typeof g.tang === 'number' ? g.tang : null,
      label: typeof g.label === 'string' ? g.label.trim() : null,
    };
  });
}

async function assertCanEdit(toaNhaId: string, userId: string, role?: string): Promise<boolean> {
  if (!toaNhaId || !userId) return false;
  if (role === 'admin') return true;
  
  // Quản lý và nhân viên không có quyền sửa (theo yêu cầu người dùng)
  if (role === 'quanLy' || role === 'nhanVien') return false;

  try {
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      select: { chuSoHuuId: true },
    });
    if (!toaNha) return false;

    // Là chủ sở hữu chính
    if (toaNha.chuSoHuuId === userId) return true;

    // Nếu là tài khoản có vai trò chuNha hoặc dongChuTro được gán cho tòa nhà này
    if (role === 'chuNha' || role === 'dongChuTro') {
      const assigned = await prisma.toaNhaNguoiQuanLy.findFirst({
        where: { nguoiDungId: userId, toaNhaId },
        select: { toaNhaId: true },
      });
      return !!assigned;
    }
  } catch (e) {
    console.error('[assertCanEdit error]', e);
    return false;
  }

  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const toaNha = await prisma.toaNha.findUnique({
    where: { id },
    select: { id: true, chuSoHuuId: true, zaloNhomChat: true },
  });
  if (!toaNha) {
    return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 404 });
  }

  // Quyền xem: admin, chủ, đồng chủ, quản lý hoặc nhân viên của tòa nhà
  const role = session.user.role;
  if (role !== 'admin' && toaNha.chuSoHuuId !== session.user.id) {
    const assigned = await prisma.toaNhaNguoiQuanLy.findFirst({
      where: { nguoiDungId: session.user.id, toaNhaId: id },
      select: { toaNhaId: true },
    });
    if (!assigned) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json({
    success: true,
    data: (toaNha.zaloNhomChat as unknown) ?? [],
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const canEdit = await assertCanEdit(id, session.user.id, session.user.role);
  if (!canEdit) {
    return NextResponse.json({ message: 'Bạn không có quyền sửa tòa nhà này' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const normalized = validateNhomChat(body);

    // Lọc trùng name
    const seen = new Set<string>();
    const finalData = normalized.filter((g) => {
      const lowerName = g.name.toLowerCase();
      if (!lowerName || seen.has(lowerName)) return false;
      seen.add(lowerName);
      return true;
    });

    const updated = await prisma.toaNha.update({
      where: { id },
      data: { zaloNhomChat: finalData as any },
      select: { zaloNhomChat: true },
    });

    return NextResponse.json({ success: true, data: updated.zaloNhomChat });
  } catch (error: any) {
    console.error('[toa-nha zalo-nhom-chat PUT]', error);
    return NextResponse.json({ 
      message: error instanceof Error ? error.message : 'Lỗi hệ thống không xác định' 
    }, { status: 500 });
  }
}
