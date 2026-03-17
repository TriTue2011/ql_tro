import type { NextConfig } from "next";

/**
 * Cấu hình Next.js — an toàn cho Cloudflare Tunnel
 *
 * Security headers được đặt ở 2 nơi:
 * 1. next.config.ts → headers() — áp dụng cho tất cả responses từ Next.js
 * 2. middleware.ts  → addSecurityHeaders() — áp dụng khi middleware chạy
 *
 * Khi dùng Cloudflare Tunnel:
 * - Cloudflare tự thêm HSTS, WAF, DDoS protection
 * - CF-Connecting-IP chứa IP thực của client
 * - App không cần expose port ra ngoài internet trực tiếp
 */
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Ẩn header X-Powered-By để không lộ Next.js version
  poweredByHeader: false,

  // Cho phép build ngay cả khi có lỗi lint/type (giữ nguyên để deploy không bị block)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // ─── Security Headers ───────────────────────────────────────────────────────
  async headers() {
    // Content-Security-Policy: chặn XSS, chặn script từ domain lạ
    // 'unsafe-inline' cần cho Next.js inline styles & scripts trong App Router
    // 'unsafe-eval' CHỈ dùng trong dev (hot-reload) — bỏ ở production để tăng bảo mật
    const isDev = process.env.NODE_ENV === 'development';

    // upgrade-insecure-requests CHỈ an toàn khi ứng dụng chạy sau HTTPS proxy (Cloudflare Tunnel).
    // Nếu bật trên HTTP trực tiếp, browser sẽ cố upgrade /_next/static CSS/JS lên HTTPS → fail → trang không có style.
    const isBehindHttps = process.env.CLOUDFLARE_TUNNEL === 'true';

    const CSP = [
      "default-src 'self'",
      // Script: production bỏ unsafe-eval, dev giữ để hot-reload hoạt động
      // Khi dùng Cloudflare Tunnel, CF tự inject beacon script từ static.cloudflareinsights.com
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : isBehindHttps
          ? "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"
          : "script-src 'self' 'unsafe-inline'",
      // Style: self + inline (CSS-in-JS / Tailwind) + Bootstrap CDN cho dashboard
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      // Ảnh: self + data URI + blob + Cloudinary + MinIO
      "img-src 'self' data: blob: https://res.cloudinary.com",
      // Font: self + Bootstrap Icons CDN (font files)
      "font-src 'self' data: https://cdn.jsdelivr.net",
      // Kết nối API: self + jsDelivr (browser tự tải source map của Bootstrap)
      isBehindHttps
        ? "connect-src 'self' https://cdn.jsdelivr.net https://cloudflareinsights.com"
        : "connect-src 'self' https://cdn.jsdelivr.net",
      // Không cho phép <object>, <embed>, <applet>
      "object-src 'none'",
      // Không cho phép <base> tag bị hijack
      "base-uri 'self'",
      // Không cho phép form submit ra ngoài domain
      "form-action 'self'",
      // frame-ancestors thay thế X-Frame-Options
      "frame-ancestors 'none'",
      // upgrade-insecure-requests: CHỈ bật khi đứng sau HTTPS proxy
      ...(isBehindHttps ? ["upgrade-insecure-requests"] : []),
    ].join('; ');

    return [
      {
        // Áp dụng cho mọi route
        source: '/(.*)',
        headers: [
          // Ngăn clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Ngăn MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // XSS protection (legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer an toàn
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Tắt tính năng browser không dùng đến
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // HSTS — Cloudflare sẽ thêm sau, nhưng set ở app level để an toàn hơn
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Content-Security-Policy — chặn XSS và script injection
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
      {
        // API routes — không cache
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      {
        // Dashboard — không cache
        source: '/dashboard/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      {
        // Static assets — cache 1 năm (immutable)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Ảnh proxy từ MinIO/Cloudinary
        source: '/api/files/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
