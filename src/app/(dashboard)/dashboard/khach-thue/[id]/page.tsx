'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { KhachThueForm } from '@/components/khach-thue-form';
import { KhachThue } from '@/types';
import { toast } from 'sonner';

export default function ChinhSuaKhachThuePage() {
  const router = useRouter();
  const params = useParams();
  const khachThueId = params.id as string;
  const { data: session } = useSession();
  const canViewZalo = ['admin', 'chuNha'].includes(session?.user?.role ?? '');
  const [khachThue, setKhachThue] = useState<KhachThue | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Chỉnh sửa khách thuê';
  }, []);

  useEffect(() => {
    fetchKhachThue();
  }, [khachThueId]);

  const fetchKhachThue = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/khach-thue/${khachThueId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setKhachThue(result.data);
        } else {
          toast.error(result.message || 'Không thể tải thông tin khách thuê');
          router.push('/dashboard/khach-thue');
        }
      } else {
        toast.error('Không thể tải thông tin khách thuê');
        router.push('/dashboard/khach-thue');
      }
    } catch (error) {
      console.error('Error fetching khach thue:', error);
      toast.error('Có lỗi xảy ra khi tải thông tin');
      router.push('/dashboard/khach-thue');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (updatedKhachThue?: KhachThue) => {
    toast.success('Cập nhật khách thuê thành công!');
    router.push('/dashboard/khach-thue');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!khachThue) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không tìm thấy khách thuê</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/khach-thue')}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/dashboard/khach-thue')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Chỉnh sửa khách thuê</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Cập nhật thông tin cho <strong>{khachThue.hoTen}</strong>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base">Thông tin khách thuê</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <KhachThueForm
            khachThue={khachThue}
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
