import prisma from '@/lib/prisma';
import type {
  HoaDonData,
  CreateHoaDonInput,
  HoaDonQueryOptions,
  PaginatedResult,
  TrangThaiHoaDon,
  PhiDichVu,
} from '../types';

function computeTrangThai(
  conLai: number,
  daThanhToan: number,
  hanThanhToan: Date
): TrangThaiHoaDon {
  if (conLai <= 0) return 'daThanhToan';
  if (daThanhToan > 0) return 'daThanhToanMotPhan';
  if (hanThanhToan < new Date() && conLai > 0) return 'quaHan';
  return 'chuaThanhToan';
}

function normalize(raw: any): HoaDonData {
  return {
    id: raw.id,
    maHoaDon: raw.maHoaDon,
    hopDongId: raw.hopDongId,
    hopDong: raw.hopDong ? { id: raw.hopDong.id, maHopDong: raw.hopDong.maHopDong } : undefined,
    phongId: raw.phongId,
    phong: raw.phong ? { id: raw.phong.id, maPhong: raw.phong.maPhong } : undefined,
    khachThueId: raw.khachThueId,
    khachThue: raw.khachThue ? { id: raw.khachThue.id, hoTen: raw.khachThue.hoTen } : undefined,
    thang: raw.thang,
    nam: raw.nam,
    tienPhong: raw.tienPhong,
    tienDien: raw.tienDien,
    soDien: raw.soDien,
    chiSoDienBanDau: raw.chiSoDienBanDau,
    chiSoDienCuoiKy: raw.chiSoDienCuoiKy,
    tienNuoc: raw.tienNuoc,
    soNuoc: raw.soNuoc,
    chiSoNuocBanDau: raw.chiSoNuocBanDau,
    chiSoNuocCuoiKy: raw.chiSoNuocCuoiKy,
    phiDichVu: (raw.phiDichVu as PhiDichVu[]) ?? [],
    tongTien: raw.tongTien,
    daThanhToan: raw.daThanhToan,
    conLai: raw.conLai,
    trangThai: raw.trangThai as TrangThaiHoaDon,
    hanThanhToan: raw.hanThanhToan,
    ghiChu: raw.ghiChu ?? undefined,
    anhChiSoDien: (raw as any).anhChiSoDien ?? undefined,
    anhChiSoNuoc: (raw as any).anhChiSoNuoc ?? undefined,
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

const includeRelations = {
  hopDong: { select: { id: true, maHopDong: true } },
  phong: { select: { id: true, maPhong: true } },
  khachThue: { select: { id: true, hoTen: true } },
};

export default class HoaDonRepository {
  async findById(id: string): Promise<HoaDonData | null> {
    const raw = await prisma.hoaDon.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: HoaDonQueryOptions = {}): Promise<PaginatedResult<HoaDonData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.hopDongId) where.hopDongId = opts.hopDongId;
    if (opts.phongId) where.phongId = opts.phongId;
    if (opts.khachThueId) where.khachThueId = opts.khachThueId;
    if (opts.thang !== undefined) where.thang = opts.thang;
    if (opts.nam !== undefined) where.nam = opts.nam;
    if (opts.trangThai) where.trangThai = opts.trangThai;
    if (opts.search) {
      where.maHoaDon = { contains: opts.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.hoaDon.count({ where }),
      prisma.hoaDon.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nam: 'desc' }, { thang: 'desc' }],
        include: includeRelations,
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreateHoaDonInput): Promise<HoaDonData> {
    const soDien = data.chiSoDienCuoiKy - data.chiSoDienBanDau;
    const soNuoc = data.chiSoNuocCuoiKy - data.chiSoNuocBanDau;
    const conLai = data.tongTien;
    const daThanhToan = 0;
    const hanThanhToan = new Date(data.hanThanhToan);
    const trangThai = computeTrangThai(conLai, daThanhToan, hanThanhToan);

    const raw = await prisma.hoaDon.create({
      data: {
        maHoaDon: data.maHoaDon,
        hopDongId: data.hopDongId,
        phongId: data.phongId,
        khachThueId: data.khachThueId,
        thang: data.thang,
        nam: data.nam,
        tienPhong: data.tienPhong,
        tienDien: data.tienDien,
        soDien,
        chiSoDienBanDau: data.chiSoDienBanDau,
        chiSoDienCuoiKy: data.chiSoDienCuoiKy,
        tienNuoc: data.tienNuoc,
        soNuoc,
        chiSoNuocBanDau: data.chiSoNuocBanDau,
        chiSoNuocCuoiKy: data.chiSoNuocCuoiKy,
        phiDichVu: (data.phiDichVu ?? []) as object[],
        tongTien: data.tongTien,
        daThanhToan,
        conLai,
        trangThai,
        hanThanhToan,
        ghiChu: data.ghiChu,
        ...(data.anhChiSoDien !== undefined && { anhChiSoDien: data.anhChiSoDien }),
        ...(data.anhChiSoNuoc !== undefined && { anhChiSoNuoc: data.anhChiSoNuoc }),
      },
      include: includeRelations,
    });
    return normalize(raw);
  }

  async update(id: string, data: Partial<HoaDonData>): Promise<HoaDonData | null> {
    try {
      const existing = await prisma.hoaDon.findUnique({ where: { id } });
      if (!existing) return null;

      const tongTien = data.tongTien ?? existing.tongTien;
      const daThanhToan = data.daThanhToan ?? existing.daThanhToan;
      const conLai = tongTien - daThanhToan;
      const hanThanhToan = data.hanThanhToan
        ? new Date(data.hanThanhToan)
        : existing.hanThanhToan;
      const trangThai = computeTrangThai(conLai, daThanhToan, hanThanhToan);

      const raw = await prisma.hoaDon.update({
        where: { id },
        data: {
          ...(data.tienPhong !== undefined && { tienPhong: data.tienPhong }),
          ...(data.tienDien !== undefined && { tienDien: data.tienDien }),
          ...(data.tienNuoc !== undefined && { tienNuoc: data.tienNuoc }),
          ...(data.phiDichVu !== undefined && { phiDichVu: data.phiDichVu as object[] }),
          ...(data.ghiChu !== undefined && { ghiChu: data.ghiChu }),
          ...(data.anhChiSoDien !== undefined && { anhChiSoDien: data.anhChiSoDien }),
          ...(data.anhChiSoNuoc !== undefined && { anhChiSoNuoc: data.anhChiSoNuoc }),
          tongTien,
          daThanhToan,
          conLai,
          trangThai,
          hanThanhToan,
        },
        include: includeRelations,
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.hoaDon.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async addPayment(id: string, soTien: number): Promise<HoaDonData | null> {
    try {
      const existing = await prisma.hoaDon.findUnique({ where: { id } });
      if (!existing) return null;

      const daThanhToan = existing.daThanhToan + soTien;
      const conLai = Math.max(0, existing.tongTien - daThanhToan);
      const trangThai = computeTrangThai(conLai, daThanhToan, existing.hanThanhToan);

      const raw = await prisma.hoaDon.update({
        where: { id },
        data: { daThanhToan, conLai, trangThai },
        include: includeRelations,
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }
}
