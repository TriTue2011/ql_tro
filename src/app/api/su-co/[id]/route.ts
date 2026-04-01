import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSuCoRepo } from '@/lib/repositories';
import { sseEmit } from '@/lib/sse-emitter';
import { notifyKhachThue } from '@/lib/send-zalo';
import { z } from 'zod';
import { checkQuyen, getToaNhaIdFromSuCo } from '@/lib/server/check-quyen';

const updateSuCoSchema = z.object({
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc').optional(),
  moTa: z.string().min(1, 'Mô tả là bắt buộc').optional(),
  anhSuCo: z.array(z.string()).optional(),
  loaiSuCo: z.enum(['dienNuoc', 'noiThat', 'vesinh', 'anNinh', 'khac']).optional(),
  mucDoUuTien: z.enum(['thap', 'trungBinh', 'cao', 'khancap']).optional(),
  trangThai: z.enum(['moi', 'dangXuLy', 'daXong', 'daHuy']).optional(),
  nguoiXuLy: z.string().optional(),
  ghiChuXuLy: z.string().optional(),
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
    const repo = await getSuCoRepo();
    const suCo = await repo.findById(id);

    if (!suCo) {
      return NextResponse.json(
        { message: 'Sự cố không tồn tại' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: suCo,
    });

  } catch (error) {
    console.error('Error fetching su co:', error);
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSuCoSchema.parse(body);

    const repo = await getSuCoRepo();

    // Lấy trạng thái cũ để so sánh
    const suCoCu = await repo.findById(id);

    // Kiểm tra quyền sửa sự cố
    const role = session.user.role;
    if (role === 'quanLy' || role === 'nhanVien') {
      const toaNhaId = await getToaNhaIdFromSuCo(id);
      if (toaNhaId) {
        const perm = await checkQuyen(session.user.id, role, toaNhaId, 'quyenSuCo');
        if (!perm.allowed) {
          return NextResponse.json({ message: perm.message }, { status: 403 });
        }
      }
    }

    const suCo = await repo.update(id, {
      trangThai: validatedData.trangThai,
      nguoiXuLyId: validatedData.nguoiXuLy,
      ghiChuXuLy: validatedData.ghiChuXuLy,
      anhSuCo: validatedData.anhSuCo,
    });

    if (!suCo) {
      return NextResponse.json(
        { message: 'Sự cố không tồn tại' },
        { status: 404 }
      );
    }

    // Gửi Zalo thông báo cho khách thuê khi trạng thái thay đổi
    if (validatedData.trangThai && suCoCu && validatedData.trangThai !== suCoCu.trangThai) {
      const msgMap: Record<string, string> = {
        dangXuLy: `✅ Sự cố "${suCo.tieuDe}" của bạn đã được tiếp nhận và đang xử lý.`,
        daXong: `🎉 Sự cố "${suCo.tieuDe}" đã được xử lý xong!${validatedData.ghiChuXuLy ? `\nGhi chú: ${validatedData.ghiChuXuLy}` : ''}`,
        daHuy: `ℹ️ Sự cố "${suCo.tieuDe}" đã được đóng/hủy.${validatedData.ghiChuXuLy ? `\nGhi chú: ${validatedData.ghiChuXuLy}` : ''}`,
      };
      const msg = msgMap[validatedData.trangThai];
      if (msg) {
        notifyKhachThue((suCo as any).khachThueId, msg).catch(() => {});
      }
    }

    sseEmit('su-co', { action: 'updated' });
    return NextResponse.json({
      success: true,
      data: suCo,
      message: 'Sự cố đã được cập nhật thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating su co:', error);
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
    const repo = await getSuCoRepo();

    const suCo = await repo.findById(id);
    if (!suCo) {
      return NextResponse.json(
        { message: 'Sự cố không tồn tại' },
        { status: 404 }
      );
    }

    // Kiểm tra quyền xóa sự cố
    const role = session.user.role;
    if (role === 'quanLy' || role === 'nhanVien') {
      const toaNhaId = await getToaNhaIdFromSuCo(id);
      if (toaNhaId) {
        const perm = await checkQuyen(session.user.id, role, toaNhaId, 'quyenSuCo');
        if (!perm.allowed) {
          return NextResponse.json({ message: perm.message }, { status: 403 });
        }
      }
    }

    await repo.delete(id);

    return NextResponse.json({
      success: true,
      message: 'Sự cố đã được xóa thành công',
    });

  } catch (error) {
    console.error('Error deleting su co:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
