/**
 * GET  /api/admin/toa-nha-permissions?toaNhaId=xxx  → Lấy gói quyền nghiệp vụ của tòa nhà
 * PUT  /api/admin/toa-nha-permissions                → Lưu gói quyền nghiệp vụ cho tòa nhà
 *
 * Chỉ admin truy cập được.
 *
 * businessPermissions là JSON string lưu trong CaiDatToaNha:
 *   { "mucDoHopDong": "fullAccess", "mucDoHoaDon": "viewOnly", ... }
 *   null = tất cả quyền được bật (mặc định)
 *
 * Tất cả người dùng trong tòa nhà đều kế thừa gói quyền này.
 * Quyền thực tế = businessPermissions AND user's role-based restrictions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const permissionLevelSchema = z.enum(['hidden', 'viewOnly', 'fullAccess']);

const permissionsSchema = z.object({
  mucDoHopDong: permissionLevelSchema,
  mucDoKichHoatTaiKhoan: permissionLevelSchema,
  mucDoHoaDon: permissionLevelSchema,
  mucDoThanhToan: permissionLevelSchema,
  mucDoSuCo: permissionLevelSchema,
  mucDoCongViec: permissionLevelSchema,
  mucDoBaoDuong: permissionLevelSchema,
  mucDoKho: permissionLevelSchema,
  mucDoZalo: permissionLevelSchema,
  mucDoZaloMonitor: permissionLevelSchema,
  mucDoCaiDatHotline: permissionLevelSchema,
  mucDoCaiDatEmail: permissionLevelSchema,
});

const putBodySchema = z.object({
  toaNhaId: z.string().min(1),
  permissions: permissionsSchema,
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const toaNhaId = searchParams.get('toaNhaId');

    if (!toaNhaId) {
      // Trả về danh sách tòa nhà kèm businessPermissions (nếu có)
      const buildings = await prisma.toaNha.findMany({
        select: {
          id: true,
          tenToaNha: true,
          caiDat: {
            select: { businessPermissions: true },
          },
        },
        orderBy: { tenToaNha: 'asc' },
      });

      const data = buildings.map((b) => ({
        id: b.id,
        tenToaNha: b.tenToaNha,
        businessPermissions: b.caiDat?.businessPermissions
          ? JSON.parse(b.caiDat.businessPermissions)
          : null,
      }));

      return NextResponse.json({ success: true, data });
    }

    const settings = await prisma.caiDatToaNha.findUnique({
      where: { toaNhaId },
    });

    const permissions = settings?.businessPermissions
      ? JSON.parse(settings.businessPermissions)
      : null;

    return NextResponse.json({ success: true, data: { toaNhaId, permissions } });
  } catch (error) {
    console.error('[toa-nha-permissions GET]', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { toaNhaId, permissions } = parsed.data;

    // Kiểm tra tòa nhà tồn tại
    const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId } });
    if (!toaNha) {
      return NextResponse.json({ error: 'Tòa nhà không tồn tại' }, { status: 404 });
    }

    const permissionsJson = JSON.stringify(permissions);

    const settings = await prisma.caiDatToaNha.upsert({
      where: { toaNhaId },
      update: { businessPermissions: permissionsJson },
      create: { toaNhaId, businessPermissions: permissionsJson },
    });

    return NextResponse.json({
      success: true,
      data: {
        toaNhaId,
        permissions: settings.businessPermissions
          ? JSON.parse(settings.businessPermissions)
          : null,
      },
    });
  } catch (error: any) {
    console.error('[toa-nha-permissions PUT]', error);
    const detail = error?.message || error?.code || 'Unknown';
    return NextResponse.json(
      { error: `Lỗi server khi lưu quyền: ${detail}` },
      { status: 500 },
    );
  }
}
