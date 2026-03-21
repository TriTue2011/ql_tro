import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function getMyBuildingIds(userId: string) {
  const rows = await prisma.toaNha.findMany({
    where: {
      OR: [
        { chuSoHuuId: userId },
        { nguoiQuanLy: { some: { nguoiDungId: userId } } },
      ],
    },
    select: { id: true },
  });
  return rows.map(r => r.id);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const callerRole = session?.user?.role;
    const ALLOWED = ['admin', 'chuNha', 'dongChuTro'];
    if (!session?.user?.id || !ALLOWED.includes(callerRole ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, phone, role, isActive, zaloChatId, toaNhaId } = body;

    // chuNha/dongChuTro: chỉ được sửa dongChuTro/quanLy/nhanVien thuộc tòa nhà của mình
    if (callerRole !== 'admin') {
      const targetUser = await prisma.nguoiDung.findUnique({ where: { id }, select: { vaiTro: true } });
      if (!targetUser || ['admin', 'chuNha'].includes(targetUser.vaiTro)) {
        return NextResponse.json({ error: 'Không có quyền chỉnh sửa tài khoản này' }, { status: 403 });
      }
      const myBuildingIds = await getMyBuildingIds(session.user.id);
      const inBuilding = await prisma.toaNhaNguoiQuanLy.findFirst({
        where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } },
      });
      if (!inBuilding) {
        return NextResponse.json({ error: 'Không có quyền chỉnh sửa tài khoản này' }, { status: 403 });
      }
      // Không cho phép đổi vaiTro thành admin/chuNha
      if (role && ['admin', 'chuNha'].includes(role)) {
        return NextResponse.json({ error: 'Không thể đặt vai trò này' }, { status: 403 });
      }

      const updateData: Record<string, unknown> = {};
      if (name) updateData.ten = name;
      if (phone) updateData.soDienThoai = phone;
      if (role) updateData.vaiTro = role;
      if (isActive !== undefined) updateData.trangThai = isActive ? 'hoatDong' : 'khoa';
      if (zaloChatId !== undefined) updateData.zaloChatId = zaloChatId || null;

      const updatedUser = await prisma.nguoiDung.update({ where: { id }, data: updateData });

      // Cập nhật gán tòa nhà trong phạm vi tòa nhà của mình
      if (toaNhaId !== undefined) {
        await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } } });
        if (toaNhaId && myBuildingIds.includes(toaNhaId)) {
          await prisma.toaNhaNguoiQuanLy.create({ data: { toaNhaId, nguoiDungId: id } }).catch(() => {});
        }
      }

      return NextResponse.json(updatedUser);
    }

    // Admin: full update
    const updateData: Record<string, unknown> = {
      ten: name,
      soDienThoai: phone,
      vaiTro: role,
      trangThai: isActive ? 'hoatDong' : 'khoa',
    };
    if (zaloChatId !== undefined) updateData.zaloChatId = zaloChatId || null;

    const updatedUser = await prisma.nguoiDung.update({ where: { id }, data: updateData });

    if (role !== 'admin') {
      await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id } });
      if (toaNhaId) {
        await prisma.toaNhaNguoiQuanLy.create({ data: { toaNhaId, nguoiDungId: id } }).catch(() => {});
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
    const callerRole = session?.user?.role;
    const ALLOWED = ['admin', 'chuNha', 'dongChuTro'];
    if (!session?.user?.id || !ALLOWED.includes(callerRole ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (session.user.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // chuNha/dongChuTro: chỉ xóa được dongChuTro/quanLy/nhanVien thuộc tòa nhà của mình
    if (callerRole !== 'admin') {
      const targetUser = await prisma.nguoiDung.findUnique({ where: { id }, select: { vaiTro: true } });
      if (!targetUser || ['admin', 'chuNha'].includes(targetUser.vaiTro)) {
        return NextResponse.json({ error: 'Không có quyền xóa tài khoản này' }, { status: 403 });
      }
      const myBuildingIds = await getMyBuildingIds(session.user.id);
      const inBuilding = await prisma.toaNhaNguoiQuanLy.findFirst({
        where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } },
      });
      if (!inBuilding) {
        return NextResponse.json({ error: 'Không có quyền xóa tài khoản này' }, { status: 403 });
      }
    }

    await prisma.nguoiDung.delete({ where: { id } });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
