-- Drop old global unique constraint on maPhong
DROP INDEX IF EXISTS "Phong_maPhong_key";

-- Create composite unique constraint (maPhong, toaNhaId)
CREATE UNIQUE INDEX IF NOT EXISTS "Phong_maPhong_toaNhaId_key" ON "Phong"("maPhong", "toaNhaId");
