'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LuuTruRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/cai-dat');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64 text-sm text-indigo-500">
      Đang chuyển hướng đến Cài đặt hệ thống...
    </div>
  );
}
