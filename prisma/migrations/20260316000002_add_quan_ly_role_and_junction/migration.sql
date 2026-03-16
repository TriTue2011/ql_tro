-- Thêm bảng gán người quản lý (role: quanLy) cho tòa nhà
CREATE TABLE "ToaNhaNguoiQuanLy" (
    "toaNhaId"    TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "ngayTao"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToaNhaNguoiQuanLy_pkey" PRIMARY KEY ("toaNhaId", "nguoiDungId")
);

-- Foreign keys
ALTER TABLE "ToaNhaNguoiQuanLy"
    ADD CONSTRAINT "ToaNhaNguoiQuanLy_toaNhaId_fkey"
    FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ToaNhaNguoiQuanLy"
    ADD CONSTRAINT "ToaNhaNguoiQuanLy_nguoiDungId_fkey"
    FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;
