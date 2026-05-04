/**
 * PUT /api/admin/users/[id]/quyen
 * Cập nhật quyền hạn của một quản lý trong một tòa nhà cụ thể.
 *
 * Body: {
 *   toaNhaId: string,
 *   mucDoHopDong?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoKichHoatTaiKhoan?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoHoaDon?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoThanhToan?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoSuCo?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoCongViec?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoBaoDuong?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoKho?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoZalo?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoZaloMonitor?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoCaiDatHotline?: 'hidden' | 'viewOnly' | 'fullAccess',
 *   mucDoCaiDatEmail?: 'hidden' | 'viewOnly' | 'fullAccess',
 * }
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

const permissionLevelSchema = z.enum(['hidden', 'viewOnly', 'fullAccess']).optional();

const bodySchema = z.object({
  toaNhaId: z.string().min(1),
  mucDoHopDong: permissionLevelSchema,
  mucDoKichHoatTaiKhoan: permissionLevelSchema,
  mucDoHoaDon: permissionLevelSchema,
  mucDoThanhToan: permissionLevelSchema,
  mucDoSuCo: permissionLevelSchema,
  mucDoCongViec: permissionLevelSchema,
  mucDoBaoDuong: permissionLevelSchema,
  mucDoKho: permissionLevelSchema,
  mucDoZalo: permissionLevelSchema,
  mucDoZaloMonitor: permissionLevelSchema,
  mucDoCaiDatHotline: permissionLevelSchema,
  mucDoCaiDatEmail: permissionLevelSchema,
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
  const { toaNhaId, ...quyenData } = parsed.data;

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

  // Chỉ cập nhật những quyền được gửi lên (partial update)
  const updateData: Record<string, string> = {};
  for (const [key, val] of Object.entries(quyenData)) {
    if (val !== undefined) updateData[key] = val;
  }

  // Upsert bản ghi quyền (tạo nếu chưa có, cập nhật nếu đã có)
  await prisma.toaNhaNguoiQuanLy.upsert({
    where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId } },
    create: { toaNhaId, nguoiDungId, ...updateData },
    update: updateData,
  });

  return NextResponse.json({ ok: true });
}
