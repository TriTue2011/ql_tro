-- Add nguoiTaoId column to HoaDon (nullable for backward compat)
ALTER TABLE "HoaDon" ADD COLUMN IF NOT EXISTS "nguoiTaoId" TEXT;

-- Foreign key: SetNull on delete to avoid cascading invoice loss
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HoaDon_nguoiTaoId_fkey'
  ) THEN
    ALTER TABLE "HoaDon"
    ADD CONSTRAINT "HoaDon_nguoiTaoId_fkey"
    FOREIGN KEY ("nguoiTaoId") REFERENCES "NguoiDung"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Index for lookups by creator
CREATE INDEX IF NOT EXISTS "HoaDon_nguoiTaoId_idx" ON "HoaDon"("nguoiTaoId");
