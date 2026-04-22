-- Thêm cấu hình giá lũy tiến (điện/nước) ở cấp hợp đồng
ALTER TABLE "HopDong"
  ADD COLUMN IF NOT EXISTS "bangGiaDienLuyTien" JSONB,
  ADD COLUMN IF NOT EXISTS "bangGiaNuocLuyTien" JSONB;

-- Thêm chi tiết breakdown tính tiền điện/nước ở hóa đơn (snapshot tại thời điểm tạo)
ALTER TABLE "HoaDon"
  ADD COLUMN IF NOT EXISTS "chiTietDien" JSONB,
  ADD COLUMN IF NOT EXISTS "chiTietNuoc" JSONB;
