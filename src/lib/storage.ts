/**
 * Storage abstraction - tự động chọn provider dựa trên STORAGE_PROVIDER:
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

export async function uploadFile(file: File): Promise<UploadResult> {
  const provider = process.env.STORAGE_PROVIDER || 'local';

  switch (provider) {
    case 'cloudinary':
      return uploadToCloudinary(file);
    case 'minio':
      return uploadToMinio(file);
    case 'both':
      return uploadToBoth(file);
    default:
      return uploadToLocal(file);
  }
}

// ─── Both (MinIO primary + Cloudinary secondary) ─────────────────────────────
async function uploadToBoth(file: File): Promise<UploadResult> {
  // Upload lên MinIO trước (primary/offline), chờ kết quả
  const result = await uploadToMinio(file);

  // Upload lên Cloudinary sau (secondary/online), fire-and-forget
  uploadToCloudinary(file).catch((err: Error) => {
    console.error('[DualStorage] Cloudinary backup failed:', err.message);
  });

  return result;
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────
async function uploadToCloudinary(file: File): Promise<UploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu cấu hình Cloudinary (NEXT_PUBLIC_CLOUD_NAME, NEXT_PUBLIC_UPLOAD_PRESET)');
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
  const { getMinioClient, ensureBucket, MINIO_BUCKET } = await import('./minio');
  const { randomBytes } = await import('crypto');
  const { extname } = await import('path');

  const client = getMinioClient();
  await ensureBucket();

  const ext = extname(file.name) || '.jpg';
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await client.putObject(MINIO_BUCKET, filename, buffer, buffer.length, {
    'Content-Type': file.type,
  });

  // URL đi qua Next.js proxy → tương thích với Cloudflare Tunnel
  return {
    public_id: `${MINIO_BUCKET}/${filename}`,
    secure_url: `/api/files/${MINIO_BUCKET}/${filename}`,
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
