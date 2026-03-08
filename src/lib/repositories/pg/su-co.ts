import prisma from '@/lib/prisma';
import type {
  SuCoData,
  CreateSuCoInput,
  UpdateSuCoInput,
  SuCoQueryOptions,
  PaginatedResult,
  LoaiSuCo,
  MucDoUuTien,
  TrangThaiSuCo,
} from '../types';

const includeRelations = {
  phong: { select: { id: true, maPhong: true, toaNhaId: true } },
  khachThue: { select: { id: true, hoTen: true, soDienThoai: true } },
  nguoiXuLy: { select: { id: true, ten: true, email: true } },
};

function normalize(raw: any): SuCoData {
  return {
    id: raw.id,
    phongId: raw.phongId,
    phong: raw.phong
      ? { id: raw.phong.id, maPhong: raw.phong.maPhong, toaNhaId: raw.phong.toaNhaId }
      : undefined,
    khachThueId: raw.khachThueId,
    khachThue: raw.khachThue
      ? { id: raw.khachThue.id, hoTen: raw.khachThue.hoTen, soDienThoai: raw.khachThue.soDienThoai }
      : undefined,
    tieuDe: raw.tieuDe,
    moTa: raw.moTa,
    anhSuCo: raw.anhSuCo ?? [],
    loaiSuCo: raw.loaiSuCo as LoaiSuCo,
    mucDoUuTien: raw.mucDoUuTien as MucDoUuTien,
    trangThai: raw.trangThai as TrangThaiSuCo,
    nguoiXuLyId: raw.nguoiXuLyId ?? undefined,
    nguoiXuLy: raw.nguoiXuLy
      ? { id: raw.nguoiXuLy.id, ten: raw.nguoiXuLy.ten, email: raw.nguoiXuLy.email }
      : undefined,
    ghiChuXuLy: raw.ghiChuXuLy ?? undefined,
    ngayBaoCao: raw.ngayBaoCao,
    ngayXuLy: raw.ngayXuLy ?? undefined,
    ngayHoanThanh: raw.ngayHoanThanh ?? undefined,
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

export default class SuCoRepository {
  async findById(id: string): Promise<SuCoData | null> {
    const raw = await prisma.suCo.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: SuCoQueryOptions = {}): Promise<PaginatedResult<SuCoData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.phongId) where.phongId = opts.phongId;
    if (opts.loaiSuCo) where.loaiSuCo = opts.loaiSuCo;
    if (opts.trangThai) where.trangThai = opts.trangThai;
    if (opts.mucDoUuTien) where.mucDoUuTien = opts.mucDoUuTien;
    if (opts.search) {
      where.OR = [
        { tieuDe: { contains: opts.search, mode: 'insensitive' } },
        { moTa: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.suCo.count({ where }),
      prisma.suCo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ngayBaoCao: 'desc' },
        include: includeRelations,
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreateSuCoInput): Promise<SuCoData> {
    const raw = await prisma.suCo.create({
      data: {
        phong: { connect: { id: data.phongId } },
        khachThue: { connect: { id: data.khachThueId } },
        tieuDe: data.tieuDe,
        moTa: data.moTa,
        anhSuCo: data.anhSuCo ?? [],
        loaiSuCo: data.loaiSuCo,
        mucDoUuTien: data.mucDoUuTien ?? 'trungBinh',
        trangThai: 'moi',
        ngayBaoCao: new Date(),
      },
      include: includeRelations,
    });
    return normalize(raw);
  }

  async update(id: string, data: UpdateSuCoInput): Promise<SuCoData | null> {
    try {
      const existing = await prisma.suCo.findUnique({ where: { id } });
      if (!existing) return null;

      const updateData: any = {};

      if (data.trangThai !== undefined) {
        updateData.trangThai = data.trangThai;
        if (data.trangThai === 'dangXuLy' && !existing.ngayXuLy) {
          updateData.ngayXuLy = data.ngayXuLy ? new Date(data.ngayXuLy) : new Date();
        }
        if (data.trangThai === 'daXong' && !existing.ngayHoanThanh) {
          updateData.ngayHoanThanh = data.ngayHoanThanh
            ? new Date(data.ngayHoanThanh)
            : new Date();
        }
      }
      if (data.nguoiXuLyId !== undefined) {
        updateData.nguoiXuLy = { connect: { id: data.nguoiXuLyId } };
      }
      if (data.ghiChuXuLy !== undefined) {
        updateData.ghiChuXuLy = data.ghiChuXuLy;
      }
      if (data.ngayXuLy !== undefined && updateData.ngayXuLy === undefined) {
        updateData.ngayXuLy = new Date(data.ngayXuLy);
      }
      if (data.ngayHoanThanh !== undefined && updateData.ngayHoanThanh === undefined) {
        updateData.ngayHoanThanh = new Date(data.ngayHoanThanh);
      }
      if (data.anhSuCo !== undefined) {
        updateData.anhSuCo = data.anhSuCo;
      }

      const raw = await prisma.suCo.update({
        where: { id },
        data: updateData,
        include: includeRelations,
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.suCo.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
