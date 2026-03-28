/**
 * POST /api/admin/storage/test-download
 * Test tải file từ MinIO URL — debug lỗi gửi file Zalo
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const results: Record<string, unknown> = { url: url.slice(0, 200) };

  // 1. Check MinIO config
  try {
    const { getMinioConfig } = await import('@/lib/minio');
    const config = await getMinioConfig();
    results.minioConfig = {
      endpoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      bucket: config.bucket,
      hasAccessKey: !!config.accessKey,
      hasSecretKey: !!config.secretKey,
    };
  } catch (e: any) {
    results.minioConfigError = e.message;
  }

  // 2. Parse URL
  try {
    const parsed = new URL(url, 'http://x');
    results.parsedUrl = {
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      hasAmzCredential: parsed.searchParams.has('X-Amz-Credential'),
    };
  } catch (e: any) {
    results.urlParseError = e.message;
  }

  // 3. Try HTTP fetch (presigned URL is self-authenticating)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    results.httpFetch = {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
    };
    if (res.ok) {
      const buf = await res.arrayBuffer();
      results.httpFetch = { ...results.httpFetch as any, size: buf.byteLength };
    }
  } catch (e: any) {
    results.httpFetchError = e.message;
  }

  // 4. Try MinIO client
  try {
    const { getMinioConfig, createMinioClient } = await import('@/lib/minio');
    const config = await getMinioConfig();
    const client = createMinioClient(config);
    const parsed = new URL(url, 'http://x');
    const pathParts = parsed.pathname.replace(/^\//, '').split('/');
    if (pathParts.length >= 2) {
      const bucket = pathParts[0];
      const objectName = decodeURIComponent(pathParts.slice(1).join('/'));
      results.minioClientAttempt = { bucket, objectName };
      const chunks: Buffer[] = [];
      const stream = await client.getObject(bucket, objectName);
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const total = Buffer.concat(chunks);
      results.minioClient = { ok: true, size: total.byteLength };
    }
  } catch (e: any) {
    results.minioClientError = e.message;
  }

  return NextResponse.json({ success: true, results });
}
