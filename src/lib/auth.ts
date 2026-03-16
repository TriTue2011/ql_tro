import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import prisma from './prisma';

export const authOptions: NextAuthOptions = {
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

          const user = isPhone
            ? await prisma.nguoiDung.findFirst({
                where: { soDienThoai: login },
              })
            : await prisma.nguoiDung.findUnique({
                where: { email: login.toLowerCase() },
              });

          if (!user || user.trangThai !== 'hoatDong') {
            return null;
          }

          const isPasswordValid = await compare(credentials.matKhau, user.matKhau);

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.ten,
            role: user.vaiTro,
            phone: user.soDienThoai ?? '',
            avatar: user.anhDaiDien ?? undefined,
          };
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
