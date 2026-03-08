import prisma from '@/lib/prisma';
import type {
  PhongData,
  CreatePhongInput,
  UpdatePhongInput,
  PhongQueryOptions,
  PaginatedResult,
  TrangThaiPhong,
} from '../types';

function normalize(raw: any): PhongData {
  return {
    id: raw.id,
    maPhong: raw.maPhong,
    toaNhaId: raw.toaNhaId,
    toaNha: raw.toaNha
      ? { id: raw.toaNha.id, tenToaNha: raw.toaNha.tenToaNha, diaChi: raw.toaNha.diaChi }
      : undefined,
    tang: raw.tang,
    dienTich: raw.dienTich,
    giaThue: raw.giaThue,
    tienCoc: raw.tienCoc,
    moTa: raw.moTa ?? undefined,
    anhPhong: raw.anhPhong,
    tienNghi: raw.tienNghi,
    trangThai: raw.trangThai as TrangThaiPhong,
    soNguoiToiDa: raw.soNguoiToiDa,
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

export default class PhongRepository {
  async findById(id: string): Promise<PhongData | null> {
    const raw = await prisma.phong.findUnique({
      where: { id },
      include: {
        toaNha: { select: { id: true, tenToaNha: true, diaChi: true } },
      },
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: PhongQueryOptions): Promise<PaginatedResult<PhongData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.toaNhaId) where.toaNhaId = opts.toaNhaId;
    if (opts.trangThai) where.trangThai = opts.trangThai;
    if (opts.search) {
      where.maPhong = { contains: opts.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.phong.count({ where }),
      prisma.phong.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ngayTao: 'desc' },
        include: {
          toaNha: { select: { id: true, tenToaNha: true, diaChi: true } },
        },
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreatePhongInput): Promise<PhongData> {
    const raw = await prisma.phong.create({
      data: {
        maPhong: data.maPhong,
        toaNhaId: data.toaNhaId,
        tang: data.tang,
        dienTich: data.dienTich,
        giaThue: data.giaThue,
        tienCoc: data.tienCoc,
        moTa: data.moTa,
        anhPhong: data.anhPhong ?? [],
        tienNghi: data.tienNghi ?? [],
        soNguoiToiDa: data.soNguoiToiDa,
      },
      include: {
        toaNha: { select: { id: true, tenToaNha: true, diaChi: true } },
      },
    });
    return normalize(raw);
  }

  async update(id: string, data: UpdatePhongInput): Promise<PhongData | null> {
    try {
      const raw = await prisma.phong.update({
        where: { id },
        data: {
          ...(data.tang !== undefined && { tang: data.tang }),
          ...(data.dienTich !== undefined && { dienTich: data.dienTich }),
          ...(data.giaThue !== undefined && { giaThue: data.giaThue }),
          ...(data.tienCoc !== undefined && { tienCoc: data.tienCoc }),
          ...(data.moTa !== undefined && { moTa: data.moTa }),
          ...(data.anhPhong !== undefined && { anhPhong: data.anhPhong }),
          ...(data.tienNghi !== undefined && { tienNghi: data.tienNghi }),
          ...(data.trangThai !== undefined && { trangThai: data.trangThai }),
          ...(data.soNguoiToiDa !== undefined && { soNguoiToiDa: data.soNguoiToiDa }),
        },
        include: {
          toaNha: { select: { id: true, tenToaNha: true, diaChi: true } },
        },
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.phong.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async countByToaNha(toaNhaId: string): Promise<Record<TrangThaiPhong, number>> {
    const groups = await prisma.phong.groupBy({
      by: ['trangThai'],
      where: { toaNhaId },
      _count: { _all: true },
    });

    const result: Record<TrangThaiPhong, number> = {
      trong: 0,
      daDat: 0,
      dangThue: 0,
      baoTri: 0,
    };

    for (const g of groups) {
      result[g.trangThai as TrangThaiPhong] = g._count._all;
    }

    return result;
  }
}
