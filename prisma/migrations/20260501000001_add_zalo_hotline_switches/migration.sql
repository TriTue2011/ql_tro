-- Migration: Add 3 Zalo Hotline switches to CaiDatToaNha
-- Giai đoạn 4: Zalo Hotline 8 kịch bản A/B + 3 công tắc quyền hạn

ALTER TABLE "CaiDatToaNha" ADD COLUMN "batHotline" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CaiDatToaNha" ADD COLUMN "uyQuyenQL" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CaiDatToaNha" ADD COLUMN "uyQuyenHotline" BOOLEAN NOT NULL DEFAULT false;
