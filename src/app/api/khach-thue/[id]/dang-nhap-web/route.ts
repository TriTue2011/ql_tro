/**
 * PUT /api/khach-thue/[id]/dang-nhap-web
 *   → Bật/tắt đăng nhập web cho khách thuê cụ thể
 *   Body: { batDangNhapWeb: boolean }
 *
 * Quyền: admin luôn được, chuNha nếu KT thuộc tòa nhà mình, quanLy nếu có quyenKichHoatTaiKhoan
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function getToaNhaIdOfKhachThue(khachThueId: string): Promise<string | null> {
  const hopDong = await prisma.hopDong.findFirst({
    where: { khachThue: { some: { id: khachThueId } }, trangThai: 'hoatDong' },
    select: { phong: { select: { toaNhaId: true } } },
  });
  return hopDong?.phong?.toaNhaId ?? null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const batDangNhapWeb = !!body.batDangNhapWeb;

  const kt = await prisma.khachThue.findUnique({ where: { id }, select: { id: true } });
  if (!kt) {
    return NextResponse.json({ error: 'Không tìm thấy khách thuê' }, { status: 404 });
  }

  const role = session.user.role;

  if (role !== 'admin') {
    const toaNhaId = await getToaNhaIdOfKhachThue(id);
    if (!toaNhaId) {
      return NextResponse.json({ error: 'Không tìm thấy tòa nhà' }, { status: 400 });
    }

    if (role === 'chuNha') {
      const toaNha = await prisma.toaNha.findFirst({
        where: { id: toaNhaId, chuSoHuuId: session.user.id },
        select: { id: true },
      });
      if (!toaNha) {
        return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
      }
    } else if (role === 'quanLy') {
      const perm = await prisma.toaNhaNguoiQuanLy.findUnique({
        where: { toaNhaId_nguoiDungId: { toaNhaId, nguoiDungId: session.user.id } },
        select: { mucDoKichHoatTaiKhoan: true },
      });
      if (!perm?.mucDoKichHoatTaiKhoan || perm.mucDoKichHoatTaiKhoan === 'hidden') {
        return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    }
  }

  await prisma.khachThue.update({
    where: { id },
    data: { batDangNhapWeb },
  });

  return NextResponse.json({ success: true, batDangNhapWeb });
}
