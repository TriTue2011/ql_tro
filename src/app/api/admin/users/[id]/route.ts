import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { notifyTenantsOfNewManager } from '@/lib/zalo-auto-link';
import { validateChucVuForRole } from '@/lib/chuc-vu';

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

/** Lấy nguoiTaoId bằng raw SQL (vì field không có trong Prisma schema) */
async function getNguoiTaoId(userId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ nguoiTaoId: string | null }[]>`
      SELECT "nguoiTaoId" FROM "NguoiDung" WHERE id = ${userId}`;
    return rows.length > 0 ? rows[0].nguoiTaoId : null;
  } catch (e) {
    // Cột nguoiTaoId có thể chưa tồn tại trong DB (cần chạy migration)
    console.warn('Could not get nguoiTaoId (column may not exist yet):', e);
    return null;
  }
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
    const { name, phone, email, role, chucVu, isActive, password, zaloChatId, zaloChatIds, toaNhaId, toaNhaIds, zaloViTri } = body;

    // chuNha/dongChuTro: chỉ được sửa dongChuTro/quanLy/nhanVien thuộc tòa nhà của mình
    if (callerRole !== 'admin') {
      const targetUser = await prisma.nguoiDung.findUnique({ where: { id }, select: { vaiTro: true } });
      if (!targetUser || ['admin', 'chuNha'].includes(targetUser.vaiTro)) {
        return NextResponse.json({ error: 'Không có quyền chỉnh sửa tài khoản này' }, { status: 403 });
      }
      // Cho phép sửa nếu người dùng do chính mình tạo (kể cả chưa gán tòa nhà)
      const nguoiTaoId = await getNguoiTaoId(id);
      if (nguoiTaoId !== session.user.id) {
        const myBuildingIds = await getMyBuildingIds(session.user.id);
        const inBuilding = await prisma.toaNhaNguoiQuanLy.findFirst({
          where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } },
        });
        if (!inBuilding) {
          return NextResponse.json({ error: 'Không có quyền chỉnh sửa tài khoản này' }, { status: 403 });
        }
      }
      // Không cho phép đổi vaiTro thành admin/chuNha
      if (role && ['admin', 'chuNha'].includes(role)) {
        return NextResponse.json({ error: 'Không thể đặt vai trò này' }, { status: 403 });
      }

      const nextRole = role ?? targetUser.vaiTro;
      const chucVuResult = validateChucVuForRole(nextRole, chucVu);
      if (!chucVuResult.ok) {
        return NextResponse.json({ error: chucVuResult.error }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};
      if (name) updateData.ten = name;
      if (phone !== undefined) updateData.soDienThoai = phone || null;
      if (role) updateData.vaiTro = role;
      if (role !== undefined || chucVu !== undefined) updateData.chucVu = chucVuResult.chucVu;
      if (isActive !== undefined) updateData.trangThai = isActive ? 'hoatDong' : 'khoa';
      if (password) {
        updateData.matKhau = await hash(password, 12);
      }
      if (Array.isArray(zaloChatIds)) {
        updateData.zaloChatIds = zaloChatIds;
        if (zaloChatIds.length > 0) updateData.zaloChatId = zaloChatIds[0].threadId || zaloChatIds[0].userId || null;
      } else if (zaloChatId !== undefined) {
        updateData.zaloChatId = zaloChatId || null;
      }

      if (zaloViTri !== undefined) updateData.zaloViTri = zaloViTri;
      await prisma.nguoiDung.update({ where: { id }, data: updateData, select: { id: true } });

      // Cập nhật gán tòa nhà trong phạm vi tòa nhà của mình
      const hasArrayIds = Array.isArray(toaNhaIds);
      const hasSingleId = toaNhaId !== undefined;
      if (hasArrayIds || hasSingleId) {
        const myBuildingIds = await getMyBuildingIds(session.user.id);
        const oldAssignments = await prisma.toaNhaNguoiQuanLy.findMany({
          where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } },
          select: { toaNhaId: true },
        });
        const oldToaNhaIds = new Set(oldAssignments.map(a => a.toaNhaId));

        const idsToAssign: string[] = hasArrayIds
          ? (toaNhaIds as string[]).filter((tid: string) => myBuildingIds.includes(tid))
          : (toaNhaId && myBuildingIds.includes(toaNhaId) ? [toaNhaId] : []);
        
        await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } } });
        for (const tid of idsToAssign) {
          await prisma.toaNhaNguoiQuanLy.create({ data: { toaNhaId: tid, nguoiDungId: id } }).catch(() => {});
        }

        const targetRole = role ?? (await prisma.nguoiDung.findUnique({ where: { id }, select: { vaiTro: true } }))?.vaiTro;
        if (targetRole === 'quanLy' || targetRole === 'dongChuTro') {
          const newToaNhaIds = idsToAssign.filter(tid => !oldToaNhaIds.has(tid));
          for (const tid of newToaNhaIds) {
            notifyTenantsOfNewManager(tid, id).catch(() => {});
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Admin: full update
    const currentUser = await prisma.nguoiDung.findUnique({ where: { id }, select: { vaiTro: true } });
    if (!currentUser) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 404 });
    }

    // BẢO VỆ: Không cho phép đổi vaiTro của admin thành role khác
    if (currentUser.vaiTro === 'admin' && role && role !== 'admin') {
      return NextResponse.json({ error: 'Không thể thay đổi vai trò của tài khoản quản trị viên' }, { status: 403 });
    }

    const nextRole = role ?? currentUser.vaiTro;
    const chucVuResult = validateChucVuForRole(nextRole, chucVu);
    if (!chucVuResult.ok) {
      return NextResponse.json({ error: chucVuResult.error }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.ten = name;
    // Chỉ cập nhật phone/email nếu được gửi lên (kể cả chuỗi rỗng để xóa)
    if (phone !== undefined) updateData.soDienThoai = phone;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.vaiTro = role;
    if (isActive !== undefined) updateData.trangThai = isActive ? 'hoatDong' : 'khoa';
    if (password) {
      updateData.matKhau = await hash(password, 12);
    }
    if (role !== undefined || chucVu !== undefined) updateData.chucVu = chucVuResult.chucVu;
    if (Array.isArray(zaloChatIds)) {
      updateData.zaloChatIds = zaloChatIds;
      if (zaloChatIds.length > 0) updateData.zaloChatId = zaloChatIds[0].threadId || zaloChatIds[0].userId || null;
    } else if (zaloChatId !== undefined) {
      updateData.zaloChatId = zaloChatId || null;
    }

    if (zaloViTri !== undefined) updateData.zaloViTri = zaloViTri;
    await prisma.nguoiDung.update({ where: { id }, data: updateData, select: { id: true } });

    // Chỉ xử lý gán tòa nhà nếu có toaNhaIds hoặc toaNhaId được gửi lên
    const hasBuildingIds = Array.isArray(toaNhaIds) || toaNhaId !== undefined;
    if (role !== 'admin' && hasBuildingIds) {
      const idsToAssign: string[] = Array.isArray(toaNhaIds) && toaNhaIds.length > 0
        ? toaNhaIds
        : (toaNhaId ? [toaNhaId] : []);

      // 1. Lưu lại các tòa nhà cũ để so sánh (thông báo quản lý)
      const oldAssignments = await prisma.toaNhaNguoiQuanLy.findMany({
        where: { nguoiDungId: id },
        select: { toaNhaId: true },
      });
      const oldToaNhaIds = new Set(oldAssignments.map(a => a.toaNhaId));

      // 2. Cleanup toàn bộ gán cũ (cả manager table)
      await prisma.toaNhaNguoiQuanLy.deleteMany({ where: { nguoiDungId: id } });

      // 3. Thực hiện gán mới
      if (role === 'chuNha') {
        // Với chuNha: Cập nhật quyền sở hữu (owner)
        for (const tid of idsToAssign) {
          await prisma.toaNha.update({
            where: { id: tid },
            data: { chuSoHuuId: id },
          }).catch(() => {});
        }
      }
      
      // Cho cả chuNha và các role khác: Gán vào bảng quản lý để đồng bộ visibility
      for (const tid of idsToAssign) {
        await prisma.toaNhaNguoiQuanLy.create({ data: { toaNhaId: tid, nguoiDungId: id } }).catch(() => {});
      }

      // 4. Gửi thông báo nếu là quản lý mới
      if (role === 'quanLy' || role === 'dongChuTro') {
        const newToaNhaIds = idsToAssign.filter(tid => !oldToaNhaIds.has(tid));
        for (const tid of newToaNhaIds) {
          notifyTenantsOfNewManager(tid, id).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Số điện thoại đã được sử dụng' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
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
    if (callerRole !== 'admin') {
      const targetUser = await prisma.nguoiDung.findUnique({ where: { id }, select: { vaiTro: true } });
      if (!targetUser || ['admin', 'chuNha'].includes(targetUser.vaiTro)) {
        return NextResponse.json({ error: 'Không có quyền xóa tài khoản này' }, { status: 403 });
      }
      // Cho phép xóa nếu người dùng do chính mình tạo (kể cả chưa gán tòa nhà)
      const nguoiTaoId = await getNguoiTaoId(id);
      if (nguoiTaoId !== session.user.id) {
        const myBuildingIds = await getMyBuildingIds(session.user.id);
        const inBuilding = await prisma.toaNhaNguoiQuanLy.findFirst({
          where: { nguoiDungId: id, toaNhaId: { in: myBuildingIds } },
        });
        if (!inBuilding) {
          return NextResponse.json({ error: 'Không có quyền xóa tài khoản này' }, { status: 403 });
        }
      }
    }
    await prisma.nguoiDung.delete({ where: { id } });
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
