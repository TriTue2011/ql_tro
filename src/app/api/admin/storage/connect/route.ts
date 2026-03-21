/**
 * POST /api/admin/storage/connect
 * Kết nối MinIO với credentials tạm thời, trả về danh sách buckets.
 * Nếu có thêm field `createBucket`, tạo bucket đó trước rồi trả list.
 *
 * Body: { endpoint, accessKey, secretKey, createBucket?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createMinioClient } from '@/lib/minio';

function deny(msg: string, status = 400) {
  return NextResponse.json({ success: false, message: msg }, { status });
}

function parseEndpoint(raw: string) {
  const s = raw.trim();
  let hostname = s, port = 9000, useSSL = false;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    const url = new URL(s);
    hostname = url.hostname;
    useSSL = url.protocol === 'https:';
    port = url.port ? parseInt(url.port) : (useSSL ? 443 : 80);
  } else {
    const i = s.lastIndexOf(':');
    if (i > 0) { hostname = s.slice(0, i); port = parseInt(s.slice(i + 1)) || 9000; }
  }
  return { hostname, port, useSSL };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint: endpointRaw, accessKey, secretKey, createBucket } =
      body as Record<string, string>;

    if (!endpointRaw || !accessKey || !secretKey) {
      return deny('Cần điền đầy đủ Endpoint, Username và Password');
    }

    const { hostname, port, useSSL } = parseEndpoint(endpointRaw);
    const client = createMinioClient({ endpoint: hostname, port, useSSL, accessKey, secretKey, bucket: '' });

    // Tạo bucket nếu được yêu cầu
    if (createBucket) {
      const name = createBucket.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (name.length < 3 || name.length > 63) {
        return deny('Tên bucket phải từ 3–63 ký tự (chữ thường, số, gạch ngang)');
      }
      const exists = await client.bucketExists(name);
      if (!exists) await client.makeBucket(name, 'us-east-1');
    }

    const buckets = await client.listBuckets();
    return NextResponse.json({ success: true, buckets: buckets.map(b => b.name) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
    return deny(msg, 500);
  }
}
