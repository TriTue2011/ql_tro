import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import prisma from './prisma';

// App chạy HTTP nội bộ, Cloudflare Tunnel xử lý HTTPS bên ngoài.
// Khi NEXTAUTH_URL=https://..., NextAuth tự động dùng __Secure- prefix + Secure flag
// → cookie không hoạt động trên HTTP LAN (172.16.x.x:3000).
// Override cookies để dùng tên và cờ tương thích cả HTTP lẫn HTTPS.
const useSecureCookies = false;

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: useSecureCookies },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: { sameSite: 'lax' as const, path: '/', secure: useSecureCookies },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: useSecureCookies },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        emailOrPhone: { label: 'Email hoặc SĐT', type: 'text' },
        matKhau: { label: 'Mật khẩu', type: 'password' }
      },
      async authorize(credentials, _req) {
        if (!credentials?.emailOrPhone || !credentials?.matKhau) {
          return null;
        }

        try {
          const login = credentials.emailOrPhone.trim();
          const isPhone = /^[0-9+\s()-]{8,15}$/.test(login.replace(/\s/g, ''));

          // 1. Tìm trong NguoiDung (admin | chuNha | quanLy | nhanVien)
          const user = isPhone
            ? await prisma.nguoiDung.findFirst({
                where: { soDienThoai: login },
              })
            : await prisma.nguoiDung.findUnique({
                where: { email: login.toLowerCase() },
              });

          if (user) {
            if (user.trangThai !== 'hoatDong') return null;

            const isPasswordValid = await compare(credentials.matKhau, user.matKhau);
            if (!isPasswordValid) return null;

            return {
              id: user.id,
              email: user.email,
              name: user.ten,
              role: user.vaiTro,
              phone: user.soDienThoai ?? '',
              avatar: user.anhDaiDien ?? undefined,
            };
          }

          // 2. Nếu không tìm thấy NguoiDung và đầu vào là số điện thoại → thử KhachThue
          if (isPhone) {
            const khachThue = await prisma.khachThue.findFirst({
              where: { soDienThoai: login },
            });

            if (khachThue && khachThue.matKhau) {
              const isPasswordValid = await compare(credentials.matKhau, khachThue.matKhau);
              if (!isPasswordValid) return null;

              // Email placeholder nếu KhachThue không có email
              const email = khachThue.email || `kt.${khachThue.soDienThoai}@phongtro.local`;

              return {
                id: khachThue.id,
                email,
                name: khachThue.hoTen,
                role: 'khachThue',
                phone: khachThue.soDienThoai,
                avatar: undefined,
              };
            }
          }

          return null;
        } catch (error) {
          console.error('[AUTH] Error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.phone = user.phone;
        token.avatar = user.avatar;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.phone = token.phone as string;
        session.user.avatar = token.avatar as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/dang-nhap',
    error: '/dang-nhap',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
