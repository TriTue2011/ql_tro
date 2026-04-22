import prisma from '@/lib/prisma';
import type {
  HopDongData,
  CreateHopDongInput,
  UpdateHopDongInput,
  HopDongQueryOptions,
  PaginatedResult,
  TrangThaiHopDong,
  PhiDichVu,
} from '../types';

const includeRelations = {
  phong: true,
  nguoiDaiDien: true,
  khachThue: true,
};

function normalize(raw: any): HopDongData {
  return {
    id: raw.id,
    maHopDong: raw.maHopDong,
    phongId: raw.phongId,
    phong: raw.phong
      ? { id: raw.phong.id, maPhong: raw.phong.maPhong, toaNhaId: raw.phong.toaNhaId }
      : undefined,
    khachThueIds: Array.isArray(raw.khachThue)
      ? raw.khachThue.map((k: any) => k.id)
      : [],
    khachThue: Array.isArray(raw.khachThue)
      ? raw.khachThue.map((k: any) => ({
          id: k.id,
          hoTen: k.hoTen,
          soDienThoai: k.soDienThoai,
        }))
      : undefined,
    nguoiDaiDienId: raw.nguoiDaiDienId,
    nguoiDaiDien: raw.nguoiDaiDien
      ? { id: raw.nguoiDaiDien.id, hoTen: raw.nguoiDaiDien.hoTen }
      : undefined,
    ngayBatDau: raw.ngayBatDau,
    ngayKetThuc: raw.ngayKetThuc,
    giaThue: raw.giaThue,
    tienCoc: raw.tienCoc,
    chuKyThanhToan: raw.chuKyThanhToan as HopDongData['chuKyThanhToan'],
    ngayThanhToan: raw.ngayThanhToan,
    dieuKhoan: raw.dieuKhoan,
    giaDien: raw.giaDien,
    giaNuoc: raw.giaNuoc,
    bangGiaDienLuyTien: (raw as any).bangGiaDienLuyTien ?? undefined,
    bangGiaNuocLuyTien: (raw as any).bangGiaNuocLuyTien ?? undefined,
    chiSoDienBanDau: raw.chiSoDienBanDau,
    chiSoNuocBanDau: raw.chiSoNuocBanDau,
    phiDichVu: (raw.phiDichVu as PhiDichVu[]) ?? [],
    trangThai: raw.trangThai as TrangThaiHopDong,
    fileHopDong: raw.fileHopDong ?? undefined,
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

export default class HopDongRepository {
  async findById(id: string): Promise<HopDongData | null> {
    const raw = await prisma.hopDong.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: HopDongQueryOptions): Promise<PaginatedResult<HopDongData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.phongId) where.phongId = opts.phongId;
    else if (opts.toaNhaIds?.length) where.phong = { toaNhaId: { in: opts.toaNhaIds } };
    if (opts.trangThai) where.trangThai = opts.trangThai;
    if (opts.khachThueId) {
      where.khachThue = { some: { id: opts.khachThueId } };
    }
    if (opts.search) {
      where.maHopDong = { contains: opts.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.hopDong.count({ where }),
      prisma.hopDong.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ngayTao: 'desc' },
        include: includeRelations,
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findActiveByPhong(phongId: string): Promise<HopDongData | null> {
    const raw = await prisma.hopDong.findFirst({
      where: { phongId, trangThai: 'hoatDong' },
      include: includeRelations,
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async create(data: CreateHopDongInput): Promise<HopDongData> {
    const raw = await prisma.hopDong.create({
      data: {
        maHopDong: data.maHopDong,
        phong: { connect: { id: data.phongId } },
        nguoiDaiDien: { connect: { id: data.nguoiDaiDienId } },
        khachThue: { connect: data.khachThueIds.map((id) => ({ id })) },
        ngayBatDau: new Date(data.ngayBatDau),
        ngayKetThuc: new Date(data.ngayKetThuc),
        giaThue: data.giaThue,
        tienCoc: data.tienCoc,
        chuKyThanhToan: data.chuKyThanhToan ?? 'thang',
        ngayThanhToan: data.ngayThanhToan,
        dieuKhoan: data.dieuKhoan,
        giaDien: data.giaDien,
        giaNuoc: data.giaNuoc,
        ...((data as any).bangGiaDienLuyTien !== undefined && { bangGiaDienLuyTien: (data as any).bangGiaDienLuyTien as any }),
        ...((data as any).bangGiaNuocLuyTien !== undefined && { bangGiaNuocLuyTien: (data as any).bangGiaNuocLuyTien as any }),
        chiSoDienBanDau: data.chiSoDienBanDau ?? 0,
        chiSoNuocBanDau: data.chiSoNuocBanDau ?? 0,
        phiDichVu: (data.phiDichVu ?? []) as object[],
        fileHopDong: data.fileHopDong,
      },
      include: includeRelations,
    });
    return normalize(raw);
  }

  async update(id: string, data: UpdateHopDongInput): Promise<HopDongData | null> {
    try {
      const raw = await prisma.hopDong.update({
        where: { id },
        data: {
          ...(data.ngayKetThuc !== undefined && {
            ngayKetThuc: new Date(data.ngayKetThuc),
          }),
          ...(data.giaThue !== undefined && { giaThue: data.giaThue }),
          ...(data.tienCoc !== undefined && { tienCoc: data.tienCoc }),
          ...(data.chuKyThanhToan !== undefined && { chuKyThanhToan: data.chuKyThanhToan }),
          ...(data.ngayThanhToan !== undefined && { ngayThanhToan: data.ngayThanhToan }),
          ...(data.dieuKhoan !== undefined && { dieuKhoan: data.dieuKhoan }),
          ...(data.giaDien !== undefined && { giaDien: data.giaDien }),
          ...(data.giaNuoc !== undefined && { giaNuoc: data.giaNuoc }),
          ...((data as any).bangGiaDienLuyTien !== undefined && { bangGiaDienLuyTien: (data as any).bangGiaDienLuyTien as any }),
          ...((data as any).bangGiaNuocLuyTien !== undefined && { bangGiaNuocLuyTien: (data as any).bangGiaNuocLuyTien as any }),
          ...(data.phiDichVu !== undefined && { phiDichVu: data.phiDichVu as object[] }),
          ...(data.trangThai !== undefined && { trangThai: data.trangThai }),
          ...(data.fileHopDong !== undefined && { fileHopDong: data.fileHopDong }),
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
      await prisma.hopDong.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
