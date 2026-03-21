/**
 * /api/admin/storage/objects
 * Admin only (enforced by middleware).
 *
 * GET    ?bucket=xxx&prefix=xxx  → list objects + virtual folders at this level
 * POST   multipart/form-data { file, bucket, prefix } → upload file
 * DELETE { bucket, key }  → delete single object
 *        { bucket, prefix, isFolder: true } → delete all objects with prefix
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMinioConfig, createMinioClient } from '@/lib/minio';

async function getClient() {
  const config = await getMinioConfig();
  return { client: createMinioClient(config) };
}

function deny(msg: string, status = 400) {
  return NextResponse.json({ success: false, message: msg }, { status });
}

// ── GET ─────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get('bucket') || '';
  const prefix = searchParams.get('prefix') || '';

  if (!bucket) return deny('Thiếu tên bucket');

  try {
    const { client } = await getClient();

    const folders: string[] = [];
    const files: { name: string; size: number; lastModified: Date }[] = [];

    await new Promise<void>((resolve, reject) => {
      // recursive=false → returns virtual folder prefixes
      const stream = client.listObjectsV2(bucket, prefix, false);
      stream.on('data', (obj: any) => {
        if (obj.prefix) {
          // Virtual folder
          folders.push(obj.prefix as string);
        } else if (obj.name) {
          // Skip the "folder placeholder" object itself (ends with /)
          if (!obj.name.endsWith('/')) {
            files.push({ name: obj.name, size: obj.size ?? 0, lastModified: obj.lastModified ?? new Date() });
          }
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Generate presigned URLs for files (1 hour)
    const filesWithUrls = await Promise.all(
      files.map(async f => {
        try {
          const url = await client.presignedGetObject(bucket, f.name, 3600);
          return { ...f, url };
        } catch {
          return { ...f, url: '' };
        }
      })
    );

    return NextResponse.json({ success: true, folders, files: filesWithUrls });
  } catch (err: any) {
    return deny(err?.message || 'Lỗi liệt kê objects', 500);
  }
}

// ── POST (upload) ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string || '').trim();
    const prefix = (formData.get('prefix') as string || '').trim();
    const folderName = (formData.get('folderName') as string || '').trim();

    if (!bucket) return deny('Thiếu tên bucket');

    const { client } = await getClient();

    // ── Tạo folder (object rỗng kết thúc bằng /) ─────────────────────────────
    if (folderName) {
      const safeName = folderName.replace(/[/\\]/g, '').trim();
      if (!safeName) return deny('Tên folder không hợp lệ');
      const key = prefix ? `${prefix}${safeName}/` : `${safeName}/`;
      const emptyBuffer = Buffer.alloc(0);
      await client.putObject(bucket, key, emptyBuffer, 0, { 'Content-Type': 'application/x-directory' });
      return NextResponse.json({ success: true, message: `Đã tạo folder "${safeName}"`, key });
    }

    // ── Upload file ────────────────────────────────────────────────────────────
    if (!file) return deny('Thiếu file');
    if (file.size > 100 * 1024 * 1024) return deny('File không được quá 100MB');

    const fileName = file.name.replace(/[^\w.\-]/g, '_');
    const key = prefix ? `${prefix}${fileName}` : fileName;

    const buffer = Buffer.from(await file.arrayBuffer());
    await client.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': file.type || 'application/octet-stream' });

    const url = await client.presignedGetObject(bucket, key, 3600);
    return NextResponse.json({ success: true, message: `Đã upload "${fileName}"`, key, url });
  } catch (err: any) {
    return deny(err?.message || 'Lỗi upload file', 500);
  }
}

// ── DELETE ──────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const bucket: string = body.bucket || '';
    const key: string = body.key || '';
    const prefix: string = body.prefix || '';
    const isFolder: boolean = body.isFolder === true;

    if (!bucket) return deny('Thiếu tên bucket');

    const { client } = await getClient();

    if (isFolder && prefix) {
      // Xóa tất cả objects có prefix này (kể cả object folder placeholder)
      const keys: string[] = [];
      await new Promise<void>((resolve, reject) => {
        const stream = client.listObjectsV2(bucket, prefix, true);
        stream.on('data', obj => { if (obj.name) keys.push(obj.name); });
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      if (keys.length > 0) {
        await client.removeObjects(bucket, keys);
      }
      return NextResponse.json({ success: true, message: `Đã xóa folder và ${keys.length} file` });
    }

    if (key) {
      await client.removeObject(bucket, key);
      return NextResponse.json({ success: true, message: `Đã xóa "${key}"` });
    }

    return deny('Thiếu key hoặc prefix để xóa');
  } catch (err: any) {
    return deny(err?.message || 'Lỗi xóa object', 500);
  }
}
