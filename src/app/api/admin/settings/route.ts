import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Vai trò được phép quản lý cài đặt hệ thống
const ALLOWED_ROLES = ['admin', 'chuNha'];

// Danh sách cài đặt mặc định — admin và chuNha đọc/ghi
const DEFAULT_SETTINGS = [
  // Lưu trữ
  { khoa: 'storage_provider', giaTri: 'local', moTa: 'Nhà cung cấp lưu trữ ảnh (local | minio | cloudinary)', nhom: 'luuTru', laBiMat: false },
  { khoa: 'cloudinary_cloud_name', giaTri: '', moTa: 'Cloudinary Cloud Name', nhom: 'luuTru', laBiMat: false },
  { khoa: 'cloudinary_api_key', giaTri: '', moTa: 'Cloudinary API Key', nhom: 'luuTru', laBiMat: false },
  { khoa: 'cloudinary_api_secret', giaTri: '', moTa: 'Cloudinary API Secret', nhom: 'luuTru', laBiMat: true },
  { khoa: 'cloudinary_upload_preset', giaTri: '', moTa: 'Cloudinary Upload Preset', nhom: 'luuTru', laBiMat: false },
  { khoa: 'minio_endpoint', giaTri: '', moTa: 'MinIO Endpoint URL', nhom: 'luuTru', laBiMat: false },
  { khoa: 'minio_access_key', giaTri: '', moTa: 'MinIO Username', nhom: 'luuTru', laBiMat: false },
  { khoa: 'minio_secret_key', giaTri: '', moTa: 'MinIO Password', nhom: 'luuTru', laBiMat: true },
  { khoa: 'minio_bucket', giaTri: 'ql-tro', moTa: 'MinIO Bucket Name', nhom: 'luuTru', laBiMat: false },
  { khoa: 'upload_max_size_mb', giaTri: '10', moTa: 'Kích thước tối đa file upload (MB)', nhom: 'luuTru', laBiMat: false },
  // Thông báo
  { khoa: 'zalo_access_token', giaTri: '', moTa: 'Zalo Bot Access Token', nhom: 'thongBao', laBiMat: true },
  { khoa: 'zalo_webhook_secret', giaTri: '', moTa: 'Zalo Webhook Secret Token', nhom: 'thongBao', laBiMat: true },
  { khoa: 'thong_bao_truoc_han_hop_dong', giaTri: '30', moTa: 'Cảnh báo trước khi hợp đồng hết hạn (ngày)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'thong_bao_qua_han_hoa_don', giaTri: '3', moTa: 'Cảnh báo hóa đơn quá hạn sau (ngày)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'zalo_tin_nhan_ho_tro', giaTri: 'Cảm ơn bạn đã nhắn tin!\nĐể được hỗ trợ, vui lòng liên hệ:\n📞 Hotline: \n📧 Email: \nChúng tôi sẽ phản hồi sớm nhất có thể.', moTa: 'Tin nhắn trả lời tự động khi khách thuê nhắn bất kỳ (dùng \\n để xuống dòng)', nhom: 'thongBao', laBiMat: false },
  // Hệ thống
  { khoa: 'ten_cong_ty', giaTri: 'Quản Lý Trọ', moTa: 'Tên công ty / nhà trọ', nhom: 'heThong', laBiMat: false },
  { khoa: 'email_lien_he', giaTri: '', moTa: 'Email liên hệ hiển thị trên hóa đơn', nhom: 'heThong', laBiMat: false },
  { khoa: 'sdt_lien_he', giaTri: '', moTa: 'Số điện thoại liên hệ', nhom: 'heThong', laBiMat: false },
  { khoa: 'dia_chi_cong_ty', giaTri: '', moTa: 'Địa chỉ công ty', nhom: 'heThong', laBiMat: false },
  { khoa: 'logo_url', giaTri: '', moTa: 'URL logo công ty', nhom: 'heThong', laBiMat: false },
  { khoa: 'tien_te', giaTri: 'VND', moTa: 'Đơn vị tiền tệ', nhom: 'heThong', laBiMat: false },
  // Bảo mật
  { khoa: 'session_max_age_days', giaTri: '30', moTa: 'Thời gian hết hạn phiên đăng nhập (ngày)', nhom: 'baoMat', laBiMat: false },
  { khoa: 'rate_limit_login', giaTri: '10', moTa: 'Số lần đăng nhập tối đa / phút', nhom: 'baoMat', laBiMat: false },
  { khoa: 'cloudflare_tunnel', giaTri: 'false', moTa: 'Ứng dụng chạy qua Cloudflare Tunnel (true/false)', nhom: 'baoMat', laBiMat: false },
  { khoa: 'allowed_origins', giaTri: '', moTa: 'Danh sách origin được phép (phân cách bằng dấu phẩy)', nhom: 'baoMat', laBiMat: false },
];

function maskSecret(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Seed mặc định nếu chưa có
    for (const setting of DEFAULT_SETTINGS) {
      await prisma.caiDat.upsert({
        where: { khoa: setting.khoa },
        create: setting,
        update: {}, // không ghi đè giá trị đã có
      });
    }

    const allSettings = await prisma.caiDat.findMany({
      orderBy: [{ nhom: 'asc' }, { khoa: 'asc' }],
    });

    // Chỉ hiển thị các key có trong DEFAULT_SETTINGS (ẩn key cũ/không dùng nữa)
    const knownKeys = new Set(DEFAULT_SETTINGS.map((d) => d.khoa));

    // Che giá trị bí mật
    const safeSettings = allSettings
      .filter((s) => knownKeys.has(s.khoa))
      .map((s) => ({
        ...s,
        giaTri: s.laBiMat ? maskSecret(s.giaTri) : s.giaTri,
      }));

    return NextResponse.json({ success: true, data: safeSettings });
  } catch (error) {
    // Log chi tiết ở server, không trả về client để tránh lộ thông tin nội bộ
    console.error('[admin/settings GET]', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

const updateSchema = z.object({
  settings: z.array(
    z.object({
      khoa: z.string().min(1),
      giaTri: z.string().nullable().optional(),
    })
  ).min(1),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = updateSchema.parse(body);

    // Cập nhật từng setting — bỏ qua nếu gửi lên giá trị đã mask (••••)
    for (const { khoa, giaTri } of settings) {
      if (giaTri !== undefined && !giaTri?.includes('••••')) {
        await prisma.caiDat.upsert({
          where: { khoa },
          create: {
            khoa,
            giaTri: giaTri ?? '',
            // tìm metadata từ DEFAULT_SETTINGS
            moTa: DEFAULT_SETTINGS.find((d) => d.khoa === khoa)?.moTa,
            nhom: DEFAULT_SETTINGS.find((d) => d.khoa === khoa)?.nhom ?? 'chung',
            laBiMat: DEFAULT_SETTINGS.find((d) => d.khoa === khoa)?.laBiMat ?? false,
          },
          update: { giaTri: giaTri ?? '' },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Đã lưu cài đặt thành công' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ', details: error.issues }, { status: 400 });
    }
    console.error('[admin/settings PUT]', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
