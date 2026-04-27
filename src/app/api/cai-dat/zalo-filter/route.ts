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

  // Admin dmFilter (global)
  const dmRow = await prisma.caiDat.findUnique({ where: { khoa: KEY_DM_FILTER }, select: { giaTri: true } });
  const dmFilter = dmRow?.giaTri === 'system_only' ? 'system_only' : 'none';

  // Group whitelist per-user (chuNha / dongChuTro)
  let groupWhitelist: string[] = [];
  if (['chuNha', 'dongChuTro', 'quanLy'].includes(role)) {
    const gwRow = await prisma.caiDat.findUnique({ where: { khoa: userGroupKey(uid) }, select: { giaTri: true } });
    try { groupWhitelist = JSON.parse(gwRow?.giaTri || '[]'); } catch { /* ignore */ }
  } else if (role === 'admin') {
    // Admin có thể xem group whitelist global (legacy)
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

  // ── groupWhitelist: chuNha + dongChuTro (per-user) ───────────────────────
  if ('groupWhitelist' in body) {
    const allowed = ['admin', 'chuNha', 'dongChuTro'].includes(role);
    if (!allowed) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    if (!Array.isArray(body.groupWhitelist)) return NextResponse.json({ error: 'groupWhitelist phải là mảng' }, { status: 400 });

    const list: string[] = (body.groupWhitelist as unknown[])
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim());

    const key = role === 'admin' ? KEY_GROUP_WL : userGroupKey(uid);
    await prisma.caiDat.upsert({
      where: { khoa: key },
      update: { giaTri: JSON.stringify(list) },
      create: { khoa: key, giaTri: JSON.stringify(list), moTa: `Group whitelist - ${uid}`, nhom: 'zalo', laBiMat: false },
    });
    return NextResponse.json({ success: true });
  }

  // ── Thêm/xóa nhóm vào ToaNha.zaloNhomChat ────────────────────────────────
  // body: { action: 'add' | 'remove', toaNhaId, name, threadId? }
  if ('action' in body && (body.action === 'add' || body.action === 'remove')) {
    const allowed = ['chuNha', 'dongChuTro', 'quanLy'].includes(role);
    if (!allowed) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

    const { action, toaNhaId, name, threadId } = body;
    if (!toaNhaId || !name) return NextResponse.json({ error: 'Thiếu toaNhaId hoặc name' }, { status: 400 });

    // Kiểm tra user có quyền với tòa nhà này
    const toa = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      select: { id: true, chuSoHuuId: true, zaloNhomChat: true, nguoiQuanLy: { select: { nguoiDungId: true } } },
    });
    if (!toa) return NextResponse.json({ error: 'Tòa nhà không tồn tại' }, { status: 404 });

    const isOwner = toa.chuSoHuuId === uid;
    const isManager = toa.nguoiQuanLy.some(m => m.nguoiDungId === uid);
    if (!isOwner && !isManager) return NextResponse.json({ error: 'Không có quyền với tòa nhà này' }, { status: 403 });

    // Lấy danh sách nhóm hiện tại
    type NhomEntry = { name: string; threadIds: Record<string, string>; tang?: number | null; label?: string };
    let groups: NhomEntry[] = [];
    try { groups = (toa.zaloNhomChat as unknown as NhomEntry[]) || []; } catch { groups = []; }
    if (!Array.isArray(groups)) groups = [];

    if (action === 'add') {
      if (!threadId) return NextResponse.json({ error: 'Thiếu threadId' }, { status: 400 });

      // Lấy zaloAccountId của user hiện tại
      const nd = await prisma.nguoiDung.findUnique({ where: { id: uid }, select: { zaloAccountId: true } });
      const accountId = nd?.zaloAccountId || uid;

      const existing = groups.find(g => g.name?.toLowerCase() === name.toLowerCase());
      if (existing) {
        // Cập nhật threadId cho account này
        existing.threadIds = { ...(existing.threadIds || {}), [accountId]: threadId };
      } else {
        groups.push({ name, threadIds: { [accountId]: threadId } });
      }

      // Đồng thời cập nhật groupWhitelist của user (per-user filter)
      const gwRow = await prisma.caiDat.findUnique({ where: { khoa: userGroupKey(uid) }, select: { giaTri: true } });
      let wl: string[] = [];
      try { wl = JSON.parse(gwRow?.giaTri || '[]'); } catch { /* ignore */ }
      if (!wl.includes(name)) {
        wl.push(name);
        await prisma.caiDat.upsert({
          where: { khoa: userGroupKey(uid) },
          update: { giaTri: JSON.stringify(wl) },
          create: { khoa: userGroupKey(uid), giaTri: JSON.stringify(wl), moTa: `Group whitelist - ${uid}`, nhom: 'zalo', laBiMat: false },
        });
      }
    } else {
      // Xóa nhóm khỏi danh sách
      groups = groups.filter(g => g.name?.toLowerCase() !== name.toLowerCase());

      // Xóa khỏi groupWhitelist của user
      const gwRow = await prisma.caiDat.findUnique({ where: { khoa: userGroupKey(uid) }, select: { giaTri: true } });
      let wl: string[] = [];
      try { wl = JSON.parse(gwRow?.giaTri || '[]'); } catch { /* ignore */ }
      wl = wl.filter(w => w.toLowerCase() !== name.toLowerCase());
      await prisma.caiDat.upsert({
        where: { khoa: userGroupKey(uid) },
        update: { giaTri: JSON.stringify(wl) },
        create: { khoa: userGroupKey(uid), giaTri: JSON.stringify(wl), moTa: `Group whitelist - ${uid}`, nhom: 'zalo', laBiMat: false },
      });
    }

    await prisma.toaNha.update({ where: { id: toaNhaId }, data: { zaloNhomChat: groups as any } });
    return NextResponse.json({ success: true, groups });
  }

  return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });
}
