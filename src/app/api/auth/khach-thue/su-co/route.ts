import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { notifyDaiDienHopDong, notifyAdminsOfToaNha, getToaNhaIdOfKhachThue } from '@/lib/send-zalo';

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

  // Thông báo đồng thời cho người đứng HĐ (nếu không phải chính người này báo)
  // và quản lý/chủ trọ
  const kt = await prisma.khachThue.findUnique({ where: { id: session.user.id }, select: { hoTen: true } });
  const mucDoMap: Record<string, string> = { thap: 'Thấp', trungBinh: 'Trung bình', cao: 'Cao', khancap: '🚨 Khẩn cấp' };
  const loaiMap: Record<string, string> = { dienNuoc: 'Điện nước', noiThat: 'Nội thất', vesinh: 'Vệ sinh', anNinh: 'An ninh', khac: 'Khác' };
  const notifMsg = `🔔 Sự cố mới được báo cáo!\n👤 Người báo: ${kt?.hoTen ?? 'Khách thuê'}\n📋 Tiêu đề: ${tieuDe}\n🔧 Loại: ${loaiMap[loaiSuCo] ?? loaiSuCo}\n⚡ Mức độ: ${mucDoMap[mucDoUuTien ?? 'trungBinh']}\n📝 Mô tả: ${moTa}`;

  Promise.allSettled([
    // Thông báo người đứng HĐ (nếu khác người báo)
    hopDong.nguoiDaiDienId !== session.user.id
      ? notifyDaiDienHopDong(hopDong.id, notifMsg)
      : Promise.resolve(),
    // Thông báo quản lý/chủ trọ
    (async () => {
      const toaNhaId = await getToaNhaIdOfKhachThue(session.user.id);
      if (toaNhaId) await notifyAdminsOfToaNha(toaNhaId, notifMsg);
    })(),
  ]).catch(() => {});

  return NextResponse.json(
    { success: true, data: suCo, message: 'Báo cáo sự cố thành công' },
    { status: 201 }
  );
}
