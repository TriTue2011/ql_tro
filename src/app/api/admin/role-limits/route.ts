/**
 * GET  /api/admin/role-limits              → giới hạn chung (global)
 * GET  /api/admin/role-limits?toaNhaId=xxx → giới hạn riêng tòa nhà (fallback global)
 * GET  /api/admin/role-limits?all=1        → tất cả tòa nhà kèm limits
 * PUT  /api/admin/role-limits              → lưu giới hạn chung (chỉ admin)
 * PUT  /api/admin/role-limits              → lưu giới hạn riêng tòa nhà (admin hoặc chuNha)
 *
 * Quy tắc:
 *  - Admin: set giới hạn global (dongChuTro, quanLy, nhanVien)
 *  - ChuNha: chỉ set quanLy + nhanVien per tòa nhà mình sở hữu
 *    Tổng tất cả tòa ≤ giới hạn global mà admin cấp
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const DEFAULT_LIMITS: Record<string, number> = { dongChuTro: 2, quanLy: 3, nhanVien: 5 };
const VALID_KEYS = ['dongChuTro', 'quanLy', 'nhanVien'];
// ChuNha chỉ được set 2 key này
const CHU_NHA_KEYS = ['quanLy', 'nhanVien'];

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
    const role = session?.user?.role;
    if (!session?.user?.id || !['admin', 'chuNha'].includes(role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { toaNhaId, ...rest } = body;

    // ChuNha chỉ được set quanLy + nhanVien
    const allowedKeys = role === 'chuNha' ? CHU_NHA_KEYS : VALID_KEYS;

    // Validate values
    const limits: Record<string, number> = {};
    for (const key of allowedKeys) {
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
      // chuNha chỉ được sửa tòa nhà của mình
      if (role === 'chuNha') {
        const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId }, select: { chuSoHuuId: true } });
        if (!toaNha || toaNha.chuSoHuuId !== session.user.id) {
          return NextResponse.json({ error: 'Không có quyền với tòa nhà này' }, { status: 403 });
        }

        // Kiểm tra tổng giới hạn tất cả tòa nhà ≤ global limit
        const globalLimits = await getGlobalLimits();
        const ownedBuildings = await prisma.toaNha.findMany({
          where: { chuSoHuuId: session.user.id },
          select: { id: true },
        });
        const ownedIds = ownedBuildings.map(b => b.id);

        // Lấy limits hiện tại của tất cả tòa nhà khác
        const otherSettings = await prisma.caiDatToaNha.findMany({
          where: { toaNhaId: { in: ownedIds.filter(id => id !== toaNhaId) } },
          select: { roleLimits: true },
        });

        // Tính tổng hiện tại (tòa nhà khác)
        const sumOther: Record<string, number> = { quanLy: 0, nhanVien: 0 };
        for (const s of otherSettings) {
          if (s.roleLimits) {
            try {
              const parsed = JSON.parse(s.roleLimits);
              for (const k of CHU_NHA_KEYS) {
                sumOther[k] += Number(parsed[k] || 0);
              }
            } catch {}
          }
        }

        // Kiểm tra: tổng (tòa khác + tòa đang sửa) ≤ global
        for (const k of CHU_NHA_KEYS) {
          const newVal = limits[k] ?? 0;
          const total = sumOther[k] + newVal;
          if (total > (globalLimits[k] ?? DEFAULT_LIMITS[k])) {
            const label = k === 'quanLy' ? 'quản lý' : 'nhân viên';
            return NextResponse.json({
              error: `Tổng giới hạn ${label} tất cả tòa nhà (${total}) vượt quá giới hạn hệ thống (${globalLimits[k]})`,
            }, { status: 400 });
          }
        }
      }

      // Nếu tất cả values = 0 hoặc rỗng → xóa (dùng global)
      const hasCustom = Object.values(limits).some(v => v > 0);

      await prisma.caiDatToaNha.upsert({
        where: { toaNhaId },
        update: { roleLimits: hasCustom ? JSON.stringify(limits) : null },
        create: { toaNhaId, roleLimits: hasCustom ? JSON.stringify(limits) : null },
      });

      return NextResponse.json({ toaNhaId, limits: hasCustom ? limits : null, _source: hasCustom ? 'building' : 'global' });
    }

    // ── Lưu global (chỉ admin) ──
    if (role === 'chuNha') {
      return NextResponse.json({ error: 'Chủ nhà không thể thay đổi giới hạn chung' }, { status: 403 });
    }

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
