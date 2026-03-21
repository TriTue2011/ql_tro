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

const khachThueSchema = z.object({
  hoTen: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ'),
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
  matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
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

    // Check if phone or CCCD already exists
    const existingBySdt = await repo.findMany({ search: validatedData.soDienThoai, limit: 1 });
    const existingByCCCD = await repo.findMany({ search: validatedData.cccd, limit: 1 });

    const sdtExists = existingBySdt.data.some(k => k.soDienThoai === validatedData.soDienThoai);
    const cccdExists = existingByCCCD.data.some(k => k.cccd === validatedData.cccd);

    if (sdtExists || cccdExists) {
      return NextResponse.json(
        { message: 'Số điện thoại hoặc CCCD đã được sử dụng' },
        { status: 400 }
      );
    }

    const hashedPassword = validatedData.matKhau
      ? await hash(validatedData.matKhau, 12)
      : undefined;

    const newKhachThue = await repo.create({
      hoTen: sanitizeText(validatedData.hoTen),
      soDienThoai: validatedData.soDienThoai,
      email: validatedData.email || undefined,
      cccd: validatedData.cccd,
      ngaySinh: new Date(validatedData.ngaySinh),
      gioiTinh: validatedData.gioiTinh,
      queQuan: sanitizeText(validatedData.queQuan),
      anhCCCD: validatedData.anhCCCD || { matTruoc: '', matSau: '' },
      ngheNghiep: validatedData.ngheNghiep ? sanitizeText(validatedData.ngheNghiep) : undefined,
      matKhau: hashedPassword,
    });

    // Lưu người tạo via raw SQL (column not in Prisma schema)
    if (session.user.id && newKhachThue.id) {
      prisma.$executeRawUnsafe(
        `UPDATE "KhachThue" SET "nguoiTaoId" = $1 WHERE id = $2`,
        session.user.id,
        newKhachThue.id,
      ).catch(() => {});
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
      return NextResponse.json(
        { message: 'Số điện thoại hoặc CCCD đã được sử dụng' },
        { status: 400 }
      );
    }

    console.error('Error creating khach thue:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
