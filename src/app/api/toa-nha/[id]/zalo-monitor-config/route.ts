import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/toa-nha/[id]/zalo-monitor-config
 * Fetch building-specific Zalo Monitor settings.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: buildingId } = await params;
  const key = `zalo_monitor_config_${buildingId}`;

  const row = await prisma.caiDat.findUnique({ where: { khoa: key } });
  if (!row) {
    // Default: enabled, no filter
    return NextResponse.json({ success: true, data: { enabled: true, dmFilter: 'none' } });
  }

  try {
    const data = JSON.parse(row.giaTri || '{}');
    return NextResponse.json({ success: true, data: { 
      enabled: data.enabled ?? true, 
      dmFilter: data.dmFilter ?? 'none' 
    } });
  } catch {
    return NextResponse.json({ success: true, data: { enabled: true, dmFilter: 'none' } });
  }
}

/**
 * PUT /api/toa-nha/[id]/zalo-monitor-config
 * Update building-specific Zalo Monitor settings.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: buildingId } = await params;
  const { enabled, dmFilter } = await req.json();

  const key = `zalo_monitor_config_${buildingId}`;

  // Phân quyền: Admin, chủ sở hữu, hoặc người được gán quản lý tòa nhà mới được sửa
  const building = await prisma.toaNha.findUnique({
    where: { id: buildingId },
    select: { chuSoHuuId: true }
  });

  if (!building) return NextResponse.json({ success: false, message: 'Tòa nhà không tồn tại' }, { status: 404 });

  const isOwner = building.chuSoHuuId === session.user.id;
  const isAdmin = session.user.role === 'admin';
  let hasPermission = isOwner || isAdmin;

  // Nếu không phải admin/chủ sở hữu, kiểm tra trong ToaNhaNguoiQuanLy
  if (!hasPermission) {
    const managerRecord = await prisma.toaNhaNguoiQuanLy.findUnique({
      where: {
        toaNhaId_nguoiDungId: { toaNhaId: buildingId, nguoiDungId: session.user.id },
      },
    });
    hasPermission = !!managerRecord;
  }

  if (!hasPermission) {
    return NextResponse.json({ success: false, message: 'Bạn không có quyền chỉnh sửa cài đặt này' }, { status: 403 });
  }

  const finalData = { enabled, dmFilter };

  await prisma.caiDat.upsert({
    where: { khoa: key },
    update: { giaTri: JSON.stringify(finalData) },
    create: {
      khoa: key,
      giaTri: JSON.stringify(finalData),
      nhom: 'heThong',
      moTa: `Cấu hình Zalo Monitor cho tòa nhà ${buildingId}`
    }
  });

  return NextResponse.json({ success: true, data: finalData });
}
