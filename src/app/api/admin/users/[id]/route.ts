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
    const { name, phone, role, isActive, zaloChatId, toaNhaId, toaNhaIds } = body;

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

      await prisma.nguoiDung.update({ where: { id }, data: updateData, select: { id: true } });

      // Cập nhật gán tòa nhà trong phạm vi tòa nhà của mình (hỗ trợ multi-select)
      const hasArrayIds = Array.isArray(toaNhaIds);
      const hasSingleId = toaNhaId !== undefined;
      if (hasArrayIds || hasSingleId) {
        const idsToAssign: string[] = hasArrayIds
          ? (toaNhaIds as string[]).filter((tid: string) => myBuildingIds.includes(tid))
          : (toaNhaId && myBuildingIds.includes(toaNhaId) ? [toaNhaId] : []);
        await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } } });
        for (const tid of idsToAssign) {
          await prisma.toaNhaNguoiQuanLy.create({ data: { toaNhaId: tid, nguoiDungId: id } }).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Admin: full update
    const updateData: Record<string, unknown> = {
      ten: name,
      soDienThoai: phone,
      vaiTro: role,
      trangThai: isActive ? 'hoatDong' : 'khoa',
    };
    if (zaloChatId !== undefined) updateData.zaloChatId = zaloChatId || null;

    await prisma.nguoiDung.update({ where: { id }, data: updateData, select: { id: true } });

    if (role !== 'admin') {
      await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id } });
      // toaNhaIds (array) ưu tiên hơn toaNhaId (single)
      const idsToAssign: string[] = Array.isArray(toaNhaIds) && toaNhaIds.length > 0
        ? toaNhaIds
        : (toaNhaId ? [toaNhaId] : []);
      for (const tid of idsToAssign) {
        await prisma.toaNhaNguoiQuanLy.create({ data: { toaNhaId: tid, nguoiDungId: id } }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    // P2002 = unique constraint (SĐT đã tồn tại)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Số điện thoại đã được sử dụng' }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
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
