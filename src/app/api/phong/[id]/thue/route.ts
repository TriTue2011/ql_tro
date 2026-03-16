import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/phong/[id]/thue — gán khách thuê vào phòng (tạo hợp đồng tối giản)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['admin', 'chuNha'].includes(session.user.role ?? '')) {
    return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
  }

  try {
    const { khachThueId } = await req.json();
    if (!khachThueId) {
      return NextResponse.json({ success: false, message: 'Thiếu khachThueId' }, { status: 400 });
    }

    const phong = await prisma.phong.findUnique({ where: { id: params.id } });
    if (!phong) {
      return NextResponse.json({ success: false, message: 'Phòng không tồn tại' }, { status: 404 });
    }
    if (phong.trangThai === 'dangThue') {
      return NextResponse.json({ success: false, message: 'Phòng đang có người thuê' }, { status: 400 });
    }

    const khachThue = await prisma.khachThue.findUnique({ where: { id: khachThueId } });
    if (!khachThue) {
      return NextResponse.json({ success: false, message: 'Khách thuê không tồn tại' }, { status: 404 });
    }

    // Tạo hợp đồng tối giản
    const ngayBatDau = new Date();
    const ngayKetThuc = new Date();
    ngayKetThuc.setFullYear(ngayKetThuc.getFullYear() + 1);

    const maHopDong = `HD-${Date.now()}`;

    const hopDong = await prisma.hopDong.create({
      data: {
        maHopDong,
        phongId: phong.id,
        nguoiDaiDienId: khachThueId,
        khachThue: { connect: { id: khachThueId } },
        ngayBatDau,
        ngayKetThuc,
        giaThue: phong.giaThue,
        tienCoc: phong.tienCoc,
        chuKyThanhToan: 'thang',
        ngayThanhToan: phong.ngayTinhTien ?? 1,
        dieuKhoan: '',
        giaDien: 3500,
        giaNuoc: 15000,
        trangThai: 'hoatDong',
      },
    });

    // Cập nhật trạng thái phòng và khách thuê
    await Promise.all([
      prisma.phong.update({ where: { id: phong.id }, data: { trangThai: 'dangThue' } }),
      prisma.khachThue.update({ where: { id: khachThueId }, data: { trangThai: 'dangThue' } }),
    ]);

    return NextResponse.json({ success: true, data: hopDong, message: 'Đã gán khách thuê vào phòng' });
  } catch (error) {
    console.error('[ASSIGN TENANT]', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ' }, { status: 500 });
  }
}

// DELETE /api/phong/[id]/thue — hủy gán (kết thúc hợp đồng hiện tại)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['admin', 'chuNha'].includes(session.user.role ?? '')) {
    return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
  }

  try {
    const hopDong = await prisma.hopDong.findFirst({
      where: { phongId: params.id, trangThai: 'hoatDong' },
      include: { khachThue: true },
    });

    if (!hopDong) {
      return NextResponse.json({ success: false, message: 'Không có hợp đồng đang hoạt động' }, { status: 404 });
    }

    await prisma.hopDong.update({ where: { id: hopDong.id }, data: { trangThai: 'daHuy' } });
    await prisma.phong.update({ where: { id: params.id }, data: { trangThai: 'trong' } });

    // Cập nhật tất cả khách thuê trong hợp đồng
    for (const kt of hopDong.khachThue) {
      await prisma.khachThue.update({ where: { id: kt.id }, data: { trangThai: 'daTraPhong' } });
    }

    return NextResponse.json({ success: true, message: 'Đã hủy gán phòng' });
  } catch (error) {
    console.error('[UNASSIGN TENANT]', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ' }, { status: 500 });
  }
}
