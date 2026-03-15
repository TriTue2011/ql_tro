-- Add ngayTinhTien column to Phong table
-- Stores the default billing day of the month (1-28) per room

ALTER TABLE "Phong" ADD COLUMN IF NOT EXISTS "ngayTinhTien" INTEGER NOT NULL DEFAULT 1;
