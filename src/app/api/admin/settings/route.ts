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
  { khoa: 'minio_access_key', giaTri: '', moTa: 'MinIO User', nhom: 'luuTru', laBiMat: false },
  { khoa: 'minio_secret_key', giaTri: '', moTa: 'MinIO Password', nhom: 'luuTru', laBiMat: true },
  { khoa: 'minio_bucket', giaTri: 'ql-tro', moTa: 'MinIO Bucket Name', nhom: 'luuTru', laBiMat: false },
  { khoa: 'upload_max_size_mb', giaTri: '10', moTa: 'Kích thước tối đa file upload (MB)', nhom: 'luuTru', laBiMat: false },
  // Thông báo — chế độ Zalo
  { khoa: 'zalo_mode', giaTri: 'oa', moTa: 'Chế độ Zalo: "oa" (Official Account API) hoặc "bot_server" (Docker bot cá nhân)', nhom: 'thongBao', laBiMat: false },
  // Zalo OA API (dùng khi zalo_mode=oa)
  { khoa: 'zalo_access_token', giaTri: '', moTa: 'Zalo Bot Access Token (chỉ dùng khi zalo_mode=oa)', nhom: 'thongBao', laBiMat: true },
  { khoa: 'zalo_webhook_secret', giaTri: '', moTa: 'Zalo Webhook Secret Token (chỉ dùng khi zalo_mode=oa)', nhom: 'thongBao', laBiMat: true },
  // Zalo Bot Server (dùng khi zalo_mode=bot_server)
  { khoa: 'zalo_bot_server_url', giaTri: '', moTa: 'URL Zalo Bot Server (vd: http://192.168.1.100:3000)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'zalo_bot_username', giaTri: 'admin', moTa: 'Username đăng nhập bot server (mặc định: admin)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'zalo_bot_password', giaTri: '', moTa: 'Password đăng nhập bot server', nhom: 'thongBao', laBiMat: true },
  { khoa: 'zalo_bot_account_id', giaTri: '', moTa: 'Zalo Account ID (own_id) dùng để gửi tin — lấy từ tab Zalo Bot', nhom: 'thongBao', laBiMat: false },
  // Webhook ID — endpoint công khai nhận tin nhắn (giống Home Assistant webhook)
  { khoa: 'zalo_webhook_id', giaTri: '', moTa: 'Webhook ID nhận tin nhắn Zalo (tự sinh, dùng qua LAN IP)', nhom: 'thongBao', laBiMat: false },
  // HA forward (tùy chọn)
  { khoa: 'ha_zalo_notify_url', giaTri: '', moTa: 'Home Assistant Webhook URL (forward tin Zalo đến HA)', nhom: 'thongBao', laBiMat: false },
  // ha_zalo_allowed_threads và ha_zalo_type_filter được quản lý riêng trong UI (không hiện trong form generic)
  { khoa: 'thong_bao_truoc_han_hop_dong', giaTri: '30', moTa: 'Cảnh báo trước khi hợp đồng hết hạn (ngày)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'thong_bao_qua_han_hoa_don', giaTri: '3', moTa: 'Cảnh báo hóa đơn quá hạn sau (ngày)', nhom: 'thongBao', laBiMat: false },
  // Hệ thống
  { khoa: 'app_local_url', giaTri: '', moTa: 'URL ứng dụng qua IP LAN (vd: http://172.16.10.200:3000) — dùng cho webhook nội bộ', nhom: 'heThong', laBiMat: false },
  { khoa: 'ten_cong_ty', giaTri: 'Quản Lý Trọ', moTa: 'Tên công ty / nhà trọ', nhom: 'heThong', laBiMat: false },
  { khoa: 'email_lien_he', giaTri: '', moTa: 'Email liên hệ hiển thị trên hóa đơn', nhom: 'heThong', laBiMat: false },
  { khoa: 'sdt_lien_he', giaTri: '', moTa: 'Số điện thoại liên hệ', nhom: 'heThong', laBiMat: false },
  { khoa: 'dia_chi_cong_ty', giaTri: '', moTa: 'Địa chỉ công ty', nhom: 'heThong', laBiMat: false },
  { khoa: 'logo_url', giaTri: '', moTa: 'URL logo công ty', nhom: 'heThong', laBiMat: false },
  { khoa: 'tien_te', giaTri: 'VND', moTa: 'Đơn vị tiền tệ', nhom: 'heThong', laBiMat: false },
  // Thanh toán — tài khoản ngân hàng & QR
  { khoa: 'ngan_hang_ten', giaTri: '', moTa: 'Ngân hàng nhận tiền (mã ngân hàng, vd: Vietcombank)', nhom: 'thanhToan', laBiMat: false },
  { khoa: 'ngan_hang_so_tai_khoan', giaTri: '', moTa: 'Số tài khoản ngân hàng', nhom: 'thanhToan', laBiMat: false },
  { khoa: 'ngan_hang_chu_tai_khoan', giaTri: '', moTa: 'Tên chủ tài khoản', nhom: 'thanhToan', laBiMat: false },
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

    // Seed mặc định nếu chưa có; luôn đồng bộ moTa/nhom/laBiMat từ code
    for (const setting of DEFAULT_SETTINGS) {
      await prisma.caiDat.upsert({
        where: { khoa: setting.khoa },
        create: setting,
        update: { moTa: setting.moTa, nhom: setting.nhom, laBiMat: setting.laBiMat },
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
