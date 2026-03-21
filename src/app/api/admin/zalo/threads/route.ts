/**
 * GET    /api/admin/zalo/threads?nguoiDungId=X&toaNhaId=Y  — Danh sách thread
 * POST   /api/admin/zalo/threads                           — Thêm/cập nhật thread
 * DELETE /api/admin/zalo/threads?id=X                      — Xóa thread
 *
 * Chỉ admin / chuNha mới được quản lý.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const BOOL_KEYS = ['nhanSuCo', 'nhanHoaDon', 'nhanTinKhach', 'nhanNguoiLa', 'nhanNhacNho'] as const;
type BoolKey = typeof BOOL_KEYS[number];

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { role } = session.user;
  if (!['admin', 'chuNha', 'quanLy'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const nguoiDungId = searchParams.get('nguoiDungId');
  const toaNhaId    = searchParams.get('toaNhaId');
  if (!nguoiDungId || !toaNhaId) {
    return NextResponse.json({ error: 'Cần nguoiDungId và toaNhaId' }, { status: 400 });
  }

  const threads = await prisma.zaloDongChuTroThread.findMany({
    where: { nguoiDungId, toaNhaId },
    orderBy: { ngayTao: 'asc' },
  });
  return NextResponse.json({ ok: true, threads });
}

// ─── POST (upsert) ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { id, nguoiDungId, toaNhaId, threadId, ten, loai, ...rest } = body as {
    id?: string;
    nguoiDungId: string;
    toaNhaId: string;
    threadId: string;
    ten?: string;
    loai?: string;
    [k: string]: unknown;
  };

  if (!nguoiDungId || !toaNhaId || !threadId?.trim()) {
    return NextResponse.json({ error: 'Cần nguoiDungId, toaNhaId, threadId' }, { status: 400 });
  }

  const settings: Partial<Record<BoolKey, boolean>> = {};
  for (const k of BOOL_KEYS) {
    if (typeof rest[k] === 'boolean') settings[k] = rest[k] as boolean;
  }

  const thread = await prisma.zaloDongChuTroThread.upsert({
    where: id
      ? { id }
      : { nguoiDungId_toaNhaId_threadId: { nguoiDungId, toaNhaId, threadId: threadId.trim() } },
    create: {
      nguoiDungId, toaNhaId,
      threadId: threadId.trim(),
      ten: ten?.trim() || null,
      loai: loai || 'user',
      ...settings,
    },
    update: {
      ten: ten?.trim() || null,
      loai: loai || 'user',
      ...settings,
      ngayCapNhat: new Date(),
    },
  });

  return NextResponse.json({ ok: true, thread });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Cần id' }, { status: 400 });

  await prisma.zaloDongChuTroThread.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
