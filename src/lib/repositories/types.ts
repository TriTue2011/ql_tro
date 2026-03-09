// ═══════════════════════════════════════════════════════════════
// Shared types cho Repository layer
// Hỗ trợ cả MongoDB (Mongoose) và PostgreSQL (Prisma)
// ═══════════════════════════════════════════════════════════════

// ─── Query helpers ────────────────────────────────────────────

export interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── NguoiDung ────────────────────────────────────────────────

export interface NguoiDungData {
  id: string;
  ten: string;
  email: string;
  soDienThoai?: string;
  vaiTro: 'admin' | 'chuNha' | 'nhanVien';
  anhDaiDien?: string;
  trangThai: 'hoatDong' | 'khoa';
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreateNguoiDungInput {
  ten: string;
  email: string;
  matKhau: string;
  soDienThoai?: string;
  vaiTro?: 'admin' | 'chuNha' | 'nhanVien';
  anhDaiDien?: string;
}

export interface UpdateNguoiDungInput {
  ten?: string;
  soDienThoai?: string;
  vaiTro?: 'admin' | 'chuNha' | 'nhanVien';
  anhDaiDien?: string;
  trangThai?: 'hoatDong' | 'khoa';
  matKhau?: string;
}

// ─── ToaNha ───────────────────────────────────────────────────

export interface DiaChi {
  soNha: string;
  duong: string;
  phuong: string;
  quan: string;
  thanhPho: string;
}

export interface ToaNhaData {
  id: string;
  tenToaNha: string;
  diaChi: DiaChi;
  moTa?: string;
  anhToaNha: string[];
  chuSoHuuId: string;
  chuSoHuu?: Partial<NguoiDungData>;
  tongSoPhong: number;
  tienNghiChung: string[];
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreateToaNhaInput {
  tenToaNha: string;
  diaChi: DiaChi;
  moTa?: string;
  anhToaNha?: string[];
  chuSoHuuId: string;
  tongSoPhong?: number;
  tienNghiChung?: string[];
}

export interface UpdateToaNhaInput {
  tenToaNha?: string;
  diaChi?: Partial<DiaChi>;
  moTa?: string;
  anhToaNha?: string[];
  tongSoPhong?: number;
  tienNghiChung?: string[];
}

// ─── Phong ────────────────────────────────────────────────────

export type TrangThaiPhong = 'trong' | 'daDat' | 'dangThue' | 'baoTri';

export interface PhongData {
  id: string;
  maPhong: string;
  toaNhaId: string;
  toaNha?: Partial<ToaNhaData>;
  tang: number;
  dienTich: number;
  giaThue: number;
  tienCoc: number;
  moTa?: string;
  anhPhong: string[];
  tienNghi: string[];
  trangThai: TrangThaiPhong;
  soNguoiToiDa: number;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreatePhongInput {
  maPhong: string;
  toaNhaId: string;
  tang: number;
  dienTich: number;
  giaThue: number;
  tienCoc: number;
  moTa?: string;
  anhPhong?: string[];
  tienNghi?: string[];
  soNguoiToiDa: number;
}

export interface UpdatePhongInput {
  tang?: number;
  dienTich?: number;
  giaThue?: number;
  tienCoc?: number;
  moTa?: string;
  anhPhong?: string[];
  tienNghi?: string[];
  trangThai?: TrangThaiPhong;
  soNguoiToiDa?: number;
}

export interface PhongQueryOptions extends QueryOptions {
  toaNhaId?: string;
  trangThai?: TrangThaiPhong;
}

// ─── KhachThue ────────────────────────────────────────────────

export type TrangThaiKhachThue = 'dangThue' | 'daTraPhong' | 'chuaThue';

export interface AnhCCCD {
  matTruoc?: string;
  matSau?: string;
}

export interface KhachThueData {
  id: string;
  hoTen: string;
  soDienThoai: string;
  email?: string;
  cccd: string;
  ngaySinh: Date;
  gioiTinh: 'nam' | 'nu' | 'khac';
  queQuan: string;
  anhCCCD?: AnhCCCD;
  ngheNghiep?: string;
  trangThai: TrangThaiKhachThue;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreateKhachThueInput {
  hoTen: string;
  soDienThoai: string;
  email?: string;
  cccd: string;
  ngaySinh: Date | string;
  gioiTinh: 'nam' | 'nu' | 'khac';
  queQuan: string;
  anhCCCD?: AnhCCCD;
  ngheNghiep?: string;
  matKhau?: string;
}

export interface UpdateKhachThueInput {
  hoTen?: string;
  soDienThoai?: string;
  email?: string;
  ngheNghiep?: string;
  anhCCCD?: AnhCCCD;
  trangThai?: TrangThaiKhachThue;
  matKhau?: string;
}

// ─── HopDong ──────────────────────────────────────────────────

export type TrangThaiHopDong = 'hoatDong' | 'hetHan' | 'daHuy';

export interface PhiDichVu {
  ten: string;
  gia: number;
}

export interface HopDongData {
  id: string;
  maHopDong: string;
  phongId: string;
  phong?: Partial<PhongData>;
  khachThueIds: string[];
  khachThue?: Partial<KhachThueData>[];
  nguoiDaiDienId: string;
  nguoiDaiDien?: Partial<KhachThueData>;
  ngayBatDau: Date;
  ngayKetThuc: Date;
  giaThue: number;
  tienCoc: number;
  chuKyThanhToan: 'thang' | 'quy' | 'nam';
  ngayThanhToan: number;
  dieuKhoan: string;
  giaDien: number;
  giaNuoc: number;
  chiSoDienBanDau: number;
  chiSoNuocBanDau: number;
  phiDichVu: PhiDichVu[];
  trangThai: TrangThaiHopDong;
  fileHopDong?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreateHopDongInput {
  maHopDong: string;
  phongId: string;
  khachThueIds: string[];
  nguoiDaiDienId: string;
  ngayBatDau: Date | string;
  ngayKetThuc: Date | string;
  giaThue: number;
  tienCoc: number;
  chuKyThanhToan?: 'thang' | 'quy' | 'nam';
  ngayThanhToan: number;
  dieuKhoan: string;
  giaDien: number;
  giaNuoc: number;
  chiSoDienBanDau?: number;
  chiSoNuocBanDau?: number;
  phiDichVu?: PhiDichVu[];
  fileHopDong?: string;
}

export interface UpdateHopDongInput {
  ngayKetThuc?: Date | string;
  giaThue?: number;
  tienCoc?: number;
  chuKyThanhToan?: 'thang' | 'quy' | 'nam';
  ngayThanhToan?: number;
  dieuKhoan?: string;
  giaDien?: number;
  giaNuoc?: number;
  phiDichVu?: PhiDichVu[];
  trangThai?: TrangThaiHopDong;
  fileHopDong?: string;
}

export interface HopDongQueryOptions extends QueryOptions {
  phongId?: string;
  trangThai?: TrangThaiHopDong;
  khachThueId?: string;
}

// ─── ChiSoDienNuoc ────────────────────────────────────────────

export interface ChiSoDienNuocData {
  id: string;
  phongId: string;
  phong?: Partial<PhongData>;
  thang: number;
  nam: number;
  chiSoDienCu: number;
  chiSoDienMoi: number;
  soDienTieuThu: number;
  chiSoNuocCu: number;
  chiSoNuocMoi: number;
  soNuocTieuThu: number;
  anhChiSoDien?: string;
  anhChiSoNuoc?: string;
  nguoiGhiId: string;
  nguoiGhi?: Partial<NguoiDungData>;
  ngayGhi: Date;
  ngayTao: Date;
}

export interface CreateChiSoInput {
  phongId: string;
  thang: number;
  nam: number;
  chiSoDienCu: number;
  chiSoDienMoi: number;
  chiSoNuocCu: number;
  chiSoNuocMoi: number;
  anhChiSoDien?: string;
  anhChiSoNuoc?: string;
  nguoiGhiId: string;
  ngayGhi?: Date | string;
}

export interface ChiSoQueryOptions extends QueryOptions {
  phongId?: string;
  thang?: number;
  nam?: number;
}

// ─── HoaDon ───────────────────────────────────────────────────

export type TrangThaiHoaDon =
  | 'chuaThanhToan'
  | 'daThanhToanMotPhan'
  | 'daThanhToan'
  | 'quaHan';

export interface HoaDonData {
  id: string;
  maHoaDon: string;
  hopDongId: string;
  hopDong?: Partial<HopDongData>;
  phongId: string;
  phong?: Partial<PhongData>;
  khachThueId: string;
  khachThue?: Partial<KhachThueData>;
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  soDien: number;
  chiSoDienBanDau: number;
  chiSoDienCuoiKy: number;
  tienNuoc: number;
  soNuoc: number;
  chiSoNuocBanDau: number;
  chiSoNuocCuoiKy: number;
  phiDichVu: PhiDichVu[];
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  trangThai: TrangThaiHoaDon;
  hanThanhToan: Date;
  ghiChu?: string;
  anhChiSoDien?: string;
  anhChiSoNuoc?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreateHoaDonInput {
  maHoaDon: string;
  hopDongId: string;
  phongId: string;
  khachThueId: string;
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  chiSoDienBanDau: number;
  chiSoDienCuoiKy: number;
  tienNuoc: number;
  chiSoNuocBanDau: number;
  chiSoNuocCuoiKy: number;
  phiDichVu?: PhiDichVu[];
  tongTien: number;
  hanThanhToan: Date | string;
  ghiChu?: string;
  anhChiSoDien?: string;
  anhChiSoNuoc?: string;
}

export interface HoaDonQueryOptions extends QueryOptions {
  hopDongId?: string;
  phongId?: string;
  khachThueId?: string;
  thang?: number;
  nam?: number;
  trangThai?: TrangThaiHoaDon;
}

// ─── ThanhToan ────────────────────────────────────────────────

export interface ThongTinChuyenKhoan {
  nganHang: string;
  soGiaoDich: string;
}

export interface ThanhToanData {
  id: string;
  hoaDonId: string;
  hoaDon?: Partial<HoaDonData>;
  soTien: number;
  phuongThuc: 'tienMat' | 'chuyenKhoan' | 'viDienTu';
  thongTinChuyenKhoan?: ThongTinChuyenKhoan;
  ngayThanhToan: Date;
  nguoiNhanId: string;
  nguoiNhan?: Partial<NguoiDungData>;
  ghiChu?: string;
  anhBienLai?: string;
  ngayTao: Date;
}

export interface CreateThanhToanInput {
  hoaDonId: string;
  soTien: number;
  phuongThuc: 'tienMat' | 'chuyenKhoan' | 'viDienTu';
  thongTinChuyenKhoan?: ThongTinChuyenKhoan;
  ngayThanhToan?: Date | string;
  nguoiNhanId: string;
  ghiChu?: string;
  anhBienLai?: string;
}

// ─── SuCo ─────────────────────────────────────────────────────

export type LoaiSuCo = 'dienNuoc' | 'noiThat' | 'vesinh' | 'anNinh' | 'khac';
export type MucDoUuTien = 'thap' | 'trungBinh' | 'cao' | 'khancap';
export type TrangThaiSuCo = 'moi' | 'dangXuLy' | 'daXong' | 'daHuy';

export interface SuCoData {
  id: string;
  phongId: string;
  phong?: Partial<PhongData>;
  khachThueId: string;
  khachThue?: Partial<KhachThueData>;
  tieuDe: string;
  moTa: string;
  anhSuCo: string[];
  loaiSuCo: LoaiSuCo;
  mucDoUuTien: MucDoUuTien;
  trangThai: TrangThaiSuCo;
  nguoiXuLyId?: string;
  nguoiXuLy?: Partial<NguoiDungData>;
  ghiChuXuLy?: string;
  ngayBaoCao: Date;
  ngayXuLy?: Date;
  ngayHoanThanh?: Date;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CreateSuCoInput {
  phongId: string;
  khachThueId: string;
  tieuDe: string;
  moTa: string;
  anhSuCo?: string[];
  loaiSuCo: LoaiSuCo;
  mucDoUuTien?: MucDoUuTien;
}

export interface UpdateSuCoInput {
  trangThai?: TrangThaiSuCo;
  nguoiXuLyId?: string;
  ghiChuXuLy?: string;
  ngayXuLy?: Date;
  ngayHoanThanh?: Date;
  anhSuCo?: string[];
}

export interface SuCoQueryOptions extends QueryOptions {
  phongId?: string;
  loaiSuCo?: LoaiSuCo;
  trangThai?: TrangThaiSuCo;
  mucDoUuTien?: MucDoUuTien;
}

// ─── ThongBao ─────────────────────────────────────────────────

export type LoaiThongBao = 'chung' | 'hoaDon' | 'suCo' | 'hopDong' | 'khac';

export interface ThongBaoData {
  id: string;
  tieuDe: string;
  noiDung: string;
  loai: LoaiThongBao;
  nguoiGuiId: string;
  nguoiGui?: Partial<NguoiDungData>;
  nguoiNhan: string[];
  phongIds?: string[];
  toaNhaId?: string;
  daDoc: string[];
  ngayGui: Date;
  ngayTao: Date;
}

export interface CreateThongBaoInput {
  tieuDe: string;
  noiDung: string;
  loai?: LoaiThongBao;
  nguoiGuiId: string;
  nguoiNhan: string[];
  phongIds?: string[];
  toaNhaId?: string;
}

export interface ThongBaoQueryOptions extends QueryOptions {
  nguoiNhanId?: string;
  loai?: LoaiThongBao;
}
