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
    soDienThoai: raw.soDienThoai ?? undefined,
    email: raw.email ?? undefined,
    cccd: raw.cccd,
    ngaySinh: raw.ngaySinh,
    gioiTinh: raw.gioiTinh as KhachThueData['gioiTinh'],
    queQuan: raw.queQuan,
    anhCCCD: raw.anhCCCD ? (raw.anhCCCD as AnhCCCD) : undefined,
    ngheNghiep: raw.ngheNghiep ?? undefined,
    zaloChatId: raw.zaloChatId ?? undefined,
    pendingZaloChatId: raw.pendingZaloChatId ?? undefined,
    nhanThongBaoZalo: raw.nhanThongBaoZalo ?? false,
    batDangNhapWeb: raw.batDangNhapWeb ?? false,
    hasMatKhau: !!raw.matKhau,
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
  ): Promise<(KhachThueData & { matKhau?: string; batDangNhapWeb: boolean }) | null> {
    const raw = await prisma.khachThue.findUnique({ where: { soDienThoai: sdt } });
    if (!raw) return null;
    return { ...normalize(raw), matKhau: raw.matKhau ?? undefined, batDangNhapWeb: raw.batDangNhapWeb };
  }

  async findByEmail(
    email: string
  ): Promise<(KhachThueData & { matKhau?: string; batDangNhapWeb: boolean }) | null> {
    const raw = await prisma.khachThue.findUnique({ where: { email } });
    if (!raw) return null;
    return { ...normalize(raw), matKhau: raw.matKhau ?? undefined, batDangNhapWeb: raw.batDangNhapWeb };
  }

  async findMany(opts: QueryOptions & { toaNhaIds?: string[]; userId?: string }): Promise<PaginatedResult<KhachThueData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = opts.search
      ? {
          OR: [
            { hoTen: { contains: opts.search, mode: 'insensitive' as const } },
            { cccd: { contains: opts.search, mode: 'insensitive' as const } },
            { soDienThoai: { contains: opts.search, mode: 'insensitive' as const } },
            { email: { contains: opts.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Lọc khách thuê theo tòa nhà của user
    // + khách thuê mồ côi (chưa có hợp đồng) do chính user hoặc đồng nghiệp cùng tòa nhà tạo
    if (opts.toaNhaIds?.length) {
      // Tìm tất cả NguoiDung thuộc cùng tòa nhà (chủ trọ + quản lý)
      const coWorkerIds = opts.userId ? await prisma.nguoiDung.findMany({
        where: {
          OR: [
            { toaNha: { some: { id: { in: opts.toaNhaIds } } } },
            { toaNhaQuanLy: { some: { toaNhaId: { in: opts.toaNhaIds } } } },
          ],
        },
        select: { id: true },
      }).then(list => list.map(u => u.id)) : [];

      const toaNhaFilter = {
        OR: [
          { hopDong: { some: { phong: { toaNhaId: { in: opts.toaNhaIds } } } } },
          // Khách thuê mồ côi do người cùng tòa nhà tạo
          { hopDong: { none: {} }, nguoiTaoId: { in: coWorkerIds } },
        ],
      };

      if (where.OR) {
        const searchFilter = { OR: where.OR };
        delete where.OR;
        where.AND = [searchFilter, toaNhaFilter];
      } else {
        Object.assign(where, toaNhaFilter);
      }
    }

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
        nguoiTaoId: data.nguoiTaoId,
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
      await prisma.khachThue.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
