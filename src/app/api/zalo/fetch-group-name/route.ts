/**
 * GET /api/zalo/fetch-group-name?groupId=xxx
 * Fetch tên nhóm từ bot server → lưu CaiDat + backfill displayName
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGroupInfoFromBotServer } from '@/lib/zalo-bot-client';

const caiDatKey = (gid: string) => `zalo_group_name_${gid}`;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  // Kiểm tra CaiDat trước
  const existing = await prisma.caiDat.findUnique({ where: { khoa: caiDatKey(groupId) } });
  if (existing?.giaTri) return NextResponse.json({ name: existing.giaTri });

  // Fetch từ bot server
  try {
    const r = await getGroupInfoFromBotServer(groupId);
    if (!r.ok || !r.data) return NextResponse.json({ name: null });

    const info = (r.data.gridInfoMap ?? r.data)?.[groupId];
    const name: string | null = info?.name || null;
    if (!name) return NextResponse.json({ name: null });

    // Lưu CaiDat + backfill
    await Promise.all([
      prisma.caiDat.upsert({
        where: { khoa: caiDatKey(groupId) },
        create: { khoa: caiDatKey(groupId), giaTri: name, nhom: 'zalo' },
        update: { giaTri: name },
      }),
      prisma.zaloMessage.updateMany({
        where: { chatId: groupId },
        data: { displayName: name },
      }),
    ]);

    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ name: null });
  }
}
