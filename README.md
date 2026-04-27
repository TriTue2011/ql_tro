# Hệ thống Quản Lý Phòng Trọ

Ứng dụng web quản lý nhà trọ hiện đại xây dựng với **Next.js 15**, **TypeScript**, **PostgreSQL** và **Prisma ORM**.
Hỗ trợ toàn bộ vòng đời: tòa nhà → phòng → hợp đồng → hóa đơn → thanh toán → sự cố → thông báo Zalo.

---

## Mục lục

1. [Tính năng chính](#tính-năng-chính)
2. [Tech Stack](#tech-stack)
3. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
4. [Docker Compose — Khởi động toàn bộ infrastructure](#docker-compose--khởi-động-toàn-bộ-infrastructure)
5. [Cài đặt Development](#cài-đặt-development)
6. [Cài đặt Production (Linux + PM2)](#cài-đặt-production--linux--pm2)
7. [Cài đặt lại từ đầu (clean install)](#cài-đặt-lại-từ-đầu-clean-install)
8. [Cấu hình `.env`](#cấu-hình-envlocal)
9. [Cấu hình trong UI — Cài đặt hệ thống](#cấu-hình-trong-ui--cài-đặt-hệ-thống)
10. [Zalo Bot — Hướng dẫn từ đầu đến cuối](#zalo-bot--hướng-dẫn-từ-đầu-đến-cuối)
11. [Cloudflare Tunnel](#cloudflare-tunnel)
12. [Lưu trữ ảnh](#lưu-trữ-ảnh)
13. [Tự động deploy với cron](#tự-động-deploy-với-cron)
14. [Database Schema & Migrations](#database-schema--migrations)
15. [API Routes](#api-routes)
16. [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
17. [Checklist trước khi go-live](#checklist-trước-khi-go-live)

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
**Backend:** Next.js API Routes · NextAuth.js (JWT) · Prisma 7 · PostgreSQL
**Infrastructure:** Docker · PM2 · MinIO (object storage) · Cloudflare Tunnel (tùy chọn)

---

## Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu | Ghi chú |
|----------|---------------------|---------|
| Node.js | 20+ | Khuyến nghị LTS |
| npm | 9+ | Đi kèm Node.js |
| Docker + Docker Compose | 20+ / 2.0+ | Chạy PostgreSQL & MinIO |
| PM2 | 5+ | Process manager (`npm i -g pm2`) |
| cloudflared | Bất kỳ | Chỉ cần nếu dùng Cloudflare Tunnel |

---

## Docker Compose — Khởi động toàn bộ infrastructure

Tạo file `docker-compose.yml` tại `/opt/ql_pt/` (hoặc import vào Portainer → **Stacks → Add stack**):

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: ql_tro_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ql_tro
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    container_name: ql_tro_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # S3 API — dùng trong app
      - "9001:9001"   # Web Console — quản trị qua trình duyệt
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Zalo Bot Server ─────────────────────────────────────────────────────────
  # Bot Zalo Web (đăng nhập cá nhân bằng QR, không cần OA).
  # Truy cập: http://localhost:3001  (admin/admin)
  # Đăng nhập lần đầu: vào Cài đặt → tab Thông báo → "Lấy QR code" rồi quét.
  zalo:
    image: ghcr.io/smarthomeblack/zalobot-amd64:latest
    container_name: zalo
    restart: unless-stopped
    network_mode: host
    environment:
      - TZ=Asia/Ho_Chi_Minh
      - PORT=3001
    volumes:
      - /opt/zalo_bot:/app/data
      - /opt/zalo_bot/www/zalo_bot:/config/www/zalo_bot

volumes:
  postgres_data:
  minio_data:
```

> **Lưu ý:** Không cần MongoDB — hệ thống chỉ dùng PostgreSQL.

### Cách 1 — Terminal (chọn một trong hai)

```bash
docker compose up -d

# Kiểm tra trạng thái
docker compose ps

# Xem log
docker compose logs -f
```

### Cách 2 — Portainer (chọn một trong hai)

1. Vào Portainer → **Stacks → Add stack**
2. Đặt tên: `ql-tro-infra`
3. Dán nội dung `docker-compose.yml` vào **Web editor**
4. Nhấn **Deploy the stack**

> Chỉ cần dùng **một trong hai cách**. Nếu đã deploy qua Portainer thì bỏ qua lệnh terminal và ngược lại.

### Sau khi khởi động

**Tạo bucket MinIO** (cần làm 1 lần):
```bash
# Cách 1: qua CLI
docker exec ql_tro_minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec ql_tro_minio mc mb local/ql-tro

# Cách 2: qua Web Console
# Truy cập http://<IP-server>:9001 → login minioadmin/minioadmin
# → Buckets → Create Bucket → tên "ql-tro" → Create
```

**Kiểm tra kết nối:**
```bash
docker exec ql_tro_postgres pg_isready -U postgres
# output: /var/run/postgresql:5432 - accepting connections
```

---

## Cài đặt Development

### Bước 1 — Clone repository

```bash
git clone https://github.com/TriTue2011/ql_tro.git
cd ql_tro
```

### Bước 2 — Khởi động infrastructure

```bash
docker compose up -d
```

### Bước 3 — Cài dependencies

```bash
npm install
# Tự động chạy prisma generate (postinstall hook)
```

### Bước 4 — Tạo file `.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ql_tro
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<sinh bằng lệnh bên dưới>
```

```bash
# Sinh NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Bước 5 — Apply migrations

```bash
npx prisma migrate deploy --config prisma/prisma.config.ts
```

### Bước 6 — Chạy dev server và tạo admin

```bash
npm run dev
```

Mở terminal khác:

```bash
curl -X POST http://localhost:3000/api/admin/create-first \
  -H "Content-Type: application/json" \
  -d '{
    "ten": "Admin",
    "email": "admin@example.com",
    "matKhau": "admin123",
    "soDienThoai": "0901234567",
    "setupSecret": "your-setup-secret-here"
  }'
```

> `setupSecret` phải khớp với `ADMIN_SETUP_SECRET` trong `.env`.
> API **tự khóa** sau khi đã có admin — không gọi được lần 2.

Truy cập: **http://localhost:3000**

---

## Cài đặt Production (Linux + PM2)

### Bước 1 — Chuẩn bị server

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2

# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
```

### Bước 2 — Clone và cài dependencies

```bash
git clone https://github.com/TriTue2011/ql_tro.git /opt/ql_pt
cd /opt/ql_pt
npm install
```

### Bước 3 — Khởi động infrastructure

> Dùng **terminal** hoặc **Portainer** — chọn một trong hai.

```bash
# Terminal
cd /opt/ql_pt
docker compose up -d
```

Hoặc qua **Portainer → Stacks → Add stack** → dán nội dung `docker-compose.yml` → Deploy.

**Tạo bucket MinIO** (làm 1 lần sau khi container chạy):
```bash
docker exec ql_tro_minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec ql_tro_minio mc mb local/ql-tro
```

### Bước 4 — Tạo `.env`

```bash
nano /opt/ql_pt/.env
```

Xem nội dung đầy đủ ở mục [Cấu hình .env](#cấu-hình-envlocal) bên dưới.

### Bước 5 — Build và khởi động app

```bash
cd /opt/ql_pt

# Build (tự động migrate → prisma generate → next build)
npm run build

# Khởi động qua PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # chạy lệnh nó in ra để auto-start khi reboot
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
  -d '{
    "ten": "Admin",
    "email": "admin@example.com",
    "matKhau": "<mat-khau-manh>",
    "soDienThoai": "0901234567",
    "setupSecret": "<gia-tri-ADMIN_SETUP_SECRET-trong-env>"
  }'
```

> API **tự khóa** sau khi đã có admin — không gọi được lần 2.

### Bước 7 — Cấu hình trong UI

Đăng nhập → **Cài đặt → Tab Hệ thống** → cấu hình MinIO, Zalo, Cloudflare Tunnel.

---

## Cài đặt lại từ đầu (clean install)

Dùng khi muốn xóa sạch và cài lại hoàn toàn.

### Bước 1 — Dừng app và xóa data

```bash
# Dừng PM2
pm2 delete ql-tro

# Dừng và xóa containers + volumes
cd /opt/ql_pt
docker compose down -v   # -v để xóa luôn volumes (mất data!)

# Xóa thư mục app
rm -rf /opt/ql_pt
```

> ⚠️ `docker compose down -v` sẽ **xóa toàn bộ data** PostgreSQL và MinIO.
> Bỏ `-v` nếu muốn giữ lại data.

### Bước 2 — Clone và cài lại

```bash
git clone https://github.com/TriTue2011/ql_tro.git /opt/ql_pt
cd /opt/ql_pt
npm install
```

### Bước 3 — Khởi động infrastructure

```bash
docker compose up -d

# Tạo bucket
docker exec ql_tro_minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec ql_tro_minio mc mb local/ql-tro
```

### Bước 4 — Tạo `.env`

```bash
nano /opt/ql_pt/.env
```

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ql_tro
NEXTAUTH_URL=https://<cloudflare-tunnel-url>   # hoặc http://<IP>:3000
NEXTAUTH_SECRET=<chuỗi ngẫu nhiên>
```

### Bước 5 — Build và start

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Bước 6 — Tạo admin và cấu hình UI

```bash
curl -X POST http://localhost:3000/api/admin/create-first \
  -H "Content-Type: application/json" \
  -d '{
    "ten": "Admin",
    "email": "admin@example.com",
    "matKhau": "admin123",
    "soDienThoai": "0901234567",
    "setupSecret": "<gia-tri-ADMIN_SETUP_SECRET-trong-env>"
  }'
```

Sau đó đăng nhập → cấu hình MinIO, Zalo, Cloudflare Tunnel trong **Cài đặt hệ thống**.

---

## Cấu hình `.env`

> File này **không được commit** lên git (đã có trong `.gitignore`).

```env
# ═══════════════════════════════════════════════════════
# DATABASE — PostgreSQL (BẮT BUỘC)
# ═══════════════════════════════════════════════════════

# Kết nối PostgreSQL
# Development:  postgresql://postgres:postgres@localhost:5432/ql_tro
# Production:   postgresql://TriTue2011:AnhNhi%400610@localhost:5432/ql_tro
DATABASE_URL="postgresql://TriTue2011:AnhNhi%400610@localhost:5432/ql_tro"

# ═══════════════════════════════════════════════════════
# NEXTAUTH (BẮT BUỘC)
# ═══════════════════════════════════════════════════════

# URL công khai của ứng dụng — RẤT QUAN TRỌNG
#   Development:        http://localhost:3000
#   Production (IP):    http://123.456.789.0:3000
#   Production (domain):https://tro.example.com
#   Cloudflare Tunnel:  https://abc123.trycloudflare.com
#
# NEXTAUTH_URL dùng để:
#   - NextAuth tạo callback URL đăng nhập
#   - Tự động điền Webhook URL cho Zalo Bot
NEXTAUTH_URL=https://qlpt.vhtatn.io.vn

# Sinh bằng: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=JjCEe9WaemeVqTs73yMorrog983BLqvtOnhSMtpT94s=

# ═══════════════════════════════════════════════════════
# ADMIN SETUP — BẮT BUỘC để tạo admin đầu tiên
# ═══════════════════════════════════════════════════════

# Chuỗi bí mật dùng 1 lần để bảo vệ endpoint /api/admin/create-first
# Tự đặt, ví dụ: my-setup-secret-2024
# Có thể xóa khỏi .env sau khi đã tạo admin xong
ADMIN_SETUP_SECRET=AnhNhi@0610
```

> **Không cần** `ZALO_ACCESS_TOKEN`, `DATABASE_PROVIDER`, `MONGODB_URI` hay credentials MinIO/Cloudinary.
> Các giá trị đó được **lưu trong database** qua giao diện **Cài đặt hệ thống** — cập nhật không cần rebuild.

---

## Cấu hình trong UI — Cài đặt hệ thống

Vào **Dashboard → Cài đặt → Tab Hệ thống**.

---

### Nhóm "Thông báo"

| Trường | Mô tả |
|--------|-------|
| Cảnh báo hóa đơn quá hạn (ngày) | Mặc định `3` — sau bao ngày từ hạn thanh toán thì đánh dấu quá hạn |
| Cảnh báo hợp đồng sắp hết hạn (ngày) | Mặc định `30` — gửi cảnh báo trước bao ngày |
| Zalo Bot Access Token 🔒 | Lấy từ [botplatform.zalo.me](https://botplatform.zalo.me) → copy token |
| Zalo Webhook Secret Token 🔒 | Tự đặt chuỗi bí mật ≥ 16 ký tự — phải khớp với Zalo Bot Platform |

---

### Nhóm "Lưu trữ ảnh"

#### Nhà cung cấp lưu trữ (`storage_provider`)

| Giá trị | Mô tả |
|---------|-------|
| `local` | Lưu vào `public/uploads/` trên server. Đơn giản, không cần cấu hình thêm |
| `minio` | Lưu trên MinIO (đã có trong Docker Compose). **Khuyến nghị production** |
| `cloudinary` | Lưu online trên Cloudinary (cloud) |
| `both` | Lưu cả MinIO lẫn Cloudinary |

#### MinIO (khi chọn `minio`)

| Trường | Giá trị |
|--------|---------|
| MinIO Endpoint URL | `http://localhost:9000` |
| MinIO Username | `minioadmin` (= `MINIO_ROOT_USER`) |
| MinIO Password 🔒 | `minioadmin` (= `MINIO_ROOT_PASSWORD`) |
| MinIO Bucket Name | `ql-tro` |

> Port **9000** = S3 API (dùng trong app). Port **9001** = Web Console (quản trị qua browser).
> Username/Password trong UI chính là `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` trong `docker-compose.yml`.

#### Cloudinary (khi chọn `cloudinary`)

| Trường | Cách lấy |
|--------|----------|
| Cloud Name | [cloudinary.com](https://cloudinary.com) → Dashboard |
| API Key | Dashboard → API Keys |
| API Secret 🔒 | Dashboard → API Keys → Reveal |
| Upload Preset | Settings → Upload → Add upload preset → **Unsigned** |

---

### Nhóm "Hệ thống"

| Trường | Mô tả |
|--------|-------|
| Tên công ty / nhà trọ | Hiển thị trên hóa đơn in |
| Email / SĐT / Địa chỉ liên hệ | Hiển thị trên hóa đơn |
| URL logo | URL ảnh logo |
| Đơn vị tiền tệ | Mặc định `VND` |

---

### Nhóm "Bảo mật"

| Trường | Mô tả |
|--------|-------|
| Thời gian hết hạn phiên (ngày) | Mặc định `30` |
| Số lần đăng nhập tối đa/phút | Mặc định `10` — rate limit chống brute force |
| Cloudflare Tunnel (toggle) | Bật khi app chạy qua `cloudflared` — để đọc IP thực qua `CF-Connecting-IP` |
| Allowed Origins | Để trống = cho phép tất cả |

---

## Zalo Bot — Tích hợp Zalo tự động

Hệ thống hiện tại **KHÔNG** sử dụng Zalo Bot Platform (Official Account / Bot API) yêu cầu Webhook hay Access Token 3 tháng.
Thay vào đó, hệ thống sử dụng cơ chế **Bot Server / Login trực tiếp** (thông qua `zca-js` hoặc API nội bộ).

### Cách hoạt động
1. Quản trị viên không cần cấu hình Webhook hay gia hạn Access Token định kỳ.
2. Tin nhắn Zalo (gửi hóa đơn, nhắc nợ, sự cố) sẽ được đẩy trực tiếp qua Session/Cookie của tài khoản Zalo đã login trên Bot Server.
3. Không yêu cầu public `NEXTAUTH_URL` chỉ để nhận Webhook như trước đây.

### Lưu ý khi phát triển
- Các file xử lý logic Zalo nằm trong `src/lib/zalo-*.ts`.
- Mọi thay đổi liên quan đến việc gửi tin nhắn Zalo cần được test trực tiếp với số điện thoại thử nghiệm để tránh spam khách thuê thực tế.

---

## Cloudflare Tunnel

Dùng khi server không có IP public nhưng cần Zalo Webhook hoạt động.

### Cài cloudflared

```bash
# Linux (Debian/Ubuntu)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### Tunnel nhanh (dev/test — URL thay đổi mỗi lần restart)

```bash
cloudflared tunnel --url http://localhost:3000
# → https://abc123.trycloudflare.com
```

### Tunnel cố định (production)

```bash
cloudflared tunnel login
cloudflared tunnel create ql-tro

# Tạo config
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: tro.example.com
    service: http://localhost:3000
  - service: http_status:404
EOF

cloudflared tunnel route dns ql-tro tro.example.com
cloudflared service install && systemctl start cloudflared
```

### Sau khi có Tunnel URL

```bash
# 1. Cập nhật .env
NEXTAUTH_URL=https://tro.example.com

# 2. Rebuild (NEXTAUTH_URL đọc lúc build)
npm run build && pm2 restart ql-tro
```

**3.** Cài đặt → Bảo mật → **Cloudflare Tunnel** → Bật → Lưu

**4.** Cài đặt → Zalo Webhook → URL tự cập nhật → **Đăng ký Webhook**

---

## Lưu trữ ảnh

### Local (mặc định)

Không cần cấu hình. Ảnh lưu tại `public/uploads/`.

> ⚠️ Mất ảnh nếu xóa thư mục app. Nên dùng MinIO hoặc Cloudinary cho production.

### MinIO (khuyến nghị — đã có trong Docker Compose)

Đã chạy sẵn tại port `9000` (API) và `9001` (Console).

Cấu hình trong UI — **Cài đặt → Lưu trữ ảnh**:

| Trường | Giá trị |
|--------|---------|
| Provider | `minio` |
| MinIO Endpoint URL | `http://localhost:9000` |
| MinIO Username | `minioadmin` |
| MinIO Password | `minioadmin` |
| MinIO Bucket Name | `ql-tro` |

> Username và Password tương ứng với `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` trong `docker-compose.yml`.

### Cloudinary

1. Đăng ký [cloudinary.com](https://cloudinary.com) (free tier có sẵn)
2. Lấy Cloud Name, API Key, API Secret từ Dashboard
3. Tạo Upload Preset **Unsigned** tại Settings → Upload
4. Điền vào UI → chọn provider `cloudinary` → Lưu

### Chuyển provider không mất ảnh cũ

Ảnh cũ vẫn hiển thị bình thường. Chỉ ảnh **upload mới** đi vào provider mới.

---

## Tự động deploy với cron

```bash
chmod +x /opt/ql_pt/scripts/deploy.sh
mkdir -p /opt/ql_pt/logs

# Thêm cron — kiểm tra GitHub mỗi phút
(crontab -l 2>/dev/null; echo "* * * * * /opt/ql_pt/scripts/deploy.sh >> /opt/ql_pt/logs/deploy.log 2>&1") | crontab -

# Theo dõi log
tail -f /opt/ql_pt/logs/deploy.log
```

Sau khi thiết lập, chỉ cần:
```bash
git push origin main
# Server tự: pull → migrate → build → pm2 restart (trong ~1 phút)
```

---

## Database Schema & Migrations

### Models

| Model | Mô tả |
|-------|-------|
| `NguoiDung` | Tài khoản (admin / chuNha / nhanVien) |
| `ToaNha` | Tòa nhà / khu nhà trọ |
| `Phong` | Phòng trọ (trong / daDat / dangThue / baoTri) |
| `KhachThue` | Khách thuê, có `zaloChatId` và `pendingZaloChatId` |
| `HopDong` | Hợp đồng thuê phòng |
| `ChiSoDienNuoc` | Chỉ số điện nước hàng tháng |
| `HoaDon` | Hóa đơn tháng |
| `ThanhToan` | Giao dịch thanh toán |
| `SuCo` | Sự cố cần xử lý |
| `ThongBao` | Thông báo hệ thống |
| `CaiDat` | Cài đặt hệ thống key-value (token Zalo, storage config...) |

### Migrations

```bash
# Development — tạo migration mới
npx prisma migrate dev --name ten_migration --config prisma/prisma.config.ts

# Production — apply migrations (tự chạy khi npm run build)
npx prisma migrate deploy --config prisma/prisma.config.ts
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
| POST | `/api/zalo/webhook` | Nhận tin nhắn từ Zalo |
| GET/POST | `/api/zalo/set-webhook` | Đăng ký / kiểm tra webhook |
| POST | `/api/gui-zalo` | Gửi tin nhắn Zalo đến khách thuê |
| GET/POST | `/api/zalo/pending-chat-id` | Chat ID chờ xác nhận |
| POST | `/api/zalo/link-chat-id` | Liên kết Chat ID thủ công |

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

### `[migrate] Không có DATABASE_URL, bỏ qua migration`

```bash
grep DATABASE_URL /opt/ql_pt/.env
# Nếu thiếu:
echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ql_tro' >> .env
```

### `P2021: Table does not exist` / `P2022: Column does not exist`

```bash
npx prisma migrate deploy --config prisma/prisma.config.ts
# hoặc: npm run build  (tự migrate trước khi build)
```

### `Cannot connect to database`

```bash
docker compose ps             # kiểm tra container
docker compose up -d postgres # khởi động lại nếu stop
docker exec ql_tro_postgres pg_isready -U postgres
```

### PM2 crash loop

```bash
pm2 logs ql-tro --lines 100
pm2 delete ql-tro
npm run build
pm2 start ecosystem.config.js && pm2 save
```

### Webhook Zalo không nhận request

1. `NEXTAUTH_URL` phải là URL public (không phải localhost)
2. Cloudflare Tunnel đang chạy: `docker ps | grep cloudflared`
3. Secret khớp giữa UI và Zalo Bot Platform
4. Nhấn **Kiểm tra trạng thái** trong card Zalo Webhook

### Zalo gửi tin thất bại (401)

Token hết hạn → lấy token mới tại [botplatform.zalo.me](https://botplatform.zalo.me) → lưu vào UI → **không cần rebuild**.

### `Module not found` sau khi pull code mới

```bash
rm -rf node_modules .next
npm install && npm run build
pm2 restart ql-tro
```

### Port 3000 đang bận

```bash
lsof -i :3000 && kill -9 <PID>
```

---

## Checklist trước khi go-live

### Infrastructure
- [ ] `docker compose up -d` thành công
- [ ] `docker compose ps` — cả 2 container `healthy`
- [ ] Bucket `ql-tro` đã tạo trong MinIO

### File `.env`
- [ ] `DATABASE_URL` kết nối được database
- [ ] `NEXTAUTH_URL` là URL **public** (không phải localhost)
- [ ] `NEXTAUTH_SECRET` đã đặt

### Build & Deploy
- [ ] `npm run build` thành công — thấy `[migrate] Tất cả migrations đã được apply.`
- [ ] `pm2 status` hiện `online`
- [ ] `pm2 startup && pm2 save` đã chạy

### Tài khoản
- [ ] `ADMIN_SETUP_SECRET` đã thêm vào `.env`
- [ ] Admin tạo qua `/api/admin/create-first` (kèm `soDienThoai` + `setupSecret`)
- [ ] Đăng nhập được tại URL public

### Lưu trữ ảnh
- [ ] Chọn provider trong UI (minio/cloudinary/local)
- [ ] Nếu MinIO: điền endpoint `http://localhost:9000`, username `minioadmin`, password `minioadmin`, bucket `ql-tro`
- [ ] Test upload ảnh thành công

### Zalo Bot (nếu dùng)
- [ ] Bot tạo tại [botplatform.zalo.me](https://botplatform.zalo.me)
- [ ] Access Token lưu trong UI
- [ ] Webhook Secret lưu trong UI
- [ ] Webhook đăng ký thành công (badge xanh)
- [ ] Webhook đăng ký trên Zalo Bot Platform
- [ ] Test gửi tin nhắn thành công

### Cloudflare Tunnel (nếu dùng)
- [ ] Tunnel đang chạy, URL accessible từ internet
- [ ] `NEXTAUTH_URL` = tunnel URL, đã rebuild app
- [ ] Toggle Cloudflare Tunnel **Bật** trong UI

---

## Cấu trúc thư mục

```
ql_tro/
├── docker-compose.yml         # PostgreSQL + MinIO
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # SQL migrations
├── scripts/
│   ├── migrate-prod.js        # Auto-migrate khi build
│   ├── deploy.sh              # Auto-deploy từ GitHub
│   └── start-services.sh      # Khởi động toàn bộ dịch vụ
├── src/
│   ├── app/
│   │   ├── api/               # API Routes
│   │   │   ├── zalo/          # Zalo Bot endpoints
│   │   │   ├── admin/         # Admin endpoints
│   │   │   └── ...            # CRUD endpoints
│   │   └── (dashboard)/       # Dashboard UI pages
│   ├── components/            # React components
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config
│   │   ├── prisma.ts          # Prisma client
│   │   └── repositories/      # Data access layer (PostgreSQL only)
│   └── types/                 # TypeScript types
├── public/
│   └── uploads/               # Ảnh lưu local
├── ecosystem.config.js        # PM2 config
└── .env                 # Environment variables (không commit)
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
