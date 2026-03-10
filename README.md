# Hệ thống Quản Lý Phòng Trọ

Ứng dụng web quản lý nhà trọ hiện đại xây dựng với **Next.js 15**, **TypeScript**, **PostgreSQL** và **Prisma ORM**. Hỗ trợ quản lý toàn bộ vòng đời: tòa nhà → phòng → hợp đồng → hóa đơn → thanh toán → sự cố.

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
| Hóa đơn | Tạo tự động theo chu kỳ, tính điện/nước/dịch vụ, gửi thông báo, in, xuất Excel |
| Thanh toán | Ghi nhận thanh toán (tiền mặt/chuyển khoản/ví), upload biên lai |
| Sự cố | Báo cáo, phân loại, theo dõi tiến độ xử lý, upload ảnh |
| Thông báo | Chuông thông báo realtime, gửi thông báo Zalo OA |
| Cài đặt | Quản lý tài khoản, cấu hình lưu trữ ảnh (Local/MinIO/Cloudinary), Zalo, bảo mật |

---

## Tech Stack

### Frontend
- **Next.js 15** (App Router, Turbopack)
- **TypeScript**
- **Bootstrap 5** + **Bootstrap Icons** — UI chính
- **shadcn/ui** + **Tailwind CSS v4** — một số component
- **React Hook Form** + **Zod** — validation form
- **Recharts** — biểu đồ doanh thu
- **date-fns** — xử lý ngày tháng

### Backend
- **Next.js API Routes** (App Router)
- **NextAuth.js** — xác thực JWT, session, phân quyền (admin / chuNha / nhanVien)
- **Prisma 7** + **PostgreSQL** — ORM, migrations
- **Repository Pattern** — tách biệt data access logic

### Infrastructure (Production)
- **Docker** — chạy PostgreSQL (`ql_tro_postgres`, port 5432)
- **PM2** — process manager cho Next.js app
- **scripts/migrate-prod.js** — tự động apply migrations khi `npm run build`
- **scripts/deploy.sh** — tự động deploy khi push code lên GitHub (chạy qua cron mỗi phút)

---

## Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu | Ghi chú |
|----------|---------------------|---------|
| Node.js | 20+ | Khuyến nghị LTS |
| npm | 9+ | Đi kèm Node.js |
| PostgreSQL | 14+ | Local hoặc Docker |
| Docker | 20+ | Chỉ cần ở production |
| PM2 | 5+ | Chỉ cần ở production |
| Git | Bất kỳ | |

---

## Cài đặt (Development)

### Bước 1 — Clone repository

```bash
git clone https://github.com/TriTue2011/ql_tro.git
cd ql_tro
```

### Bước 2 — Cài dependencies

```bash
npm install
```

Lệnh này sẽ tự chạy `prisma generate` (postinstall hook).

### Bước 3 — Tạo file `.env.local`

Tạo file `.env.local` ở thư mục gốc với nội dung sau:

```env
# ───────────────────────────────────────────
# DATABASE — PostgreSQL
# ───────────────────────────────────────────
# Kết nối PostgreSQL (bắt buộc)
POSTGRESQL_URI=postgresql://postgres:postgres@localhost:5432/ql_tro

# Chế độ database: postgresql | mongodb | both
DATABASE_PROVIDER=postgresql

# ───────────────────────────────────────────
# NEXTAUTH
# ───────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
# Tạo secret ngẫu nhiên: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=your-random-secret-here

# ───────────────────────────────────────────
# LƯU TRỮ ẢNH
# ───────────────────────────────────────────
# Chế độ lưu trữ: local | cloudinary | minio | both
STORAGE_PROVIDER=local

# --- Cloudinary (nếu STORAGE_PROVIDER=cloudinary hoặc both) ---
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=

# --- MinIO (nếu STORAGE_PROVIDER=minio hoặc both) ---
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=ql-tro

# ───────────────────────────────────────────
# ZALO OA (tùy chọn)
# ───────────────────────────────────────────
ZALO_ACCESS_TOKEN=
ZALO_OA_ID=
ZALO_WEBHOOK_SECRET=
```

### Bước 4 — Tạo database PostgreSQL

```bash
# Tạo database (nếu chưa có)
psql -U postgres -c "CREATE DATABASE ql_tro;"

# Apply migrations (tạo tất cả bảng)
npx prisma migrate deploy
```

> **Lưu ý:** Nếu dùng Docker cho PostgreSQL:
> ```bash
> docker run -d --name ql_tro_postgres \
>   -e POSTGRES_PASSWORD=postgres \
>   -p 5432:5432 \
>   postgres:16
> docker exec ql_tro_postgres psql -U postgres -c "CREATE DATABASE ql_tro;"
> npx prisma migrate deploy
> ```

### Bước 5 — Tạo tài khoản admin đầu tiên

Sau khi apply migrations, gọi API để tạo admin:

```bash
curl -X POST http://localhost:3000/api/admin/create-first \
  -H "Content-Type: application/json" \
  -d '{"ten":"Admin","email":"admin@example.com","matKhau":"admin123"}'
```

> API này tự khóa sau khi đã có admin trong hệ thống.

### Bước 6 — Chạy development server

```bash
npm run dev
```

Truy cập: **http://localhost:3000**

Đăng nhập bằng tài khoản vừa tạo ở Bước 5.

---

## Cài đặt (Production — Linux Server)

### Yêu cầu thêm

- Docker đã cài và đang chạy
- PM2 cài global: `npm install -g pm2`
- Node.js 20+ trên server

### Bước 1 — Clone và cài dependencies

```bash
git clone https://github.com/TriTue2011/ql_tro.git /opt/ql_tro
cd /opt/ql_tro
npm install
```

### Bước 2 — Tạo `.env.local`

```bash
nano /opt/ql_tro/.env.local
```

Nội dung tương tự phần Development, thay đổi:

```env
NEXTAUTH_URL=http://<IP-SERVER>:3000   # hoặc domain thực
POSTGRESQL_URI=postgresql://postgres:postgres@localhost:5432/ql_tro
DATABASE_PROVIDER=postgresql
STORAGE_PROVIDER=local                  # hoặc cloudinary nếu đã cấu hình
```

### Bước 3 — Tạo Docker PostgreSQL container

```bash
docker run -d --name ql_tro_postgres \
  --restart unless-stopped \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16

# Tạo database
docker exec ql_tro_postgres psql -U postgres -c "CREATE DATABASE ql_tro;"
```

### Bước 4 — Build và khởi động

```bash
cd /opt/ql_tro

# Build (tự động apply migrations trước khi build)
npm run build

# Khởi động qua PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # đăng ký PM2 khởi động cùng hệ thống
```

Trong quá trình build, bạn sẽ thấy:
```
[migrate] Kết nối PostgreSQL thành công.
[migrate]   Applying: 20260308022917_init...
[migrate]   OK: 20260308022917_init
[migrate] Tất cả migrations đã được apply.
```

### Bước 5 — Tạo tài khoản admin

```bash
curl -X POST http://localhost:3000/api/admin/create-first \
  -H "Content-Type: application/json" \
  -d '{"ten":"Admin","email":"admin@example.com","matKhau":"<mat-khau-manh>"}'
```

### Bước 6 — Thiết lập tự động deploy (tùy chọn)

Script `scripts/deploy.sh` kiểm tra GitHub mỗi phút, tự động pull và rebuild khi có commit mới:

```bash
chmod +x /opt/ql_tro/scripts/deploy.sh
chmod +x /opt/ql_tro/scripts/start-services.sh

# Thêm vào crontab
(crontab -l 2>/dev/null; echo "* * * * * /opt/ql_tro/scripts/deploy.sh >> /opt/ql_tro/logs/deploy.log 2>&1") | crontab -

# Kiểm tra
tail -f /opt/ql_tro/logs/deploy.log
```

Sau khi thiết lập, quy trình deploy chỉ cần:
```bash
git push origin main
# Server tự pull → migrate → build → restart PM2 trong vòng 1 phút
```

---

## Cấu hình lưu trữ ảnh

### Local (mặc định — không cần cấu hình)

Ảnh lưu vào thư mục `public/uploads/` trên server.

```env
STORAGE_PROVIDER=local
```

### Cloudinary (khuyến nghị cho production)

1. Đăng ký tại https://cloudinary.com/
2. Lấy Cloud Name, API Key, API Secret từ Dashboard
3. Tạo Upload Preset (unsigned) tại Settings → Upload

```env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=your-secret
CLOUDINARY_UPLOAD_PRESET=your-preset
```

Hoặc cấu hình qua giao diện: **Cài đặt hệ thống → tab Lưu trữ** (đăng nhập admin).

### MinIO (self-hosted S3)

```env
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://your-minio-server:9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=ql-tro
```

---

## Cấu hình Zalo OA (gửi thông báo tự động)

1. Đăng ký Zalo Official Account tại https://oa.zalo.me/
2. Lấy Access Token và OA ID
3. Điền vào `.env.local` hoặc qua giao diện **Cài đặt → tab Thông báo**

```env
ZALO_ACCESS_TOKEN=your-access-token
ZALO_OA_ID=your-oa-id
ZALO_WEBHOOK_SECRET=your-webhook-secret
```

---

## Database Schema

Hệ thống sử dụng **PostgreSQL** với Prisma ORM. Migrations nằm trong `prisma/migrations/`.

| Model | Mô tả |
|-------|-------|
| `NguoiDung` | Tài khoản người dùng (admin / chuNha / nhanVien) |
| `ToaNha` | Tòa nhà / khu nhà trọ |
| `Phong` | Phòng trọ (trong / daDat / dangThue / baoTri) |
| `KhachThue` | Thông tin khách thuê |
| `HopDong` | Hợp đồng thuê phòng (hoatDong / hetHan / daHuy) |
| `ChiSoDienNuoc` | Chỉ số điện nước hàng tháng theo phòng |
| `HoaDon` | Hóa đơn tháng (chuaThanhToan / daThanhToanMotPhan / daThanhToan / quaHan) |
| `ThanhToan` | Giao dịch thanh toán (tiền mặt / chuyển khoản / ví điện tử) |
| `SuCo` | Sự cố cần xử lý (moi / dangXuLy / daXong / daHuy) |
| `ThongBao` | Thông báo hệ thống |
| `CaiDat` | Cài đặt hệ thống dạng key-value |

### Thêm migration mới

```bash
# Development
npx prisma migrate dev --name ten_migration

# Production (tự chạy khi npm run build)
# Hoặc chạy thủ công:
npx prisma migrate deploy
```

---

## API Routes

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/[...nextauth]` | Đăng nhập (NextAuth) |
| POST | `/api/admin/create-first` | Tạo admin đầu tiên (tự khóa sau khi dùng) |

### Tòa nhà
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/toa-nha` | Danh sách tòa nhà |
| POST | `/api/toa-nha` | Tạo mới |
| GET/PUT/DELETE | `/api/toa-nha/[id]` | Chi tiết / cập nhật / xóa |

### Phòng
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/phong` | Danh sách phòng (có filter trangThai, toaNhaId) |
| POST | `/api/phong` | Tạo mới |
| GET/PUT/DELETE | `/api/phong/[id]` | Chi tiết / cập nhật / xóa |
| GET | `/api/phong-public` | Danh sách phòng công khai (không cần auth) |

### Khách thuê
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/khach-thue` | Danh sách khách thuê |
| POST | `/api/khach-thue` | Tạo mới |
| GET/PUT/DELETE | `/api/khach-thue/[id]` | Chi tiết / cập nhật / xóa |

### Hợp đồng
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/hop-dong` | Danh sách hợp đồng |
| POST | `/api/hop-dong` | Tạo mới |
| GET/PUT/DELETE | `/api/hop-dong/[id]` | Chi tiết / cập nhật / xóa |

### Chỉ số điện nước
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/chi-so-dien-nuoc` | Danh sách chỉ số |
| POST | `/api/chi-so-dien-nuoc` | Ghi chỉ số mới |
| GET/PUT/DELETE | `/api/chi-so-dien-nuoc/[id]` | Chi tiết / cập nhật / xóa |

### Hóa đơn
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/hoa-don` | Danh sách hóa đơn |
| POST | `/api/hoa-don` | Tạo hóa đơn |
| GET | `/api/hoa-don-public/[id]` | Xem hóa đơn công khai (link chia sẻ) |
| POST | `/api/auto-invoice` | Tạo hóa đơn tự động theo chu kỳ |

### Thanh toán
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/thanh-toan` | Danh sách thanh toán |
| POST | `/api/thanh-toan` | Ghi nhận thanh toán |
| PUT/DELETE | `/api/thanh-toan/[id]` | Cập nhật / xóa |

### Sự cố
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/su-co` | Danh sách sự cố |
| POST | `/api/su-co` | Báo cáo sự cố |
| GET/PUT/DELETE | `/api/su-co/[id]` | Chi tiết / cập nhật / xóa |

### Thông báo & Notifications
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/thong-bao` | Danh sách thông báo |
| POST | `/api/thong-bao` | Gửi thông báo |
| GET | `/api/notifications` | Chuông thông báo (hóa đơn quá hạn, hợp đồng sắp hết hạn, sự cố) |
| POST | `/api/gui-zalo` | Gửi tin nhắn Zalo OA |

### Admin
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/admin/users` | Danh sách người dùng |
| PUT/DELETE | `/api/admin/users/[id]` | Cập nhật / xóa tài khoản |
| GET/PUT | `/api/admin/settings` | Đọc / cập nhật cài đặt hệ thống |

### Khác
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/dashboard/stats` | Thống kê dashboard |
| GET | `/api/reports` | Xuất báo cáo |
| POST | `/api/upload` | Upload file/ảnh |
| GET | `/api/files/[...path]` | Serve file local |

---

## Scripts

| Script | Lệnh | Mô tả |
|--------|------|-------|
| Dev server | `npm run dev` | Chạy Next.js với Turbopack |
| Build | `npm run build` | Tự động migrate → prisma generate → next build |
| Production | `npm run start` | Chạy bản đã build |
| Check setup | `npm run check-setup` | Kiểm tra cấu hình môi trường |
| Migrate prod | `node scripts/migrate-prod.js` | Apply migrations vào PostgreSQL thủ công |
| Start services | `bash scripts/start-services.sh` | Khởi động toàn bộ dịch vụ (Docker + Migrate + PM2) |
| Auto deploy | `bash scripts/deploy.sh` | Deploy thủ công (thường chạy qua cron) |

---

## Xử lý lỗi thường gặp

### `P2021: Table does not exist`

Migration chưa được apply vào database.

```bash
# Chạy lại build (sẽ tự migrate)
npm run build

# Hoặc migrate thủ công
npx prisma migrate deploy

# Nếu dùng Docker PostgreSQL
docker exec -i ql_tro_postgres psql -U postgres -d ql_tro \
  < prisma/migrations/20260309000001_add_cai_dat/migration.sql
```

### `P2022: Column does not exist`

Migration thêm cột mới chưa được apply.

```bash
docker exec -i ql_tro_postgres psql -U postgres -d ql_tro \
  < prisma/migrations/20260309000002_hoa_don_anh_chi_so/migration.sql
```

### `[migrate] Không có POSTGRESQL_URI, bỏ qua migration.`

File `.env.local` thiếu biến `POSTGRESQL_URI`.

```bash
echo 'POSTGRESQL_URI=postgresql://postgres:postgres@localhost:5432/ql_tro' >> .env.local
```

### `Cannot connect to database`

PostgreSQL chưa chạy.

```bash
# Kiểm tra container
docker ps | grep ql_tro_postgres

# Khởi động lại nếu đang stop
docker start ql_tro_postgres

# Kiểm tra PostgreSQL sẵn sàng chưa
docker exec ql_tro_postgres pg_isready -U postgres
```

### PM2 process lỗi / crash loop

```bash
# Xem log lỗi
pm2 logs ql-tro --lines 50

# Reset sạch và khởi động lại
pm2 delete all
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

### Port 3000 đang bận

```bash
# Tìm process đang dùng port 3000
lsof -i :3000
kill -9 <PID>
```

### `Module not found` / lỗi node_modules

```bash
rm -rf node_modules .next
npm install
npm run build
```

---

## Checklist Setup

### Development
- [ ] Node.js 20+ đã cài
- [ ] PostgreSQL đang chạy (local hoặc Docker)
- [ ] Database `ql_tro` đã tạo
- [ ] File `.env.local` đã tạo với `POSTGRESQL_URI` và `NEXTAUTH_SECRET`
- [ ] `npm install` thành công
- [ ] `npx prisma migrate deploy` thành công
- [ ] `npm run dev` chạy không lỗi
- [ ] Tạo admin qua `/api/admin/create-first`
- [ ] Đăng nhập được tại http://localhost:3000

### Production
- [ ] Docker đang chạy
- [ ] Container `ql_tro_postgres` đang chạy
- [ ] `.env.local` đã cấu hình đầy đủ
- [ ] `npm run build` thành công (thấy `[migrate] Tất cả migrations đã được apply.`)
- [ ] PM2 đang chạy: `pm2 status`
- [ ] `pm2 startup` đã chạy để auto-restart khi reboot
- [ ] Cron deploy đã thiết lập (nếu muốn auto-deploy)
- [ ] Tạo admin qua API

---

## Phân quyền

| Vai trò | Quyền |
|---------|-------|
| `admin` | Toàn quyền: quản lý tài khoản, cài đặt hệ thống, xem tất cả dữ liệu |
| `chuNha` | Quản lý tòa nhà, phòng, hợp đồng, hóa đơn, báo cáo của mình |
| `nhanVien` | Xem và thao tác theo phân công, không vào cài đặt hệ thống |

---

## Cấu trúc thư mục

```
ql_tro/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # SQL migrations
├── scripts/
│   ├── migrate-prod.js        # Auto-migrate khi build
│   ├── deploy.sh              # Auto-deploy từ GitHub
│   └── start-services.sh     # Khởi động toàn bộ dịch vụ
├── src/
│   ├── app/
│   │   ├── api/               # API Routes (Next.js App Router)
│   │   └── (dashboard)/       # Dashboard UI pages
│   ├── components/            # React components
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

## Liên hệ & Hỗ trợ

- GitHub Issues: https://github.com/TriTue2011/ql_tro/issues
- Nếu gặp lỗi: chạy `pm2 logs ql-tro --lines 100` và kiểm tra log

---

*Dự án phát triển bởi Phạm Trung Dũng — OpenSource theo MIT License*
