import prisma from '@/lib/prisma';
import type {
  ThongBaoData,
  CreateThongBaoInput,
  ThongBaoQueryOptions,
  QueryOptions,
  PaginatedResult,
  LoaiThongBao,
} from '../types';

const includeRelations = {
  nguoiGui: { select: { id: true, ten: true, email: true } },
  phong: { select: { phongId: true } },
};

function normalize(raw: any): ThongBaoData {
  return {
    id: raw.id,
    tieuDe: raw.tieuDe,
    noiDung: raw.noiDung,
    loai: raw.loai as LoaiThongBao,
    nguoiGuiId: raw.nguoiGuiId,
    nguoiGui: raw.nguoiGui
      ? { id: raw.nguoiGui.id, ten: raw.nguoiGui.ten, email: raw.nguoiGui.email }
      : undefined,
    nguoiNhan: raw.nguoiNhan,
    phongIds: raw.phong ? raw.phong.map((p: any) => p.phongId) : undefined,
    toaNhaId: raw.toaNhaId ?? undefined,
    daDoc: raw.daDoc,
    trangThaiXuLy: (raw.trangThaiXuLy ?? 'chuaXuLy') as ThongBaoData['trangThaiXuLy'],
    ngayGui: raw.ngayGui,
    ngayTao: raw.ngayTao,
  };
}

export default class ThongBaoRepository {
  async findById(id: string): Promise<ThongBaoData | null> {
    const raw = await prisma.thongBao.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(opts: ThongBaoQueryOptions = {}): Promise<PaginatedResult<ThongBaoData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.loai) where.loai = opts.loai;
    if (opts.nguoiNhanId) {
      where.nguoiNhan = { has: opts.nguoiNhanId };
    }
    if (opts.toaNhaIds?.length) {
      where.toaNhaId = { in: opts.toaNhaIds };
    }
    if (opts.search) {
      where.tieuDe = { contains: opts.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.thongBao.count({ where }),
      prisma.thongBao.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ngayGui: 'desc' },
        include: includeRelations,
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByNguoiNhan(
    userId: string,
    opts: QueryOptions = {}
  ): Promise<PaginatedResult<ThongBaoData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { nguoiNhan: { has: userId } };
    if (opts.search) {
      where.tieuDe = { contains: opts.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.thongBao.count({ where }),
      prisma.thongBao.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ngayGui: 'desc' },
        include: includeRelations,
      }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreateThongBaoInput): Promise<ThongBaoData> {
    const raw = await prisma.thongBao.create({
      data: {
        tieuDe: data.tieuDe,
        noiDung: data.noiDung,
        loai: data.loai ?? 'chung',
        nguoiGuiId: data.nguoiGuiId,
        nguoiNhan: data.nguoiNhan,
        toaNhaId: data.toaNhaId,
        daDoc: [],
        trangThaiXuLy: data.trangThaiXuLy ?? 'chuaXuLy',
        ...(data.phongIds && data.phongIds.length > 0
          ? {
              phong: {
                create: data.phongIds.map((phongId) => ({ phongId })),
              },
            }
          : {}),
      },
      include: includeRelations,
    });
    return normalize(raw);
  }

  async updateTrangThai(id: string, trangThaiXuLy: string): Promise<ThongBaoData | null> {
    try {
      const raw = await prisma.thongBao.update({
        where: { id },
        data: { trangThaiXuLy },
        include: includeRelations,
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async markAsRead(id: string, userId: string): Promise<ThongBaoData | null> {
    try {
      const existing = await prisma.thongBao.findUnique({ where: { id } });
      if (!existing) return null;

      if (existing.daDoc.includes(userId)) {
        return normalize(
          await prisma.thongBao.findUnique({
            where: { id },
            include: includeRelations,
          })
        );
      }

      const raw = await prisma.thongBao.update({
        where: { id },
        data: { daDoc: { push: userId } },
        include: includeRelations,
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Delete join table records first
      await prisma.thongBaoPhong.deleteMany({ where: { thongBaoId: id } });
      await prisma.thongBao.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
