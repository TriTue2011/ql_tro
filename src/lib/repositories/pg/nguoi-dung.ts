import prisma from '@/lib/prisma';
import type {
  NguoiDungData,
  CreateNguoiDungInput,
  UpdateNguoiDungInput,
  QueryOptions,
  PaginatedResult,
} from '../types';

function normalize(raw: any): NguoiDungData {
  return {
    id: raw.id,
    ten: raw.ten,
    email: raw.email,
    soDienThoai: raw.soDienThoai ?? undefined,
    vaiTro: raw.vaiTro as NguoiDungData['vaiTro'],
    anhDaiDien: raw.anhDaiDien ?? undefined,
    trangThai: raw.trangThai as NguoiDungData['trangThai'],
    zaloChatId: raw.zaloChatId ?? undefined,
    pendingZaloChatId: raw.pendingZaloChatId ?? undefined,
    nhanThongBaoZalo: raw.nhanThongBaoZalo ?? false,
    ngayTao: raw.ngayTao,
    ngayCapNhat: raw.ngayCapNhat,
  };
}

export default class NguoiDungRepository {
  async findById(id: string): Promise<NguoiDungData | null> {
    const raw = await prisma.nguoiDung.findUnique({ where: { id } });
    if (!raw) return null;
    return normalize(raw);
  }

  async findByEmail(
    email: string
  ): Promise<(NguoiDungData & { matKhau: string }) | null> {
    const raw = await prisma.nguoiDung.findUnique({ where: { email } });
    if (!raw) return null;
    return { ...normalize(raw), matKhau: raw.matKhau };
  }

  async findMany(opts: QueryOptions): Promise<PaginatedResult<NguoiDungData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = opts.search
      ? {
          OR: [
            { ten: { contains: opts.search, mode: 'insensitive' as const } },
            { email: { contains: opts.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      prisma.nguoiDung.count({ where }),
      prisma.nguoiDung.findMany({ where, skip, take: limit, orderBy: { ngayTao: 'desc' } }),
    ]);

    return {
      data: rows.map(normalize),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: CreateNguoiDungInput): Promise<NguoiDungData> {
    const raw = await prisma.nguoiDung.create({
      data: {
        ten: data.ten,
        email: data.email,
        matKhau: data.matKhau,
        soDienThoai: data.soDienThoai,
        vaiTro: data.vaiTro ?? 'nhanVien',
        anhDaiDien: data.anhDaiDien,
      },
    });
    return normalize(raw);
  }

  async update(
    id: string,
    data: UpdateNguoiDungInput
  ): Promise<NguoiDungData | null> {
    try {
      const raw = await prisma.nguoiDung.update({
        where: { id },
        data: {
          ...(data.ten !== undefined && { ten: data.ten }),
          ...(data.soDienThoai !== undefined && { soDienThoai: data.soDienThoai }),
          ...(data.vaiTro !== undefined && { vaiTro: data.vaiTro }),
          ...(data.anhDaiDien !== undefined && { anhDaiDien: data.anhDaiDien }),
          ...(data.trangThai !== undefined && { trangThai: data.trangThai }),
          ...(data.matKhau !== undefined && { matKhau: data.matKhau }),
          ...(data.zaloChatId !== undefined && { zaloChatId: data.zaloChatId }),
          ...(data.pendingZaloChatId !== undefined && { pendingZaloChatId: data.pendingZaloChatId }),
          ...(data.nhanThongBaoZalo !== undefined && { nhanThongBaoZalo: data.nhanThongBaoZalo }),
        },
      });
      return normalize(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.nguoiDung.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
