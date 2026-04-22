/**
 * GET  /api/cai-dat/zalo-filter  → Lấy cài đặt lọc Zalo Monitor
 * PUT  /api/cai-dat/zalo-filter  → Cập nhật cài đặt lọc Zalo Monitor
 *
 * Quyền:
 *   - GET: mọi role đã đăng nhập
 *   - PUT dmFilter: admin
 *   - PUT groupWhitelist: admin | chuNha | dongChuTro
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const KEY_DM_FILTER = 'zalo_monitor_dm_filter';
const KEY_GROUP_WL  = 'zalo_monitor_group_whitelist';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: [KEY_DM_FILTER, KEY_GROUP_WL] } },
    select: { khoa: true, giaTri: true },
  });
  const map = Object.fromEntries(rows.map(r => [r.khoa, r.giaTri ?? '']));

  let groupWhitelist: string[] = [];
  try { groupWhitelist = JSON.parse(map[KEY_GROUP_WL] || '[]'); } catch { /* ignore */ }

  return NextResponse.json({
    dmFilter: (map[KEY_DM_FILTER] === 'system_only' ? 'system_only' : 'none') as 'none' | 'system_only',
    groupWhitelist,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = session.user.role as string | undefined;

  const body = await req.json();
  const updates: { key: string; value: string }[] = [];

  // Admin có thể đổi dmFilter
  if ('dmFilter' in body) {
    if (role !== 'admin') return NextResponse.json({ error: 'Chỉ admin mới được đổi bộ lọc DM' }, { status: 403 });
    const val = body.dmFilter === 'system_only' ? 'system_only' : 'none';
    updates.push({ key: KEY_DM_FILTER, value: val });
  }

  // Admin + chủ trọ có thể đổi groupWhitelist
  if ('groupWhitelist' in body) {
    const allowed = ['admin', 'chuNha', 'dongChuTro'].includes(role || '');
    if (!allowed) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    if (!Array.isArray(body.groupWhitelist)) return NextResponse.json({ error: 'groupWhitelist phải là mảng' }, { status: 400 });
    const list: string[] = body.groupWhitelist.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim());
    updates.push({ key: KEY_GROUP_WL, value: JSON.stringify(list) });
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });

  await Promise.all(updates.map(({ key, value }) =>
    prisma.caiDat.upsert({
      where: { khoa: key },
      update: { giaTri: value },
      create: { khoa: key, giaTri: value, moTa: '', nhom: 'zalo', laBiMat: false },
    })
  ));

  return NextResponse.json({ success: true });
}
