import prisma from '@/lib/prisma';
import type {
  ToaNhaData,
  CreateToaNhaInput,
  UpdateToaNhaInput,
  QueryOptions,
  PaginatedResult,
  DiaChi,
  LienHePhuTrach,
} from '../types';

function normalize(raw: any): ToaNhaData {
  return {
    id: raw.id,
    tenToaNha: raw.tenToaNha,
    diaChi: raw.diaChi as DiaChi,
    moTa: raw.moTa ?? undefined,
    anhToaNha: raw.anhToaNha,
    chuSoHuuId: raw.chuSoHuuId,
    chuSoHuu: raw.chuSoHuu
      ? { id: raw.chuSoHuu.id, ten: raw.chuSoHuu.ten, email: raw.chuSoHuu.email, soDienThoai: raw.chuSoHuu.soDienThoai }
      : undefined,
    tongSoPhong: raw.tongSoPhong,
    tienNghiChung: raw.tienNghiChung,
    lienHePhuTrach: (raw.lienHePhuTrach as LienHePhuTrach[]) ?? [],
    zaloNhomChat: (raw.zaloNhomChat as any[]) ?? [],
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

export default class ToaNhaRepository {
  async findById(id: string): Promise<ToaNhaData | null> {
    const raw = await prisma.toaNha.findUnique({
      where: { id },
      include: { chuSoHuu: { select: { id: true, ten: true, email: true, soDienThoai: true } } },
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: QueryOptions): Promise<PaginatedResult<ToaNhaData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (opts.search) where.tenToaNha = { contains: opts.search, mode: 'insensitive' as const };

    if (opts.ownerId && opts.managerId) {
      // chuNha: thấy cả tòa nhà sở hữu lẫn tòa nhà được gán
      where.OR = [
        { chuSoHuuId: opts.ownerId },
        { nguoiQuanLy: { some: { nguoiDungId: opts.managerId } } },
      ];
    } else if (opts.ownerId) {
      where.chuSoHuuId = opts.ownerId;
    } else if (opts.managerId) {
      where.nguoiQuanLy = { some: { nguoiDungId: opts.managerId } };
    }

    const [total, rows] = await Promise.all([
      prisma.toaNha.count({ where }),
      prisma.toaNha.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ngayTao: 'desc' },
        include: { chuSoHuu: { select: { id: true, ten: true, email: true, soDienThoai: true } } },
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreateToaNhaInput): Promise<ToaNhaData> {
    const raw = await prisma.toaNha.create({
      data: {
        tenToaNha: data.tenToaNha,
        diaChi: data.diaChi as object,
        moTa: data.moTa,
        anhToaNha: data.anhToaNha ?? [],
        chuSoHuuId: data.chuSoHuuId,
        tongSoPhong: data.tongSoPhong ?? 0,
        tienNghiChung: data.tienNghiChung ?? [],
        lienHePhuTrach: (data.lienHePhuTrach ?? []) as object[],
        zaloNhomChat: (data.zaloNhomChat ?? []) as object[],
      },
      include: { chuSoHuu: { select: { id: true, ten: true, email: true } } },
    });
    return normalize(raw);
  }

  async update(id: string, data: UpdateToaNhaInput): Promise<ToaNhaData | null> {
    try {
      const existing = await prisma.toaNha.findUnique({ where: { id } });
      if (!existing) return null;

      const updatedDiaChi = data.diaChi
        ? { ...(existing.diaChi as object), ...data.diaChi }
        : undefined;

      const raw = await prisma.toaNha.update({
        where: { id },
        data: {
          ...(data.tenToaNha !== undefined && { tenToaNha: data.tenToaNha }),
          ...(updatedDiaChi !== undefined && { diaChi: updatedDiaChi }),
          ...(data.moTa !== undefined && { moTa: data.moTa }),
          ...(data.anhToaNha !== undefined && { anhToaNha: data.anhToaNha }),
          ...(data.tongSoPhong !== undefined && { tongSoPhong: data.tongSoPhong }),
          ...(data.tienNghiChung !== undefined && { tienNghiChung: data.tienNghiChung }),
          ...(data.lienHePhuTrach !== undefined && { lienHePhuTrach: data.lienHePhuTrach as object[] }),
          ...(data.zaloNhomChat !== undefined && { zaloNhomChat: data.zaloNhomChat as object[] }),
        },
        include: { chuSoHuu: { select: { id: true, ten: true, email: true } } },
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.toaNha.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async count(filter?: object): Promise<number> {
    return prisma.toaNha.count({ where: filter });
  }
}
