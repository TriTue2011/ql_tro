import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import prisma from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        matKhau: { label: 'Mật khẩu', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.matKhau) {
          return null;
        }

        try {
          console.log('[AUTH] Attempting login for:', credentials.email);
          const user = await prisma.nguoiDung.findUnique({
            where: {
              email: credentials.email.toLowerCase(),
            }
          });

          console.log('[AUTH] User found:', !!user, 'trangThai:', user?.trangThai);
          if (!user || user.trangThai !== 'hoatDong') {
            return null;
          }

          const isPasswordValid = await compare(credentials.matKhau, user.matKhau);
          console.log('[AUTH] Password valid:', isPasswordValid);

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.ten,
            role: user.vaiTro,
            phone: user.soDienThoai,
            avatar: user.anhDaiDien,
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
