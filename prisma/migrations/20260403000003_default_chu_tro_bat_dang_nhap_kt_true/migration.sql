-- Đổi default chuTroBatDangNhapKT thành true (admin bật = mặc định cho phép)
ALTER TABLE "CaiDatToaNha" ALTER COLUMN "chuTroBatDangNhapKT" SET DEFAULT true;

-- Cập nhật record hiện có: khi admin đã bật mà chủ trọ chưa bật → bật luôn
UPDATE "CaiDatToaNha" SET "chuTroBatDangNhapKT" = true WHERE "adminBatDangNhapKT" = true;
