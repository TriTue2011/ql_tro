import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

/**
 * Thêm security headers — thích ứng theo nguồn request:
 * - Qua Cloudflare (có CF-Connecting-IP): thêm HSTS + upgrade-insecure-requests
 * - Qua LAN IP trực tiếp: KHÔNG thêm HSTS (tránh browser nhớ HSTS → phá HTTP LAN)
 */
function addSecurityHeaders(response: NextResponse, req: NextRequest): NextResponse {
  // Detect request đến qua Cloudflare (HTTPS proxy)
  const isBehindCF = !!req.headers.get('cf-connecting-ip');

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

  // HSTS + upgrade-insecure-requests CHỈ khi qua Cloudflare (HTTPS)
  // Không thêm khi truy cập qua LAN IP HTTP → tránh browser cache HSTS
  if (isBehindCF) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    // Thêm upgrade-insecure-requests vào CSP hiện có
    const existingCSP = response.headers.get('Content-Security-Policy') || '';
    if (existingCSP && !existingCSP.includes('upgrade-insecure-requests')) {
      response.headers.set('Content-Security-Policy', existingCSP + '; upgrade-insecure-requests');
    }
  }

  // Ẩn thông tin server
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  return response;
}

// ─── Rate limit đơn giản trong memory (login endpoints) ──────────────────────
// Giới hạn: tối đa 10 request / phút mỗi IP cho các endpoint đăng nhập.
// Áp dụng cho cả NextAuth và khách thuê login.
// Lưu ý: in-memory, reset khi restart process. Dùng Redis cho production scale-out.

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 phút
const RATE_LIMIT_MAX = 10;

// Dọn dẹp entries hết hạn mỗi 5 phút để tránh memory leak
let lastCleanup = Date.now();
function cleanupRateLimitEntries() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return; // 5 phút
  lastCleanup = now;
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(key);
  }
}

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

/** Danh sách path cần rate limit — bao gồm cả khách thuê login */
const RATE_LIMITED_PATHS = [
  '/api/auth/khach-thue/login',
];

// ─── withAuth (bảo vệ /dashboard/*) ───────────────────────────────────────────

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token as Record<string, unknown> | null | undefined;
    const ip = getRealIP(req);

    // Redirect khách thuê về đúng trang đăng nhập khi chưa auth
    if (pathname.startsWith('/khach-thue/dashboard') && (!token || token.role !== 'khachThue')) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/khach-thue/dang-nhap';
      return NextResponse.redirect(loginUrl);
    }

    cleanupRateLimitEntries();

    // Rate limit cho endpoint đăng nhập, upload (NextAuth + khách thuê)
    const isNextAuthLogin =
      pathname.startsWith('/api/auth') &&
      (pathname.includes('callback') || pathname.includes('signin'));
    const isKhachThueLogin = RATE_LIMITED_PATHS.some(p => pathname === p);
    const isUpload = pathname === '/api/upload';

    if (isNextAuthLogin || isKhachThueLogin || isUpload) {
      if (!checkRateLimit(ip)) {
        return new NextResponse(
          JSON.stringify({ message: 'Quá nhiều yêu cầu, thử lại sau 1 phút' }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
    }

    // Chặn /api/admin/* nếu không phải admin (trừ create-first)
    if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/create-first' && token?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ message: 'Forbidden — chỉ admin mới có quyền truy cập' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Chặn khachThue truy cập API quản lý
    const isManagementApi = pathname.startsWith('/api/') &&
      !pathname.startsWith('/api/auth/') &&
      !pathname.startsWith('/api/khach-thue/') &&
      !pathname.startsWith('/api/webhook/') &&
      pathname !== '/api/upload';
    if (isManagementApi && token?.role === 'khachThue') {
      return new NextResponse(
        JSON.stringify({ message: 'Forbidden — khách thuê không có quyền truy cập' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response, req);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        const role = (token as Record<string, unknown> | null)?.role as string | undefined;

        // /khach-thue/dashboard/* chỉ dành cho khachThue
        if (pathname.startsWith('/khach-thue/dashboard')) {
          return !!token && role === 'khachThue';
        }

        // /dashboard/* chỉ dành cho NguoiDung (không phải khachThue)
        if (pathname.startsWith('/dashboard')) {
          return !!token && role !== 'khachThue';
        }

        // /api/webhook/* không cần session (public endpoint giống HA)
        if (pathname.startsWith('/api/webhook/')) return true;

        // /api/admin/create-first không cần session (bootstrap admin đầu tiên)
        if (pathname === '/api/admin/create-first') return true;

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
    '/khach-thue/dashboard/:path*',
    '/api/:path*',
  ],
};
