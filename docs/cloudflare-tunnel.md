# Hướng dẫn bảo mật với Cloudflare Tunnel

## Kiến trúc

```
Internet → Cloudflare Edge → Cloudflare Tunnel → localhost:3000 (Next.js)
```

Ứng dụng **không cần mở port** ra ngoài. Cloudflare Tunnel tạo kết nối outbound từ server đến Cloudflare.

---

## Cài đặt Cloudflare Tunnel

```bash
# 1. Cài cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 2. Đăng nhập
cloudflared tunnel login

# 3. Tạo tunnel
cloudflared tunnel create ql-tro

# 4. Cấu hình (~/.cloudflared/config.yml)
# tunnel: <TUNNEL_ID>
# credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
# ingress:
#   - hostname: yourdomain.com
#     service: http://localhost:3000
#   - service: http_status:404

# 5. Chạy tunnel
cloudflared tunnel run ql-tro

# 6. Chạy như service
cloudflared service install
```

---

## Biến môi trường cần đặt

```env
# .env.local
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<random 32+ chars>

# Nếu dùng Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Nếu dùng MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
```

---

## Bảo mật đã tích hợp trong ứng dụng

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Security Headers | ✅ | X-Frame-Options, NOSNIFF, HSTS, CSP |
| Rate Limit đăng nhập | ✅ | 10 req/phút/IP |
| IP thực từ CF-Connecting-IP | ✅ | middleware.ts |
| Admin routes protected | ✅ | /api/admin/* yêu cầu role=admin |
| Tenant isolation | ✅ | JWT khách thuê chỉ truy cập dữ liệu của mình |
| Password hashing | ✅ | bcryptjs 12 rounds |
| Session JWT | ✅ | 30 ngày, ký bằng NEXTAUTH_SECRET |
| XSS Prevention | ✅ | Headers + React auto-escaping |
| CSRF | ✅ | NextAuth built-in |

---

## Khuyến nghị bổ sung (Cloudflare Dashboard)

1. **WAF Rules** → bật Cloudflare Managed Rules
2. **Bot Fight Mode** → bật để chặn bot tự động
3. **Rate Limiting Rules** → đặt thêm ở Cloudflare (layer ngoài)
4. **Access** → cân nhắc Cloudflare Access để bảo vệ /dashboard với SSO
5. **SSL** → chọn Full (strict) trong SSL/TLS settings
6. **Always Use HTTPS** → bật
7. **Minimum TLS Version** → TLS 1.2+

---

## Cài đặt trong UI Admin

Vào **Dashboard → Quản trị → Cài đặt hệ thống** → Tab **Bảo mật**:
- Bật **"Ứng dụng chạy qua Cloudflare Tunnel"**
- Đặt **Số lần đăng nhập tối đa** theo nhu cầu
