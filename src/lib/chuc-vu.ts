export const CHUC_VU_QUAN_LY = [
  { value: 'giamDoc', label: 'Giám đốc' },
  { value: 'keToanTruong', label: 'Kế toán trưởng' },
  { value: 'truongCSKH', label: 'Trưởng CSKH' },
  { value: 'truongHanhChinh', label: 'Trưởng Hành chính' },
  { value: 'truongKyThuat', label: 'Trưởng Kỹ thuật' },
  { value: 'thuKho', label: 'Thủ kho' },
  { value: 'phoBoPhan', label: 'Phó bộ phận' },
  { value: 'phoKT', label: 'Phó KT' },
  { value: 'quanLyKiemToanBo', label: 'Quản lý kiêm toàn bộ' },
] as const;

export const CHUC_VU_NHAN_VIEN = [
  { value: 'truongCa', label: 'Trưởng ca' },
  { value: 'truongCaKT', label: 'Trưởng ca KT' },
  { value: 'nvKeToan', label: 'NV Kế toán' },
  { value: 'leTan', label: 'Lễ tân' },
  { value: 'nvHanhChinh', label: 'NV Hành chính' },
  { value: 'nvKyThuat', label: 'NV Kỹ thuật' },
  { value: 'nvKho', label: 'NV Kho' },
  { value: 'nhanVienKiemToanBo', label: 'Nhân viên kiêm toàn bộ' },
] as const;

export const DEFAULT_CHUC_VU_BY_ROLE = {
  quanLy: 'quanLyKiemToanBo',
  nhanVien: 'nhanVienKiemToanBo',
} as const;

export type ChucVuOption =
  | (typeof CHUC_VU_QUAN_LY)[number]
  | (typeof CHUC_VU_NHAN_VIEN)[number];

const ALL_CHUC_VU_OPTIONS = [
  ...CHUC_VU_QUAN_LY,
  ...CHUC_VU_NHAN_VIEN,
] as const;

export function getChucVuOptionsForRole(role?: string | null): readonly ChucVuOption[] {
  if (role === 'quanLy') return CHUC_VU_QUAN_LY;
  if (role === 'nhanVien') return CHUC_VU_NHAN_VIEN;
  return [];
}

export function getDefaultChucVuForRole(role?: string | null): string | null {
  if (role === 'quanLy') return DEFAULT_CHUC_VU_BY_ROLE.quanLy;
  if (role === 'nhanVien') return DEFAULT_CHUC_VU_BY_ROLE.nhanVien;
  return null;
}

export function getChucVuLabel(chucVu?: string | null): string {
  if (!chucVu) return '';
  return ALL_CHUC_VU_OPTIONS.find(option => option.value === chucVu)?.label ?? chucVu;
}

export function isChucVuAllowedForRole(role: string, chucVu: string): boolean {
  return getChucVuOptionsForRole(role).some(option => option.value === chucVu);
}

export function normalizeChucVuForRole(role: string, chucVu?: unknown): string | null {
  const defaultChucVu = getDefaultChucVuForRole(role);
  if (!defaultChucVu) return null;

  if (typeof chucVu !== 'string' || chucVu.trim() === '') {
    return defaultChucVu;
  }

  const cleanChucVu = chucVu.trim();
  return isChucVuAllowedForRole(role, cleanChucVu) ? cleanChucVu : defaultChucVu;
}

export function validateChucVuForRole(
  role: string,
  chucVu?: unknown,
): { ok: true; chucVu: string | null } | { ok: false; error: string } {
  const defaultChucVu = getDefaultChucVuForRole(role);
  if (!defaultChucVu) return { ok: true, chucVu: null };

  if (typeof chucVu !== 'string' || chucVu.trim() === '') {
    return { ok: true, chucVu: defaultChucVu };
  }

  const cleanChucVu = chucVu.trim();
  if (!isChucVuAllowedForRole(role, cleanChucVu)) {
    const roleLabel = role === 'quanLy' ? 'quản lý' : 'nhân viên';
    return { ok: false, error: `Chức vụ không hợp lệ cho vai trò ${roleLabel}` };
  }

  return { ok: true, chucVu: cleanChucVu };
}
