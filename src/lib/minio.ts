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

/** Đọc cấu hình MinIO từ DB (CaiDat), fallback env vars. Cache 30s. */
export async function getMinioConfig(): Promise<MinioConfig> {
  if (_dbConfig && Date.now() < _cacheExpiry) return _dbConfig;

  const env = getEnvConfig();
  try {
    const { default: prisma } = await import('./prisma');
    const settings = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
    const get = (key: string) => settings.find((s) => s.khoa === key)?.giaTri ?? '';

    _dbConfig = {
      endpoint: get('minio_endpoint') || env.endpoint,
      port: env.port,
      useSSL: env.useSSL,
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
