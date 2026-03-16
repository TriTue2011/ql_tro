import prisma from '@/lib/prisma';
import type {
  KhachThueData,
  CreateKhachThueInput,
  UpdateKhachThueInput,
  QueryOptions,
  PaginatedResult,
  TrangThaiKhachThue,
  AnhCCCD,
} from '../types';

function normalize(raw: any): KhachThueData {
  return {
    id: raw.id,
    hoTen: raw.hoTen,
    soDienThoai: raw.soDienThoai,
    email: raw.email ?? undefined,
    cccd: raw.cccd,
    ngaySinh: raw.ngaySinh,
    gioiTinh: raw.gioiTinh as KhachThueData['gioiTinh'],
    queQuan: raw.queQuan,
    anhCCCD: raw.anhCCCD ? (raw.anhCCCD as AnhCCCD) : undefined,
    ngheNghiep: raw.ngheNghiep ?? undefined,
    zaloChatId: raw.zaloChatId ?? undefined,
    pendingZaloChatId: raw.pendingZaloChatId ?? undefined,
    trangThai: raw.trangThai as TrangThaiKhachThue,
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

export default class KhachThueRepository {
  async findById(id: string): Promise<KhachThueData | null> {
    const raw = await prisma.khachThue.findUnique({ where: { id } });
    if (!raw) return null;
    return normalize(raw);
  }

  async findBySoDienThoai(
    sdt: string
  ): Promise<(KhachThueData & { matKhau?: string }) | null> {
    const raw = await prisma.khachThue.findUnique({ where: { soDienThoai: sdt } });
    if (!raw) return null;
    return { ...normalize(raw), matKhau: raw.matKhau ?? undefined };
  }

  async findMany(opts: QueryOptions): Promise<PaginatedResult<KhachThueData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = opts.search
      ? {
          OR: [
            { hoTen: { contains: opts.search, mode: 'insensitive' as const } },
            { cccd: { contains: opts.search, mode: 'insensitive' as const } },
            { soDienThoai: { contains: opts.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      prisma.khachThue.count({ where }),
      prisma.khachThue.findMany({ where, skip, take: limit, orderBy: { ngayTao: 'desc' } }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreateKhachThueInput): Promise<KhachThueData> {
    const raw = await prisma.khachThue.create({
      data: {
        hoTen: data.hoTen,
        soDienThoai: data.soDienThoai,
        email: data.email,
        cccd: data.cccd,
        ngaySinh: new Date(data.ngaySinh),
        gioiTinh: data.gioiTinh,
        queQuan: data.queQuan,
        anhCCCD: data.anhCCCD ? (data.anhCCCD as object) : undefined,
        ngheNghiep: data.ngheNghiep,
        matKhau: data.matKhau,
      },
    });
    return normalize(raw);
  }

  async update(
    id: string,
    data: UpdateKhachThueInput
  ): Promise<KhachThueData | null> {
    try {
      const raw = await prisma.khachThue.update({
        where: { id },
        data: {
          ...(data.hoTen !== undefined && { hoTen: data.hoTen }),
          ...(data.soDienThoai !== undefined && { soDienThoai: data.soDienThoai }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.ngheNghiep !== undefined && { ngheNghiep: data.ngheNghiep }),
          ...(data.anhCCCD !== undefined && { anhCCCD: data.anhCCCD as object }),
          ...(data.trangThai !== undefined && { trangThai: data.trangThai }),
          ...(data.matKhau !== undefined && { matKhau: data.matKhau }),
          ...(data.zaloChatId !== undefined && { zaloChatId: data.zaloChatId }),
          ...(data.pendingZaloChatId !== undefined && { pendingZaloChatId: data.pendingZaloChatId }),
        },
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.khachThue.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
