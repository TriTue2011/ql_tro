-- CreateTable
CREATE TABLE IF NOT EXISTS "CaiDat" (
    "id" TEXT NOT NULL,
    "khoa" TEXT NOT NULL,
    "giaTri" TEXT,
    "moTa" TEXT,
    "nhom" TEXT NOT NULL DEFAULT 'chung',
    "laBiMat" BOOLEAN NOT NULL DEFAULT false,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaiDat_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CaiDat_khoa_key" ON "CaiDat"("khoa");
