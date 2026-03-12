import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

/**
 * Kiểm tra magic bytes thực tế của file để chặn backdoor upload.
 * Hacker thường đổi Content-Type thành image/jpeg nhưng file thực là PHP/JS/shell.
 * Magic bytes không thể giả mạo vì đọc trực tiếp từ nội dung file.
 */
async function validateImageMagicBytes(file: File): Promise<boolean> {
  // Chỉ đọc 12 byte đầu tiên để kiểm tra
  const slice = file.slice(0, 12);
  const buf = Buffer.from(await slice.arrayBuffer());

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF87a / GIF89a: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4D) return true;
  // AVIF/HEIC: ftyp box tại offset 4
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;

  return false;
}

/** Danh sách extension được phép — chặn .php, .js, .sh, .exe, .svg (có thể chứa XSS) */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic']);

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { message: 'Không có file được chọn' },
        { status: 400 }
      );
    }

    // 1. Kiểm tra MIME type (lớp đầu tiên)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { message: 'Chỉ được upload file ảnh' },
        { status: 400 }
      );
    }

    // 2. Kiểm tra extension tên file (chặn .php, .js, .sh...)
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { message: 'Định dạng file không được phép' },
        { status: 400 }
      );
    }

    // 3. Kiểm tra magic bytes thực tế — không thể giả mạo
    const isRealImage = await validateImageMagicBytes(file);
    if (!isRealImage) {
      return NextResponse.json(
        { message: 'File không phải ảnh hợp lệ' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { message: 'Kích thước file không được vượt quá 10MB' },
        { status: 400 }
      );
    }

    // Tự động chọn provider: cloudinary | minio | local (theo STORAGE_PROVIDER)
    const result = await uploadFile(file);

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
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'Có lỗi xảy ra khi upload file' },
      { status: 500 }
    );
  }
}
