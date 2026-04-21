/**
 * PATCH /api/zalo/group-name { groupId, name }
 *   → Lưu tên nhóm vào CaiDat + cập nhật displayName tất cả tin nhắn của nhóm đó
 *
 * GET /api/zalo/group-name?groupId=xxx
 *   → Lấy tên nhóm hiện tại từ CaiDat
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const caiDatKey = (gid: string) => `zalo_group_name_${gid}`;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  const row = await prisma.caiDat.findUnique({ where: { khoa: caiDatKey(groupId) } });
  return NextResponse.json({ name: row?.giaTri || null });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { groupId, name } = await request.json();
  if (!groupId || typeof name !== 'string') {
    return NextResponse.json({ error: 'groupId và name là bắt buộc' }, { status: 400 });
  }

  const trimmed = name.trim();
  if (!trimmed) return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 });

  await Promise.all([
    prisma.caiDat.upsert({
      where: { khoa: caiDatKey(groupId) },
      create: { khoa: caiDatKey(groupId), giaTri: trimmed, nhom: 'zalo' },
      update: { giaTri: trimmed },
    }),
    prisma.zaloMessage.updateMany({
      where: { chatId: groupId },
      data: { displayName: trimmed },
    }),
  ]);

  return NextResponse.json({ ok: true, name: trimmed });
}
