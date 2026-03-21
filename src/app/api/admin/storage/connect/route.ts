/**
 * POST /api/admin/storage/connect
 * Kiểm tra kết nối MinIO với credentials tạm thời và trả về danh sách buckets.
 * Body: { endpoint: string, accessKey: string, secretKey: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createMinioClient } from '@/lib/minio';

function deny(msg: string, status = 400) {
  return NextResponse.json({ success: false, message: msg }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint: endpointRaw, accessKey, secretKey } = body as Record<string, string>;

    if (!endpointRaw || !accessKey || !secretKey) {
      return deny('Cần điền đầy đủ Endpoint, Username và Password');
    }

    // Parse endpoint → hostname, port, useSSL
    const s = endpointRaw.trim();
    let hostname = s;
    let port = 9000;
    let useSSL = false;

    if (s.startsWith('http://') || s.startsWith('https://')) {
      const url = new URL(s);
      hostname = url.hostname;
      useSSL = url.protocol === 'https:';
      port = url.port ? parseInt(url.port) : (useSSL ? 443 : 80);
    } else {
      const colonIdx = s.lastIndexOf(':');
      if (colonIdx > 0) {
        hostname = s.slice(0, colonIdx);
        port = parseInt(s.slice(colonIdx + 1)) || 9000;
      }
    }

    const client = createMinioClient({ endpoint: hostname, port, useSSL, accessKey, secretKey, bucket: '' });
    const buckets = await client.listBuckets();

    return NextResponse.json({
      success: true,
      buckets: buckets.map(b => b.name),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
    return deny(msg, 500);
  }
}
