import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const suCos = await prisma.suCo.findMany({
    where: { khachThueId: session.user.id },
    include: {
      phong: { select: { maPhong: true } },
      nguoiXuLy: { select: { ten: true } },
    },
    orderBy: { ngayTao: 'desc' },
  });

  return NextResponse.json({ success: true, data: suCos });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { tieuDe, moTa, loaiSuCo, mucDoUuTien } = await request.json();

  if (!tieuDe || !moTa || !loaiSuCo) {
    return NextResponse.json({ success: false, message: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }

  const now = new Date();
  const hopDong = await prisma.hopDong.findFirst({
    where: {
      khachThue: { some: { id: session.user.id } },
      trangThai: 'hoatDong',
      ngayBatDau: { lte: now },
      ngayKetThuc: { gte: now },
    },
  });

  if (!hopDong) {
    return NextResponse.json(
      { success: false, message: 'Bạn không có hợp đồng đang hoạt động' },
      { status: 400 }
    );
  }

  const suCo = await prisma.suCo.create({
    data: {
      phongId: hopDong.phongId,
      khachThueId: session.user.id,
      tieuDe,
      moTa,
      loaiSuCo,
      mucDoUuTien: mucDoUuTien || 'trungBinh',
      anhSuCo: [],
    },
  });

  return NextResponse.json(
    { success: true, data: suCo, message: 'Báo cáo sự cố thành công' },
    { status: 201 }
  );
}
