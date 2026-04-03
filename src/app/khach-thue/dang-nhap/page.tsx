'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Lock, LogIn, Home } from 'lucide-react';
import { toast } from 'sonner';

export default function KhachThueDangNhapPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    taiKhoan: '',
    matKhau: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        emailOrPhone: formData.taiKhoan,
        matKhau: formData.matKhau,
        redirect: false,
      });

      if (result?.ok) {
        toast.success('Đăng nhập thành công!');
        router.push('/khach-thue/dashboard');
      } else {
        toast.error('Tài khoản hoặc mật khẩu không đúng');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      toast.error('Có lỗi xảy ra khi đăng nhập');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Home className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Đăng nhập Khách thuê</CardTitle>
          <CardDescription>
            Nhập số điện thoại hoặc email và mật khẩu để xem thông tin phòng trọ của bạn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taiKhoan">Số điện thoại hoặc Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="taiKhoan"
                  type="text"
                  placeholder="0123456789 hoặc email@example.com"
                  value={formData.taiKhoan}
                  onChange={(e) => setFormData(prev => ({ ...prev, taiKhoan: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="matKhau">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="matKhau"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={formData.matKhau}
                  onChange={(e) => setFormData(prev => ({ ...prev, matKhau: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Đăng nhập
                </>
              )}
            </Button>

            <div className="text-center text-sm text-gray-600 mt-4">
              <p>Chưa có mật khẩu?</p>
              <p className="text-xs mt-1">Vui lòng liên hệ quản lý để được tạo tài khoản</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
