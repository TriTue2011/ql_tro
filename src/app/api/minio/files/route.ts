/**
 * GET /api/minio/files?prefix=&limit=50
 * Liệt kê file trong MinIO bucket.
 * Chỉ admin/chuNha.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMinioConfig, createMinioClient } from '@/lib/minio';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || '';
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);

  try {
    const config = await getMinioConfig();
    const client = createMinioClient(config);
    const bucket = config.bucket;

    const files: { name: string; size: number; lastModified: Date; url: string }[] = [];

    await new Promise<void>((resolve, reject) => {
      const stream = client.listObjectsV2(bucket, prefix, true);
      stream.on('data', (obj) => {
        if (files.length >= limit) return;
        if (!obj.name) return;
        // Tạo presigned URL có hiệu lực 1 giờ
        files.push({
          name: obj.name,
          size: obj.size ?? 0,
          lastModified: obj.lastModified ?? new Date(),
          url: '', // sẽ điền sau
        });
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Tạo presigned URLs cho tất cả file
    const withUrls = await Promise.all(
      files.slice(0, limit).map(async (f) => {
        try {
          const url = await client.presignedGetObject(bucket, f.name, 3600);
          return { ...f, url };
        } catch {
          return { ...f, url: '' };
        }
      })
    );

    return NextResponse.json({ success: true, files: withUrls, bucket });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Lỗi MinIO' }, { status: 500 });
  }
}
