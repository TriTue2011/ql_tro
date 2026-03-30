/**
 * GET    /api/admin/zalo/danh-ba-ngoai — Lấy danh bạ ngoài của user đang đăng nhập
 * POST   /api/admin/zalo/danh-ba-ngoai — Thêm liên hệ mới
 * PUT    /api/admin/zalo/danh-ba-ngoai — Cập nhật liên hệ (id, ten?, soDienThoai?, threadId?)
 * DELETE /api/admin/zalo/danh-ba-ngoai?id=xxx — Xóa liên hệ
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ALLOWED_ROLES = ['chuNha', 'dongChuTro', 'quanLy'];

async function checkAccess(session: any) {
  if (!session?.user?.id) return null;
  if (!ALLOWED_ROLES.includes(session.user.role)) return null;
  return session.user;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = await checkAccess(session);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contacts = await prisma.danhBaNgoai.findMany({
    where: { nguoiTaoId: user.id },
    orderBy: { ngayTao: 'asc' },
  });

  return NextResponse.json({ ok: true, contacts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = await checkAccess(session);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ten, soDienThoai, threadId } = await req.json();
  if (!ten?.trim()) {
    return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 });
  }

  const contact = await prisma.danhBaNgoai.create({
    data: {
      ten: ten.trim(),
      soDienThoai: soDienThoai?.trim() || null,
      threadId: threadId?.trim() || null,
      nguoiTaoId: user.id,
    },
  });

  return NextResponse.json({ ok: true, contact });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = await checkAccess(session);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ten, soDienThoai, threadId } = await req.json();
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const existing = await prisma.danhBaNgoai.findFirst({
    where: { id, nguoiTaoId: user.id },
  });
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });

  const contact = await prisma.danhBaNgoai.update({
    where: { id },
    data: {
      ...(ten !== undefined && { ten: ten.trim() }),
      ...(soDienThoai !== undefined && { soDienThoai: soDienThoai?.trim() || null }),
      ...(threadId !== undefined && { threadId: threadId?.trim() || null }),
    },
  });

  return NextResponse.json({ ok: true, contact });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = await checkAccess(session);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const existing = await prisma.danhBaNgoai.findFirst({
    where: { id, nguoiTaoId: user.id },
  });
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });

  await prisma.danhBaNgoai.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
