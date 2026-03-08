import { NextRequest, NextResponse } from 'next/server';
import { getPhongRepo } from '@/lib/repositories';
import type { TrangThaiPhong } from '@/lib/repositories/types';

const TRANG_THAI_PHONG: readonly string[] = ['trong', 'daDat', 'dangThue', 'baoTri'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const toaNhaId = searchParams.get('toaNha') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const repo = await getPhongRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      toaNhaId: (toaNhaId && toaNhaId !== 'all') ? toaNhaId : undefined,
      trangThai: (trangThai && trangThai !== 'all' && TRANG_THAI_PHONG.includes(trangThai))
        ? trangThai as TrangThaiPhong : undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching public phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
