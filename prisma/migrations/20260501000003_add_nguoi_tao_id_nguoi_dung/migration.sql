-- Add nguoiTaoId column to NguoiDung (nullable for backward compat)
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "nguoiTaoId" TEXT;

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NguoiDung_nguoiTaoId_fkey'
  ) THEN
    ALTER TABLE "NguoiDung"
    ADD CONSTRAINT "NguoiDung_nguoiTaoId_fkey"
    FOREIGN KEY ("nguoiTaoId") REFERENCES "NguoiDung"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for lookups by creator
CREATE INDEX IF NOT EXISTS "NguoiDung_nguoiTaoId_idx" ON "NguoiDung"("nguoiTaoId");
