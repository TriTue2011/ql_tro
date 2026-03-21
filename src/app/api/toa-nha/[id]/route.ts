import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToaNhaRepo, getPhongRepo } from '@/lib/repositories';
import { z } from 'zod';

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
    thanhPho: z.string().min(1, 'Thành phố là bắt buộc'),
  }),
  moTa: z.string().optional(),
  tienNghiChung: z.array(z.string()).optional(),
  lienHePhuTrach: z.array(lienHeSchema).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const repo = await getToaNhaRepo();
    const phongRepo = await getPhongRepo();

    const toaNha = await repo.findById(id);

    if (!toaNha) {
      return NextResponse.json(
        { message: 'Tòa nhà không tồn tại' },
        { status: 404 }
      );
    }

    // Tính tổng số phòng thực tế
    const phongResult = await phongRepo.findMany({ toaNhaId: id, limit: 1 });
    const toaNhaWithPhongCount = {
      ...toaNha,
      tongSoPhong: phongResult.pagination.total,
    };

    return NextResponse.json({
      success: true,
      data: toaNhaWithPhongCount,
    });

  } catch (error) {
    console.error('Error fetching toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const repo = await getToaNhaRepo();
    const phongRepo = await getPhongRepo();

    const toaNha = await repo.findById(id);

    if (!toaNha) {
      return NextResponse.json(
        { message: 'Tòa nhà không tồn tại' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this toa nha
    if (toaNha.chuSoHuuId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Bạn không có quyền chỉnh sửa tòa nhà này' },
        { status: 403 }
      );
    }

    const updatedToaNha = await repo.update(id, {
      ...validatedData,
      tienNghiChung: validatedData.tienNghiChung || [],
    });

    // Tính tổng số phòng thực tế
    const phongResult = await phongRepo.findMany({ toaNhaId: id, limit: 1 });
    const toaNhaWithPhongCount = {
      ...updatedToaNha,
      tongSoPhong: phongResult.pagination.total,
    };

    sseEmit('toa-nha', { action: 'updated' });
    return NextResponse.json({
      success: true,
      data: toaNhaWithPhongCount,
      message: 'Tòa nhà đã được cập nhật thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const repo = await getToaNhaRepo();
    const phongRepo = await getPhongRepo();

    const toaNha = await repo.findById(id);

    if (!toaNha) {
      return NextResponse.json(
        { message: 'Tòa nhà không tồn tại' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete this toa nha
    if (toaNha.chuSoHuuId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Bạn không có quyền xóa tòa nhà này' },
        { status: 403 }
      );
    }

    // Check if toa nha has rooms
    const phongResult = await phongRepo.findMany({ toaNhaId: id, limit: 1 });
    if (phongResult.pagination.total > 0) {
      return NextResponse.json(
        { message: 'Không thể xóa tòa nhà có phòng. Vui lòng xóa tất cả phòng trước.' },
        { status: 400 }
      );
    }

    await repo.delete(id);

    sseEmit('toa-nha', { action: 'deleted' });
    return NextResponse.json({
      success: true,
      message: 'Tòa nhà đã được xóa thành công',
    });

  } catch (error) {
    console.error('Error deleting toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
