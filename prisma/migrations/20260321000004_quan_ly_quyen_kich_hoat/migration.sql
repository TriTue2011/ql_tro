-- Thêm cột quyền kích hoạt tài khoản khách thuê cho quản lý
ALTER TABLE "ToaNhaNguoiQuanLy"
  ADD COLUMN "quyenKichHoatTaiKhoan" BOOLEAN NOT NULL DEFAULT false;
