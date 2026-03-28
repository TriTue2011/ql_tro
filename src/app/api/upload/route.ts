import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { uploadFile } from '@/lib/storage';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

/** Danh sách extension được phép — chặn .php, .js, .sh, .exe, .svg (có thể chứa XSS) */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic']);
/** Extension cho phép khi upload file (không phải ảnh) */
const ALLOWED_FILE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.zip', '.rar']);

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

/**
 * Kiểm tra magic bytes thực tế từ buffer đã đọc sẵn.
 * Không đọc lại file lần thứ hai để tránh lỗi stream.
 */
function validateMagicBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF87a / GIF89a: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4D) return true;
  // AVIF/HEIC: ftyp box tại offset 4
  if (buf.length >= 8 &&
      buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;
  return false;
}

/** Làm sạch tên file: bỏ ký tự đặc biệt, giữ tên gốc đọc được */
function sanitizeFilename(name: string): string {
  // Lấy tên file (bỏ path)
  const base = name.split(/[/\\]/).pop() || name;
  // Thay ký tự không an toàn bằng dấu gạch ngang, giữ tiếng Việt + unicode
  return base
    .replace(/[<>:"|?*\x00-\x1f]/g, '-')  // ký tự không hợp lệ trong filename
    .replace(/\s+/g, '_')                   // space → underscore
    .replace(/-{2,}/g, '-')                 // nhiều dấu - liên tiếp
    .slice(0, 200);                          // giới hạn độ dài
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: NextRequest) {
  try {
    // Xác thực: ưu tiên NextAuth JWT (tương thích Next.js 15)
    const nextAuthToken = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, cookieName: 'next-auth.session-token' });
    let authorized = !!nextAuthToken;

    // Fallback: custom Bearer JWT
    if (!authorized) {
      try {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
          authorized = !!decoded?.id;
        }
      } catch { /* token lỗi → không authorized */ }
    }

    if (!authorized) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderRaw = formData.get('folder') as string | null;
    const folder = folderRaw?.slice(0, 200).replace(/\.\./g, '') || undefined;
    const uploadType = (formData.get('type') as string | null) || 'image'; // 'image' | 'file'

    if (!file) {
      return NextResponse.json({ message: 'Không có file được chọn' }, { status: 400 });
    }

    const ext = getExtension(file.name);
    const isFileMode = uploadType === 'file';

    if (isFileMode) {
      // Chế độ file: cho phép PDF, DOC, XLS, v.v.
      if (!ALLOWED_FILE_EXTENSIONS.has(ext) && !ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json({ message: 'Định dạng file không được phép' }, { status: 400 });
      }
    } else {
      // Chế độ ảnh: chỉ cho phép image/*
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ message: 'Chỉ được upload file ảnh' }, { status: 400 });
      }
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json({ message: 'Định dạng file không được phép' }, { status: 400 });
      }
    }

    // Đọc file vào Buffer một lần duy nhất
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Kiểm tra kích thước
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'Kích thước file không được vượt quá 5MB' }, { status: 400 });
    }

    // Kiểm tra magic bytes (chỉ cho ảnh)
    if (!isFileMode && !validateMagicBytes(buffer)) {
      return NextResponse.json({ message: 'File không phải ảnh hợp lệ' }, { status: 400 });
    }

    // Upload (truyền buffer để storage layer không cần đọc lại)
    const result = await uploadFileFromBuffer(buffer, file.name, file.type, folder);

    return NextResponse.json({
      success: true,
      data: {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: 0,
        height: 0,
      },
      message: 'Upload ảnh thành công',
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[UPLOAD] Error:', msg);
    return NextResponse.json(
      { message: `Có lỗi xảy ra khi upload file: ${msg}` },
      { status: 500 }
    );
  }
}

/** Upload từ buffer đã đọc sẵn — không cần đọc lại File object */
async function uploadFileFromBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder?: string,
): Promise<{ public_id: string; secure_url: string }> {
  // Lấy storage config
  const { buildFolderPath } = await import('@/lib/storage');
  const normalizedFolder = folder ? buildFolderPath(folder) : undefined;

  // Lấy provider từ DB / env
  const provider = await getProvider();

  if (provider === 'cloudinary') {
    return uploadBufferToCloudinary(buffer, originalName, mimeType, normalizedFolder);
  }
  if (provider === 'minio' || provider === 'both') {
    return uploadBufferToMinio(buffer, originalName, mimeType, normalizedFolder);
  }
  return uploadBufferToLocal(buffer, originalName, normalizedFolder);
}

async function getProvider(): Promise<string> {
  const envProvider = process.env.STORAGE_PROVIDER || 'local';
  try {
    const { default: prisma } = await import('@/lib/prisma');
    const settings = await prisma.caiDat.findMany({ where: { nhom: 'luuTru' } });
    const get = (key: string) => settings.find(s => s.khoa === key)?.giaTri ?? '';
    return get('storage_provider') || envProvider;
  } catch {
    return envProvider;
  }
}

async function uploadBufferToLocal(buffer: Buffer, originalName: string, folder?: string) {
  const { writeFile, mkdir } = await import('fs/promises');
  const { join, extname, basename } = await import('path');
  const { randomBytes } = await import('crypto');

  const uploadDir = folder
    ? join(process.cwd(), 'public', 'uploads', folder)
    : join(process.cwd(), 'public', 'uploads');

  await mkdir(uploadDir, { recursive: true });

  // Giữ tên gốc, thêm prefix timestamp để tránh trùng
  const safeName = sanitizeFilename(originalName);
  const filename = `${Date.now()}-${safeName}`;
  const filePath = join(uploadDir, filename);

  await writeFile(filePath, buffer);

  const relativePath = folder ? `uploads/${folder}/${filename}` : `uploads/${filename}`;
  return { public_id: relativePath, secure_url: `/${relativePath}` };
}

async function uploadBufferToMinio(buffer: Buffer, originalName: string, mimeType: string, folder?: string) {
  const { getMinioConfig, createMinioClient, ensureBucketExists } = await import('@/lib/minio');

  const config = await getMinioConfig();
  const client = createMinioClient(config);
  await ensureBucketExists(client, config.bucket);

  // Giữ tên gốc, thêm prefix timestamp để tránh trùng
  const safeName = sanitizeFilename(originalName);
  const filename = `${Date.now()}-${safeName}`;
  const objectName = folder ? `${folder}/${filename}` : filename;

  await client.putObject(config.bucket, objectName, buffer, buffer.length, { 'Content-Type': mimeType });

  return {
    public_id: `${config.bucket}/${objectName}`,
    secure_url: `/api/files/${config.bucket}/${objectName}`,
  };
}

async function uploadBufferToCloudinary(buffer: Buffer, originalName: string, mimeType: string, folder?: string) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUD_NAME || '';
  const uploadPreset = process.env.NEXT_PUBLIC_UPLOAD_PRESET || '';

  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu cấu hình Cloudinary');
  }

  const blob = new Blob([buffer], { type: mimeType });
  const fd = new FormData();
  fd.append('file', blob, originalName);
  fd.append('upload_preset', uploadPreset);
  if (folder) fd.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST', body: fd,
  });
  if (!res.ok) throw new Error('Lỗi khi upload lên Cloudinary');

  const result = await res.json();
  return { public_id: result.public_id, secure_url: result.secure_url };
}
