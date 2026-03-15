/**
 * Storage abstraction - tự động chọn provider từ DB (CaiDat) với fallback env vars:
 *   cloudinary  → Cloudinary (online)
 *   minio       → MinIO Docker (offline, phục vụ qua /api/files/)
 *   local       → public/uploads/ (mặc định nếu không set)
 *   both        → Upload lên MinIO (primary/offline) + Cloudinary (secondary/online, fire-and-forget)
 *                 Trả về URL MinIO để dùng offline, Cloudinary backup chạy nền
 */

export type UploadResult = {
  public_id: string;
  secure_url: string;
};

interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

interface StorageConfig {
  provider: string;
  cloudinary: CloudinaryConfig;
}

// ─── DB config cache (30s TTL) ────────────────────────────────────────────────
let _storageConfig: StorageConfig | null = null;
let _cacheExpiry = 0;

async function getStorageConfig(): Promise<StorageConfig> {
  if (_storageConfig && Date.now() < _cacheExpiry) return _storageConfig;

  const envConfig: StorageConfig = {
    provider: process.env.STORAGE_PROVIDER || 'local',
    cloudinary: {
      cloudName: process.env.NEXT_PUBLIC_CLOUD_NAME || '',
      uploadPreset: process.env.NEXT_PUBLIC_UPLOAD_PRESET || '',
    },
  };

  try {
    const { default: prisma } = await import('./prisma');
    const settings = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
    const get = (key: string) => settings.find((s) => s.khoa === key)?.giaTri ?? '';

    _storageConfig = {
      provider: get('storage_provider') || envConfig.provider,
      cloudinary: {
        cloudName: get('cloudinary_cloud_name') || envConfig.cloudinary.cloudName,
        uploadPreset: get('cloudinary_upload_preset') || envConfig.cloudinary.uploadPreset,
      },
    };
    _cacheExpiry = Date.now() + 30_000;
  } catch {
    _storageConfig = envConfig;
    _cacheExpiry = Date.now() + 5_000;
  }

  return _storageConfig!;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const config = await getStorageConfig();

  switch (config.provider) {
    case 'cloudinary':
      return uploadToCloudinary(file, config.cloudinary);
    case 'minio':
      return uploadToMinio(file);
    case 'both':
      return uploadToBoth(file, config.cloudinary);
    default:
      return uploadToLocal(file);
  }
}

// ─── Both (MinIO primary + Cloudinary secondary) ─────────────────────────────
async function uploadToBoth(file: File, cloudinaryConfig: CloudinaryConfig): Promise<UploadResult> {
  const result = await uploadToMinio(file);

  uploadToCloudinary(file, cloudinaryConfig).catch((err: Error) => {
    console.error('[DualStorage] Cloudinary backup failed:', err.message);
  });

  return result;
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────
async function uploadToCloudinary(file: File, config: CloudinaryConfig): Promise<UploadResult> {
  const { cloudName, uploadPreset } = config;

  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu cấu hình Cloudinary (cloud name, upload preset)');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Lỗi khi upload lên Cloudinary');

  const result = await response.json();
  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
  };
}

// ─── MinIO ────────────────────────────────────────────────────────────────────
async function uploadToMinio(file: File): Promise<UploadResult> {
  const { getMinioConfig, createMinioClient, ensureBucketExists } = await import('./minio');
  const { randomBytes } = await import('crypto');
  const { extname } = await import('path');

  const config = await getMinioConfig();
  const client = createMinioClient(config);
  await ensureBucketExists(client, config.bucket);

  const ext = extname(file.name) || '.jpg';
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await client.putObject(config.bucket, filename, buffer, buffer.length, {
    'Content-Type': file.type,
  });

  return {
    public_id: `${config.bucket}/${filename}`,
    secure_url: `/api/files/${config.bucket}/${filename}`,
  };
}

// ─── Local filesystem ─────────────────────────────────────────────────────────
async function uploadToLocal(file: File): Promise<UploadResult> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { join, extname } = await import('path');
  const { randomBytes } = await import('crypto');

  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const ext = extname(file.name) || '.jpg';
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  const filePath = join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return {
    public_id: `uploads/${filename}`,
    secure_url: `/uploads/${filename}`,
  };
}
