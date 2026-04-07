import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { sseEmit } from '@/lib/sse-emitter';
import { parsePage, parseLimit } from '@/lib/parse-query';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sanitizeText } from '@/lib/sanitize';
import { autoLinkZaloChatIds } from '@/lib/zalo-auto-link';

const khachThueSchema = z.object({
  hoTen: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ').optional().or(z.literal('')),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  cccd: z.string().regex(/^[0-9]{12}$/, 'CCCD phải có 12 chữ số'),
  ngaySinh: z.string().min(1, 'Ngày sinh là bắt buộc'),
  gioiTinh: z.enum(['nam', 'nu', 'khac']),
  queQuan: z.string().min(1, 'Quê quán là bắt buộc'),
  anhCCCD: z.object({
    matTruoc: z.string().optional(),
    matSau: z.string().optional(),
  }).optional(),
  ngheNghiep: z.string().optional(),
  matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional().or(z.literal('')),
}).refine(
  data => (data.soDienThoai && data.soDienThoai.trim() !== '') || (data.email && data.email.trim() !== ''),
  { message: 'Cần ít nhất số điện thoại hoặc email', path: ['soDienThoai'] }
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (role === 'admin') {
      return NextResponse.json({ message: 'Admin không quản lý khách thuê' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const search = searchParams.get('search') || '';

    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    const repo = await getKhachThueRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      toaNhaIds,
      userId: session.user.id,
    });

    // Batch-fetch hợp đồng đang hoạt động (tránh N+1)
    const ktIds = result.data.map(kt => kt.id).filter(Boolean) as string[];
    const hopDongBatch = await prisma.hopDong.findMany({
      where: {
        khachThue: { some: { id: { in: ktIds } } },
        trangThai: 'hoatDong',
      },
      select: {
        id: true,
        khachThue: { select: { id: true } },
        phong: {
          select: {
            id: true,
            maPhong: true,
            toaNha: { select: { tenToaNha: true } },
          },
        },
      },
    });
    const hopDongByKT = new Map<string, (typeof hopDongBatch)[0]>();
    for (const hd of hopDongBatch) {
      for (const kt of hd.khachThue) {
        if (!hopDongByKT.has(kt.id)) hopDongByKT.set(kt.id, hd);
      }
    }
    // Batch-fetch nguoiTaoId từ DB
    const ktIdsForCreator = result.data.map(kt => kt.id).filter(Boolean) as string[];
    const nguoiTaoRows = ktIdsForCreator.length > 0
      ? await prisma.$queryRaw<{ id: string; nguoiTaoId: string | null }[]>`
          SELECT id, "nguoiTaoId" FROM "KhachThue" WHERE id = ANY(${ktIdsForCreator})`
      : [];
    const nguoiTaoIdByKT = new Map(nguoiTaoRows.map(r => [r.id, r.nguoiTaoId]));

    // Batch-fetch tên người tạo
    const creatorIds = [...new Set(nguoiTaoRows.map(r => r.nguoiTaoId).filter(Boolean) as string[])];
    const creators = creatorIds.length > 0
      ? await prisma.nguoiDung.findMany({ where: { id: { in: creatorIds } }, select: { id: true, ten: true } })
      : [];
    const creatorMap = new Map(creators.map(c => [c.id, c.ten]));

    // Auto-sync: cập nhật trạng thái khách thuê có hợp đồng hoạt động nhưng chưa đúng status
    const outOfSyncIds = result.data
      .filter(kt => kt.id && hopDongByKT.has(kt.id) && kt.trangThai !== 'dangThue')
      .map(kt => kt.id as string);
    if (outOfSyncIds.length > 0) {
      prisma.khachThue.updateMany({
        where: { id: { in: outOfSyncIds } },
        data: { trangThai: 'dangThue' },
      }).catch(() => {});
      // Cập nhật luôn trong response
      for (const kt of result.data) {
        if (kt.id && outOfSyncIds.includes(kt.id)) {
          (kt as any).trangThai = 'dangThue';
        }
      }
    }

    const khachThueListWithContracts = result.data.map(kt => {
      const nguoiTaoId = nguoiTaoIdByKT.get(kt.id ?? '') ?? null;
      return {
        ...kt,
        hopDongHienTai: hopDongByKT.get(kt.id ?? '') ?? null,
        nguoiTaoId,
        nguoiTaoTen: nguoiTaoId ? (creatorMap.get(nguoiTaoId) ?? null) : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: khachThueListWithContracts,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching khach thue:', error);
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
    const validatedData = khachThueSchema.parse(body);

    const repo = await getKhachThueRepo();

    const sdt = validatedData.soDienThoai?.trim() || undefined;
    const email = validatedData.email?.trim() || undefined;

    // Kiểm tra trùng SĐT
    if (sdt) {
      const existingBySdt = await repo.findMany({ search: sdt, limit: 1 });
      if (existingBySdt.data.some(k => k.soDienThoai === sdt)) {
        return NextResponse.json({ message: 'Số điện thoại đã được sử dụng' }, { status: 400 });
      }
    }
    // Kiểm tra trùng email
    if (email) {
      const existing = await prisma.khachThue.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ message: 'Email đã được sử dụng' }, { status: 400 });
      }
    }
    // Kiểm tra trùng CCCD
    const existingByCCCD = await repo.findMany({ search: validatedData.cccd, limit: 1 });
    if (existingByCCCD.data.some(k => k.cccd === validatedData.cccd)) {
      return NextResponse.json({ message: 'CCCD đã được sử dụng' }, { status: 400 });
    }

    const matKhauRaw = validatedData.matKhau?.trim() || '';
    const hashedPassword = matKhauRaw ? await hash(matKhauRaw, 12) : undefined;

    const newKhachThue = await repo.create({
      hoTen: sanitizeText(validatedData.hoTen),
      soDienThoai: sdt,
      email,
      cccd: validatedData.cccd,
      ngaySinh: new Date(validatedData.ngaySinh),
      gioiTinh: validatedData.gioiTinh,
      queQuan: sanitizeText(validatedData.queQuan),
      anhCCCD: validatedData.anhCCCD || { matTruoc: '', matSau: '' },
      ngheNghiep: validatedData.ngheNghiep ? sanitizeText(validatedData.ngheNghiep) : undefined,
      matKhau: hashedPassword,
      nguoiTaoId: session.user.id,
    });

    // Tự động tra cứu và liên kết zaloChatId qua bot server (fire-and-forget)
    if (sdt) {
      autoLinkZaloChatIds('khachThue', newKhachThue.id, sdt).catch(() => {});
    }

    sseEmit('khach-thue', { action: 'created' });
    return NextResponse.json({
      success: true,
      data: newKhachThue,
      message: 'Khách thuê đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      let msg = 'Thông tin đã được sử dụng';
      if (target.includes('soDienThoai')) msg = 'Số điện thoại đã được sử dụng';
      else if (target.includes('email')) msg = 'Email đã được sử dụng';
      else if (target.includes('cccd')) msg = 'CCCD đã được sử dụng';
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    console.error('Error creating khach thue:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
