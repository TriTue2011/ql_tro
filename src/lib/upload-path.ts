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
    .slice(0, 5)
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
