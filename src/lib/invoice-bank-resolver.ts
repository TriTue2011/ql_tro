/**
 * Resolve thông tin tài khoản nhận tiền cho hóa đơn.
 *
 * Logic:
 *   1. Đọc CaiDat global (key snake_case) — luôn là baseline/fallback.
 *   2. Nếu flag `cho_phep_quan_ly_tai_khoan` = true VÀ hóa đơn có nguoiTaoId
 *      VÀ user đó có CaiDatChuNha với đầy đủ STK + ngân hàng → dùng của họ.
 *   3. Ngược lại → dùng global.
 */
import prisma from '@/lib/prisma';

export interface InvoiceBankInfo {
  tenChuNha: string;
  soTaiKhoan: string;
  nganHang: string;
  chuTaiKhoan: string;
  logoUrl: string;
}

export async function resolveInvoiceBankInfo(
  nguoiTaoId: string | null | undefined,
): Promise<InvoiceBankInfo> {
  // 1. Global CaiDat
  const globalRows = await prisma.caiDat.findMany({
    where: {
      khoa: {
        in: [
          'ten_cong_ty',
          'ngan_hang_so_tai_khoan',
          'ngan_hang_ten',
          'ngan_hang_chu_tai_khoan',
          'logo_url',
          'cho_phep_quan_ly_tai_khoan',
        ],
      },
    },
    select: { khoa: true, giaTri: true },
  });
  const g = Object.fromEntries(globalRows.map(r => [r.khoa, r.giaTri ?? '']));

  const chophep = (g['cho_phep_quan_ly_tai_khoan'] ?? 'false') === 'true';

  const result: InvoiceBankInfo = {
    tenChuNha: g['ten_cong_ty'] ?? '',
    soTaiKhoan: g['ngan_hang_so_tai_khoan'] ?? '',
    nganHang: g['ngan_hang_ten'] ?? '',
    chuTaiKhoan: g['ngan_hang_chu_tai_khoan'] ?? '',
    logoUrl: g['logo_url'] ?? '',
  };

  // 2. Ưu tiên bank của người tạo hóa đơn nếu flag bật
  if (chophep && nguoiTaoId) {
    const personal = await prisma.caiDatChuNha.findUnique({
      where: { nguoiDungId: nguoiTaoId },
      select: {
        nganHangTen: true,
        nganHangSoTaiKhoan: true,
        nganHangChuTaiKhoan: true,
        tenCongTy: true,
      },
    });
    // Chỉ override khi có đủ STK + ngân hàng
    if (personal?.nganHangSoTaiKhoan && personal?.nganHangTen) {
      result.soTaiKhoan = personal.nganHangSoTaiKhoan;
      result.nganHang = personal.nganHangTen;
      result.chuTaiKhoan = personal.nganHangChuTaiKhoan || result.chuTaiKhoan;
      if (personal.tenCongTy) result.tenChuNha = personal.tenCongTy;
    }
  }

  return result;
}
