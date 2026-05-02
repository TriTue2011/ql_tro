/**
 * GET  /api/admin/zalo-quyen?toaNhaId=xxx → lấy quyền Zalo tính năng per slot
 * PUT  /api/admin/zalo-quyen              → lưu quyền (admin, chuNha, hoặc quanLy)
 *
 * JSON structure in CaiDatToaNha.zaloQuyenTinhNang:
 * {
 *   admin:  { slotKey: {features}, ... },  // Admin sets ceiling per position (chức vụ)
 *   chuNha: { slotKey: {features}, ... },  // ChuNha restricts per-person within admin's ceiling
 *   quanLy: { slotKey: {features}, ... },  // QuanLy restricts per-person within chuNha's effective
 * }
 *
 * Slot key format:
 *   - Position level: "chucVu" (e.g., "giamDoc", "keToanTruong") — used by admin for ceiling
 *   - Person level:   "chucVu__userId" (e.g., "giamDoc__abc123") — used by chuNha/quanLy per-person
 *
 * Effective calculation:
 *   - For position-level slots: admin sets the ceiling
 *   - For person-level slots: effective = admin[position] AND chuNha[person] AND quanLy[person]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ZALO_FEATURES = [
  'botServer', 'trucTiep', 'proxy', 'webhook',
  'tinTuDong', 'testGui', 'ketBan', 'theoDoiTin', 'zaloMonitor', 'quanLyQuyen',
] as const;

type ZaloFeature = typeof ZALO_FEATURES[number];

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

  // Build effective permissions
  // For position-level slots (admin ceiling): just admin value
  // For person-level slots: admin[position] AND chuNha[person] AND (quanLy[person] if applicable)
  const allKeys = new Set([
    ...Object.keys(adminLevel),
    ...Object.keys(chuNhaLevel),
    ...Object.keys(quanLyLevel),
  ]);
  const effective: Record<string, Record<ZaloFeature, boolean>> = {};
  for (const key of allKeys) {
    effective[key] = {} as any;
    
    // Determine the position key for this slot
    let positionKey = key;
    if (key.includes('__')) {
      positionKey = key.split('__')[0]; // "giamDoc__userId" → "giamDoc"
    }
    
    for (const f of ZALO_FEATURES) {
      // Admin ceiling is always based on the position key
      const aVal = adminLevel[positionKey]?.[f] ?? true;
      
      if (!key.includes('__')) {
        // Position-level slot: only admin ceiling applies
        effective[key][f] = aVal;
      } else {
        // Person-level slot: admin[position] AND chuNha[person] AND (quanLy[person] if exists)
        const cVal = chuNhaLevel[key]?.[f] ?? true;
        const qVal = quanLyLevel[key]?.[f] ?? true;
        effective[key][f] = aVal && cVal && qVal;
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
  if (!['admin', 'chuNha', 'dongChuTro', 'quanLy'].includes(userRole ?? '')) {
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
  if (level === 'chuNha' && !['admin', 'chuNha', 'dongChuTro'].includes(userRole!)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  if (level === 'quanLy' && !['admin', 'chuNha', 'dongChuTro', 'quanLy'].includes(userRole!)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  // Verify ownership — check cả chủ sở hữu lẫn gán qua toaNhaNguoiQuanLy
  if (userRole !== 'admin') {
    const owns = await prisma.toaNha.findFirst({
      where: { id: toaNhaId, chuSoHuuId: session.user.id },
      select: { id: true },
    });
    if (!owns) {
      const manages = await prisma.toaNhaNguoiQuanLy.findFirst({
        where: { toaNhaId, nguoiDungId: session.user.id },
      });
      if (!manages) return NextResponse.json({ error: 'Không có quyền với tòa nhà này' }, { status: 403 });
    }
  }

  const row = await prisma.caiDatToaNha.findUnique({ where: { toaNhaId } });
  const existing = parseQuyen(row?.zaloQuyenTinhNang ?? null) || {};
  const updated = { ...existing };
  if (!updated[level]) updated[level] = {};

  for (const [slotKey, featureObj] of Object.entries(permissions)) {
    if (typeof featureObj !== 'object' || !featureObj) continue;

    updated[level][slotKey] = { ...(updated[level][slotKey] || {}) };
    
    // Determine the position key for ceiling checks
    let positionKey = slotKey;
    if (slotKey.includes('__')) {
      positionKey = slotKey.split('__')[0];
    }
    
    for (const f of ZALO_FEATURES) {
      if (f in (featureObj as any)) {
        let val = !!(featureObj as any)[f];

        // Cannot enable what higher level disabled
        if (level === 'chuNha' && val) {
          // Check admin ceiling by position key
          if (updated.admin?.[positionKey]?.[f] === false) val = false;
        }
        if (level === 'quanLy' && val) {
          const adminVal = updated.admin?.[positionKey]?.[f] ?? true;
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
