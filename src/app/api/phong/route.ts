import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPhongRepo, getToaNhaRepo, getHopDongRepo } from '@/lib/repositories';
import { z } from 'zod';

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
    const toaNhaId = searchParams.get('toaNha') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const repo = await getPhongRepo();
    const hopDongRepo = await getHopDongRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      toaNhaId: toaNhaId || undefined,
      trangThai: trangThai as any || undefined,
    });

    // Thêm thông tin hợp đồng hiện tại cho mỗi phòng
    const phongListWithContracts = await Promise.all(
      result.data.map(async (phong) => {
        const hopDongResult = await hopDongRepo.findMany({
          phongId: phong.id,
          trangThai: 'hoatDong',
          limit: 1,
        });
        return {
          ...phong,
          hopDongHienTai: hopDongResult.data[0] || null,
        };
      })
    );

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
    });

    return NextResponse.json({
      success: true,
      data: newPhong,
      message: 'Phòng đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
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
