/**
 * GET  /api/admin/toa-nha-settings?toaNhaId=xxx  → Lấy cài đặt HA + lưu trữ của tòa nhà
 * PUT  /api/admin/toa-nha-settings                → Lưu cài đặt của tòa nhà
 * Chỉ admin truy cập được.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const toaNhaId = searchParams.get('toaNhaId');

  if (!toaNhaId) {
    // Trả về danh sách tòa nhà cho dropdown (chỉ cần id + tên)
    const buildings = await prisma.toaNha.findMany({
      select: { id: true, tenToaNha: true },
      orderBy: { tenToaNha: 'asc' },
    });
    return NextResponse.json({ success: true, data: buildings });
  }

  const settings = await prisma.caiDatToaNha.findUnique({
    where: { toaNhaId },
  });

  // Fallback về global CaiDat khi: (1) chưa có record, hoặc (2) storageProvider rỗng
  if (!settings || !settings.storageProvider) {
    const globals = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
    const g = (k: string) => globals.find(s => s.khoa === k)?.giaTri ?? null;
    const merged = {
      ...(settings ?? {}),
      storageProvider: g('storage_provider') ?? 'local',
      minioEndpoint: settings?.minioEndpoint ?? g('minio_endpoint'),
      minioAccessKey: settings?.minioAccessKey ?? g('minio_access_key'),
      minioSecretKey: settings?.minioSecretKey ?? g('minio_secret_key'),
      minioBucket: settings?.minioBucket ?? g('minio_bucket'),
      cloudinaryCloudName: settings?.cloudinaryCloudName ?? g('cloudinary_cloud_name'),
      cloudinaryApiKey: settings?.cloudinaryApiKey ?? g('cloudinary_api_key'),
      cloudinaryApiSecret: settings?.cloudinaryApiSecret ?? g('cloudinary_api_secret'),
      cloudinaryPreset: settings?.cloudinaryPreset ?? g('cloudinary_upload_preset'),
      uploadMaxSizeMb: settings?.uploadMaxSizeMb ?? Number(g('upload_max_size_mb') ?? 10),
    };
    return NextResponse.json({ success: true, data: merged });
  }

  return NextResponse.json({ success: true, data: settings });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { toaNhaId, ...rest } = body;

  if (!toaNhaId) {
    return NextResponse.json({ error: 'toaNhaId required' }, { status: 400 });
  }

  // Kiểm tra tòa nhà tồn tại
  const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId } });
  if (!toaNha) {
    return NextResponse.json({ error: 'Tòa nhà không tồn tại' }, { status: 404 });
  }

  const allowed = [
    'haUrl', 'haToken', 'haWebhookUrl', 'haAllowedThreads',
    'storageProvider', 'minioEndpoint', 'minioAccessKey', 'minioSecretKey', 'minioBucket',
    'cloudinaryCloudName', 'cloudinaryApiKey', 'cloudinaryApiSecret', 'cloudinaryPreset',
    'uploadMaxSizeMb',
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in rest) data[key] = rest[key];
  }

  const settings = await prisma.caiDatToaNha.upsert({
    where: { toaNhaId },
    update: data,
    create: { toaNhaId, ...data },
  });

  return NextResponse.json({ success: true, data: settings });
}
