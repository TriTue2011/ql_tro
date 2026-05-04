-- Add businessPermissions JSON field to CaiDatToaNha
-- This stores the building's feature package as a JSON string
-- e.g. {"mucDoHopDong":"fullAccess","mucDoHoaDon":"viewOnly",...}
-- null = all permissions enabled (default for new buildings)
ALTER TABLE "CaiDatToaNha" ADD COLUMN "businessPermissions" TEXT;
