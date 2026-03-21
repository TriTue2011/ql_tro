/**
 * PUT /api/admin/users/[id]/quyen
 * Cập nhật quyền hạn của một quản lý trong một tòa nhà cụ thể.
 *
 * Body: { toaNhaId: string, quyenKichHoatTaiKhoan: boolean }
 *
 * Quyền truy cập:
 *   - admin: luôn được
 *   - chuNha: chỉ được với quanLy trong tòa nhà của mình
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const bodySchema = z.object({
  toaNhaId: z.string().min(1),
  quyenKichHoatTaiKhoan: z.boolean(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const role = session.user.role;
  if (role !== 'admin' && role !== 'chuNha') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id: nguoiDungId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { toaNhaId, quyenKichHoatTaiKhoan } = parsed.data;

  // Kiểm tra tòa nhà tồn tại
  const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId }, select: { id: true, chuSoHuuId: true } });
  if (!toaNha) return NextResponse.json({ error: 'Tòa nhà không tồn tại' }, { status: 404 });

  // chuNha chỉ được cấp quyền cho tòa nhà của mình
  if (role === 'chuNha') {
    const isOwnerOrManager =
      toaNha.chuSoHuuId === session.user.id ||
      !!(await prisma.toaNhaNguoiQuanLy.findUnique({
        where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId: session.user.id } },
      }));
    if (!isOwnerOrManager) {
      return NextResponse.json({ error: 'Bạn không có quyền quản lý tòa nhà này' }, { status: 403 });
    }
  }

  // Upsert bản ghi quyền
  const existing = await prisma.toaNhaNguoiQuanLy.findUnique({
    where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Người dùng chưa được gán vào tòa nhà này' }, { status: 400 });
  }

  await prisma.toaNhaNguoiQuanLy.update({
    where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId } },
    data: { quyenKichHoatTaiKhoan },
  });

  return NextResponse.json({ ok: true });
}
