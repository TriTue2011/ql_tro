-- Add 5 missing permission columns to ToaNhaNguoiQuanLy
-- These columns exist in Prisma schema but were never migrated to the database

ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoCongViec" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoKho" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoBaoDuong" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoCaiDatHotline" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoCaiDatEmail" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
