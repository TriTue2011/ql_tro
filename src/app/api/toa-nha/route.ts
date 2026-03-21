import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToaNhaRepo } from '@/lib/repositories';
import { sseEmit } from '@/lib/sse-emitter';
import { parsePage, parseLimit } from '@/lib/parse-query';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const toaNghiEnum = z.enum(['wifi', 'camera', 'baoVe', 'giuXe', 'thangMay', 'sanPhoi', 'nhaVeSinhChung', 'khuBepChung']);

const lienHeSchema = z.object({
  ten: z.string().min(1, 'Tên liên hệ không được trống'),
  soDienThoai: z.string().min(9, 'Số điện thoại không hợp lệ'),
  vaiTro: z.string().optional(),
});

const toaNhaSchema = z.object({
  tenToaNha: z.string().min(1, 'Tên tòa nhà là bắt buộc'),
  diaChi: z.object({
    soNha: z.string().min(1, 'Số nhà là bắt buộc'),
    duong: z.string().min(1, 'Tên đường là bắt buộc'),
    phuong: z.string().min(1, 'Phường/xã là bắt buộc'),
    quan: z.string().optional(), // không còn bắt buộc
    thanhPho: z.string().min(1, 'Tỉnh/Thành phố là bắt buộc'),
  }),
  moTa: z.string().optional(),
  tienNghiChung: z.array(toaNghiEnum).optional(),
  lienHePhuTrach: z.array(lienHeSchema).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const search = searchParams.get('search') || '';

    const repo = await getToaNhaRepo();
    const role = session.user.role;
    const userId = session.user.id;

    // Scoping theo vai trò:
    // - admin: thấy tất cả
    // - chuNha: thấy tòa nhà mình sở hữu (chuSoHuuId) HOẶC được gán qua ToaNhaNguoiQuanLy
    // - quanLy / nhanVien: chỉ thấy tòa nhà được gán qua ToaNhaNguoiQuanLy
    const ownerId = role === 'chuNha' ? userId : undefined;
    const managerId = (role === 'chuNha' || role === 'quanLy' || role === 'nhanVien') ? userId : undefined;

    const result = await repo.findMany({ page, limit, search: search || undefined, ownerId, managerId });

    // Batch-fetch thống kê phòng (tránh N+1: 5 queries/tòa nhà → 1 groupBy)
    const toaNhaIds = result.data.map(t => t.id).filter(Boolean) as string[];
    const phongGroups = await prisma.phong.groupBy({
      by: ['toaNhaId', 'trangThai'],
      where: { toaNhaId: { in: toaNhaIds } },
      _count: { id: true },
    });

    type Stats = { trong: number; dangThue: number; daDat: number; baoTri: number; total: number };
    const statsMap = new Map<string, Stats>();
    for (const id of toaNhaIds) {
      statsMap.set(id, { trong: 0, dangThue: 0, daDat: 0, baoTri: 0, total: 0 });
    }
    for (const g of phongGroups) {
      const s = statsMap.get(g.toaNhaId);
      if (!s) continue;
      s.total += g._count.id;
      if (g.trangThai === 'trong') s.trong = g._count.id;
      else if (g.trangThai === 'dangThue') s.dangThue = g._count.id;
      else if (g.trangThai === 'daDat') s.daDat = g._count.id;
      else if (g.trangThai === 'baoTri') s.baoTri = g._count.id;
    }

    const toaNhaWithStats = result.data.map(toaNha => {
      const s = statsMap.get(toaNha.id ?? '') ?? { trong: 0, dangThue: 0, daDat: 0, baoTri: 0, total: 0 };
      return {
        ...toaNha,
        tongSoPhong: s.total,
        phongTrong: s.trong,
        phongDangThue: s.dangThue,
        phongDaDat: s.daDat,
        phongBaoTri: s.baoTri,
      };
    });

    return NextResponse.json({
      success: true,
      data: toaNhaWithStats,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = toaNhaSchema.parse(body);

    const role = session.user.role;

    // Admin có thể chỉ định chuSoHuuId (tạo tòa nhà thay cho chủ trọ)
    let chuSoHuuId = session.user.id;
    if (role === 'admin' && body.chuSoHuuId) {
      const owner = await prisma.nguoiDung.findUnique({
        where: { id: body.chuSoHuuId },
        select: { id: true, vaiTro: true },
      });
      if (owner && owner.vaiTro === 'chuNha') {
        chuSoHuuId = owner.id;
      }
    }

    const repo = await getToaNhaRepo();

    const newToaNha = await repo.create({
      ...validatedData,
      chuSoHuuId,
      tienNghiChung: validatedData.tienNghiChung || [],
      lienHePhuTrach: validatedData.lienHePhuTrach || [],
    });

    // Nếu người tạo không phải chuNha thì getUserToaNhaIds không tìm được qua chuSoHuuId
    // → tự thêm họ vào ToaNhaNguoiQuanLy để thấy phòng/hóa đơn của tòa nhà vừa tạo
    if (role !== 'admin' && role !== 'chuNha') {
      await prisma.toaNhaNguoiQuanLy.create({
        data: { toaNhaId: newToaNha.id, nguoiDungId: session.user.id },
      }).catch(() => {}); // bỏ qua nếu đã tồn tại
    }

    sseEmit('toa-nha', { action: 'created' });
    return NextResponse.json({
      success: true,
      data: newToaNha,
      message: 'Tòa nhà đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
