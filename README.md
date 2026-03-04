# Hệ thống quản lý phòng trọ

Hệ thống quản lý phòng trọ hiện đại và toàn diện được xây dựng với Next.js 15, TypeScript và MongoDB.

## 🚀 Tính năng chính

### 📊 Dashboard
- Thống kê tổng quan về phòng, doanh thu, hóa đơn
- Biểu đồ doanh thu theo tháng
- Danh sách hóa đơn sắp đến hạn
- Danh sách sự cố cần xử lý
- Hợp đồng sắp hết hạn

### 🏢 Quản lý tòa nhà
- CRUD thông tin tòa nhà
- Upload ảnh tòa nhà
- Quản lý tiện ích chung
- Xem danh sách phòng theo tòa nhà

### 🏠 Quản lý phòng
- CRUD thông tin phòng
- Upload ảnh phòng
- Lọc phòng theo trạng thái
- Xem lịch sử thuê phòng
- Quản lý tiện nghi phòng

### 👥 Quản lý khách thuê
- CRUD thông tin khách thuê
- Upload ảnh CCCD
- Lịch sử thuê phòng
- Lịch sử thanh toán

### 📄 Quản lý hợp đồng
- Tạo hợp đồng mới
- Upload file hợp đồng PDF
- Gia hạn hợp đồng
- Chấm dứt hợp đồng
- In hợp đồng

### ⚡ Quản lý chỉ số điện nước
- Ghi chỉ số hàng tháng
- Upload ảnh chỉ số
- Tự động tính tiêu thụ
- Lịch sử chỉ số

### 🧾 Quản lý hóa đơn
- Tạo hóa đơn tự động theo chu kỳ
- Tính toán tự động: tiền điện, nước, dịch vụ
- Gửi thông báo hóa đơn
- In hóa đơn
- Xuất báo cáo Excel

### 💰 Quản lý thanh toán
- Ghi nhận thanh toán
- Upload biên lai
- Lịch sử thanh toán
- Xuất phiếu thu

### 🚨 Quản lý sự cố
- Khách thuê báo cáo sự cố
- Phân loại và ưu tiên sự cố
- Theo dõi tiến độ xử lý
- Upload ảnh sự cố

### 🔔 Thông báo
- Gửi thông báo đến khách thuê
- Thông báo theo phòng/tòa nhà
- Lịch sử thông báo

### ⚙️ Cài đặt hệ thống
- Quản lý người dùng
- Cấu hình hệ thống
- Sao lưu và khôi phục dữ liệu
- Cài đặt thông báo

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS v4.1
- **State Management**: React Hooks, Context API
- **Form Handling**: React Hook Form + Zod validation
- **Icons**: lucide-react

### Backend
- **API**: Next.js API Routes (App Router)
- **Authentication**: NextAuth.js (JWT + Session)
- **Database**: MongoDB với Mongoose ODM

### Additional Libraries
- **Date handling**: date-fns
- **Charts**: recharts
- **Toast notifications**: sonner
- **File upload**: uploadthing hoặc cloudinary

## 📦 Cài đặt

### Yêu cầu hệ thống
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị: Node.js 20+)
- **npm**: Đi kèm với Node.js
- **MongoDB Atlas**: URI connection string (hoặc MongoDB local)
- **Git**: Để clone repository
- **Code Editor**: VS Code (khuyến nghị) hoặc bất kỳ editor nào

---

## 🚀 HƯỚNG DẪN SETUP CHO KHÁCH HÀNG MỚI

### Bước 1: Chuẩn bị môi trường

#### 1.1. Cài đặt Node.js
- Tải và cài đặt Node.js từ: https://nodejs.org/
- Kiểm tra cài đặt thành công:
```bash
node --version    # Nên >= v18.0.0
npm --version     # Nên >= 9.0.0
```

#### 1.2. Cài đặt Git (nếu chưa có)
- Windows: https://git-scm.com/download/win
- Mac: https://git-scm.com/download/mac
- Linux: `sudo apt-get install git`

### Bước 2: Clone dự án

```bash
# Clone repository (thay <repository-url> bằng link git của bạn)
git clone <repository-url>

# Di chuyển vào thư mục dự án
cd demo-phong-tro
```

### Bước 3: Cài đặt dependencies

```bash
# Cài đặt tất cả package cần thiết (có thể mất 2-5 phút)
npm install

# Hoặc nếu gặp lỗi, thử:
npm install --legacy-peer-deps
```

### Bước 4: Cấu hình Environment Variables

#### 4.1. Tạo file .env.local
```bash
# Windows (PowerShell)
Copy-Item env.example .env.local

# Mac/Linux
cp env.example .env.local
```

#### 4.2. Cấu hình MongoDB URI

**Mở file `.env.local`** bằng editor và cập nhật các thông tin sau:

```env
# Database - QUAN TRỌNG: Thêm tên database vào URI
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/TENDATABASE?retryWrites=true&w=majority&appName=AppName



# NextAuth - Tạo secret key ngẫu nhiên
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-here-make-it-long-and-complex

# Cloudinary (upload ảnh) - QUAN TRỌNG
NEXT_PUBLIC_CLOUD_NAME=your-cloudinary-name
NEXT_PUBLIC_UPLOAD_PRESET=your-upload-preset

# Email (tùy chọn - để gửi thông báo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

#### 4.3. Tạo NEXTAUTH_SECRET
Chạy lệnh sau để tạo secret key ngẫu nhiên:

```bash
# Windows PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Mac/Linux/Git Bash
openssl rand -base64 32
```

Copy kết quả vào `NEXTAUTH_SECRET` trong file `.env.local`

#### 4.4. Cấu hình Cloudinary (để upload ảnh)

1. Đăng ký tài khoản miễn phí tại: https://cloudinary.com/
2. Vào Dashboard, lấy:
   - **Cloud Name**: Điền vào `NEXT_PUBLIC_CLOUD_NAME`
   - **Upload Preset**: 
     - Vào Settings → Upload
     - Tạo Upload Preset mới (unsigned)
     - Copy tên preset vào `NEXT_PUBLIC_UPLOAD_PRESET`

### Bước 5: Chạy ứng dụng

#### 5.1. Khởi động Development Server

```bash
npm run dev
```

Đợi vài giây cho đến khi thấy thông báo:
```
✓ Ready in 3.2s
○ Local:   http://localhost:3000
```

#### 5.2. Truy cập ứng dụng

Mở trình duyệt và truy cập: **http://localhost:3000**

### Bước 6: Tạo dữ liệu mẫu (Optional)

Nếu muốn test với dữ liệu mẫu:

#### 6.1. Mở Terminal mới (giữ server đang chạy)

#### 6.2. Gọi API seed data

```bash
# Windows PowerShell
Invoke-WebRequest -Uri http://localhost:3000/api/seed -Method POST

# Mac/Linux/Git Bash
curl -X POST http://localhost:3000/api/seed

# Hoặc dùng browser: Truy cập http://localhost:3000/api/seed trong trình duyệt
```

#### 6.3. Đăng nhập với tài khoản mặc định

- **Email**: `admin@example.com`
- **Password**: `admin123`

---

## 🔧 Xử lý lỗi thường gặp

### Lỗi 1: "Cannot connect to MongoDB"
**Nguyên nhân**: MongoDB URI không đúng hoặc IP chưa được whitelist

**Giải pháp**:
1. Kiểm tra MongoDB URI trong file `.env.local`
2. Vào MongoDB Atlas → Network Access → Add IP Address
3. Chọn "Allow access from anywhere" (0.0.0.0/0) để test

### Lỗi 2: "Module not found"
**Nguyên nhân**: Dependencies chưa được cài đặt đầy đủ

**Giải pháp**:
```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install
```

### Lỗi 3: "Port 3000 already in use"
**Nguyên nhân**: Port 3000 đang được sử dụng

**Giải pháp**:
```bash
# Chạy trên port khác
npm run dev -- -p 3001
```

### Lỗi 4: Upload ảnh không hoạt động
**Nguyên nhân**: Chưa cấu hình Cloudinary

**Giải pháp**: Xem lại Bước 4.4

---

## 📝 Checklist Setup

- [ ] ✅ Đã cài đặt Node.js 18+
- [ ] ✅ Đã clone repository
- [ ] ✅ Đã chạy `npm install` thành công
- [ ] ✅ Đã tạo file `.env.local`
- [ ] ✅ Đã cấu hình MONGODB_URI với **TÊN DATABASE**
- [ ] ✅ Đã tạo NEXTAUTH_SECRET
- [ ] ✅ Đã cấu hình Cloudinary
- [ ] ✅ Đã chạy `npm run dev` thành công
- [ ] ✅ Truy cập http://localhost:3000 được
- [ ] ✅ (Optional) Đã seed data và đăng nhập được

---

## 🌐 Deploy lên Production

### Deploy lên Vercel (Khuyến nghị - Miễn phí)

1. **Push code lên GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy với Vercel**
   - Truy cập: https://vercel.com/
   - Đăng nhập bằng GitHub
   - Click "New Project"
   - Import repository `demo-phong-tro`
   - Cấu hình Environment Variables (copy từ `.env.local`)
   - Click "Deploy"

3. **Cập nhật NEXTAUTH_URL**
   - Sau khi deploy xong, copy URL Vercel (vd: `https://demo-phong-tro.vercel.app`)
   - Vào Settings → Environment Variables
   - Sửa `NEXTAUTH_URL` thành URL mới
   - Redeploy

---

## 💡 Tips cho khách hàng mới

1. **Backup MongoDB URI**: Lưu lại MongoDB URI ở nơi an toàn
2. **Đổi mật khẩu admin**: Đăng nhập và đổi password ngay
3. **Tạo tài khoản riêng**: Không dùng chung tài khoản admin
4. **Backup database**: Thường xuyên export data từ MongoDB Atlas
5. **Check logs**: Nếu có lỗi, xem logs trong terminal
6. **Update thường xuyên**: Chạy `npm update` để update dependencies

---

## 📞 Hỗ trợ

Nếu gặp vấn đề trong quá trình setup:
1. Kiểm tra lại từng bước trong hướng dẫn
2. Xem phần "Xử lý lỗi thường gặp"
3. Liên hệ người phát triển

## 📊 Database Schema

Hệ thống sử dụng MongoDB với các collection chính:

- **NguoiDung**: Quản lý người dùng (admin, chủ nhà, nhân viên)
- **ToaNha**: Thông tin tòa nhà
- **Phong**: Thông tin phòng trọ
- **KhachThue**: Thông tin khách thuê
- **HopDong**: Hợp đồng thuê phòng
- **ChiSoDienNuoc**: Chỉ số điện nước hàng tháng
- **HoaDon**: Hóa đơn thanh toán
- **ThanhToan**: Giao dịch thanh toán
- **SuCo**: Báo cáo sự cố
- **ThongBao**: Thông báo hệ thống

## 🔐 Authentication

Hệ thống sử dụng NextAuth.js với:
- JWT tokens
- Session management
- Role-based access control (admin, chủ nhà, nhân viên)
- Protected routes

## 📱 Responsive Design

- Mobile-first approach
- Sidebar collapse trên mobile
- Bảng responsive với horizontal scroll
- Form stack trên mobile

## 🚀 Deployment

### Vercel (Recommended)
1. Push code lên GitHub
2. Connect với Vercel
3. Cấu hình environment variables
4. Deploy

### Docker
```bash
docker build -t motel-management .
docker run -p 3000:3000 motel-management
```

## 📝 API Documentation

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/[...nextauth]` - Đăng nhập

### Tòa nhà
- `GET /api/toa-nha` - Lấy danh sách tòa nhà
- `POST /api/toa-nha` - Tạo tòa nhà mới
- `GET /api/toa-nha/[id]` - Lấy thông tin tòa nhà
- `PUT /api/toa-nha/[id]` - Cập nhật tòa nhà
- `DELETE /api/toa-nha/[id]` - Xóa tòa nhà

### Phòng
- `GET /api/phong` - Lấy danh sách phòng
- `POST /api/phong` - Tạo phòng mới
- `GET /api/phong/[id]` - Lấy thông tin phòng
- `PUT /api/phong/[id]` - Cập nhật phòng
- `DELETE /api/phong/[id]` - Xóa phòng

### Khách thuê
- `GET /api/khach-thue` - Lấy danh sách khách thuê
- `POST /api/khach-thue` - Tạo khách thuê mới
- `GET /api/khach-thue/[id]` - Lấy thông tin khách thuê
- `PUT /api/khach-thue/[id]` - Cập nhật khách thuê
- `DELETE /api/khach-thue/[id]` - Xóa khách thuê

### Hợp đồng
- `GET /api/hop-dong` - Lấy danh sách hợp đồng
- `POST /api/hop-dong` - Tạo hợp đồng mới
- `GET /api/hop-dong/[id]` - Lấy thông tin hợp đồng
- `PUT /api/hop-dong/[id]` - Cập nhật hợp đồng
- `DELETE /api/hop-dong/[id]` - Xóa hợp đồng

### Chỉ số điện nước
- `GET /api/chi-so-dien-nuoc` - Lấy danh sách chỉ số
- `POST /api/chi-so-dien-nuoc` - Ghi chỉ số mới

### Hóa đơn
- `GET /api/hoa-don` - Lấy danh sách hóa đơn
- `POST /api/hoa-don` - Tạo hóa đơn mới

### Thanh toán
- `GET /api/thanh-toan` - Lấy danh sách thanh toán
- `POST /api/thanh-toan` - Ghi nhận thanh toán

### Sự cố
- `GET /api/su-co` - Lấy danh sách sự cố
- `POST /api/su-co` - Báo cáo sự cố
- `GET /api/su-co/[id]` - Lấy thông tin sự cố
- `PUT /api/su-co/[id]` - Cập nhật sự cố
- `DELETE /api/su-co/[id]` - Xóa sự cố

### Thông báo
- `GET /api/thong-bao` - Lấy danh sách thông báo
- `POST /api/thong-bao` - Gửi thông báo

### Dashboard
- `GET /api/dashboard/stats` - Lấy thống kê dashboard

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Contact

Project Link: [https://github.com/yourusername/demo-phong-tro](https://github.com/yourusername/demo-phong-tro)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [MongoDB](https://www.mongodb.com/)
- [NextAuth.js](https://next-auth.js.org/)