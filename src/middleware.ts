import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware bảo mật cho QL-Trọ.
 *
 * Chức năng:
 * 1. Bảo vệ /dashboard/* — yêu cầu NextAuth session hợp lệ
 * 2. Thêm security headers cho mọi response (Cloudflare Tunnel safe)
 * 3. Từ chối truy cập /api/admin/* nếu không phải admin
 * 4. Ghi nhận IP thực qua CF-Connecting-IP khi dùng Cloudflare Tunnel
 */

// ─── Cloudflare Tunnel helpers ─────────────────────────────────────────────────

/** Lấy IP thực của client (ưu tiên Cloudflare header) */
function getRealIP(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

// ─── Security headers chung ────────────────────────────────────────────────────

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Ngăn clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // Ngăn MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Ngăn XSS cũ (browser compat)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // Chính sách referrer an toàn
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Tắt các tính năng browser không cần thiết
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  // HSTS — Cloudflare sẽ ghi đè nhưng đặt sẵn ở app level
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  // Ẩn thông tin server
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  return response;
}

// ─── Rate limit đơn giản trong memory (login endpoint) ────────────────────────
// Giới hạn: tối đa 10 request / phút mỗi IP cho /api/auth/[...nextauth]

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 phút
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // OK
  }

  if (entry.count >= RATE_LIMIT_MAX) return false; // bị chặn

  entry.count++;
  return true;
}

// ─── withAuth (bảo vệ /dashboard/*) ───────────────────────────────────────────

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token as Record<string, unknown> | null | undefined;
    const ip = getRealIP(req);

    // Rate limit cho endpoint đăng nhập
    if (
      pathname.startsWith('/api/auth') &&
      (pathname.includes('callback') || pathname.includes('signin'))
    ) {
      if (!checkRateLimit(ip)) {
        return new NextResponse(
          JSON.stringify({ message: 'Quá nhiều yêu cầu, thử lại sau 1 phút' }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
    }

    // Chặn /api/admin/* nếu không phải admin
    if (pathname.startsWith('/api/admin') && token?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ message: 'Forbidden — chỉ admin mới có quyền truy cập' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // /dashboard/* phải có session
        if (pathname.startsWith('/dashboard')) return !!token;

        // /api/admin/* phải có session (role check là trong middleware function trên)
        if (pathname.startsWith('/api/admin')) return !!token;

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
  ],
};
