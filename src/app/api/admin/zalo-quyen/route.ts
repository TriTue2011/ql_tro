/**
 * GET  /api/admin/zalo-quyen?toaNhaId=xxx → lấy quyền Zalo tính năng per slot
 * PUT  /api/admin/zalo-quyen              → lưu quyền (admin, chuNha, hoặc quanLy)
 *
 * JSON structure in CaiDatToaNha.zaloQuyenTinhNang:
 * {
 *   admin:  { slotKey: {features}, ... },  // Admin sets ceiling
 *   chuNha: { slotKey: {features}, ... },  // ChuNha restricts within admin's ceiling
 *   quanLy: { slotKey: {features}, ... },  // QuanLy restricts within chuNha's effective
 * }
 *
 * Slot key format: "role" (when limit=1) or "role_N" (when limit>1)
 * Effective = admin AND chuNha AND quanLy
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

  const adminLevel = data?.admin || {};
  const chuNhaLevel = data?.chuNha || {};
  const quanLyLevel = data?.quanLy || {};

  // Build effective: admin AND chuNha AND quanLy
  const allKeys = new Set([
    ...Object.keys(adminLevel),
    ...Object.keys(chuNhaLevel),
    ...Object.keys(quanLyLevel),
  ]);
  const effective: Record<string, Record<ZaloFeature, boolean>> = {};
  for (const key of allKeys) {
    effective[key] = {} as any;
    for (const f of ZALO_FEATURES) {
      const aVal = adminLevel[key]?.[f] ?? true;
      // chuNha slots: only admin level applies
      if (key === 'chuNha' || key.startsWith('chuNha_')) {
        effective[key][f] = aVal;
      } else {
        const cVal = chuNhaLevel[key]?.[f] ?? true;
        // nhanVien slots: also apply quanLy level
        if (key === 'nhanVien' || key.startsWith('nhanVien_')) {
          const qVal = quanLyLevel[key]?.[f] ?? true;
          effective[key][f] = aVal && cVal && qVal;
        } else {
          effective[key][f] = aVal && cVal;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    admin: adminLevel,
    chuNha: chuNhaLevel,
    quanLy: quanLyLevel,
    effective,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role: userRole } = session.user;
  if (!['admin', 'chuNha', 'quanLy'].includes(userRole ?? '')) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const body = await req.json();
  const { toaNhaId, level, permissions } = body;

  if (!toaNhaId || !level || !permissions) {
    return NextResponse.json({ error: 'Thiếu toaNhaId, level, hoặc permissions' }, { status: 400 });
  }

  // Authorization
  if (level === 'admin' && userRole !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin' }, { status: 403 });
  }
  if (level === 'chuNha' && userRole !== 'admin' && userRole !== 'chuNha') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  if (level === 'quanLy' && !['admin', 'chuNha', 'quanLy'].includes(userRole!)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  // Verify ownership
  if (userRole === 'chuNha') {
    const owns = await prisma.toaNha.findFirst({
      where: { id: toaNhaId, chuSoHuuId: session.user.id },
      select: { id: true },
    });
    if (!owns) return NextResponse.json({ error: 'Không có quyền với tòa nhà này' }, { status: 403 });
  }
  if (userRole === 'quanLy') {
    const manages = await prisma.toaNhaNguoiQuanLy.findFirst({
      where: { toaNhaId, nguoiDungId: session.user.id },
    });
    if (!manages) return NextResponse.json({ error: 'Không có quyền với tòa nhà này' }, { status: 403 });
  }

  const row = await prisma.caiDatToaNha.findUnique({ where: { toaNhaId } });
  const existing = parseQuyen(row?.zaloQuyenTinhNang ?? null) || {};
  const updated = { ...existing };
  if (!updated[level]) updated[level] = {};

  for (const [slotKey, featureObj] of Object.entries(permissions)) {
    if (typeof featureObj !== 'object' || !featureObj) continue;

    updated[level][slotKey] = { ...(updated[level][slotKey] || {}) };
    for (const f of ZALO_FEATURES) {
      if (f in (featureObj as any)) {
        let val = !!(featureObj as any)[f];

        // Cannot enable what higher level disabled
        if (level === 'chuNha' && val && updated.admin?.[slotKey]?.[f] === false) val = false;
        if (level === 'quanLy' && val) {
          const adminVal = updated.admin?.[slotKey]?.[f] ?? true;
          const chuNhaVal = updated.chuNha?.[slotKey]?.[f] ?? true;
          if (!adminVal || !chuNhaVal) val = false;
        }

        updated[level][slotKey][f] = val;
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
