/**
 * Proxy route để serve ảnh từ MinIO qua Next.js.
 * Tất cả URL ảnh MinIO đều đi qua đây → tương thích với Cloudflare Tunnel.
 *
 * Ví dụ: GET /api/files/ql-tro/2024-abc.jpg
 * → lấy object "2024-abc.jpg" từ bucket "ql-tro" trong MinIO
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMinioClient } from '@/lib/minio';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!path || path.length < 2) {
    return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
  }

  const [bucket, ...fileParts] = path;
  const filename = fileParts.join('/');

  try {
    const client = getMinioClient();

    const stat = await client.statObject(bucket, filename);
    const stream = await client.getObject(bucket, filename);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    const contentType =
      (stat.metaData?.['content-type'] as string) || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ message: 'File not found' }, { status: 404 });
  }
}
