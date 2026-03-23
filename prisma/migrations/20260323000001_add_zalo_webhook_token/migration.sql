-- AlterTable
ALTER TABLE "NguoiDung" ADD COLUMN "zaloWebhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NguoiDung_zaloWebhookToken_key" ON "NguoiDung"("zaloWebhookToken");
