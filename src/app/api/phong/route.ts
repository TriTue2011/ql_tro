import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPhongRepo, getToaNhaRepo } from '@/lib/repositories';
import { parsePage, parseLimit } from '@/lib/parse-query';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type { TrangThaiPhong } from '@/lib/repositories/types';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';

const TRANG_THAI_PHONG: readonly string[] = ['trong', 'daDat', 'dangThue', 'baoTri'];

const phongSchema = z.object({
  maPhong: z.string().min(1, 'Mã phòng là bắt buộc'),
  toaNha: z.string().min(1, 'Tòa nhà là bắt buộc'),
  tang: z.number().min(0, 'Tầng phải lớn hơn hoặc bằng 0'),
  dienTich: z.number().min(1, 'Diện tích phải lớn hơn 0'),
  giaThue: z.number().min(0, 'Giá thuê phải lớn hơn hoặc bằng 0'),
  tienCoc: z.number().min(0, 'Tiền cọc phải lớn hơn hoặc bằng 0'),
  moTa: z.string().optional(),
  anhPhong: z.array(z.string()).optional(),
  tienNghi: z.array(z.string()).optional(),
  soNguoiToiDa: z.number().min(1, 'Số người tối đa phải lớn hơn 0').max(10, 'Số người tối đa không được quá 10'),
  ngayTinhTien: z.number().min(1).max(28).optional(),
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
      return NextResponse.json({ message: 'Admin không quản lý phòng' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const search = searchParams.get('search') || '';
    const toaNhaId = searchParams.get('toaNha') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    const repo = await getPhongRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      toaNhaId: toaNhaId || undefined,
      toaNhaIds: !toaNhaId ? toaNhaIds : undefined,
      trangThai: TRANG_THAI_PHONG.includes(trangThai)
        ? trangThai as TrangThaiPhong : undefined,
    });

    // Batch-fetch hợp đồng đang hoạt động (tránh N+1)
    const phongIds = result.data.map(p => p.id).filter(Boolean) as string[];
    const hopDongBatch = await prisma.hopDong.findMany({
      where: { phongId: { in: phongIds }, trangThai: 'hoatDong' },
      select: {
        id: true,
        phongId: true,
        nguoiDaiDien: { select: { id: true, hoTen: true, soDienThoai: true } },
        khachThue: { select: { id: true, hoTen: true, soDienThoai: true } },
      },
    });
    const hopDongByPhong = new Map(hopDongBatch.map(hd => [hd.phongId, hd]));
    const phongListWithContracts = result.data.map(phong => ({
      ...phong,
      hopDongHienTai: hopDongByPhong.get(phong.id ?? '') ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: phongListWithContracts,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching phong:', error);
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
    const validatedData = phongSchema.parse(body);

    const toaNhaRepo = await getToaNhaRepo();
    const phongRepo = await getPhongRepo();

    // Check if toa nha exists
    const toaNha = await toaNhaRepo.findById(validatedData.toaNha);
    if (!toaNha) {
      return NextResponse.json(
        { message: 'Tòa nhà không tồn tại' },
        { status: 400 }
      );
    }

    const newPhong = await phongRepo.create({
      maPhong: validatedData.maPhong,
      toaNhaId: validatedData.toaNha,
      tang: validatedData.tang,
      dienTich: validatedData.dienTich,
      giaThue: validatedData.giaThue,
      tienCoc: validatedData.tienCoc,
      moTa: validatedData.moTa,
      anhPhong: validatedData.anhPhong || [],
      tienNghi: validatedData.tienNghi || [],
      soNguoiToiDa: validatedData.soNguoiToiDa,
      ngayTinhTien: validatedData.ngayTinhTien ?? 1,
    });

    return NextResponse.json({
      success: true,
      data: newPhong,
      message: 'Phòng đã được tạo thành công',
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
        { message: 'Mã phòng đã tồn tại' },
        { status: 400 }
      );
    }

    console.error('Error creating phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
