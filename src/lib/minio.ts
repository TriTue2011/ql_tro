import { Client } from 'minio';

const globalForMinio = globalThis as unknown as {
  minioClient: Client | undefined;
};

export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'ql-tro';

function createMinioClient(): Client {
  return new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });
}

export function getMinioClient(): Client {
  if (!globalForMinio.minioClient) {
    globalForMinio.minioClient = createMinioClient();
  }
  return globalForMinio.minioClient;
}

export async function ensureBucket(): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await client.makeBucket(MINIO_BUCKET, 'us-east-1');
  }
}
