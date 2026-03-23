'use client';

import { useSession } from 'next-auth/react';

/**
 * Hook kiểm tra quyền chỉnh sửa dữ liệu.
 * dongChuTro chỉ được xem, không được tạo/sửa/xóa.
 */
export function useCanEdit(): boolean {
  const { data: session } = useSession();
  const role = session?.user?.role;
  return role !== 'dongChuTro';
}
