/**
 * GET  /api/admin/role-limits              → giới hạn chung (global)
 * GET  /api/admin/role-limits?toaNhaId=xxx → giới hạn riêng tòa nhà (fallback global)
 * GET  /api/admin/role-limits?all=1        → tất cả tòa nhà kèm limits
 * PUT  /api/admin/role-limits              → lưu giới hạn (chỉ admin)
 *
 * Chủ trọ chỉ có quyền XEM giới hạn, không được thay đổi.
 * Admin set giới hạn chung + per tòa nhà.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const DEFAULT_LIMITS: Record<string, number> = { dongChuTro: 2, quanLy: 3, nhanVien: 5 };
const VALID_KEYS = ['dongChuTro', 'quanLy', 'nhanVien'];

async function getGlobalLimits(): Promise<Record<string, number>> {
  const row = await prisma.caiDat.findUnique({ where: { khoa: 'role_limits' } });
  if (row?.giaTri) {
    try { return { ...DEFAULT_LIMITS, ...JSON.parse(row.giaTri) }; } catch {}
  }
  return DEFAULT_LIMITS;
}

async function getBuildingLimits(toaNhaId: string): Promise<Record<string, number> | null> {
  const row = await prisma.caiDatToaNha.findUnique({ where: { toaNhaId } });
  if (row?.roleLimits) {
    try { return JSON.parse(row.roleLimits); } catch {}
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const toaNhaId = searchParams.get('toaNhaId');
    const all = searchParams.get('all');

    const globalLimits = await getGlobalLimits();

    // Trả về tất cả tòa nhà kèm limits (cho dialog UI)
    if (all === '1') {
      const buildings = await prisma.caiDatToaNha.findMany({
        select: { toaNhaId: true, roleLimits: true },
      });
      const perBuilding: Record<string, Record<string, number> | null> = {};
      for (const b of buildings) {
        if (b.roleLimits) {
          try { perBuilding[b.toaNhaId] = JSON.parse(b.roleLimits); } catch {}
        }
      }
      return NextResponse.json({ global: globalLimits, perBuilding });
    }

    // Trả về limits cho một tòa nhà cụ thể (merge với global)
    if (toaNhaId) {
      const buildingLimits = await getBuildingLimits(toaNhaId);
      return NextResponse.json({
        ...globalLimits,
        ...(buildingLimits || {}),
        _source: buildingLimits ? 'building' : 'global',
      });
    }

    // Trả về global limits
    return NextResponse.json(globalLimits);
  } catch (error) {
    console.error('Error fetching role limits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới có quyền thay đổi giới hạn' }, { status: 403 });
    }

    const body = await request.json();
    const { toaNhaId, ...rest } = body;

    // Validate values
    const limits: Record<string, number> = {};
    for (const key of VALID_KEYS) {
      if (key in rest) {
        const val = Number(rest[key]);
        if (isNaN(val) || val < 0 || val > 100) {
          return NextResponse.json({ error: `Giá trị không hợp lệ cho ${key}` }, { status: 400 });
        }
        limits[key] = val;
      }
    }

    // ── Lưu per-building ──
    if (toaNhaId) {
      const hasCustom = Object.values(limits).some(v => v > 0);

      await prisma.caiDatToaNha.upsert({
        where: { toaNhaId },
        update: { roleLimits: hasCustom ? JSON.stringify(limits) : null },
        create: { toaNhaId, roleLimits: hasCustom ? JSON.stringify(limits) : null },
      });

      return NextResponse.json({ toaNhaId, limits: hasCustom ? limits : null, _source: hasCustom ? 'building' : 'global' });
    }

    // ── Lưu global ──
    for (const key of VALID_KEYS) {
      if (!(key in limits)) {
        limits[key] = DEFAULT_LIMITS[key];
      }
    }

    await prisma.caiDat.upsert({
      where: { khoa: 'role_limits' },
      update: { giaTri: JSON.stringify(limits) },
      create: {
        khoa: 'role_limits',
        giaTri: JSON.stringify(limits),
        moTa: 'Giới hạn số lượng mỗi vai trò trên mỗi tòa nhà (JSON)',
        nhom: 'heThong',
      },
    });

    return NextResponse.json(limits);
  } catch (error) {
    console.error('Error updating role limits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
