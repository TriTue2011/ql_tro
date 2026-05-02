-- Migration: Add Giai đoạn 4-6 models
-- Giai đoạn 4: CaiDatEmail + EmailLog
-- Giai đoạn 5: CongViec + CongViecLichSu
-- Giai đoạn 6: VatTu + TonKho + PhieuNhapKho + PhieuNhapKhoChiTiet + PhieuXuatKho + PhieuXuatKhoChiTiet + BaoDuong + BaoDuongLichSu

-- ─── Giai đoạn 4: Email ───────────────────────────────────────────────────────

-- Create CaiDatEmail table
CREATE TABLE "CaiDatEmail" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "appPassword" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 587,
    "tenHienThi" TEXT,
    "tuDongGuiHoaDon" BOOLEAN NOT NULL DEFAULT false,
    "tuDongGuiNhacNo" BOOLEAN NOT NULL DEFAULT false,
    "tuDongGuiBaoCao" BOOLEAN NOT NULL DEFAULT false,
    "tuDongGuiBaoTri" BOOLEAN NOT NULL DEFAULT false,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaiDatEmail_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CaiDatEmail_nguoiDungId_key" UNIQUE ("nguoiDungId")
);

-- Create EmailLog table
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "tieuDe" TEXT NOT NULL,
    "noiDung" TEXT,
    "loai" TEXT NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'thanhCong',
    "loiNhac" TEXT,
    "ngayGui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailLog_nguoiDungId_ngayGui_idx" ON "EmailLog"("nguoiDungId", "ngayGui");
CREATE INDEX "EmailLog_loai_ngayGui_idx" ON "EmailLog"("loai", "ngayGui");

-- ─── Giai đoạn 5: Task/Kanban ─────────────────────────────────────────────────

-- Create CongViec table
CREATE TABLE "CongViec" (
    "id" TEXT NOT NULL,
    "tieuDe" TEXT NOT NULL,
    "moTa" TEXT,
    "loai" TEXT NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'choTiepNhan',
    "mucDoUuTien" TEXT NOT NULL DEFAULT 'trungBinh',
    "deadline" TIMESTAMP(3),
    "toaNhaId" TEXT,
    "phongId" TEXT,
    "suCoId" TEXT,
    "hoaDonId" TEXT,
    "nguoiTaoId" TEXT NOT NULL,
    "nguoiXuLyId" TEXT,
    "ghiChuXuLy" TEXT,
    "ketQua" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,
    "ngayHoanThanh" TIMESTAMP(3),

    CONSTRAINT "CongViec_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CongViec_toaNhaId_trangThai_idx" ON "CongViec"("toaNhaId", "trangThai");
CREATE INDEX "CongViec_nguoiXuLyId_trangThai_idx" ON "CongViec"("nguoiXuLyId", "trangThai");
CREATE INDEX "CongViec_nguoiTaoId_idx" ON "CongViec"("nguoiTaoId");

-- Create CongViecLichSu table
CREATE TABLE "CongViecLichSu" (
    "id" TEXT NOT NULL,
    "congViecId" TEXT NOT NULL,
    "nguoiThayDoiId" TEXT NOT NULL,
    "thayDoi" JSONB NOT NULL,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CongViecLichSu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CongViecLichSu_congViecId_idx" ON "CongViecLichSu"("congViecId");

-- ─── Giai đoạn 6: Kho bãi ─────────────────────────────────────────────────────

-- Create VatTu table
CREATE TABLE "VatTu" (
    "id" TEXT NOT NULL,
    "maVatTu" TEXT NOT NULL,
    "tenVatTu" TEXT NOT NULL,
    "donViTinh" TEXT NOT NULL,
    "moTa" TEXT,
    "nhomVatTu" TEXT NOT NULL,
    "phanTichABC" TEXT NOT NULL DEFAULT 'C',
    "tonKhoToiThieu" INTEGER NOT NULL DEFAULT 0,
    "anhVatTu" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maQR" TEXT,
    "giaMua" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "giaBan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatTu_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VatTu_maVatTu_key" UNIQUE ("maVatTu")
);

-- Create TonKho table
CREATE TABLE "TonKho" (
    "id" TEXT NOT NULL,
    "vatTuId" TEXT NOT NULL,
    "toaNhaId" TEXT NOT NULL,
    "soLuong" INTEGER NOT NULL DEFAULT 0,
    "viTri" TEXT,

    CONSTRAINT "TonKho_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TonKho_vatTuId_toaNhaId_key" UNIQUE ("vatTuId", "toaNhaId")
);

CREATE INDEX "TonKho_toaNhaId_idx" ON "TonKho"("toaNhaId");

-- Create PhieuNhapKho table
CREATE TABLE "PhieuNhapKho" (
    "id" TEXT NOT NULL,
    "maPhieu" TEXT NOT NULL,
    "toaNhaId" TEXT NOT NULL,
    "nguoiNhapId" TEXT NOT NULL,
    "nhaCungCap" TEXT,
    "ghiChu" TEXT,
    "tongTien" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ngayNhap" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhieuNhapKho_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhieuNhapKho_maPhieu_key" UNIQUE ("maPhieu")
);

CREATE INDEX "PhieuNhapKho_toaNhaId_ngayNhap_idx" ON "PhieuNhapKho"("toaNhaId", "ngayNhap");

-- Create PhieuNhapKhoChiTiet table
CREATE TABLE "PhieuNhapKhoChiTiet" (
    "id" TEXT NOT NULL,
    "phieuNhapId" TEXT NOT NULL,
    "vatTuId" TEXT NOT NULL,
    "soLuong" INTEGER NOT NULL,
    "donGia" DOUBLE PRECISION NOT NULL,
    "thanhTien" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PhieuNhapKhoChiTiet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhieuNhapKhoChiTiet_phieuNhapId_idx" ON "PhieuNhapKhoChiTiet"("phieuNhapId");

-- Create PhieuXuatKho table
CREATE TABLE "PhieuXuatKho" (
    "id" TEXT NOT NULL,
    "maPhieu" TEXT NOT NULL,
    "toaNhaId" TEXT NOT NULL,
    "nguoiXuatId" TEXT NOT NULL,
    "lyDo" TEXT NOT NULL,
    "phongId" TEXT,
    "suCoId" TEXT,
    "ghiChu" TEXT,
    "ngayXuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhieuXuatKho_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhieuXuatKho_maPhieu_key" UNIQUE ("maPhieu")
);

CREATE INDEX "PhieuXuatKho_toaNhaId_ngayXuat_idx" ON "PhieuXuatKho"("toaNhaId", "ngayXuat");

-- Create PhieuXuatKhoChiTiet table
CREATE TABLE "PhieuXuatKhoChiTiet" (
    "id" TEXT NOT NULL,
    "phieuXuatId" TEXT NOT NULL,
    "vatTuId" TEXT NOT NULL,
    "soLuong" INTEGER NOT NULL,
    "donGia" DOUBLE PRECISION NOT NULL,
    "thanhTien" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PhieuXuatKhoChiTiet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhieuXuatKhoChiTiet_phieuXuatId_idx" ON "PhieuXuatKhoChiTiet"("phieuXuatId");

-- ─── Giai đoạn 6: Bảo dưỡng ───────────────────────────────────────────────────

-- Create BaoDuong table
CREATE TABLE "BaoDuong" (
    "id" TEXT NOT NULL,
    "tieuDe" TEXT NOT NULL,
    "moTa" TEXT,
    "toaNhaId" TEXT NOT NULL,
    "phongId" TEXT,
    "thietBi" TEXT NOT NULL,
    "loaiBaoDuong" TEXT NOT NULL,
    "chuKyNgay" INTEGER NOT NULL,
    "ngayBaoDuongTruoc" TIMESTAMP(3),
    "ngayBaoDuongSau" TIMESTAMP(3),
    "nguoiPhuTrachId" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'chuaDenHan',
    "ketQua" TEXT,
    "vatTuDaDung" JSONB,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,
    "ngayHoanThanh" TIMESTAMP(3),

    CONSTRAINT "BaoDuong_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BaoDuong_toaNhaId_trangThai_idx" ON "BaoDuong"("toaNhaId", "trangThai");
CREATE INDEX "BaoDuong_ngayBaoDuongSau_idx" ON "BaoDuong"("ngayBaoDuongSau");

-- Create BaoDuongLichSu table
CREATE TABLE "BaoDuongLichSu" (
    "id" TEXT NOT NULL,
    "baoDuongId" TEXT NOT NULL,
    "nguoiThucHienId" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "ketQua" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaoDuongLichSu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BaoDuongLichSu_baoDuongId_idx" ON "BaoDuongLichSu"("baoDuongId");

-- ─── Foreign Key Constraints ───────────────────────────────────────────────────

-- CaiDatEmail
ALTER TABLE "CaiDatEmail" ADD CONSTRAINT "CaiDatEmail_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailLog
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CongViec
ALTER TABLE "CongViec" ADD CONSTRAINT "CongViec_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CongViec" ADD CONSTRAINT "CongViec_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CongViec" ADD CONSTRAINT "CongViec_nguoiTaoId_fkey" FOREIGN KEY ("nguoiTaoId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CongViec" ADD CONSTRAINT "CongViec_nguoiXuLyId_fkey" FOREIGN KEY ("nguoiXuLyId") REFERENCES "NguoiDung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CongViecLichSu
ALTER TABLE "CongViecLichSu" ADD CONSTRAINT "CongViecLichSu_congViecId_fkey" FOREIGN KEY ("congViecId") REFERENCES "CongViec"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CongViecLichSu" ADD CONSTRAINT "CongViecLichSu_nguoiThayDoiId_fkey" FOREIGN KEY ("nguoiThayDoiId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TonKho
ALTER TABLE "TonKho" ADD CONSTRAINT "TonKho_vatTuId_fkey" FOREIGN KEY ("vatTuId") REFERENCES "VatTu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TonKho" ADD CONSTRAINT "TonKho_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PhieuNhapKho
ALTER TABLE "PhieuNhapKho" ADD CONSTRAINT "PhieuNhapKho_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhieuNhapKho" ADD CONSTRAINT "PhieuNhapKho_nguoiNhapId_fkey" FOREIGN KEY ("nguoiNhapId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PhieuNhapKhoChiTiet
ALTER TABLE "PhieuNhapKhoChiTiet" ADD CONSTRAINT "PhieuNhapKhoChiTiet_phieuNhapId_fkey" FOREIGN KEY ("phieuNhapId") REFERENCES "PhieuNhapKho"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhieuNhapKhoChiTiet" ADD CONSTRAINT "PhieuNhapKhoChiTiet_vatTuId_fkey" FOREIGN KEY ("vatTuId") REFERENCES "VatTu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PhieuXuatKho
ALTER TABLE "PhieuXuatKho" ADD CONSTRAINT "PhieuXuatKho_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhieuXuatKho" ADD CONSTRAINT "PhieuXuatKho_nguoiXuatId_fkey" FOREIGN KEY ("nguoiXuatId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhieuXuatKho" ADD CONSTRAINT "PhieuXuatKho_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PhieuXuatKhoChiTiet
ALTER TABLE "PhieuXuatKhoChiTiet" ADD CONSTRAINT "PhieuXuatKhoChiTiet_phieuXuatId_fkey" FOREIGN KEY ("phieuXuatId") REFERENCES "PhieuXuatKho"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhieuXuatKhoChiTiet" ADD CONSTRAINT "PhieuXuatKhoChiTiet_vatTuId_fkey" FOREIGN KEY ("vatTuId") REFERENCES "VatTu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BaoDuong
ALTER TABLE "BaoDuong" ADD CONSTRAINT "BaoDuong_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaoDuong" ADD CONSTRAINT "BaoDuong_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BaoDuong" ADD CONSTRAINT "BaoDuong_nguoiPhuTrachId_fkey" FOREIGN KEY ("nguoiPhuTrachId") REFERENCES "NguoiDung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BaoDuongLichSu
ALTER TABLE "BaoDuongLichSu" ADD CONSTRAINT "BaoDuongLichSu_baoDuongId_fkey" FOREIGN KEY ("baoDuongId") REFERENCES "BaoDuong"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BaoDuongLichSu" ADD CONSTRAINT "BaoDuongLichSu_nguoiThucHienId_fkey" FOREIGN KEY ("nguoiThucHienId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
