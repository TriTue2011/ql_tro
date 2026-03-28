/**
 * POST /api/admin/storage/test-send
 * Chẩn đoán lỗi gửi file qua Zalo trực tiếp.
 * Body: { url: string, chatId?: string, dryRun?: boolean }
 *
 * dryRun=true (mặc định): chỉ test download, không gửi thật
 * dryRun=false + chatId: test download VÀ gửi thật qua Zalo
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { url, chatId, dryRun = true } = body;
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const steps: { step: string; ok: boolean; detail: any; ms: number }[] = [];
  const t = () => Date.now();

  // ─── Step 1: Parse URL ───
  let start = t();
  const ext = path.extname(new URL(url, 'http://x').pathname).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'].includes(ext);
  steps.push({
    step: '1. Parse URL',
    ok: true,
    detail: {
      url: url.slice(0, 200),
      extension: ext || '(không có)',
      isImage,
      startsWithHttp: url.startsWith('http://') || url.startsWith('https://'),
      startsWithApiFiles: url.startsWith('/api/files/'),
      startsWithUploads: url.startsWith('/uploads/'),
      hasAmzCredential: url.includes('X-Amz-Credential'),
    },
    ms: t() - start,
  });

  // ─── Step 2: MinIO Config ───
  start = t();
  try {
    const { getMinioConfig } = await import('@/lib/minio');
    const config = await getMinioConfig();
    steps.push({
      step: '2. MinIO Config',
      ok: true,
      detail: {
        endpoint: config.endpoint,
        port: config.port,
        bucket: config.bucket,
        hasAccessKey: !!config.accessKey,
        hasSecretKey: !!config.secretKey,
      },
      ms: t() - start,
    });
  } catch (e: any) {
    steps.push({ step: '2. MinIO Config', ok: false, detail: e.message, ms: t() - start });
  }

  // ─── Step 3: resolveMinioToBuffer ───
  start = t();
  let buffer: Buffer | null = null;
  try {
    // Import helpers trực tiếp
    const { saveImage, saveFileFromUrl } = await import('@/lib/zalo-direct/helpers');

    // Test fetchBuffer logic manually
    const parsed = new URL(url, 'http://x');

    // Try /uploads/ local path
    if (parsed.pathname.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', parsed.pathname);
      const exists = fs.existsSync(localPath);
      steps.push({
        step: '3a. Local uploads check',
        ok: exists,
        detail: { localPath, exists },
        ms: t() - start,
      });
      if (exists) {
        buffer = fs.readFileSync(localPath);
      }
    }

    // Try /api/files/ → MinIO client
    if (!buffer && parsed.pathname.startsWith('/api/files/')) {
      try {
        const { getMinioConfig, createMinioClient } = await import('@/lib/minio');
        const config = await getMinioConfig();
        const client = createMinioClient(config);
        const parts = parsed.pathname.replace('/api/files/', '').split('/');
        const bucket = parts[0];
        const objectName = decodeURIComponent(parts.slice(1).join('/'));
        steps.push({
          step: '3a. MinIO path parsing',
          ok: true,
          detail: { bucket, objectName },
          ms: t() - start,
        });

        const chunks: Buffer[] = [];
        const stream = await client.getObject(bucket, objectName);
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        buffer = Buffer.concat(chunks);
        steps.push({
          step: '3b. MinIO client download',
          ok: true,
          detail: { size: buffer.length, magic: buffer.slice(0, 4).toString('hex') },
          ms: t() - start,
        });
      } catch (e: any) {
        steps.push({ step: '3b. MinIO client download', ok: false, detail: e.message, ms: t() - start });
      }
    }

    // Try presigned URL → HTTP fetch
    if (!buffer && parsed.searchParams.has('X-Amz-Credential')) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          buffer = Buffer.from(await res.arrayBuffer());
          steps.push({
            step: '3b. Presigned HTTP fetch',
            ok: true,
            detail: { size: buffer.length, contentType: res.headers.get('content-type') },
            ms: t() - start,
          });
        } else {
          steps.push({ step: '3b. Presigned HTTP fetch', ok: false, detail: { status: res.status }, ms: t() - start });
        }
      } catch (e: any) {
        steps.push({ step: '3b. Presigned HTTP fetch', ok: false, detail: e.message, ms: t() - start });
      }
    }

    // Try regular HTTP fetch
    if (!buffer && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          buffer = Buffer.from(await res.arrayBuffer());
          steps.push({
            step: '3b. HTTP fetch',
            ok: true,
            detail: { size: buffer.length, contentType: res.headers.get('content-type') },
            ms: t() - start,
          });
        } else {
          steps.push({ step: '3b. HTTP fetch', ok: false, detail: { status: res.status }, ms: t() - start });
        }
      } catch (e: any) {
        steps.push({ step: '3b. HTTP fetch', ok: false, detail: e.message, ms: t() - start });
      }
    }

    if (!buffer) {
      steps.push({ step: '3. Download file', ok: false, detail: 'Không tải được file bằng bất kỳ phương thức nào', ms: t() - start });
    }
  } catch (e: any) {
    steps.push({ step: '3. Download file', ok: false, detail: e.message, ms: t() - start });
  }

  // ─── Step 4: Save to temp file ───
  let tempPath: string | null = null;
  if (buffer) {
    start = t();
    try {
      const tmpDir = path.join(process.cwd(), 'tmp', 'zalo');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const filename = `test_${Date.now()}${ext || '.bin'}`;
      tempPath = path.join(tmpDir, filename);
      fs.writeFileSync(tempPath, buffer);

      // Detect file type from magic bytes
      let detectedType = 'unknown';
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) detectedType = 'JPEG';
      else if (buffer[0] === 0x89 && buffer[1] === 0x50) detectedType = 'PNG';
      else if (buffer[0] === 0x47 && buffer[1] === 0x49) detectedType = 'GIF';
      else if (buffer[0] === 0x52 && buffer[1] === 0x49) detectedType = 'RIFF/WebP';
      else if (buffer[0] === 0x25 && buffer[1] === 0x50) detectedType = 'PDF';
      else if (buffer[0] === 0x50 && buffer[1] === 0x4B) detectedType = 'ZIP/DOCX/XLSX';

      steps.push({
        step: '4. Save temp file',
        ok: true,
        detail: {
          path: tempPath,
          size: buffer.length,
          extension: ext,
          detectedType,
          magic: buffer.slice(0, 8).toString('hex'),
        },
        ms: t() - start,
      });
    } catch (e: any) {
      steps.push({ step: '4. Save temp file', ok: false, detail: e.message, ms: t() - start });
    }
  }

  // ─── Step 5: Test send (only if dryRun=false and chatId provided) ───
  if (!dryRun && chatId && tempPath) {
    start = t();
    try {
      const { sendImage, sendFile } = await import('@/lib/zalo-direct/service');
      let result;
      if (isImage) {
        result = await sendImage(chatId, url, '', 0, 0);
      } else {
        result = await sendFile(chatId, url, '', 0, 0);
      }
      steps.push({
        step: '5. Gửi qua Zalo',
        ok: result.ok,
        detail: result,
        ms: t() - start,
      });
    } catch (e: any) {
      steps.push({ step: '5. Gửi qua Zalo', ok: false, detail: e.message, ms: t() - start });
    }
  } else if (!dryRun && !chatId) {
    steps.push({ step: '5. Gửi qua Zalo', ok: false, detail: 'Cần chatId để gửi thật', ms: 0 });
  } else {
    steps.push({ step: '5. Gửi qua Zalo', ok: true, detail: 'Bỏ qua (dryRun=true). Thêm dryRun:false và chatId để test gửi thật', ms: 0 });
  }

  // Cleanup temp file
  if (tempPath && fs.existsSync(tempPath)) {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  }

  const allOk = steps.every(s => s.ok);

  return NextResponse.json({
    success: allOk,
    summary: allOk ? 'Tất cả bước OK' : `Lỗi ở: ${steps.filter(s => !s.ok).map(s => s.step).join(', ')}`,
    steps,
  });
}
