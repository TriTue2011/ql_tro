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

/** Chuẩn hóa 1 segment của đường dẫn folder: bỏ dấu, lowercase, chỉ giữ a-z0-9_- */
function slugifySegment(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Chuẩn hóa toàn bộ folder path: toa/thang/phong → an toàn cho filesystem & object storage */
export function buildFolderPath(folder: string): string {
  return folder
    .split('/')
    .map(s => slugifySegment(s.trim()))
    .filter(Boolean)
    .slice(0, 5) // tối đa 5 cấp
    .join('/');
}

/**
 * Tạo folder path chuẩn cho upload: {toaNha}/{maPhong}/{MM.YYYY}
 * - Bỏ tầng, chỉ giữ tòa nhà + phòng
 * - Phân loại theo tháng.năm (vd: 03.2026)
 * - date mặc định = now
 */
export function buildUploadFolder(
  toaNha?: string,
  maPhong?: string,
  date?: Date,
): string | undefined {
  const d = date ?? new Date();
  const thangNam = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const parts = [toaNha, maPhong, thangNam].filter(Boolean);
  return parts.length > 0 ? parts.join('/') : undefined;
}

export async function uploadFile(file: File, folder?: string): Promise<UploadResult> {
  const config = await getStorageConfig();
  const normalizedFolder = folder ? buildFolderPath(folder) : undefined;

  switch (config.provider) {
    case 'cloudinary':
      return uploadToCloudinary(file, config.cloudinary, normalizedFolder);
    case 'minio':
      return uploadToMinio(file, normalizedFolder);
    case 'both':
      return uploadToBoth(file, config.cloudinary, normalizedFolder);
    default:
      return uploadToLocal(file, normalizedFolder);
  }
}

// ─── Both (MinIO primary + Cloudinary secondary) ─────────────────────────────
async function uploadToBoth(file: File, cloudinaryConfig: CloudinaryConfig, folder?: string): Promise<UploadResult> {
  const result = await uploadToMinio(file, folder);

  uploadToCloudinary(file, cloudinaryConfig, folder).catch((err: Error) => {
    console.error('[DualStorage] Cloudinary backup failed:', err.message);
  });

  return result;
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────
async function uploadToCloudinary(file: File, config: CloudinaryConfig, folder?: string): Promise<UploadResult> {
  const { cloudName, uploadPreset } = config;

  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu cấu hình Cloudinary (cloud name, upload preset)');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (folder) formData.append('folder', folder);

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
async function uploadToMinio(file: File, folder?: string): Promise<UploadResult> {
  const { getMinioConfig, createMinioClient, ensureBucketExists } = await import('./minio');
  const { randomBytes } = await import('crypto');
  const { extname } = await import('path');

  const config = await getMinioConfig();
  const client = createMinioClient(config);
  await ensureBucketExists(client, config.bucket);

  const ext = extname(file.name) || '.jpg';
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  const objectName = folder ? `${folder}/${filename}` : filename;

  const buffer = Buffer.from(await file.arrayBuffer());
  await client.putObject(config.bucket, objectName, buffer, buffer.length, {
    'Content-Type': file.type,
  });

  return {
    public_id: `${config.bucket}/${objectName}`,
    secure_url: `/api/files/${config.bucket}/${objectName}`,
  };
}

// ─── Local filesystem ─────────────────────────────────────────────────────────
async function uploadToLocal(file: File, folder?: string): Promise<UploadResult> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { join, extname } = await import('path');
  const { randomBytes } = await import('crypto');

  const uploadDir = folder
    ? join(process.cwd(), 'public', 'uploads', folder)
    : join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const ext = extname(file.name) || '.jpg';
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  const filePath = join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const relativePath = folder ? `uploads/${folder}/${filename}` : `uploads/${filename}`;
  return {
    public_id: relativePath,
    secure_url: `/${relativePath}`,
  };
}
