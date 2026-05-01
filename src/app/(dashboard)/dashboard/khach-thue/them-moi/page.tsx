'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { KhachThueForm } from '@/components/khach-thue-form';
import { KhachThue } from '@/types';
import { toast } from 'sonner';

export default function ThemMoiKhachThuePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canViewZalo = ['admin', 'chuNha'].includes(session?.user?.role ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSuccess = (newKhachThue?: KhachThue) => {
    toast.success('Thêm khách thuê thành công!');
    router.push('/dashboard/khach-thue');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/dashboard/khach-thue')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Thêm khách thuê mới</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Nhập thông tin khách thuê mới</p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base">Thông tin khách thuê</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <KhachThueForm
            khachThue={null}
            canViewZalo={canViewZalo}
            onClose={() => router.push('/dashboard/khach-thue')}
            onSuccess={handleSuccess}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
