ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "chucVu" TEXT;

UPDATE "NguoiDung"
SET "chucVu" = 'quanLyKiemToanBo'
WHERE "vaiTro" = 'quanLy' AND ("chucVu" IS NULL OR "chucVu" = '');

UPDATE "NguoiDung"
SET "chucVu" = 'nhanVienKiemToanBo'
WHERE "vaiTro" = 'nhanVien' AND ("chucVu" IS NULL OR "chucVu" = '');

UPDATE "NguoiDung"
SET "chucVu" = NULL
WHERE "vaiTro" NOT IN ('quanLy', 'nhanVien');
