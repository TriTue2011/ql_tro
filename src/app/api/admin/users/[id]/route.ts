import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, phone, role, isActive, zaloChatId, toaNhaId } = body;

    const updateData: Record<string, unknown> = {
      ten: name,
      soDienThoai: phone,
      vaiTro: role,
      trangThai: isActive ? 'hoatDong' : 'khoa',
    };
    if (zaloChatId !== undefined) updateData.zaloChatId = zaloChatId || null;

    const updatedUser = await prisma.nguoiDung.update({
      where: { id },
      data: updateData,
    });

    // Cập nhật gán tòa nhà (cho non-admin)
    if (role !== 'admin') {
      // Xóa tất cả gán hiện tại
      await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id } });
      // Thêm gán mới nếu có
      if (toaNhaId) {
        await prisma.toaNhaNguoiQuanLy.create({
          data: { toaNhaId, nguoiDungId: id },
        }).catch(() => {}); // ignore duplicate
      }
    }

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (session.user.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await prisma.nguoiDung.delete({ where: { id } });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
