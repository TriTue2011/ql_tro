-- AlterTable: Add YeuCauThayDoi model
CREATE TABLE "YeuCauThayDoi" (
    "id" TEXT NOT NULL,
    "khachThueId" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "noiDung" JSONB NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'choPheduyet',
    "nguoiPheDuyetId" TEXT,
    "ghiChuPheDuyet" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YeuCauThayDoi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YeuCauThayDoi" ADD CONSTRAINT "YeuCauThayDoi_khachThueId_fkey" FOREIGN KEY ("khachThueId") REFERENCES "KhachThue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauThayDoi" ADD CONSTRAINT "YeuCauThayDoi_nguoiPheDuyetId_fkey" FOREIGN KEY ("nguoiPheDuyetId") REFERENCES "NguoiDung"("id") ON DELETE SET NULL ON UPDATE CASCADE;
