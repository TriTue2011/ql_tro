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

/** Đọc cấu hình MinIO từ DB (CaiDat), fallback CaiDatToaNha, fallback env vars. Cache 30s. */
export async function getMinioConfig(toaNhaId?: string): Promise<MinioConfig> {
  // Nếu có toaNhaId, không dùng cache global vì mỗi tòa nhà có config riêng
  if (!toaNhaId && _dbConfig && Date.now() < _cacheExpiry) return _dbConfig;

  const env = getEnvConfig();
  try {
    const { default: prisma } = await import('./prisma');

    let endpointRaw = '';
    let accessKey = '';
    let secretKey = '';
    let bucket = '';

    // 1. Ưu tiên đọc từ CaiDatToaNha nếu có toaNhaId
    if (toaNhaId) {
      const toaNhaConfig = await prisma.caiDatToaNha.findUnique({
        where: { toaNhaId },
      });
      if (toaNhaConfig && toaNhaConfig.minioEndpoint) {
        endpointRaw = toaNhaConfig.minioEndpoint;
        accessKey = toaNhaConfig.minioAccessKey || '';
        secretKey = toaNhaConfig.minioSecretKey || '';
        bucket = toaNhaConfig.minioBucket || '';
      }
    }

    // 2. Nếu không có toaNhaId hoặc tòa nhà không có config riêng → đọc từ global CaiDat
    if (!endpointRaw) {
      const settings = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
      const get = (key: string) => settings.find((s) => s.khoa === key)?.giaTri ?? '';
      
      endpointRaw = get('minio_endpoint');
      accessKey = get('minio_access_key');
      secretKey = get('minio_secret_key');
      bucket = get('minio_bucket');
    }

    // 3. Nếu vẫn không có config → fallback tìm tòa nhà đầu tiên có config (legacy behavior)
    if (!endpointRaw) {
      const toaNhaConfig = await prisma.caiDatToaNha.findFirst({
        where: { storageProvider: { in: ['minio', 'both'] }, minioEndpoint: { not: '' } },
      });
      if (toaNhaConfig?.minioEndpoint) {
        endpointRaw = toaNhaConfig.minioEndpoint;
        accessKey = toaNhaConfig.minioAccessKey || '';
        secretKey = toaNhaConfig.minioSecretKey || '';
        bucket = toaNhaConfig.minioBucket || '';
      }
    }

    const { endpoint, port, useSSL } = endpointRaw
      ? parseEndpoint(endpointRaw, env.port, env.useSSL)
      : { endpoint: env.endpoint, port: env.port, useSSL: env.useSSL };

    const config: MinioConfig = {
      endpoint,
      port,
      useSSL,
      accessKey: accessKey || env.accessKey,
      secretKey: secretKey || env.secretKey,
      bucket: bucket || env.bucket,
    };

    if (!toaNhaId) {
      _dbConfig = config;
      _cacheExpiry = Date.now() + 30_000;
    }
    return config;
  } catch {
    const config = env;
    if (!toaNhaId) {
      _dbConfig = config;
      _cacheExpiry = Date.now() + 5_000;
    }
    return config;
  }
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
