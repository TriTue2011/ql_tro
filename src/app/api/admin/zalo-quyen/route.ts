/**
 * GET  /api/admin/zalo-quyen?toaNhaId=xxx → lấy quyền Zalo tính năng per role
 * PUT  /api/admin/zalo-quyen              → lưu quyền (admin hoặc chuNha)
 *
 * JSON structure in CaiDatToaNha.zaloQuyenTinhNang:
 * {
 *   admin: { chuNha: {...}, dongChuTro: {...}, quanLy: {...}, nhanVien: {...} },
 *   chuNha: { dongChuTro: {...}, quanLy: {...}, nhanVien: {...} }
 * }
 *
 * Each feature object: { botServer, trucTiep, proxy, webhook, tinTuDong, testGui, ketBan, theoDoiTin, zaloMonitor }
 * null = all features enabled (default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const ZALO_FEATURES = [
  'botServer', 'trucTiep', 'proxy', 'webhook',
  'tinTuDong', 'testGui', 'ketBan', 'theoDoiTin', 'zaloMonitor',
] as const;

export type ZaloFeature = typeof ZALO_FEATURES[number];

const ROLES = ['chuNha', 'dongChuTro', 'quanLy', 'nhanVien'] as const;
const CHU_NHA_ROLES = ['dongChuTro', 'quanLy', 'nhanVien'] as const;

function defaultFeatures(): Record<ZaloFeature, boolean> {
  return Object.fromEntries(ZALO_FEATURES.map(f => [f, true])) as any;
}

function parseQuyen(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const toaNhaId = req.nextUrl.searchParams.get('toaNhaId');
  if (!toaNhaId) {
    return NextResponse.json({ error: 'Cần toaNhaId' }, { status: 400 });
  }

  const row = await prisma.caiDatToaNha.findUnique({ where: { toaNhaId } });
  const data = parseQuyen(row?.zaloQuyenTinhNang ?? null);

  // Build response with defaults
  const adminLevel: Record<string, Record<ZaloFeature, boolean>> = {};
  for (const role of ROLES) {
    adminLevel[role] = { ...defaultFeatures(), ...(data?.admin?.[role] || {}) };
  }

  const chuNhaLevel: Record<string, Record<ZaloFeature, boolean>> = {};
  for (const role of CHU_NHA_ROLES) {
    chuNhaLevel[role] = { ...defaultFeatures(), ...(data?.chuNha?.[role] || {}) };
  }

  // Effective = admin AND chuNha
  const effective: Record<string, Record<ZaloFeature, boolean>> = {};
  for (const role of ROLES) {
    effective[role] = {} as any;
    for (const f of ZALO_FEATURES) {
      if (role === 'chuNha') {
        effective[role][f] = adminLevel[role][f];
      } else {
        effective[role][f] = adminLevel[role][f] && chuNhaLevel[role as typeof CHU_NHA_ROLES[number]][f];
      }
    }
  }

  return NextResponse.json({
    ok: true,
    admin: adminLevel,
    chuNha: chuNhaLevel,
    effective,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role: userRole } = session.user;
  if (userRole !== 'admin' && userRole !== 'chuNha') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const body = await req.json();
  const { toaNhaId, level, permissions } = body;
  // level = 'admin' | 'chuNha'
  // permissions = { roleName: { feature: boolean, ... }, ... }

  if (!toaNhaId || !level || !permissions) {
    return NextResponse.json({ error: 'Thiếu toaNhaId, level, hoặc permissions' }, { status: 400 });
  }

  // Admin can set admin level; chuNha can only set chuNha level
  if (level === 'admin' && userRole !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin mới được thay đổi quyền cấp admin' }, { status: 403 });
  }

  if (level === 'chuNha' && userRole !== 'admin' && userRole !== 'chuNha') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  // If chuNha, verify they own this building
  if (userRole === 'chuNha') {
    const owns = await prisma.toaNha.findFirst({
      where: { id: toaNhaId, chuSoHuuId: session.user.id },
      select: { id: true },
    });
    if (!owns) {
      return NextResponse.json({ error: 'Không có quyền với tòa nhà này' }, { status: 403 });
    }
  }

  // Read existing data
  const row = await prisma.caiDatToaNha.findUnique({ where: { toaNhaId } });
  const existing = parseQuyen(row?.zaloQuyenTinhNang ?? null) || {};

  // Validate & merge
  const allowedRoles = level === 'admin' ? ROLES : CHU_NHA_ROLES;
  const updated = { ...existing };
  if (!updated[level]) updated[level] = {};

  for (const [roleName, featureObj] of Object.entries(permissions)) {
    if (!allowedRoles.includes(roleName as any)) continue;
    if (typeof featureObj !== 'object' || !featureObj) continue;

    updated[level][roleName] = { ...(updated[level][roleName] || {}) };
    for (const f of ZALO_FEATURES) {
      if (f in (featureObj as any)) {
        let val = !!(featureObj as any)[f];

        // ChuNha cannot enable what admin disabled
        if (level === 'chuNha' && val) {
          const adminVal = updated.admin?.[roleName]?.[f];
          if (adminVal === false) val = false;
        }

        updated[level][roleName][f] = val;
      }
    }
  }

  await prisma.caiDatToaNha.upsert({
    where: { toaNhaId },
    update: { zaloQuyenTinhNang: JSON.stringify(updated) },
    create: { toaNhaId, zaloQuyenTinhNang: JSON.stringify(updated) },
  });

  return NextResponse.json({ ok: true });
}
