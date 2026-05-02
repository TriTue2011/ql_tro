'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

export type PermissionLevel = 'hidden' | 'viewOnly' | 'fullAccess';

/**
 * Hook kiểm tra quyền chỉnh sửa dữ liệu.
 *
 * Dùng không tham số: trả về true nếu role không phải dongChuTro (giữ nguyên hành vi cũ).
 * Dùng với moduleKey: trả về true nếu mức quyền của module đó là 'fullAccess'.
 *
 * @param moduleKey - Tên module cần kiểm tra (vd: 'mucDoHopDong', 'mucDoHoaDon', ...)
 * @param permissionLevel - Mức quyền hiện tại của người dùng cho module đó
 */
export function useCanEdit(
  moduleKey?: string,
  permissionLevel?: PermissionLevel,
): boolean {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return useMemo(() => {
    // Admin luôn có quyền chỉnh sửa
    if (role === 'admin') return true;

    // dongChuTro không bao giờ được chỉnh sửa
    if (role === 'dongChuTro') return false;

    // Nếu có moduleKey và permissionLevel, kiểm tra mức quyền
    if (moduleKey && permissionLevel) {
      return permissionLevel === 'fullAccess';
    }

    // Hành vi mặc định: không phải dongChuTro thì được chỉnh sửa
    return role !== 'dongChuTro';
  }, [role, moduleKey, permissionLevel]);
}
