import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMinioConfig, createMinioClient, ensureBucketExists } from '@/lib/minio';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['admin', 'chuNha'].includes(session.user.role ?? '')) {
    return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
  }

  try {
    const config = await getMinioConfig();

    if (!config.endpoint) {
      return NextResponse.json({
        success: false,
        message: 'Chưa cấu hình MinIO Endpoint URL',
      });
    }

    const client = createMinioClient(config);

    // Kiểm tra kết nối bằng cách list buckets
    const buckets = await client.listBuckets();

    // Đảm bảo bucket tồn tại (tạo nếu chưa có)
    await ensureBucketExists(client, config.bucket);

    return NextResponse.json({
      success: true,
      message: `Kết nối thành công! Bucket "${config.bucket}" sẵn sàng.`,
      details: {
        endpoint: `${config.useSSL ? 'https' : 'http'}://${config.endpoint}:${config.port}`,
        bucket: config.bucket,
        totalBuckets: buckets.length,
        buckets: buckets.map((b) => b.name),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      success: false,
      message: `Kết nối thất bại: ${msg}`,
    });
  }
}
