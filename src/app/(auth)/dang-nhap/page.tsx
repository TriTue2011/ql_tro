'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, 'Vui lòng nhập email hoặc số điện thoại'),
  matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        emailOrPhone: data.emailOrPhone,
        matKhau: data.matKhau,
        redirect: false,
      });

      if (result?.error) {
        const isPhone = /^[0-9]{9,11}$/.test(data.emailOrPhone.trim());
        setError(
          isPhone
            ? 'Số điện thoại hoặc mật khẩu không đúng. Nếu bạn là khách thuê, vui lòng dùng trang đăng nhập dành cho khách thuê.'
            : 'Email hoặc mật khẩu không đúng'
        );
      } else {
        // Redirect tất cả user về dashboard
        router.push('/dashboard');
      }
    } catch (error) {
      setError('Đã xảy ra lỗi, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 md:space-y-8">
        <div className="text-center">
          <h2 className="mt-4 md:mt-6 text-2xl md:text-3xl font-bold text-gray-900">
            Đăng nhập hệ thống
          </h2>
          <p className="mt-2 text-xs md:text-sm text-gray-600">
            Quản lý phòng trọ
          </p>
        </div>
        
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Đăng nhập</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Nhập thông tin đăng nhập của bạn
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 md:space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="emailOrPhone" className="text-xs md:text-sm">Email hoặc số điện thoại</Label>
                <Input
                  id="emailOrPhone"
                  type="text"
                  placeholder="Nhập email hoặc số điện thoại"
                  {...register('emailOrPhone')}
                  className={`text-sm ${errors.emailOrPhone ? 'border-red-500' : ''}`}
                />
                {errors.emailOrPhone && (
                  <p className="text-xs md:text-sm text-red-500">{errors.emailOrPhone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="matKhau" className="text-xs md:text-sm">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="matKhau"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    {...register('matKhau')}
                    className={`text-sm ${errors.matKhau ? 'border-red-500 pr-10' : 'pr-10'}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    )}
                  </Button>
                </div>
                {errors.matKhau && (
                  <p className="text-xs md:text-sm text-red-500">{errors.matKhau.message}</p>
                )}
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
              Bạn là khách thuê?{' '}
              <Link href="/khach-thue/dang-nhap" className="text-primary underline underline-offset-2">
                Đăng nhập tại đây
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
