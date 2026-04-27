/**
 * GET  /api/cai-dat/zalo-filter      → Lấy cài đặt lọc Zalo Monitor
 * PUT  /api/cai-dat/zalo-filter      → Cập nhật cài đặt lọc Zalo Monitor
 *
 * Quyền:
 *   - GET: mọi role đã đăng nhập
 *   - PUT dmFilter: admin only → global (ảnh hưởng tất cả)
 *   - PUT groupWhitelist: admin | chuNha | dongChuTro
 *       + chuNha/dongChuTro: lưu per-user (key: zalo_group_whitelist_{userId})
 *       + Nếu kèm toaNhaId + threadId → cập nhật ToaNha.zaloNhomChat luôn
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const KEY_DM_FILTER = 'zalo_monitor_dm_filter';
const KEY_GROUP_WL  = 'zalo_monitor_group_whitelist'; // global (admin only - legacy)
const userGroupKey  = (uid: string) => `zalo_group_whitelist_${uid}`;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = session.user.id;
  const role = session.user.role as string;

  const dbUser = await prisma.nguoiDung.findUnique({ where: { id: uid }, select: { vaiTro: true } });
  const effectiveRole = dbUser?.vaiTro || role;

  // Admin dmFilter (global)
  const dmRow = await prisma.caiDat.findUnique({ where: { khoa: KEY_DM_FILTER }, select: { giaTri: true } });
  const dmFilter = dmRow?.giaTri === 'system_only' ? 'system_only' : 'none';

  // Group whitelist
  let groupWhitelist: string[] = [];
  if (['chuNha', 'dongChuTro'].includes(effectiveRole)) {
    const buildings = await prisma.toaNha.findMany({
      where: { chuSoHuuId: uid },
      select: { zaloNhomChat: true },
    });
    const merged: string[] = [];
    for (const b of buildings) {
      if (Array.isArray(b.zaloNhomChat)) {
        b.zaloNhomChat.forEach((g: any) => { if (g?.name) merged.push(g.name); });
      }
    }
    groupWhitelist = [...new Set(merged)];
  } else if (effectiveRole === 'quanLy' || effectiveRole === 'nhanVien') {
    const managed = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { nguoiDungId: uid },
      select: { toaNha: { select: { zaloNhomChat: true } } },
    });
    const merged: string[] = [];
    for (const m of managed) {
      if (Array.isArray(m.toaNha.zaloNhomChat)) {
        m.toaNha.zaloNhomChat.forEach((g: any) => { if (g?.name) merged.push(g.name); });
      }
    }
    groupWhitelist = [...new Set(merged)];
  } else if (effectiveRole === 'admin') {
    const gwRow = await prisma.caiDat.findUnique({ where: { khoa: KEY_GROUP_WL }, select: { giaTri: true } });
    try { groupWhitelist = JSON.parse(gwRow?.giaTri || '[]'); } catch { /* ignore */ }
  }

  return NextResponse.json({ dmFilter, groupWhitelist });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = session.user.id;
  const role = session.user.role as string;
  const body = await req.json();

  // ── dmFilter: admin only ──────────────────────────────────────────────────
  if ('dmFilter' in body) {
    if (role !== 'admin') return NextResponse.json({ error: 'Chỉ admin mới được đổi bộ lọc DM' }, { status: 403 });
    const val = body.dmFilter === 'system_only' ? 'system_only' : 'none';
    await prisma.caiDat.upsert({
      where: { khoa: KEY_DM_FILTER },
      update: { giaTri: val },
      create: { khoa: KEY_DM_FILTER, giaTri: val, moTa: 'Bộ lọc DM Zalo Monitor', nhom: 'zalo', laBiMat: false },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });
}
