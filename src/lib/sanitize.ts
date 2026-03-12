/**
 * Sanitize input để chặn XSS và injection attacks.
 *
 * Tại sao cần thêm layer này dù đã có Zod?
 * - Zod validate cấu trúc (type, length, format) nhưng KHÔNG loại bỏ nội dung độc hại
 * - Ví dụ: "<script>alert(1)</script>" vẫn pass qua z.string() của Zod
 * - Sanitize loại bỏ HTML/script TRƯỚC khi dữ liệu lưu vào DB và hiển thị lại
 *
 * Không dùng thư viện ngoài (DOMPurify chỉ chạy browser) để giữ bundle nhỏ.
 */

/** Escape ký tự HTML đặc biệt — dùng khi render text vào HTML */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/** Strip toàn bộ HTML tags — dùng cho text fields (tên, địa chỉ, ghi chú) */
export function stripHtml(str: string): string {
  // Xóa script/style/event handler trước
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // onclick="...", onload='...'
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')         // onclick=alert(1)
    .replace(/javascript\s*:/gi, '')               // href="javascript:..."
    .replace(/vbscript\s*:/gi, '')
    .replace(/<[^>]+>/g, '');                      // strip remaining tags
}

/** Sanitize string thông thường — trim + strip HTML */
export function sanitizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return stripHtml(value.trim());
}

/** Sanitize một object: áp dụng sanitizeText cho tất cả string fields */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? sanitizeText(item) : item
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Kiểm tra chuỗi có chứa SQL injection pattern không.
 * Đây là lớp bảo vệ bổ sung — Prisma đã parameterize queries,
 * nhưng log/cảnh báo giúp phát hiện tấn công sớm.
 */
export function hasSqlInjectionPattern(str: string): boolean {
  const patterns = [
    /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)(\b)/i,
    /--\s/,          // SQL comment
    /;\s*(DROP|DELETE|UPDATE|INSERT)/i,
    /'\s*OR\s*'?\d/i, // ' OR '1'='1
    /'\s*;\s*/,       // '; DROP TABLE
  ];
  return patterns.some(p => p.test(str));
}

/**
 * Sanitize dữ liệu đầu vào API và log cảnh báo nếu phát hiện injection.
 * Trả về dữ liệu đã được làm sạch.
 */
export function sanitizeApiInput<T extends Record<string, unknown>>(
  data: T,
  endpoint?: string
): T {
  // Kiểm tra SQL injection patterns trong tất cả string values
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && hasSqlInjectionPattern(value)) {
      console.warn(`[SECURITY] SQL injection pattern detected at ${endpoint ?? 'unknown'} — field: ${key}`);
    }
  }

  return sanitizeObject(data);
}
