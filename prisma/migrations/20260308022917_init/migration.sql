-- CreateTable
CREATE TABLE "NguoiDung" (
    "id" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "matKhau" TEXT NOT NULL,
    "soDienThoai" TEXT,
    "vaiTro" TEXT NOT NULL DEFAULT 'nhanVien',
    "anhDaiDien" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'hoatDong',
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NguoiDung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToaNha" (
    "id" TEXT NOT NULL,
    "tenToaNha" TEXT NOT NULL,
    "diaChi" JSONB NOT NULL,
    "moTa" TEXT,
    "anhToaNha" TEXT[],
    "chuSoHuuId" TEXT NOT NULL,
    "tongSoPhong" INTEGER NOT NULL DEFAULT 0,
    "tienNghiChung" TEXT[],
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToaNha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phong" (
    "id" TEXT NOT NULL,
    "maPhong" TEXT NOT NULL,
    "toaNhaId" TEXT NOT NULL,
    "tang" INTEGER NOT NULL,
    "dienTich" DOUBLE PRECISION NOT NULL,
    "giaThue" DOUBLE PRECISION NOT NULL,
    "tienCoc" DOUBLE PRECISION NOT NULL,
    "moTa" TEXT,
    "anhPhong" TEXT[],
    "tienNghi" TEXT[],
    "trangThai" TEXT NOT NULL DEFAULT 'trong',
    "soNguoiToiDa" INTEGER NOT NULL,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Phong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KhachThue" (
    "id" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "soDienThoai" TEXT NOT NULL,
    "email" TEXT,
    "cccd" TEXT NOT NULL,
    "ngaySinh" TIMESTAMP(3) NOT NULL,
    "gioiTinh" TEXT NOT NULL,
    "queQuan" TEXT NOT NULL,
    "anhCCCD" JSONB,
    "ngheNghiep" TEXT,
    "matKhau" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'chuaThue',
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KhachThue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HopDong" (
    "id" TEXT NOT NULL,
    "maHopDong" TEXT NOT NULL,
    "phongId" TEXT NOT NULL,
    "nguoiDaiDienId" TEXT NOT NULL,
    "ngayBatDau" TIMESTAMP(3) NOT NULL,
    "ngayKetThuc" TIMESTAMP(3) NOT NULL,
    "giaThue" DOUBLE PRECISION NOT NULL,
    "tienCoc" DOUBLE PRECISION NOT NULL,
    "chuKyThanhToan" TEXT NOT NULL DEFAULT 'thang',
    "ngayThanhToan" INTEGER NOT NULL,
    "dieuKhoan" TEXT NOT NULL,
    "giaDien" DOUBLE PRECISION NOT NULL,
    "giaNuoc" DOUBLE PRECISION NOT NULL,
    "chiSoDienBanDau" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chiSoNuocBanDau" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phiDichVu" JSONB NOT NULL DEFAULT '[]',
    "trangThai" TEXT NOT NULL DEFAULT 'hoatDong',
    "fileHopDong" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HopDong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChiSoDienNuoc" (
    "id" TEXT NOT NULL,
    "phongId" TEXT NOT NULL,
    "thang" INTEGER NOT NULL,
    "nam" INTEGER NOT NULL,
    "chiSoDienCu" DOUBLE PRECISION NOT NULL,
    "chiSoDienMoi" DOUBLE PRECISION NOT NULL,
    "soDienTieuThu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chiSoNuocCu" DOUBLE PRECISION NOT NULL,
    "chiSoNuocMoi" DOUBLE PRECISION NOT NULL,
    "soNuocTieuThu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anhChiSoDien" TEXT,
    "anhChiSoNuoc" TEXT,
    "nguoiGhiId" TEXT NOT NULL,
    "ngayGhi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChiSoDienNuoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoaDon" (
    "id" TEXT NOT NULL,
    "maHoaDon" TEXT NOT NULL,
    "hopDongId" TEXT NOT NULL,
    "phongId" TEXT NOT NULL,
    "khachThueId" TEXT NOT NULL,
    "thang" INTEGER NOT NULL,
    "nam" INTEGER NOT NULL,
    "tienPhong" DOUBLE PRECISION NOT NULL,
    "tienDien" DOUBLE PRECISION NOT NULL,
    "soDien" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chiSoDienBanDau" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chiSoDienCuoiKy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tienNuoc" DOUBLE PRECISION NOT NULL,
    "soNuoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chiSoNuocBanDau" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chiSoNuocCuoiKy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phiDichVu" JSONB NOT NULL DEFAULT '[]',
    "tongTien" DOUBLE PRECISION NOT NULL,
    "daThanhToan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conLai" DOUBLE PRECISION NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'chuaThanhToan',
    "hanThanhToan" TIMESTAMP(3) NOT NULL,
    "ghiChu" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoaDon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThanhToan" (
    "id" TEXT NOT NULL,
    "hoaDonId" TEXT NOT NULL,
    "soTien" DOUBLE PRECISION NOT NULL,
    "phuongThuc" TEXT NOT NULL,
    "thongTinChuyenKhoan" JSONB,
    "ngayThanhToan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nguoiNhanId" TEXT NOT NULL,
    "ghiChu" TEXT,
    "anhBienLai" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThanhToan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuCo" (
    "id" TEXT NOT NULL,
    "phongId" TEXT NOT NULL,
    "khachThueId" TEXT NOT NULL,
    "tieuDe" TEXT NOT NULL,
    "moTa" TEXT NOT NULL,
    "anhSuCo" TEXT[],
    "loaiSuCo" TEXT NOT NULL,
    "mucDoUuTien" TEXT NOT NULL DEFAULT 'trungBinh',
    "trangThai" TEXT NOT NULL DEFAULT 'moi',
    "nguoiXuLyId" TEXT,
    "ghiChuXuLy" TEXT,
    "ngayBaoCao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayXuLy" TIMESTAMP(3),
    "ngayHoanThanh" TIMESTAMP(3),
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuCo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThongBao" (
    "id" TEXT NOT NULL,
    "tieuDe" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "loai" TEXT NOT NULL DEFAULT 'chung',
    "nguoiGuiId" TEXT NOT NULL,
    "nguoiNhan" TEXT[],
    "daDoc" TEXT[],
    "ngayGui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toaNhaId" TEXT,

    CONSTRAINT "ThongBao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThongBaoPhong" (
    "thongBaoId" TEXT NOT NULL,
    "phongId" TEXT NOT NULL,

    CONSTRAINT "ThongBaoPhong_pkey" PRIMARY KEY ("thongBaoId","phongId")
);

-- CreateTable
CREATE TABLE "_HopDongToKhachThue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_HopDongToKhachThue_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "NguoiDung_email_key" ON "NguoiDung"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Phong_maPhong_key" ON "Phong"("maPhong");

-- CreateIndex
CREATE UNIQUE INDEX "KhachThue_soDienThoai_key" ON "KhachThue"("soDienThoai");

-- CreateIndex
CREATE UNIQUE INDEX "KhachThue_cccd_key" ON "KhachThue"("cccd");

-- CreateIndex
CREATE UNIQUE INDEX "HopDong_maHopDong_key" ON "HopDong"("maHopDong");

-- CreateIndex
CREATE UNIQUE INDEX "ChiSoDienNuoc_phongId_thang_nam_key" ON "ChiSoDienNuoc"("phongId", "thang", "nam");

-- CreateIndex
CREATE UNIQUE INDEX "HoaDon_maHoaDon_key" ON "HoaDon"("maHoaDon");

-- CreateIndex
CREATE INDEX "_HopDongToKhachThue_B_index" ON "_HopDongToKhachThue"("B");

-- AddForeignKey
ALTER TABLE "ToaNha" ADD CONSTRAINT "ToaNha_chuSoHuuId_fkey" FOREIGN KEY ("chuSoHuuId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phong" ADD CONSTRAINT "Phong_toaNhaId_fkey" FOREIGN KEY ("toaNhaId") REFERENCES "ToaNha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HopDong" ADD CONSTRAINT "HopDong_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HopDong" ADD CONSTRAINT "HopDong_nguoiDaiDienId_fkey" FOREIGN KEY ("nguoiDaiDienId") REFERENCES "KhachThue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChiSoDienNuoc" ADD CONSTRAINT "ChiSoDienNuoc_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChiSoDienNuoc" ADD CONSTRAINT "ChiSoDienNuoc_nguoiGhiId_fkey" FOREIGN KEY ("nguoiGhiId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_hopDongId_fkey" FOREIGN KEY ("hopDongId") REFERENCES "HopDong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_khachThueId_fkey" FOREIGN KEY ("khachThueId") REFERENCES "KhachThue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThanhToan" ADD CONSTRAINT "ThanhToan_hoaDonId_fkey" FOREIGN KEY ("hoaDonId") REFERENCES "HoaDon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThanhToan" ADD CONSTRAINT "ThanhToan_nguoiNhanId_fkey" FOREIGN KEY ("nguoiNhanId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuCo" ADD CONSTRAINT "SuCo_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuCo" ADD CONSTRAINT "SuCo_khachThueId_fkey" FOREIGN KEY ("khachThueId") REFERENCES "KhachThue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuCo" ADD CONSTRAINT "SuCo_nguoiXuLyId_fkey" FOREIGN KEY ("nguoiXuLyId") REFERENCES "NguoiDung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThongBao" ADD CONSTRAINT "ThongBao_nguoiGuiId_fkey" FOREIGN KEY ("nguoiGuiId") REFERENCES "NguoiDung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThongBaoPhong" ADD CONSTRAINT "ThongBaoPhong_thongBaoId_fkey" FOREIGN KEY ("thongBaoId") REFERENCES "ThongBao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThongBaoPhong" ADD CONSTRAINT "ThongBaoPhong_phongId_fkey" FOREIGN KEY ("phongId") REFERENCES "Phong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HopDongToKhachThue" ADD CONSTRAINT "_HopDongToKhachThue_A_fkey" FOREIGN KEY ("A") REFERENCES "HopDong"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HopDongToKhachThue" ADD CONSTRAINT "_HopDongToKhachThue_B_fkey" FOREIGN KEY ("B") REFERENCES "KhachThue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
