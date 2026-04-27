import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToaNhaRepo } from '@/lib/repositories';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sseEmit } from '@/lib/sse-emitter';

const toaNghiEnum = z.enum(['wifi', 'camera', 'baoVe', 'giuXe', 'thangMay', 'sanPhoi', 'nhaVeSinhChung', 'khuBepChung']);

const toaNhaSchema = z.object({
  tenToaNha: z.string().min(1, 'Tên tòa nhà là bắt buộc'),
  diaChi: z.object({
    soNha: z.string().min(1, 'Số nhà là bắt buộc'),
    duong: z.string().min(1, 'Tên đường là bắt buộc'),
    phuong: z.string().min(1, 'Phường/xã là bắt buộc'),
    quan: z.string().min(1, 'Quận/huyện là bắt buộc'),
    thanhPho: z.string().min(1, 'Thành phố là bắt buộc'),
  }),
  moTa: z.string().optional(),
  tienNghiChung: z.array(toaNghiEnum).optional(),
  lienHePhuTrach: z.array(z.object({
    ten: z.string(),
    soDienThoai: z.string(),
    vaiTro: z.string().optional(),
  })).optional(),
});

const parsePage = (val: string | null) => {
  const p = parseInt(val || '1');
  return isNaN(p) || p < 1 ? 1 : p;
};

const parseLimit = (val: string | null) => {
  const l = parseInt(val || '10');
  return isNaN(l) || l < 1 ? 10 : l;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const search = searchParams.get('search') || '';

    const repo = await getToaNhaRepo();
    const role = session.user.role;
    const userId = session.user.id;

    // QUY TẮC HIỂN THỊ MỚI:
    // - Admin: Thấy tất cả.
    // - Tất cả vai trò khác (chuNha, quanLy, ...): Chỉ thấy những tòa nhà được gán trong ToaNhaNguoiQuanLy.
    // Điều này cho phép Admin kiểm soát tuyệt đối việc ai thấy gì qua UI "Gán tòa nhà".
    
    const managerId = role !== 'admin' ? userId : undefined;
    const ownerId = undefined; // Không dùng chuSoHuuId để filter visibility nữa để tránh "3 tòa" do owner cũ.

    const result = await repo.findMany({ page, limit, search: search || undefined, ownerId, managerId });

    // Nếu là Landlord (chuNha) và không thấy tòa nhà nào qua assignment table, 
    // thử tìm qua chuSoHuuId để tránh lỗi "0 tòa" cho các tài khoản cũ chưa được migrate.
    if (role === 'chuNha' && result.data.length === 0 && !search) {
       const legacyResult = await repo.findMany({ page, limit, ownerId: userId });
       if (legacyResult.data.length > 0) {
          return NextResponse.json(legacyResult);
       }
    }

    const toaNhaIds = result.data.map(t => t.id).filter(Boolean) as string[];
    const phongGroups = await prisma.phong.groupBy({
      by: ['toaNhaId', 'trangThai'],
      where: { toaNhaId: { in: toaNhaIds } },
      _count: { id: true },
    });

    type Stats = { trong: number; dangThue: number; daDat: number; baoTri: number; total: number };
    const statsMap: Record<string, Stats> = {};
    toaNhaIds.forEach(id => {
      statsMap[id] = { trong: 0, dangThue: 0, daDat: 0, baoTri: 0, total: 0 };
    });

    phongGroups.forEach(g => {
      const s = statsMap[g.toaNhaId];
      if (!s) return;
      const count = g._count.id;
      if (g.trangThai === 'trong') s.trong = count;
      else if (g.trangThai === 'dangThue') s.dangThue = count;
      else if (g.trangThai === 'daDat') s.daDat = count;
      else if (g.trangThai === 'baoTri') s.baoTri = count;
      s.total += count;
    });

    const finalData = result.data.map(t => ({
      ...t,
      phongTrong: statsMap[t.id]?.trong || 0,
      phongDangThue: statsMap[t.id]?.dangThue || 0,
      phongDaDat: statsMap[t.id]?.daDat || 0,
      phongBaoTri: statsMap[t.id]?.baoTri || 0,
      tongSoPhong: statsMap[t.id]?.total || 0,
    }));

    return NextResponse.json({
      success: true,
      data: finalData,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching toa nha:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = toaNhaSchema.parse(body);
    const role = session.user.role;

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

    // QUAN TRỌNG: Mọi vai trò (trừ admin) khi tạo tòa nhà hoặc được gán làm chủ sở hữu 
    // đều phải được thêm vào ToaNhaNguoiQuanLy để có thể nhìn thấy tòa nhà đó.
    
    // 1. Thêm người tạo (nếu không phải admin)
    if (role !== 'admin') {
      await prisma.toaNhaNguoiQuanLy.create({
        data: { toaNhaId: newToaNha.id, nguoiDungId: session.user.id },
      }).catch(() => {});
    }

    // 2. Nếu admin chỉ định chủ sở hữu khác, thêm chủ sở hữu đó vào bảng quản lý luôn
    if (role === 'admin' && chuSoHuuId !== session.user.id) {
       await prisma.toaNhaNguoiQuanLy.create({
          data: { toaNhaId: newToaNha.id, nguoiDungId: chuSoHuuId },
       }).catch(() => {});
    }

    sseEmit('toa-nha', { action: 'created' });
    return NextResponse.json({ success: true, data: newToaNha }, { status: 201 });
  } catch (error) {
    console.error('Error creating toa nha:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
