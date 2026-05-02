-- CreateEnum: PermissionLevel
CREATE TYPE "PermissionLevel" AS ENUM ('hidden', 'viewOnly', 'fullAccess');

-- AlterTable: ToaNhaNguoiQuanLy
-- Step 1: Add new columns with default value 'fullAccess'
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoHopDong" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoHoaDon" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoThanhToan" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoSuCo" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoKichHoatTaiKhoan" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoZalo" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';
ALTER TABLE "ToaNhaNguoiQuanLy" ADD COLUMN "mucDoZaloMonitor" "PermissionLevel" NOT NULL DEFAULT 'fullAccess';

-- Step 2: Backfill data from old boolean columns
-- Mapping rules:
--   quyenX = true  → fullAccess
--   quyenX = false AND anNavTabX = true → hidden
--   quyenX = false AND anNavTabX = false → viewOnly
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoHopDong" = CASE
  WHEN "quyenHopDong" = true THEN 'fullAccess'::"PermissionLevel"
  WHEN "anNavTabHopDong" = true THEN 'hidden'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoHoaDon" = CASE
  WHEN "quyenHoaDon" = true THEN 'fullAccess'::"PermissionLevel"
  WHEN "anNavTabHoaDon" = true THEN 'hidden'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoThanhToan" = CASE
  WHEN "quyenThanhToan" = true THEN 'fullAccess'::"PermissionLevel"
  WHEN "anNavTabThanhToan" = true THEN 'hidden'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoSuCo" = CASE
  WHEN "quyenSuCo" = true THEN 'fullAccess'::"PermissionLevel"
  WHEN "anNavTabSuCo" = true THEN 'hidden'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoKichHoatTaiKhoan" = CASE
  WHEN "quyenKichHoatTaiKhoan" = true THEN 'fullAccess'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoZalo" = CASE
  WHEN "quyenZalo" = true THEN 'fullAccess'::"PermissionLevel"
  WHEN "anNavTabZalo" = true THEN 'hidden'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;
UPDATE "ToaNhaNguoiQuanLy" SET "mucDoZaloMonitor" = CASE
  WHEN "quyenZaloMonitor" = true THEN 'fullAccess'::"PermissionLevel"
  WHEN "anNavTabZaloMonitor" = true THEN 'hidden'::"PermissionLevel"
  ELSE 'viewOnly'::"PermissionLevel"
END;

-- Step 3: Drop old columns
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenKichHoatTaiKhoan";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenHopDong";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenHoaDon";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenThanhToan";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenSuCo";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenZalo";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "quyenZaloMonitor";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "anNavTabHopDong";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "anNavTabHoaDon";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "anNavTabThanhToan";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "anNavTabSuCo";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "anNavTabZalo";
ALTER TABLE "ToaNhaNguoiQuanLy" DROP COLUMN "anNavTabZaloMonitor";
