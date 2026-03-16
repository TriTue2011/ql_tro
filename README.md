# Hệ thống Quản Lý Phòng Trọ

Ứng dụng web quản lý nhà trọ hiện đại xây dựng với **Next.js 15**, **TypeScript**, **PostgreSQL** và **Prisma ORM**.
Hỗ trợ toàn bộ vòng đời: tòa nhà → phòng → hợp đồng → hóa đơn → thanh toán → sự cố → thông báo Zalo.

---

## Mục lục

1. [Tính năng chính](#tính-năng-chính)
2. [Tech Stack](#tech-stack)
3. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
4. [Cài đặt Development](#cài-đặt-development)
5. [Cài đặt Production (Linux + PM2)](#cài-đặt-production--linux--pm2)
6. [Cấu hình .env.local — toàn bộ biến](#cấu-hình-envlocal--toàn-bộ-biến)
7. [Cấu hình trong UI — Cài đặt hệ thống](#cấu-hình-trong-ui--cài-đặt-hệ-thống)
8. [Zalo Bot — Hướng dẫn từ đầu đến cuối](#zalo-bot--hướng-dẫn-từ-đầu-đến-cuối)
9. [Cloudflare Tunnel — Expose local app ra internet](#cloudflare-tunnel--expose-local-app-ra-internet)
10. [Lưu trữ ảnh (Local / Cloudinary / MinIO)](#lưu-trữ-ảnh)
11. [Tự động deploy với cron](#tự-động-deploy-với-cron)
12. [Database Schema](#database-schema)
13. [API Routes](#api-routes)
14. [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
15. [Checklist trước khi go-live](#checklist-trước-khi-go-live)

---

## Tính năng chính

| Nhóm | Chức năng |
|------|-----------|
| Dashboard | Thống kê tổng quan, biểu đồ doanh thu, cảnh báo hóa đơn quá hạn & hợp đồng sắp hết hạn |
| Tòa nhà | CRUD, upload ảnh, quản lý tiện ích chung |
| Phòng | CRUD, lọc theo trạng thái, lịch sử thuê, tiện nghi |
| Khách thuê | CRUD, upload ảnh CCCD 2 mặt, lịch sử thuê & thanh toán |
| Hợp đồng | Tạo/gia hạn/chấm dứt, upload PDF, in hợp đồng |
| Chỉ số điện nước | Ghi chỉ số hàng tháng, upload ảnh đồng hồ, tự động tính tiêu thụ |
| Hóa đơn | Tạo tự động theo chu kỳ, tính điện/nước/dịch vụ, gửi thông báo Zalo, in, xuất Excel |
| Thanh toán | Ghi nhận thanh toán (tiền mặt/chuyển khoản/ví), upload biên lai |
| Sự cố | Báo cáo, phân loại, theo dõi tiến độ xử lý, upload ảnh |
| Thông báo | Chuông thông báo realtime, gửi thông báo Zalo Bot |
| Cài đặt | Quản lý tài khoản, cấu hình lưu trữ ảnh (Local/MinIO/Cloudinary), Zalo Bot, bảo mật |

---

## Tech Stack

**Frontend:** Next.js 15 (App Router) · TypeScript · shadcn/ui · Tailwind CSS v4 · Recharts · React Hook Form + Zod
**Backend:** Next.js API Routes · NextAuth.js (JWT) · Prisma 7 · PostgreSQL · Repository Pattern
**Infrastructure:** Docker (PostgreSQL) · PM2 · Cloudflare Tunnel (tùy chọn)

---

## Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu | Ghi chú |
|----------|---------------------|---------|
| Node.js | 20+ | Khuyến nghị LTS |
| npm | 9+ | Đi kèm Node.js |
| PostgreSQL | 14+ | Local hoặc Docker |
| Docker | 20+ | Chỉ cần ở production |
| PM2 | 5+ | Chỉ cần ở production (`npm i -g pm2`) |
| cloudflared | Bất kỳ | Chỉ cần nếu dùng Cloudflare Tunnel |

---

## Cài đặt Development

### Bước 1 — Clone repository

```bash
git clone https://github.com/TriTue2011/ql_tro.git
cd ql_tro
```

### Bước 2 — Cài dependencies

```bash
npm install
# Tự động chạy prisma generate (postinstall hook)
```

### Bước 3 — Tạo file `.env.local`

```bash
cp .env.local.example .env.local   # nếu có file mẫu
# hoặc tạo thủ công, xem mục "Cấu hình .env.local" bên dưới
```

Nội dung tối thiểu để chạy development:

```env
POSTGRESQL_URI=postgresql://postgres:postgres@localhost:5432/ql_tro
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<chuỗi ngẫu nhiên — xem cách sinh bên dưới>
```

Sinh `NEXTAUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Bước 4 — Tạo database và apply migrations

```bash
# Tạo database (nếu chưa có)
psql -U postgres -c "CREATE DATABASE ql_tro;"

# Apply tất cả migrations (tạo bảng)
npx prisma migrate deploy
```

> **Dùng Docker PostgreSQL:**
> ```bash
> docker run -d --name ql_tro_postgres \
>   -e POSTGRES_PASSWORD=postgres \
>   -p 5432:5432 \
>   postgres:16
> docker exec ql_tro_postgres psql -U postgres -c "CREATE DATABASE ql_tro;"
> npx prisma migrate deploy
> ```

### Bước 5 — Tạo tài khoản admin đầu tiên

```bash
# Chạy dev server trước
npm run dev

# Sau đó gọi API (terminal khác)
curl -X POST http://localhost:3000/api/admin/create-first \
  -H "Content-Type: application/json" \
  -d '{"ten":"Admin","email":"admin@example.com","matKhau":"admin123"}'
```

> API này **tự khóa** sau khi đã có ít nhất một admin trong hệ thống.

### Bước 6 — Chạy dev server

```bash
npm run dev
# Truy cập: http://localhost:3000
```

---

## Cài đặt Production (Linux + PM2)

### Bước 1 — Chuẩn bị server

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2

# Docker (nếu chưa có)
curl -fsSL https://get.docker.com | sh
```

### Bước 2 — Clone và cài dependencies

```bash
git clone https://github.com/TriTue2011/ql_tro.git /opt/ql_tro
cd /opt/ql_tro
npm install
```

### Bước 3 — Tạo PostgreSQL container

```bash
docker run -d --name ql_tro_postgres \
  --restart unless-stopped \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16

docker exec ql_tro_postgres psql -U postgres -c "CREATE DATABASE ql_tro;"
```

### Bước 4 — Tạo `.env.local`

```bash
nano /opt/ql_tro/.env.local
```

Xem đầy đủ nội dung ở mục [Cấu hình .env.local](#cấu-hình-envlocal--toàn-bộ-biến) bên dưới.
Với production, `NEXTAUTH_URL` phải là URL thật (IP server hoặc domain hoặc Cloudflare Tunnel URL).

### Bước 5 — Build và khởi động

```bash
cd /opt/ql_tro

# Build (tự động apply migrations rồi mới build Next.js)
npm run build

# Khởi động qua PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # đăng ký tự khởi động cùng hệ thống (chạy lệnh nó in ra)
```

Output build thành công:
```
[migrate] Kết nối PostgreSQL thành công.
[migrate]   Applying: 20260308022917_init... OK
[migrate] Tất cả migrations đã được apply.
✓ Compiled successfully
```

### Bước 6 — Tạo tài khoản admin

```bash
curl -X POST http://localhost:3000/api/admin/create-first \
  -H "Content-Type: application/json" \
  -d '{"ten":"Admin","email":"admin@example.com","matKhau":"<mat-khau-manh>"}'
```

### Bước 7 — Cấu hình Zalo và các tùy chọn khác trong UI

Đăng nhập vào app → **Cài đặt → Tab Hệ thống** → cấu hình từng nhóm.
Xem chi tiết ở mục [Cấu hình trong UI](#cấu-hình-trong-ui--cài-đặt-hệ-thống) bên dưới.

---

## Cấu hình `.env.local` — toàn bộ biến

> **Lưu ý:** File `.env.local` **không được commit** lên git (đã có trong `.gitignore`).

```env
# ═══════════════════════════════════════════════════════
# DATABASE — PostgreSQL (BẮT BUỘC)
# ═══════════════════════════════════════════════════════

# Chuỗi kết nối PostgreSQL
# Development:  postgresql://postgres:postgres@localhost:5432/ql_tro
# Docker local: postgresql://postgres:postgres@localhost:5432/ql_tro
# Remote:       postgresql://user:password@host:5432/ql_tro
POSTGRESQL_URI=postgresql://postgres:postgres@localhost:5432/ql_tro

# ═══════════════════════════════════════════════════════
# NEXTAUTH (BẮT BUỘC)
# ═══════════════════════════════════════════════════════

# URL công khai của ứng dụng — RẤT QUAN TRỌNG
#   Development:       http://localhost:3000
#   Production (IP):   http://123.456.789.0:3000
#   Production (domain): https://tro.example.com
#   Cloudflare Tunnel: https://abc123.trycloudflare.com  ← URL tunnel của bạn
#
# NEXTAUTH_URL được dùng để:
#   - NextAuth tạo callback URL đăng nhập
#   - Tự động điền Webhook URL cho Zalo Bot (không cần nhập tay)
NEXTAUTH_URL=http://localhost:3000

# Secret ngẫu nhiên để ký JWT — tạo bằng:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# KHÔNG dùng cùng một secret ở nhiều môi trường
NEXTAUTH_SECRET=your-random-secret-here

# ═══════════════════════════════════════════════════════
# LƯU TRỮ ẢNH — chỉ cần nếu KHÔNG dùng local
# (Có thể cấu hình qua UI thay vì đặt ở đây)
# ═══════════════════════════════════════════════════════

# Cloudinary (nếu STORAGE_PROVIDER=cloudinary hoặc both — cấu hình qua UI)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
# CLOUDINARY_UPLOAD_PRESET=

# MinIO (nếu STORAGE_PROVIDER=minio — cấu hình qua UI)
# MINIO_ENDPOINT=http://your-minio:9000
# MINIO_ACCESS_KEY=
# MINIO_SECRET_KEY=
# MINIO_BUCKET=ql-tro
```

> **Không cần đặt** `ZALO_ACCESS_TOKEN` hay `ZALO_WEBHOOK_SECRET` vào `.env.local`.
> Các giá trị Zalo được **lưu trong database** qua giao diện **Cài đặt → Thông báo**.
> Lý do: token Zalo có thể hết hạn và cần cập nhật mà **không cần rebuild app**.

---

## Cấu hình trong UI — Cài đặt hệ thống

Vào **Dashboard → Cài đặt → Tab Hệ thống** (chỉ admin và chủ trọ thấy tab này).

---

### Nhóm "Thông báo"

#### Cảnh báo hóa đơn quá hạn (ngày)
- **Key:** `thong_bao_qua_han_hoa_don`
- **Mặc định:** `3`
- Sau bao nhiêu ngày tính từ ngày đến hạn, hệ thống mới đánh dấu hóa đơn là "quá hạn" và gửi cảnh báo.

#### Cảnh báo trước khi hợp đồng hết hạn (ngày)
- **Key:** `thong_bao_truoc_han_hop_dong`
- **Mặc định:** `30`
- Gửi cảnh báo trước bao nhiêu ngày khi hợp đồng sắp hết hạn.

#### Zalo Bot Access Token 🔒
- **Key:** `zalo_access_token`
- Lấy từ [Zalo Bot Platform](https://botplatform.zalo.me) → chọn bot → copy token.
- Token có thời hạn (thường 3 tháng) — khi hết hạn, lưu token mới vào đây mà **không cần rebuild**.
- Xem hướng dẫn lấy token chi tiết ở mục [Zalo Bot](#zalo-bot--hướng-dẫn-từ-đầu-đến-cuối).

#### Zalo Webhook Secret Token 🔒
- **Key:** `zalo_webhook_secret`
- Chuỗi bí mật để xác thực request từ Zalo gửi vào webhook của bạn.
- Tự đặt, ví dụ: `my-super-secret-token-2024` (không chứa ký tự đặc biệt, ≥ 16 ký tự).
- **Phải khớp** với secret bạn đăng ký trên Zalo Bot Platform.
- **Lưu trước** → rồi mới đăng ký webhook.

---

### Nhóm "Lưu trữ ảnh"

#### Nhà cung cấp lưu trữ
- **Key:** `storage_provider`
- Chọn một trong:
  - `local` — Lưu vào `public/uploads/` trên server. Đơn giản, không cần cấu hình thêm. **Mất ảnh nếu xóa server.**
  - `cloudinary` — Lưu online trên Cloudinary. Phù hợp production. Cần điền 4 trường bên dưới.
  - `minio` — Lưu trên MinIO tự host (S3-compatible). Cần điền 4 trường MinIO.
  - `both` — Lưu cả MinIO lẫn Cloudinary (backup redundant).

#### Cloudinary (khi chọn `cloudinary` hoặc `both`)

| Trường | Cách lấy |
|--------|----------|
| Cloudinary Cloud Name | [cloudinary.com](https://cloudinary.com) → Dashboard → Cloud Name |
| Cloudinary API Key | Dashboard → API Keys |
| Cloudinary API Secret 🔒 | Dashboard → API Keys (click Reveal) |
| Cloudinary Upload Preset | Settings → Upload → Add upload preset → chọn **Unsigned** → lấy tên preset |

#### MinIO (khi chọn `minio` hoặc `both`)

| Trường | Ví dụ |
|--------|-------|
| MinIO Endpoint URL | `http://192.168.1.10:9000` |
| MinIO Access Key | `minioadmin` |
| MinIO Secret Key 🔒 | `minioadmin123` |
| MinIO Bucket Name | `ql-tro` |

---

### Nhóm "Hệ thống"

| Trường | Mô tả |
|--------|-------|
| Tên công ty / nhà trọ | Hiển thị trên hóa đơn in |
| Email liên hệ | Hiển thị trên hóa đơn |
| Số điện thoại liên hệ | Hiển thị trên hóa đơn |
| Địa chỉ công ty | Hiển thị trên hóa đơn |
| URL logo | URL ảnh logo (có thể là Cloudinary URL) |
| Đơn vị tiền tệ | Mặc định: `VND` |

---

### Nhóm "Bảo mật"

| Trường | Mô tả |
|--------|-------|
| Thời gian hết hạn phiên (ngày) | Mặc định: `30`. Sau số ngày này user phải đăng nhập lại |
| Số lần đăng nhập tối đa/phút | Mặc định: `10`. Rate limit chống brute force |
| **Cloudflare Tunnel** ← Toggle | Bật nếu app chạy qua `cloudflared tunnel`. Ảnh hưởng đến xử lý IP thực của client |
| Allowed Origins | Danh sách domain được phép (phân cách dấu phẩy). Để trống = cho phép tất cả |

> **Toggle Cloudflare Tunnel:** Kéo sang **Bật** khi bạn đang expose app qua Cloudflare Tunnel. Đảm bảo ứng dụng đọc IP thực của client qua header `CF-Connecting-IP`.

---

## Zalo Bot — Hướng dẫn từ đầu đến cuối

Hệ thống dùng **Zalo Bot API** (`bot-api.zaloplatforms.com`), **không phải** Zalo OA API.

### Bước 1 — Tạo Zalo Bot

1. Truy cập [https://botplatform.zalo.me](https://botplatform.zalo.me)
2. Đăng nhập bằng tài khoản Zalo của bạn
3. Nhấn **Tạo Bot mới** → đặt tên → tạo
4. Vào phần **Access Token** → copy token (dạng `xxxxxxxx.yyyyyyyy.zzzzzzzz`)

### Bước 2 — Lưu Access Token vào hệ thống

1. Đăng nhập dashboard → **Cài đặt → Tab Hệ thống → Nhóm Thông báo**
2. Dán token vào trường **Zalo Bot Access Token** 🔒
3. Nhấn **Lưu Thông báo**

### Bước 3 — Đặt Webhook Secret

1. Tự đặt một chuỗi bí mật, ví dụ: `ql-tro-webhook-secret-2024` (≥ 16 ký tự)
2. Lưu vào trường **Zalo Webhook Secret Token** 🔒
3. Nhấn **Lưu Thông báo**
4. Ghi nhớ chuỗi này — cần dùng lại ở bước đăng ký webhook

> ⚠️ **Lưu secret TRƯỚC khi đăng ký webhook.** Nếu không có secret, nút "Đăng ký Webhook" sẽ báo lỗi.

### Bước 4 — Đảm bảo NEXTAUTH_URL đúng

Kiểm tra `.env.local`:

```env
# Nếu dùng Cloudflare Tunnel:
NEXTAUTH_URL=https://abc123.trycloudflare.com

# Nếu có domain riêng:
NEXTAUTH_URL=https://tro.example.com

# Nếu dùng IP server trực tiếp:
NEXTAUTH_URL=http://123.456.789.0:3000
```

> URL này phải **truy cập được từ internet** — Zalo sẽ gọi vào `NEXTAUTH_URL/api/zalo/webhook`.

### Bước 5 — Đăng ký Webhook trên hệ thống

1. Vào **Cài đặt → Tab Hệ thống → Card "Zalo Webhook"**
2. Kiểm tra **Webhook URL** hiển thị — nếu badge xanh `✓ từ NEXTAUTH_URL` là đúng
   - Nếu badge vàng `⚠ URL từ trình duyệt` → `NEXTAUTH_URL` chưa được set đúng trong `.env.local`
   - Có thể chỉnh tay URL trong ô input nếu cần
3. Nhấn **Đăng ký Webhook**
4. Nhấn **Kiểm tra trạng thái** để verify

### Bước 6 — Đăng ký Webhook trên Zalo Bot Platform

1. Quay lại [https://botplatform.zalo.me](https://botplatform.zalo.me)
2. Vào bot của bạn → **Webhook Settings**
3. Điền:
   - **Webhook URL:** `https://your-domain.com/api/zalo/webhook`
   - **Secret Token:** chuỗi bí mật bạn đặt ở Bước 3
4. Lưu

### Bước 7 — Test gửi tin nhắn

1. Vào **Cài đặt → Card "Gửi tin nhắn Zalo test"**
2. Nhập **Chat ID** của người nhận (lấy từ phần quản lý khách thuê sau khi đã liên kết)
3. Nhấn **Gửi tin nhắn test** — nếu thành công sẽ hiện badge xanh

### Luồng hoạt động Webhook (tự động liên kết Chat ID)

```
Khách thuê nhắn tin vào Zalo Bot
        ↓
Zalo POST → https://your-domain.com/api/zalo/webhook
        ↓
System: validate X-Bot-Api-Secret-Token header
        ↓
So khớp tên người gửi với danh sách khách thuê (fuzzy match)
        ↓
Lưu vào pendingZaloChatId (chờ admin xác nhận)
        ↓
Admin: Cài đặt → Liên kết Zalo → Xác nhận / Từ chối
        ↓
Sau khi xác nhận: zaloChatId được lưu, gửi thông báo tự động được
```

### Lưu ý quan trọng về Zalo Bot

| Vấn đề | Giải pháp |
|--------|-----------|
| Token hết hạn (~3 tháng) | Lấy token mới từ Zalo Platform → lưu vào UI → **không cần rebuild** |
| Webhook không nhận được tin | Kiểm tra `NEXTAUTH_URL` đúng và server accessible từ internet |
| Chat ID tự động khớp sai người | Hệ thống dùng fuzzy name match, luôn cần admin xác nhận thủ công |
| Gửi tin nhắn thất bại 401 | Token đã hết hạn, cần cập nhật |

---

## Cloudflare Tunnel — Expose local app ra internet

Dùng Cloudflare Tunnel khi server chạy sau NAT/firewall và không có IP public, nhưng vẫn cần Zalo Webhook hoạt động.

### Cài đặt cloudflared

```bash
# Linux (Debian/Ubuntu)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Hoặc dùng brew (macOS)
brew install cloudflare/cloudflare/cloudflared
```

### Chạy tunnel nhanh (không cần tài khoản — cho dev/test)

```bash
cloudflared tunnel --url http://localhost:3000
# Sẽ in ra URL dạng: https://abc123.trycloudflare.com
```

> URL này thay đổi mỗi lần restart. Chỉ dùng để test, **không ổn định cho production**.

### Tunnel cố định với domain riêng (production)

```bash
# 1. Đăng nhập Cloudflare
cloudflared tunnel login

# 2. Tạo tunnel
cloudflared tunnel create ql-tro

# 3. Tạo file config ~/.cloudflared/config.yml
cat > ~/.cloudflared/config.yml << EOF
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: tro.example.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# 4. Thêm DNS record
cloudflared tunnel route dns ql-tro tro.example.com

# 5. Chạy tunnel
cloudflared tunnel run ql-tro

# 6. (Tùy chọn) Chạy như service systemd
cloudflared service install
systemctl start cloudflared
```

### Cấu hình sau khi có Tunnel URL

**1. Cập nhật `.env.local`:**
```env
NEXTAUTH_URL=https://tro.example.com   # hoặc https://abc123.trycloudflare.com
```

**2. Rebuild app** (vì `NEXTAUTH_URL` đọc lúc build):
```bash
npm run build && pm2 restart ql-tro
```

**3. Bật toggle trong UI:**
Cài đặt → Tab Hệ thống → Nhóm Bảo mật → **Cloudflare Tunnel** → kéo sang **Bật** → Lưu

**4. Đăng ký lại Webhook Zalo** (vì URL đã thay đổi):
Cài đặt → Card Zalo Webhook → Webhook URL sẽ tự cập nhật → nhấn **Đăng ký Webhook**

---

## Lưu trữ ảnh

### Local (mặc định)

```
Không cần cấu hình gì thêm.
Ảnh lưu tại: /opt/ql_tro/public/uploads/
```

> ⚠️ Nếu server bị xóa hoặc reinstall, ảnh sẽ mất. Khuyến nghị backup thư mục `uploads/` định kỳ hoặc dùng Cloudinary.

### Cloudinary (khuyến nghị production)

1. Đăng ký tại [cloudinary.com](https://cloudinary.com) (có free tier)
2. Dashboard → lấy **Cloud Name**, **API Key**, **API Secret**
3. Settings → Upload → **Add upload preset** → chọn **Unsigned** → lưu tên preset
4. Vào **Cài đặt hệ thống → Nhóm Lưu trữ** → chọn `cloudinary` → điền 4 trường → Lưu

### Chuyển đổi provider không làm mất ảnh cũ

Khi đổi từ `local` sang `cloudinary`, ảnh cũ (đường dẫn `/uploads/...`) vẫn hiển thị bình thường.
Chỉ ảnh **upload mới** sẽ đi lên Cloudinary.

---

## Tự động deploy với cron

Script `scripts/deploy.sh` kiểm tra GitHub mỗi phút, tự động pull và rebuild khi có commit mới trên `main`.

```bash
chmod +x /opt/ql_tro/scripts/deploy.sh

# Tạo thư mục log
mkdir -p /opt/ql_tro/logs

# Thêm vào crontab
(crontab -l 2>/dev/null; echo "* * * * * /opt/ql_tro/scripts/deploy.sh >> /opt/ql_tro/logs/deploy.log 2>&1") | crontab -

# Theo dõi log
tail -f /opt/ql_tro/logs/deploy.log
```

Sau khi thiết lập, quy trình deploy chỉ cần:
```bash
git push origin main
# Server tự: pull → migrate → build → pm2 restart — trong vòng ~1 phút
```

---

## Database Schema

| Model | Mô tả |
|-------|-------|
| `NguoiDung` | Tài khoản (admin / chuNha / nhanVien), có `zaloChatId` |
| `ToaNha` | Tòa nhà / khu nhà trọ |
| `Phong` | Phòng trọ (trong / daDat / dangThue / baoTri) |
| `KhachThue` | Khách thuê, có `zaloChatId` và `pendingZaloChatId` |
| `HopDong` | Hợp đồng thuê phòng |
| `ChiSoDienNuoc` | Chỉ số điện nước hàng tháng |
| `HoaDon` | Hóa đơn tháng |
| `ThanhToan` | Giao dịch thanh toán |
| `SuCo` | Sự cố cần xử lý |
| `ThongBao` | Thông báo hệ thống |
| `CaiDat` | Cài đặt hệ thống dạng key-value (lưu token Zalo, cấu hình storage...) |

### Thêm migration mới

```bash
# Development
npx prisma migrate dev --name ten_migration

# Production (tự chạy khi npm run build)
npx prisma migrate deploy  # chạy thủ công nếu cần
```

---

## API Routes

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/[...nextauth]` | Đăng nhập (NextAuth) |
| POST | `/api/admin/create-first` | Tạo admin đầu tiên (tự khóa sau khi dùng) |

### CRUD chính
| Endpoint | Mô tả |
|----------|-------|
| `/api/toa-nha` | Tòa nhà |
| `/api/phong` | Phòng trọ |
| `/api/khach-thue` | Khách thuê |
| `/api/hop-dong` | Hợp đồng |
| `/api/chi-so-dien-nuoc` | Chỉ số điện nước |
| `/api/hoa-don` | Hóa đơn |
| `/api/thanh-toan` | Thanh toán |
| `/api/su-co` | Sự cố |

### Zalo Bot
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/zalo/webhook` | Nhận tin nhắn từ Zalo (public, validate bằng secret) |
| GET/POST | `/api/zalo/set-webhook` | Đăng ký / xóa / kiểm tra webhook |
| POST | `/api/gui-zalo` | Gửi tin nhắn Zalo đến khách thuê |
| GET | `/api/zalo/updates` | Polling tin nhắn (thay thế webhook) |
| GET/POST | `/api/zalo/pending-chat-id` | Quản lý Chat ID chờ xác nhận |
| POST | `/api/zalo/link-chat-id` | Liên kết Chat ID thủ công theo SĐT |

### Admin & System
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/PUT | `/api/admin/settings` | Đọc / cập nhật cài đặt hệ thống |
| GET | `/api/admin/users` | Danh sách người dùng |
| GET | `/api/dashboard/stats` | Thống kê dashboard |
| GET | `/api/notifications` | Chuông thông báo realtime |
| POST | `/api/upload` | Upload file/ảnh |
| POST | `/api/auto-invoice` | Tạo hóa đơn tự động |

---

## Xử lý lỗi thường gặp

### `[migrate] Không có POSTGRESQL_URI, bỏ qua migration`

```bash
# Kiểm tra .env.local có đúng tên biến không
grep POSTGRESQL_URI .env.local

# Thêm nếu thiếu
echo 'POSTGRESQL_URI=postgresql://postgres:postgres@localhost:5432/ql_tro' >> .env.local
```

### `P2021: Table does not exist` / `P2022: Column does not exist`

```bash
# Chạy migrate thủ công
npx prisma migrate deploy

# Hoặc rebuild (sẽ tự migrate trước)
npm run build
```

### `Cannot connect to database`

```bash
# Kiểm tra container đang chạy
docker ps | grep ql_tro_postgres

# Khởi động lại nếu stop
docker start ql_tro_postgres

# Kiểm tra PostgreSQL sẵn sàng
docker exec ql_tro_postgres pg_isready -U postgres
```

### PM2 crash loop hoặc không start

```bash
# Xem log lỗi chi tiết
pm2 logs ql-tro --lines 100

# Reset và khởi động lại
pm2 delete ql-tro
npm run build
pm2 start ecosystem.config.js
pm2 save
```

### Webhook Zalo không nhận được request

1. Kiểm tra `NEXTAUTH_URL` trong `.env.local` là URL public (không phải localhost)
2. Kiểm tra Cloudflare Tunnel đang chạy: `curl https://your-tunnel-url/api/health`
3. Kiểm tra secret khớp: cùng chuỗi trong UI và Zalo Bot Platform
4. Nhấn **Kiểm tra trạng thái** trong card Zalo Webhook để xem thông tin

### Zalo gửi tin thất bại (lỗi 401 / token invalid)

Token đã hết hạn. Quy trình gia hạn:
1. Vào [https://botplatform.zalo.me](https://botplatform.zalo.me) → lấy token mới
2. **Cài đặt → Thông báo → Zalo Bot Access Token** → dán token mới → **Lưu**
3. **Không cần rebuild hay restart PM2**

### `Module not found` / lỗi sau khi pull code mới

```bash
rm -rf node_modules .next
npm install
npm run build
pm2 restart ql-tro
```

### Port 3000 đang bận

```bash
lsof -i :3000
kill -9 <PID>
```

---

## Checklist trước khi go-live

### Môi trường

- [ ] Node.js 20+ đã cài
- [ ] Docker đang chạy
- [ ] Container `ql_tro_postgres` đang chạy và healthy
- [ ] Database `ql_tro` đã tạo

### File `.env.local`

- [ ] `POSTGRESQL_URI` đúng — kết nối được database
- [ ] `NEXTAUTH_URL` là URL **công khai** (không phải localhost nếu production)
- [ ] `NEXTAUTH_SECRET` đã đặt (chuỗi ngẫu nhiên mạnh)

### Build & Deploy

- [ ] `npm run build` thành công — thấy `[migrate] Tất cả migrations đã được apply.`
- [ ] PM2 đang chạy: `pm2 status` hiện `online`
- [ ] `pm2 startup && pm2 save` đã chạy

### Tài khoản

- [ ] Admin đầu tiên đã tạo qua `/api/admin/create-first`
- [ ] Đăng nhập được tại URL công khai

### Zalo Bot (nếu dùng)

- [ ] Zalo Bot đã tạo tại botplatform.zalo.me
- [ ] **Access Token** đã lưu trong UI (Cài đặt → Thông báo)
- [ ] **Webhook Secret** đã lưu trong UI (Cài đặt → Thông báo)
- [ ] `NEXTAUTH_URL` đúng → Webhook URL hiển thị badge xanh
- [ ] Nhấn **Đăng ký Webhook** thành công
- [ ] Đăng ký webhook trên Zalo Bot Platform với cùng secret
- [ ] Test gửi tin nhắn thành công

### Cloudflare Tunnel (nếu dùng)

- [ ] `cloudflared` đã cài
- [ ] Tunnel đang chạy và URL accessible từ internet
- [ ] `NEXTAUTH_URL` = tunnel URL trong `.env.local`
- [ ] Rebuild app sau khi đổi `NEXTAUTH_URL`
- [ ] Toggle **Cloudflare Tunnel** đã Bật trong Cài đặt → Bảo mật

### Lưu trữ ảnh (nếu dùng Cloudinary)

- [ ] Tài khoản Cloudinary đã tạo
- [ ] Upload Preset (unsigned) đã tạo
- [ ] 4 trường Cloudinary đã điền trong UI
- [ ] Storage provider đổi sang `cloudinary`
- [ ] Test upload ảnh thành công

---

## Cấu trúc thư mục

```
ql_tro/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # SQL migrations
├── scripts/
│   ├── migrate-prod.js        # Auto-migrate khi build
│   ├── deploy.sh              # Auto-deploy từ GitHub (dùng với cron)
│   └── start-services.sh      # Khởi động toàn bộ dịch vụ
├── src/
│   ├── app/
│   │   ├── api/               # API Routes
│   │   │   ├── zalo/          # Zalo Bot endpoints
│   │   │   ├── admin/         # Admin endpoints
│   │   │   └── ...            # CRUD endpoints
│   │   └── (dashboard)/       # Dashboard UI pages
│   ├── components/            # React components (shadcn/ui)
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config
│   │   ├── prisma.ts          # Prisma client
│   │   └── repositories/      # Data access layer
│   └── types/                 # TypeScript types
├── public/
│   └── uploads/               # Ảnh lưu local
├── ecosystem.config.js        # PM2 config
└── .env.local                 # Environment variables (không commit)
```

---

## Phân quyền

| Vai trò | Quyền |
|---------|-------|
| `admin` | Toàn quyền: quản lý tài khoản, cài đặt hệ thống, xem tất cả dữ liệu |
| `chuNha` | Quản lý tòa nhà, phòng, hợp đồng, hóa đơn, báo cáo, cài đặt Zalo |
| `nhanVien` | Xem và thao tác theo phân công, không vào cài đặt hệ thống |

---

## Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Dev server với Turbopack |
| `npm run build` | Migrate → prisma generate → next build |
| `npm run start` | Chạy bản production đã build |
| `npm run check-setup` | Kiểm tra cấu hình môi trường |
| `node scripts/migrate-prod.js` | Apply migrations thủ công |
| `bash scripts/deploy.sh` | Deploy thủ công |

---

## Liên hệ & Hỗ trợ

- **GitHub Issues:** https://github.com/TriTue2011/ql_tro/issues
- **Log lỗi:** `pm2 logs ql-tro --lines 100`

---

*Dự án phát triển bởi Phạm Trung Dũng — OpenSource theo MIT License*
