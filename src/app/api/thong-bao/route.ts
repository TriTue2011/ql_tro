import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getThongBaoRepo } from '@/lib/repositories';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { parsePage, parseLimit } from '@/lib/parse-query';
import { z } from 'zod';

const thongBaoSchema = z.object({
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc'),
  noiDung: z.string().min(1, 'Nội dung là bắt buộc'),
  loai: z.enum(['chung', 'hoaDon', 'suCo', 'hopDong', 'khac']).optional(),
  nguoiNhan: z.array(z.string()).min(1, 'Phải có ít nhất 1 người nhận'),
  phong: z.array(z.string()).optional(),
  toaNha: z.string().optional(),
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
      return NextResponse.json({ message: 'Admin không quản lý thông báo' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const search = searchParams.get('search') || '';
    const loai = searchParams.get('loai') || '';

    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    const repo = await getThongBaoRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      loai: ['chung','hoaDon','suCo','hopDong','khac'].includes(loai) ? loai as import('@/lib/repositories/types').LoaiThongBao : undefined,
      toaNhaIds,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching thong bao:', error);
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
    const validatedData = thongBaoSchema.parse(body);

    const repo = await getThongBaoRepo();

    const newThongBao = await repo.create({
      tieuDe: validatedData.tieuDe,
      noiDung: validatedData.noiDung,
      loai: validatedData.loai || 'chung',
      nguoiGuiId: session.user.id,
      nguoiNhan: validatedData.nguoiNhan,
      phongIds: validatedData.phong || [],
      toaNhaId: validatedData.toaNha,
    });

    return NextResponse.json({
      success: true,
      data: newThongBao,
      message: 'Thông báo đã được gửi thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating thong bao:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID thông báo là bắt buộc' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = thongBaoSchema.parse(body);

    const repo = await getThongBaoRepo();

    // Mark as read or use prisma for update (thong-bao repo doesn't have generic update)
    // We'll use markAsRead for the common case, but for full update we use prisma directly
    const existing = await repo.findById(id);
    if (!existing) {
      return NextResponse.json(
        { message: 'Không tìm thấy thông báo' },
        { status: 404 }
      );
    }

    // Use prisma for full update since repo doesn't expose generic update
    const { default: prisma } = await import('@/lib/prisma');
    const updatedThongBao = await prisma.thongBao.update({
      where: { id },
      data: {
        tieuDe: validatedData.tieuDe,
        noiDung: validatedData.noiDung,
        loai: validatedData.loai || 'chung',
        nguoiNhan: validatedData.nguoiNhan,
        toaNhaId: validatedData.toaNha,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedThongBao,
      message: 'Cập nhật thông báo thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating thong bao:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Cập nhật trạng thái xử lý thông báo
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'ID thông báo là bắt buộc' }, { status: 400 });
    }

    const body = await request.json();
    const validTrangThai = ['chuaXuLy', 'daXuLy', 'tuChoi', 'tamHoan'];
    if (!body.trangThaiXuLy || !validTrangThai.includes(body.trangThaiXuLy)) {
      return NextResponse.json(
        { message: 'Trạng thái không hợp lệ' },
        { status: 400 }
      );
    }

    const repo = await getThongBaoRepo();
    const updated = await repo.updateTrangThai(id, body.trangThaiXuLy);
    if (!updated) {
      return NextResponse.json({ message: 'Không tìm thấy thông báo' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Cập nhật trạng thái thành công',
    });
  } catch (error) {
    console.error('Error updating thong bao status:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID thông báo là bắt buộc' },
        { status: 400 }
      );
    }

    const repo = await getThongBaoRepo();
    const deleted = await repo.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { message: 'Không tìm thấy thông báo' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Xóa thông báo thành công',
    });

  } catch (error) {
    console.error('Error deleting thong bao:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
