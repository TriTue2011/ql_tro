import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Vai trò được phép quản lý cài đặt hệ thống
const ALLOWED_ROLES = ['admin', 'chuNha'];

// Nhóm chỉ admin được xem/sửa (liên quan server/DB/hạ tầng + cấu hình AI)
const ADMIN_ONLY_NHOM = new Set(['luuTru', 'heThong', 'baoMat', 'ai']);

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
  { khoa: 'storage_cleanup_days_zalo', giaTri: '7', moTa: 'Số ngày giữ ảnh/file Zalo trên lưu trữ trước khi xóa (0 = không xóa)', nhom: 'luuTru', laBiMat: false },
  { khoa: 'storage_cleanup_days_invoice', giaTri: '365', moTa: 'Số ngày giữ ảnh hóa đơn (chỉ số điện/nước) trên lưu trữ trước khi xóa (0 = không xóa)', nhom: 'luuTru', laBiMat: false },
  // Thông báo — Zalo Bot Server
  { khoa: 'zalo_bot_server_url', giaTri: '', moTa: 'URL Zalo Bot Server (vd: http://192.168.1.100:3000)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'zalo_bot_username', giaTri: 'admin', moTa: 'Username đăng nhập bot server (mặc định: admin)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'zalo_bot_password', giaTri: '', moTa: 'Password đăng nhập bot server', nhom: 'thongBao', laBiMat: true },
  { khoa: 'zalo_bot_account_id', giaTri: '', moTa: 'Zalo Account ID (own_id) dùng để gửi tin — lấy từ tab Zalo Bot', nhom: 'thongBao', laBiMat: false },
  { khoa: 'zalo_bot_ttl', giaTri: '0', moTa: 'TTL tin nhắn gửi đi (ms). 0 = không tự hủy, 86400000 = 1 ngày, 3600000 = 1 giờ', nhom: 'thongBao', laBiMat: false },
  // Webhook ID — endpoint công khai nhận tin nhắn (giống Home Assistant webhook)
  { khoa: 'zalo_webhook_id', giaTri: '', moTa: 'Webhook ID nhận tin nhắn Zalo (tự sinh, dùng qua LAN IP)', nhom: 'thongBao', laBiMat: false },
  // HA forward (tùy chọn)
  { khoa: 'ha_zalo_notify_url', giaTri: '', moTa: 'Home Assistant Webhook URL (forward tin Zalo đến HA)', nhom: 'thongBao', laBiMat: false },
  // ha_zalo_allowed_threads và ha_zalo_type_filter được quản lý riêng trong UI (không hiện trong form generic)
  { khoa: 'thong_bao_truoc_han_hop_dong', giaTri: '30', moTa: 'Cảnh báo trước khi hợp đồng hết hạn (ngày)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'thong_bao_qua_han_hoa_don', giaTri: '3', moTa: 'Cảnh báo hóa đơn quá hạn sau (ngày)', nhom: 'thongBao', laBiMat: false },
  // Cảnh báo hóa đơn quá hạn - 3 lần
  { khoa: 'hoa_don_canh_bao_lan_1', giaTri: '0', moTa: 'Cảnh báo hóa đơn quá hạn lần 1: sau N ngày kể từ ngày đến hạn', nhom: 'thongBao', laBiMat: false },
  { khoa: 'hoa_don_canh_bao_lan_2', giaTri: '3', moTa: 'Cảnh báo hóa đơn quá hạn lần 2: sau N ngày kể từ lần cảnh báo 1', nhom: 'thongBao', laBiMat: false },
  { khoa: 'hoa_don_canh_bao_lan_3', giaTri: '7', moTa: 'Cảnh báo hóa đơn quá hạn lần 3: sau N ngày kể từ lần cảnh báo 2', nhom: 'thongBao', laBiMat: false },
  // Cảnh báo hợp đồng sắp hết hạn - 3 lần
  { khoa: 'hop_dong_canh_bao_lan_1', giaTri: '30', moTa: 'Cảnh báo hợp đồng sắp hết hạn lần 1: trước N ngày', nhom: 'thongBao', laBiMat: false },
  { khoa: 'hop_dong_canh_bao_lan_2', giaTri: '15', moTa: 'Cảnh báo hợp đồng sắp hết hạn lần 2: trước N ngày', nhom: 'thongBao', laBiMat: false },
  { khoa: 'hop_dong_canh_bao_lan_3', giaTri: '7', moTa: 'Cảnh báo hợp đồng sắp hết hạn lần 3: trước N ngày', nhom: 'thongBao', laBiMat: false },
  // Nhắc nhở chốt chỉ số điện nước
  { khoa: 'chot_chi_so_truoc_ngay', giaTri: '3', moTa: 'Nhắc nhở chốt chỉ số: trước N ngày so với ngày chốt', nhom: 'thongBao', laBiMat: false },
  { khoa: 'chot_chi_so_ngay_trong_thang', giaTri: '15', moTa: 'Ngày chốt chỉ số điện nước trong tháng (1-31)', nhom: 'thongBao', laBiMat: false },
  // Nhắc nhở sự cố (không áp dụng khách thuê)
  { khoa: 'su_co_chua_nhan_gio', giaTri: '2', moTa: 'Nhắc nhở sự cố chưa được nhận sau N giờ', nhom: 'thongBao', laBiMat: false },
  { khoa: 'su_co_chua_xu_ly_gio', giaTri: '24', moTa: 'Nhắc nhở sự cố chưa được xử lý sau N giờ', nhom: 'thongBao', laBiMat: false },
  // Gửi Zalo tự động
  { khoa: 'auto_zalo_hoa_don_tao', giaTri: 'false', moTa: 'Tự động gửi Zalo cho khách thuê khi tạo hóa đơn mới', nhom: 'thongBao', laBiMat: false },
  { khoa: 'auto_zalo_hoa_don_thanh_toan', giaTri: 'false', moTa: 'Tự động gửi Zalo cho khách thuê khi xác nhận thanh toán', nhom: 'thongBao', laBiMat: false },
  { khoa: 'auto_zalo_su_co_ghi_nhan', giaTri: 'false', moTa: 'Tự động gửi Zalo cho khách thuê khi ghi nhận sự cố mới', nhom: 'thongBao', laBiMat: false },
  { khoa: 'auto_zalo_su_co_tiep_nhan', giaTri: 'false', moTa: 'Tự động gửi Zalo khi tiếp nhận và bắt đầu xử lý sự cố', nhom: 'thongBao', laBiMat: false },
  { khoa: 'auto_zalo_su_co_xu_ly_xong', giaTri: 'false', moTa: 'Tự động gửi Zalo (kèm ảnh) khi xử lý xong sự cố', nhom: 'thongBao', laBiMat: false },
  { khoa: 'auto_zalo_su_co_huy', giaTri: 'false', moTa: 'Tự động gửi Zalo khi hủy sự cố', nhom: 'thongBao', laBiMat: false },
  { khoa: 'auto_zalo_yeu_cau_phe_duyet', giaTri: 'false', moTa: 'Tự động gửi Zalo cho khách thuê khi phê duyệt / từ chối yêu cầu thay đổi', nhom: 'thongBao', laBiMat: false },
  // Chatbot tự động
  { khoa: 'bot_auto_reply_enabled', giaTri: 'true', moTa: 'Bật/tắt chatbot tự động trả lời tin nhắn Zalo (true/false)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'bot_forward_unknown', giaTri: 'true', moTa: 'Chuyển tiếp tin nhắn người lạ đến quản lý (true/false)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'bot_forward_thread_id', giaTri: '', moTa: 'Thread ID nhóm Zalo mặc định nhận tin chuyển tiếp người lạ (ghi đè bởi cài đặt tòa nhà)', nhom: 'thongBao', laBiMat: false },
  { khoa: 'bot_greeting_stranger', giaTri: 'Xin chào! Tôi là trợ lý tự động của nhà trọ. Bạn cần hỗ trợ gì? Nếu bạn đang tìm phòng, hãy cho tôi biết số người ở và diện tích mong muốn.', moTa: 'Tin chào tự động gửi cho người lạ nhắn tin lần đầu', nhom: 'thongBao', laBiMat: false },
  // AI — chỉ admin mới được xem/sửa
  { khoa: 'ai_provider', giaTri: 'none', moTa: 'Nhà cung cấp AI: none | openai | gemini', nhom: 'ai', laBiMat: false },
  { khoa: 'ai_api_key', giaTri: '', moTa: 'API Key của nhà cung cấp AI (OpenAI hoặc Gemini)', nhom: 'ai', laBiMat: true },
  { khoa: 'ai_model', giaTri: '', moTa: 'Tên model AI (để trống = dùng mặc định: gpt-4o-mini / gemini-1.5-flash)', nhom: 'ai', laBiMat: false },
  { khoa: 'ai_base_url', giaTri: '', moTa: 'Base URL tùy chỉnh cho OpenAI-compatible API (bỏ trống = dùng api.openai.com)', nhom: 'ai', laBiMat: false },
  // Hệ thống
  { khoa: 'app_local_url', giaTri: '', moTa: 'URL ứng dụng qua IP LAN (vd: http://172.16.10.200:3000) — dùng cho webhook nội bộ', nhom: 'heThong', laBiMat: false },
  { khoa: 'app_domain_url', giaTri: '', moTa: 'URL ứng dụng qua domain (vd: https://qlpt.vhtatn.io.vn) — dùng cho webhook qua internet', nhom: 'heThong', laBiMat: false },
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
  { khoa: 'cho_phep_quan_ly_tai_khoan', giaTri: 'false', moTa: 'Cho phép quản lý tự cấu hình tài khoản nhận tiền riêng (true/false)', nhom: 'thanhToan', laBiMat: false },
  // Bảo mật
  { khoa: 'session_max_age_days', giaTri: '30', moTa: 'Thời gian hết hạn phiên đăng nhập (ngày)', nhom: 'baoMat', laBiMat: false },
  { khoa: 'rate_limit_login', giaTri: '10', moTa: 'Số lần đăng nhập tối đa / phút', nhom: 'baoMat', laBiMat: false },
  { khoa: 'cloudflare_tunnel', giaTri: 'false', moTa: 'Ứng dụng chạy qua Cloudflare Tunnel (true/false)', nhom: 'baoMat', laBiMat: false },
  { khoa: 'allowed_origins', giaTri: '', moTa: 'Danh sách origin được phép (phân cách bằng dấu phẩy)', nhom: 'baoMat', laBiMat: false },
  // Quản lý tài khoản — giới hạn vai trò trên mỗi tòa nhà
  { khoa: 'role_limits', giaTri: '{"dongChuTro":2,"quanLy":3,"nhanVien":5}', moTa: 'Giới hạn số lượng mỗi vai trò trên mỗi tòa nhà (JSON)', nhom: 'heThong', laBiMat: false },
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
    const role = session.user.role;

    // Che giá trị bí mật; chuNha không được xem nhóm liên quan server/DB
    const safeSettings = allSettings
      .filter((s) => knownKeys.has(s.khoa))
      .filter((s) => role === 'admin' || !ADMIN_ONLY_NHOM.has(s.nhom))
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
    const role = session.user.role;

    // Cập nhật từng setting — bỏ qua nếu gửi lên giá trị đã mask (••••)
    for (const { khoa, giaTri } of settings) {
      // chuNha không được ghi nhóm server/DB
      const nhom = DEFAULT_SETTINGS.find((d) => d.khoa === khoa)?.nhom ?? '';
      if (role !== 'admin' && ADMIN_ONLY_NHOM.has(nhom)) continue;
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
