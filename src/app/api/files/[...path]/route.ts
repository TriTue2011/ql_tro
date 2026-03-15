/**
 * Proxy route để serve ảnh từ MinIO qua Next.js.
 * Tất cả URL ảnh MinIO đều đi qua đây → tương thích với Cloudflare Tunnel.
 *
 * Ví dụ: GET /api/files/ql-tro/2024-abc.jpg
 * → lấy object "2024-abc.jpg" từ bucket "ql-tro" trong MinIO
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMinioConfig, createMinioClient } from '@/lib/minio';

/** Kiểm tra path traversal: không cho phép .. hoặc ký tự nguy hiểm */
function isSafePath(value: string): boolean {
  // Không cho phép path traversal (../, ..\, %2e%2e, v.v.)
  if (/\.\./.test(value)) return false;
  // Không cho phép ký tự null byte
  if (/\0/.test(value)) return false;
  // Không cho phép path bắt đầu hoặc kết thúc bằng /
  if (value.startsWith('/') || value.endsWith('/')) return false;
  // Chỉ cho phép ký tự an toàn: chữ, số, -, _, ., /
  if (!/^[\w\-./ ]+$/.test(value)) return false;
  return true;
}

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

  // Kiểm tra path traversal trong filename
  if (!isSafePath(filename)) {
    return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
  }

  try {
    const minioConfig = await getMinioConfig();

    // Chỉ cho phép truy cập bucket đã cấu hình — chặn truy cập bucket tùy ý
    if (bucket !== minioConfig.bucket) {
      return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
    }

    const client = createMinioClient(minioConfig);

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
