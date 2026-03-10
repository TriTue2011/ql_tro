-- Add missing image columns to HoaDon table
-- These columns exist in schema.prisma but were absent from the initial migration

ALTER TABLE "HoaDon" ADD COLUMN IF NOT EXISTS "anhChiSoDien" TEXT;
ALTER TABLE "HoaDon" ADD COLUMN IF NOT EXISTS "anhChiSoNuoc" TEXT;
