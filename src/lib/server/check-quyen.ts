/**
 * Kiểm tra quyền quản lý (quanLy/nhanVien) trên tòa nhà cụ thể.
 *
 * - admin: không truy cập CRUD nghiệp vụ
 * - chuNha, dongChuTro: luôn có quyền
 * - quanLy: phải có quyền cụ thể trong ToaNhaNguoiQuanLy
 * - nhanVien: không có quyền thêm/sửa/xóa (chỉ xem)
 *
 * Trả về { allowed: true } hoặc { allowed: false, message: string }
 */
import prisma from '@/lib/prisma';

export type QuyenKey = 'quyenHopDong' | 'quyenHoaDon' | 'quyenThanhToan' | 'quyenSuCo';

interface CheckResult {
  allowed: boolean;
  message?: string;
}

/**
 * Kiểm tra user có quyền thực hiện hành động (thêm/sửa/xóa) trên 1 tòa nhà.
 * @param userId - ID người dùng
 * @param role - vai trò (chuNha, dongChuTro, quanLy, nhanVien)
 * @param toaNhaId - ID tòa nhà liên quan (lấy từ phòng/hợp đồng/hóa đơn)
 * @param quyen - loại quyền cần kiểm tra
 */
export async function checkQuyen(
  userId: string,
  role: string,
  toaNhaId: string,
  quyen: QuyenKey,
): Promise<CheckResult> {
  // chuNha, dongChuTro: luôn có quyền trên tòa nhà của mình
  if (role === 'chuNha' || role === 'dongChuTro') {
    return { allowed: true };
  }

  // nhanVien: không có quyền thêm/sửa/xóa
  if (role === 'nhanVien') {
    return { allowed: false, message: 'Nhân viên chỉ có quyền xem' };
  }

  // quanLy: kiểm tra quyền cụ thể trong ToaNhaNguoiQuanLy
  if (role === 'quanLy') {
    const record = await prisma.toaNhaNguoiQuanLy.findUnique({
      where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId: userId } },
      select: { [quyen]: true } as Record<string, boolean>,
    });

    if (!record) {
      return { allowed: false, message: 'Bạn không được gán quản lý tòa nhà này' };
    }

    if (!(record as Record<string, boolean>)[quyen]) {
      const labels: Record<QuyenKey, string> = {
        quyenHopDong: 'hợp đồng',
        quyenHoaDon: 'hóa đơn',
        quyenThanhToan: 'thanh toán',
        quyenSuCo: 'sự cố',
      };
      return { allowed: false, message: `Bạn không có quyền thêm/sửa/xóa ${labels[quyen]}` };
    }

    return { allowed: true };
  }

  // admin hoặc role không xác định
  return { allowed: false, message: 'Không có quyền' };
}

/**
 * Lấy toaNhaId từ phòng ID (qua prisma).
 */
export async function getToaNhaIdFromPhong(phongId: string): Promise<string | null> {
  const phong = await prisma.phong.findUnique({
    where: { id: phongId },
    select: { toaNhaId: true },
  });
  return phong?.toaNhaId ?? null;
}

/**
 * Lấy toaNhaId từ hợp đồng ID.
 */
export async function getToaNhaIdFromHopDong(hopDongId: string): Promise<string | null> {
  const hd = await prisma.hopDong.findUnique({
    where: { id: hopDongId },
    select: { phong: { select: { toaNhaId: true } } },
  });
  return hd?.phong?.toaNhaId ?? null;
}

/**
 * Lấy toaNhaId từ hóa đơn ID.
 */
export async function getToaNhaIdFromHoaDon(hoaDonId: string): Promise<string | null> {
  const hd = await prisma.hoaDon.findUnique({
    where: { id: hoaDonId },
    select: { phong: { select: { toaNhaId: true } } },
  });
  return hd?.phong?.toaNhaId ?? null;
}

/**
 * Lấy toaNhaId từ thanh toán ID.
 */
export async function getToaNhaIdFromThanhToan(thanhToanId: string): Promise<string | null> {
  const tt = await prisma.thanhToan.findUnique({
    where: { id: thanhToanId },
    select: { hoaDon: { select: { phong: { select: { toaNhaId: true } } } } },
  });
  return tt?.hoaDon?.phong?.toaNhaId ?? null;
}

/**
 * Lấy toaNhaId từ sự cố ID.
 */
export async function getToaNhaIdFromSuCo(suCoId: string): Promise<string | null> {
  const sc = await prisma.suCo.findUnique({
    where: { id: suCoId },
    select: { phong: { select: { toaNhaId: true } } },
  });
  return sc?.phong?.toaNhaId ?? null;
}
