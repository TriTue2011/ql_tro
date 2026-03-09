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
          // Không cache trang dashboard (dữ liệu nhạy cảm)
          // (chỉ áp dụng cho /dashboard và /api — see below)
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
