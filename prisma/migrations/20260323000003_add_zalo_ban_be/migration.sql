-- CreateTable
CREATE TABLE "ZaloBanBe" (
    "id" TEXT NOT NULL,
    "zaloAccountId" TEXT NOT NULL,
    "friendUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "zaloName" TEXT,
    "phone" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZaloBanBe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZaloBanBe_friendUserId_idx" ON "ZaloBanBe"("friendUserId");

-- CreateIndex
CREATE INDEX "ZaloBanBe_zaloAccountId_idx" ON "ZaloBanBe"("zaloAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloBanBe_zaloAccountId_friendUserId_key" ON "ZaloBanBe"("zaloAccountId", "friendUserId");
