'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Layout bảo vệ khu vực Khách thuê.
 * - Trang đăng nhập (/khach-thue/dang-nhap) luôn mở.
 * - Mọi route khác trong /khach-thue/* yêu cầu token JWT khách thuê.
 */
export default function KhachThueLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Không kiểm tra ở trang đăng nhập
    if (pathname === '/khach-thue/dang-nhap') return;

    const token = localStorage.getItem('khachThueToken');
    if (!token) {
      router.replace('/khach-thue/dang-nhap');
      return;
    }

    // Kiểm tra token còn hạn không (decode payload mà không verify — server sẽ verify sau)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem('khachThueToken');
        localStorage.removeItem('khachThueInfo');
        router.replace('/khach-thue/dang-nhap');
      }
    } catch {
      // token malformed
      localStorage.removeItem('khachThueToken');
      router.replace('/khach-thue/dang-nhap');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
