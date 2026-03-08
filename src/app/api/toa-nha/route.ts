import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToaNhaRepo, getPhongRepo } from '@/lib/repositories';
import { z } from 'zod';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const repo = await getToaNhaRepo();
    const phongRepo = await getPhongRepo();

    const result = await repo.findMany({ page, limit, search: search || undefined });

    // Tính thống kê trạng thái phòng cho mỗi tòa nhà
    const toaNhaWithStats = await Promise.all(
      result.data.map(async (toaNha) => {
        const phongTrongResult = await phongRepo.findMany({ toaNhaId: toaNha.id, trangThai: 'trong', limit: 1 });
        const phongDangThueResult = await phongRepo.findMany({ toaNhaId: toaNha.id, trangThai: 'dangThue', limit: 1 });
        const phongDaDatResult = await phongRepo.findMany({ toaNhaId: toaNha.id, trangThai: 'daDat', limit: 1 });
        const phongBaoTriResult = await phongRepo.findMany({ toaNhaId: toaNha.id, trangThai: 'baoTri', limit: 1 });
        const tongSoPhongResult = await phongRepo.findMany({ toaNhaId: toaNha.id, limit: 1 });

        return {
          ...toaNha,
          tongSoPhong: tongSoPhongResult.pagination.total,
          phongTrong: phongTrongResult.pagination.total,
          phongDangThue: phongDangThueResult.pagination.total,
          phongDaDat: phongDaDatResult.pagination.total,
          phongBaoTri: phongBaoTriResult.pagination.total,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: toaNhaWithStats,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching toa nha:', error);

    const errorMessage = process.env.NODE_ENV === 'development'
      ? error instanceof Error ? error.message : String(error)
      : 'Internal server error';

    const errorDetails = process.env.NODE_ENV === 'development'
      ? {
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
          fullError: error
        }
      : undefined;

    return NextResponse.json(
      {
        message: errorMessage,
        details: errorDetails,
        error: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/toa-nha started ===');

    const session = await getServerSession(authOptions);
    console.log('Session:', session ? 'Found' : 'Not found');

    if (!session) {
      console.log('No session found, returning 401');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Session user ID:', session.user.id);
    console.log('Session user role:', session.user.role);

    const body = await request.json();
    console.log('Request body:', body);

    const validatedData = toaNhaSchema.parse(body);
    console.log('Validated data:', validatedData);

    const repo = await getToaNhaRepo();

    const newToaNha = await repo.create({
      ...validatedData,
      chuSoHuuId: session.user.id,
      tienNghiChung: validatedData.tienNghiChung || [],
    });

    console.log('Toa nha saved successfully');

    return NextResponse.json({
      success: true,
      data: newToaNha,
      message: 'Tòa nhà đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      return NextResponse.json(
        {
          message: 'Validation error',
          details: error.issues,
          error: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    console.error('Error creating toa nha:', error);

    const errorMessage = process.env.NODE_ENV === 'development'
      ? error instanceof Error ? error.message : String(error)
      : 'Internal server error';

    const errorDetails = process.env.NODE_ENV === 'development'
      ? {
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
          fullError: error
        }
      : undefined;

    return NextResponse.json(
      {
        message: errorMessage,
        details: errorDetails,
        error: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}
