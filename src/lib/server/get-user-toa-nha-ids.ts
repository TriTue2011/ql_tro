/**
 * Server-side helper: lấy danh sách toaNhaId mà user hiện tại được phép quản lý.
 *
 * - admin       → null  (không dùng hàm này — admin không quản lý phòng/khách/...)
 * - chuNha      → tòa nhà họ sở hữu (chuSoHuuId) + tòa nhà được gán qua ToaNhaNguoiQuanLy
 * - dongChuTro  → tòa nhà được gán qua ToaNhaNguoiQuanLy
 * - quanLy      → tòa nhà được gán qua ToaNhaNguoiQuanLy
 * - nhanVien    → tòa nhà được gán qua ToaNhaNguoiQuanLy
 *
 * Returns [] nếu user không có tòa nào (tránh lộ data khi chưa được gán).
 */
import prisma from '@/lib/prisma';

export async function getUserToaNhaIds(userId: string, role: string): Promise<string[]> {
  if (role === 'admin') return [];

  const [owned, managed] = await Promise.all([
    // chuNha thấy tòa nhà họ sở hữu qua chuSoHuuId
    (role === 'chuNha' || role === 'dongChuTro')
      ? prisma.toaNha.findMany({ where: { chuSoHuuId: userId }, select: { id: true } })
      : [],
    // Tất cả role thấy tòa nhà được gán qua ToaNhaNguoiQuanLy
    prisma.toaNhaNguoiQuanLy.findMany({
      where: { nguoiDungId: userId },
      select: { toaNhaId: true },
    }),
  ]);

  const ids = new Set<string>();
  if (Array.isArray(owned)) owned.forEach((t) => ids.add(t.id));
  managed.forEach((t) => ids.add(t.toaNhaId));
  return [...ids];
}
