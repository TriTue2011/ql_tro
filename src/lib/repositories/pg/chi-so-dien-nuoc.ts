import prisma from '@/lib/prisma';
import type {
  ChiSoDienNuocData,
  CreateChiSoInput,
  ChiSoQueryOptions,
  PaginatedResult,
} from '../types';

function normalize(raw: any): ChiSoDienNuocData {
  return {
    id: raw.id,
    phongId: raw.phongId,
    phong: raw.phong
      ? { id: raw.phong.id, maPhong: raw.phong.maPhong, toaNhaId: raw.phong.toaNhaId }
      : undefined,
    thang: raw.thang,
    nam: raw.nam,
    chiSoDienCu: raw.chiSoDienCu,
    chiSoDienMoi: raw.chiSoDienMoi,
    soDienTieuThu: raw.soDienTieuThu,
    chiSoNuocCu: raw.chiSoNuocCu,
    chiSoNuocMoi: raw.chiSoNuocMoi,
    soNuocTieuThu: raw.soNuocTieuThu,
    anhChiSoDien: raw.anhChiSoDien ?? undefined,
    anhChiSoNuoc: raw.anhChiSoNuoc ?? undefined,
    nguoiGhiId: raw.nguoiGhiId,
    nguoiGhi: raw.nguoiGhi
      ? { id: raw.nguoiGhi.id, ten: raw.nguoiGhi.ten, email: raw.nguoiGhi.email }
      : undefined,
    ngayGhi: raw.ngayGhi,
    ngayTao: raw.ngayTao,
  };
}

export default class ChiSoDienNuocRepository {
  async findById(id: string): Promise<ChiSoDienNuocData | null> {
    const raw = await prisma.chiSoDienNuoc.findUnique({
      where: { id },
      include: {
        phong: { select: { id: true, maPhong: true, toaNhaId: true } },
        nguoiGhi: { select: { id: true, ten: true, email: true } },
      },
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: ChiSoQueryOptions): Promise<PaginatedResult<ChiSoDienNuocData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.phongId) where.phongId = opts.phongId;
    if (opts.thang !== undefined) where.thang = opts.thang;
    if (opts.nam !== undefined) where.nam = opts.nam;

    const [total, rows] = await Promise.all([
      prisma.chiSoDienNuoc.count({ where }),
      prisma.chiSoDienNuoc.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nam: 'desc' }, { thang: 'desc' }],
        include: {
          phong: { select: { id: true, maPhong: true, toaNhaId: true } },
          nguoiGhi: { select: { id: true, ten: true, email: true } },
        },
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByPhongThangNam(
    phongId: string,
    thang: number,
    nam: number
  ): Promise<ChiSoDienNuocData | null> {
    const raw = await prisma.chiSoDienNuoc.findUnique({
      where: { phongId_thang_nam: { phongId, thang, nam } },
      include: {
        phong: { select: { id: true, maPhong: true, toaNhaId: true } },
        nguoiGhi: { select: { id: true, ten: true, email: true } },
      },
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async create(data: CreateChiSoInput): Promise<ChiSoDienNuocData> {
    const soDienTieuThu = Math.max(0, data.chiSoDienMoi - data.chiSoDienCu);
    const soNuocTieuThu = Math.max(0, data.chiSoNuocMoi - data.chiSoNuocCu);

    const raw = await prisma.chiSoDienNuoc.create({
      data: {
        phong: { connect: { id: data.phongId } },
        thang: data.thang,
        nam: data.nam,
        chiSoDienCu: data.chiSoDienCu,
        chiSoDienMoi: data.chiSoDienMoi,
        soDienTieuThu,
        chiSoNuocCu: data.chiSoNuocCu,
        chiSoNuocMoi: data.chiSoNuocMoi,
        soNuocTieuThu,
        anhChiSoDien: data.anhChiSoDien,
        anhChiSoNuoc: data.anhChiSoNuoc,
        nguoiGhi: { connect: { id: data.nguoiGhiId } },
        ngayGhi: data.ngayGhi ? new Date(data.ngayGhi) : new Date(),
      },
      include: {
        phong: { select: { id: true, maPhong: true, toaNhaId: true } },
        nguoiGhi: { select: { id: true, ten: true, email: true } },
      },
    });
    return normalize(raw);
  }

  async update(
    id: string,
    data: Partial<CreateChiSoInput>
  ): Promise<ChiSoDienNuocData | null> {
    try {
      const existing = await prisma.chiSoDienNuoc.findUnique({ where: { id } });
      if (!existing) return null;

      const chiSoDienMoi = data.chiSoDienMoi ?? existing.chiSoDienMoi;
      const chiSoDienCu = data.chiSoDienCu ?? existing.chiSoDienCu;
      const chiSoNuocMoi = data.chiSoNuocMoi ?? existing.chiSoNuocMoi;
      const chiSoNuocCu = data.chiSoNuocCu ?? existing.chiSoNuocCu;

      const soDienTieuThu = Math.max(0, chiSoDienMoi - chiSoDienCu);
      const soNuocTieuThu = Math.max(0, chiSoNuocMoi - chiSoNuocCu);

      const raw = await prisma.chiSoDienNuoc.update({
        where: { id },
        data: {
          ...(data.thang !== undefined && { thang: data.thang }),
          ...(data.nam !== undefined && { nam: data.nam }),
          chiSoDienCu,
          chiSoDienMoi,
          soDienTieuThu,
          chiSoNuocCu,
          chiSoNuocMoi,
          soNuocTieuThu,
          ...(data.anhChiSoDien !== undefined && { anhChiSoDien: data.anhChiSoDien }),
          ...(data.anhChiSoNuoc !== undefined && { anhChiSoNuoc: data.anhChiSoNuoc }),
          ...(data.nguoiGhiId !== undefined && {
            nguoiGhi: { connect: { id: data.nguoiGhiId } },
          }),
          ...(data.ngayGhi !== undefined && { ngayGhi: new Date(data.ngayGhi) }),
        },
        include: {
          phong: { select: { id: true, maPhong: true, toaNhaId: true } },
          nguoiGhi: { select: { id: true, ten: true, email: true } },
        },
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.chiSoDienNuoc.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
