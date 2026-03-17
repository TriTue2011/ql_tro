import { Client } from 'minio';

export interface MinioConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

// ─── DB config cache (30s TTL) ────────────────────────────────────────────────
let _dbConfig: MinioConfig | null = null;
let _cacheExpiry = 0;

function getEnvConfig(): MinioConfig {
  return {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'ql-tro',
  };
}

/** Parse endpoint URL → tách hostname, port, useSSL
 *  Nhận cả 2 dạng: "localhost" hoặc "http://localhost:9000"
 */
function parseEndpoint(raw: string, fallbackPort: number, fallbackSSL: boolean): { endpoint: string; port: number; useSSL: boolean } {
  const s = raw.trim();
  if (!s) return { endpoint: 'localhost', port: fallbackPort, useSSL: fallbackSSL };

  // Nếu có protocol (http:// hoặc https://) → parse như URL
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const url = new URL(s);
      return {
        endpoint: url.hostname,
        port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
        useSSL: url.protocol === 'https:',
      };
    } catch {
      // URL không hợp lệ, fallback
    }
  }

  // Dạng "hostname:port" hoặc chỉ "hostname"
  const colonIdx = s.lastIndexOf(':');
  if (colonIdx > 0) {
    const host = s.slice(0, colonIdx);
    const port = parseInt(s.slice(colonIdx + 1));
    return { endpoint: host, port: isNaN(port) ? fallbackPort : port, useSSL: fallbackSSL };
  }

  return { endpoint: s, port: fallbackPort, useSSL: fallbackSSL };
}

/** Đọc cấu hình MinIO từ DB (CaiDat), fallback env vars. Cache 30s. */
export async function getMinioConfig(): Promise<MinioConfig> {
  if (_dbConfig && Date.now() < _cacheExpiry) return _dbConfig;

  const env = getEnvConfig();
  try {
    const { default: prisma } = await import('./prisma');
    const settings = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
    const get = (key: string) => settings.find((s) => s.khoa === key)?.giaTri ?? '';

    const endpointRaw = get('minio_endpoint');
    const { endpoint, port, useSSL } = endpointRaw
      ? parseEndpoint(endpointRaw, env.port, env.useSSL)
      : { endpoint: env.endpoint, port: env.port, useSSL: env.useSSL };

    _dbConfig = {
      endpoint,
      port,
      useSSL,
      accessKey: get('minio_access_key') || env.accessKey,
      secretKey: get('minio_secret_key') || env.secretKey,
      bucket: get('minio_bucket') || env.bucket,
    };
    _cacheExpiry = Date.now() + 30_000;
  } catch {
    _dbConfig = env;
    _cacheExpiry = Date.now() + 5_000;
  }

  return _dbConfig!;
}

/** Tạo MinIO client từ config */
export function createMinioClient(config: MinioConfig): Client {
  return new Client({
    endPoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
}

/** Đảm bảo bucket tồn tại */
export async function ensureBucketExists(client: Client, bucket: string): Promise<void> {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');
  }
}

// ─── Legacy API (giữ tương thích với code cũ) ─────────────────────────────────
const globalForMinio = globalThis as unknown as { minioClient: Client | undefined };
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'ql-tro';

export function getMinioClient(): Client {
  if (!globalForMinio.minioClient) {
    globalForMinio.minioClient = createMinioClient(getEnvConfig());
  }
  return globalForMinio.minioClient;
}

export async function ensureBucket(): Promise<void> {
  await ensureBucketExists(getMinioClient(), MINIO_BUCKET);
}
