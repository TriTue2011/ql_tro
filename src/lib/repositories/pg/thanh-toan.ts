import prisma from '@/lib/prisma';
import type {
  ThanhToanData,
  CreateThanhToanInput,
  QueryOptions,
  PaginatedResult,
  ThongTinChuyenKhoan,
} from '../types';

function normalize(raw: any): ThanhToanData {
  return {
    id: raw.id,
    hoaDonId: raw.hoaDonId,
    hoaDon: raw.hoaDon ? { id: raw.hoaDon.id, maHoaDon: raw.hoaDon.maHoaDon } : undefined,
    soTien: raw.soTien,
    phuongThuc: raw.phuongThuc as ThanhToanData['phuongThuc'],
    thongTinChuyenKhoan: raw.thongTinChuyenKhoan
      ? (raw.thongTinChuyenKhoan as ThongTinChuyenKhoan)
      : undefined,
    ngayThanhToan: raw.ngayThanhToan,
    nguoiNhanId: raw.nguoiNhanId,
    nguoiNhan: raw.nguoiNhan
      ? { id: raw.nguoiNhan.id, ten: raw.nguoiNhan.ten, email: raw.nguoiNhan.email }
      : undefined,
    ghiChu: raw.ghiChu ?? undefined,
    anhBienLai: raw.anhBienLai ?? undefined,
    ngayTao: raw.ngayTao,
  };
}

const includeRelations = {
  hoaDon: { select: { id: true, maHoaDon: true } },
  nguoiNhan: { select: { id: true, ten: true, email: true } },
};

export default class ThanhToanRepository {
  async findById(id: string): Promise<ThanhToanData | null> {
    const raw = await prisma.thanhToan.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!raw) return null;
    return normalize(raw);
  }

  async findMany(
    opts: QueryOptions & { hoaDonId?: string } = {}
  ): Promise<PaginatedResult<ThanhToanData>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const opts2 = opts as QueryOptions & { toaNhaIds?: string[] };
    const where: any = {};
    if (opts2.hoaDonId) where.hoaDonId = opts2.hoaDonId;
    else if (opts2.toaNhaIds?.length) {
      where.hoaDon = { phong: { toaNhaId: { in: opts2.toaNhaIds } } };
    }

    const [total, rows] = await Promise.all([
      prisma.thanhToan.count({ where }),
      prisma.thanhToan.findMany({
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

  async findByHoaDon(hoaDonId: string): Promise<ThanhToanData[]> {
    const rows = await prisma.thanhToan.findMany({
      where: { hoaDonId },
      orderBy: { ngayThanhToan: 'desc' },
      include: includeRelations,
    });
    return rows.map(normalize);
  }

  async create(data: CreateThanhToanInput): Promise<ThanhToanData> {
    const raw = await prisma.thanhToan.create({
      data: {
        hoaDonId: data.hoaDonId,
        soTien: data.soTien,
        phuongThuc: data.phuongThuc,
        thongTinChuyenKhoan: data.thongTinChuyenKhoan
          ? (data.thongTinChuyenKhoan as object)
          : undefined,
        ngayThanhToan: data.ngayThanhToan ? new Date(data.ngayThanhToan) : new Date(),
        nguoiNhanId: data.nguoiNhanId,
        ghiChu: data.ghiChu,
        anhBienLai: data.anhBienLai,
      },
      include: includeRelations,
    });
    return normalize(raw);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.thanhToan.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
