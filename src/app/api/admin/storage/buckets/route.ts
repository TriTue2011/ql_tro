/**
 * /api/admin/storage/buckets
 * Admin only (enforced by middleware).
 *
 * GET  → list all buckets
 * POST → create bucket  { name: string }
 * DELETE ?name=xxx → delete bucket + all objects inside
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMinioConfig, createMinioClient } from '@/lib/minio';

// ── helpers ────────────────────────────────────────────────────────────────────

async function getClient() {
  const config = await getMinioConfig();
  return { client: createMinioClient(config), config };
}

function deny(msg: string, status = 400) {
  return NextResponse.json({ success: false, message: msg }, { status });
}

// ── GET /api/admin/storage/buckets ─────────────────────────────────────────────
export async function GET() {
  try {
    const { client } = await getClient();
    const buckets = await client.listBuckets();
    return NextResponse.json({
      success: true,
      buckets: buckets.map(b => ({ name: b.name, creationDate: b.creationDate })),
    });
  } catch (err: any) {
    return deny(err?.message || 'Lỗi kết nối MinIO', 500);
  }
}

// ── POST /api/admin/storage/buckets ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name: string = (body.name || '').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-');
    if (!name || name.length < 3 || name.length > 63) {
      return deny('Tên bucket phải từ 3-63 ký tự (chữ thường, số, gạch ngang)');
    }

    const { client } = await getClient();
    const exists = await client.bucketExists(name);
    if (exists) return deny('Bucket đã tồn tại');

    await client.makeBucket(name, 'us-east-1');
    return NextResponse.json({ success: true, message: `Đã tạo bucket "${name}"` });
  } catch (err: any) {
    return deny(err?.message || 'Lỗi tạo bucket', 500);
  }
}

// ── DELETE /api/admin/storage/buckets?name=xxx ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('name') || '';
  if (!name) return deny('Thiếu tên bucket');

  try {
    const { client } = await getClient();
    const exists = await client.bucketExists(name);
    if (!exists) return deny('Bucket không tồn tại', 404);

    // Xóa tất cả objects trước khi xóa bucket
    const keys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = client.listObjectsV2(name, '', true);
      stream.on('data', obj => { if (obj.name) keys.push(obj.name); });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (keys.length > 0) {
      await client.removeObjects(name, keys);
    }

    await client.removeBucket(name);
    return NextResponse.json({ success: true, message: `Đã xóa bucket "${name}"` });
  } catch (err: any) {
    return deny(err?.message || 'Lỗi xóa bucket', 500);
  }
}
