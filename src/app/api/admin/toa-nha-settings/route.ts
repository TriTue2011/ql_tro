/**
 * GET  /api/admin/toa-nha-settings?toaNhaId=xxx  → Lấy cài đặt của tòa nhà
 * PUT  /api/admin/toa-nha-settings                → Lưu cài đặt của tòa nhà
 *
 * Admin: có thể xem/sửa tất cả tòa nhà
 * Chủ trọ: chỉ xem/sửa được tòa nhà mình quản lý
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/** Lấy danh sách tòa nhà mà user hiện tại có quyền truy cập */
async function getAccessibleBuildingIds(userId: string, role: string): Promise<string[]> {
  if (role === 'admin') {
    const all = await prisma.toaNha.findMany({ select: { id: true } });
    return all.map(b => b.id);
  }
  // Chủ trọ: lấy tòa nhà có chuSoHuuId = userId
  const buildings = await prisma.toaNha.findMany({
    where: { chuSoHuuId: userId },
    select: { id: true },
  });
  return buildings.map(b => b.id);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role ?? '';
    const userId = session.user.id;
    const accessibleIds = await getAccessibleBuildingIds(userId, role);

    const { searchParams } = new URL(req.url);
    const toaNhaId = searchParams.get('toaNhaId');

    if (!toaNhaId) {
      // Trả về danh sách tòa nhà cho dropdown (chỉ cần id + tên)
      const buildings = await prisma.toaNha.findMany({
        where: { id: { in: accessibleIds } },
        select: { id: true, tenToaNha: true },
        orderBy: { tenToaNha: 'asc' },
      });
      return NextResponse.json({ success: true, data: buildings });
    }

    // Kiểm tra quyền truy cập tòa nhà này
    if (!accessibleIds.includes(toaNhaId)) {
      return NextResponse.json({ error: 'Bạn không có quyền truy cập tòa nhà này' }, { status: 403 });
    }

    const settings = await prisma.caiDatToaNha.findUnique({
      where: { toaNhaId },
    });

    // Fallback về global CaiDat khi chưa có record cho tòa nhà này
    if (!settings) {
      const globals = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
      const g = (k: string) => globals.find(s => s.khoa === k)?.giaTri ?? '';
      return NextResponse.json({
        success: true,
        data: {
          storageProvider: g('storage_provider') || 'local',
          minioEndpoint: g('minio_endpoint'),
          minioAccessKey: g('minio_access_key'),
          minioSecretKey: g('minio_secret_key'),
          minioBucket: g('minio_bucket'),
          cloudinaryCloudName: g('cloudinary_cloud_name'),
          cloudinaryApiKey: g('cloudinary_api_key'),
          cloudinaryApiSecret: g('cloudinary_api_secret'),
          cloudinaryPreset: g('cloudinary_upload_preset'),
          uploadMaxSizeMb: Number(g('upload_max_size_mb')) || 10,
        },
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[toa-nha-settings GET]', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role ?? '';
    const userId = session.user.id;
    const accessibleIds = await getAccessibleBuildingIds(userId, role);

    const body = await req.json();
    const { toaNhaId, ...rest } = body;

    if (!toaNhaId) {
      return NextResponse.json({ error: 'toaNhaId required' }, { status: 400 });
    }

    // Kiểm tra quyền truy cập tòa nhà này
    if (!accessibleIds.includes(toaNhaId)) {
      return NextResponse.json({ error: 'Bạn không có quyền truy cập tòa nhà này' }, { status: 403 });
    }

    // Kiểm tra tòa nhà tồn tại
    const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId } });
    if (!toaNha) {
      return NextResponse.json({ error: 'Tòa nhà không tồn tại' }, { status: 404 });
    }

    // Xây dựng data object rõ ràng kiểu cho Prisma (tránh Record<string, unknown>)
    const updateData: any = {};
    const strFields = [
      'haUrl', 'haToken', 'haWebhookUrl', 'haAllowedThreads',
      'storageProvider', 'minioEndpoint', 'minioAccessKey', 'minioSecretKey', 'minioBucket',
      'cloudinaryCloudName', 'cloudinaryApiKey', 'cloudinaryApiSecret', 'cloudinaryPreset',
    ];
    for (const key of strFields) {
      if (key in rest) updateData[key] = String(rest[key] ?? '');
    }
    if ('uploadMaxSizeMb' in rest) {
      const n = Number(rest.uploadMaxSizeMb);
      updateData.uploadMaxSizeMb = isNaN(n) ? 10 : Math.floor(n);
    }

    // Đăng nhập web khách thuê — admin có thể bật/tắt, chủ trọ chỉ bật/tắt được chuTroBatDangNhapKT
    if (role === 'admin') {
      if ('adminBatDangNhapKT' in rest) {
        updateData.adminBatDangNhapKT = Boolean(rest.adminBatDangNhapKT);
        if (rest.adminBatDangNhapKT) {
          updateData.chuTroBatDangNhapKT = true;
        } else {
          updateData.chuTroBatDangNhapKT = false;
        }
      }
      if ('gioiHanDangNhapKT' in rest) {
        const n = rest.gioiHanDangNhapKT;
        updateData.gioiHanDangNhapKT = n === null || n === '' ? null : Math.max(0, Math.floor(Number(n)));
      }
    } else {
      // Chủ trọ: chỉ được thay đổi chuTroBatDangNhapKT
      if ('chuTroBatDangNhapKT' in rest) {
        updateData.chuTroBatDangNhapKT = Boolean(rest.chuTroBatDangNhapKT);
      }
    }

    // Zalo Hotline switches — chủ trọ có thể thay đổi
    if ('batHotline' in rest) updateData.batHotline = Boolean(rest.batHotline);
    if ('uyQuyenQL' in rest) updateData.uyQuyenQL = Boolean(rest.uyQuyenQL);
    if ('uyQuyenHotline' in rest) updateData.uyQuyenHotline = Boolean(rest.uyQuyenHotline);

    const settings = await prisma.caiDatToaNha.upsert({
      where: { toaNhaId },
      update: updateData,
      create: { toaNhaId, ...updateData },
    });

    // Đồng bộ cài đặt lưu trữ lên global CaiDat để getMinioConfig() hoạt động
    const storageKeys: Record<string, string> = {
      storageProvider: 'storage_provider',
      minioEndpoint: 'minio_endpoint',
      minioAccessKey: 'minio_access_key',
      minioSecretKey: 'minio_secret_key',
      minioBucket: 'minio_bucket',
      cloudinaryCloudName: 'cloudinary_cloud_name',
      cloudinaryApiKey: 'cloudinary_api_key',
      cloudinaryApiSecret: 'cloudinary_api_secret',
      cloudinaryPreset: 'cloudinary_upload_preset',
      uploadMaxSizeMb: 'upload_max_size_mb',
    };
    for (const [camelKey, snakeKey] of Object.entries(storageKeys)) {
      if (camelKey in updateData) {
        try {
          await prisma.caiDat.upsert({
            where: { khoa: snakeKey },
            update: { giaTri: String(updateData[camelKey] ?? '') },
            create: {
              khoa: snakeKey,
              giaTri: String(updateData[camelKey] ?? ''),
              nhom: 'luuTru',
              moTa: snakeKey,
              laBiMat: snakeKey.includes('secret') || snakeKey.includes('password'),
            },
          });
        } catch (syncErr) {
          console.warn(`[toa-nha-settings] Lỗi đồng bộ ${snakeKey}:`, syncErr);
        }
      }
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('[toa-nha-settings PUT]', error);
    const detail = error?.message || error?.code || 'Unknown';
    return NextResponse.json(
      { error: `Lỗi server khi lưu cài đặt: ${detail}` },
      { status: 500 },
    );
  }
}
