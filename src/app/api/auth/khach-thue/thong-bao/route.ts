import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET - Lấy thông báo của khách thuê (phân theo loại) + nhắc nhở tự động
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const khachThueId = session.user.id;
  const now = new Date();

  const [thongBaoList, hopDong] = await Promise.all([
    prisma.thongBao.findMany({
      where: { nguoiNhan: { has: khachThueId } },
      orderBy: { ngayGui: 'desc' },
      select: {
        id: true, tieuDe: true, noiDung: true, loai: true,
        ngayGui: true, daDoc: true,
      },
    }),
    prisma.hopDong.findFirst({
      where: {
        khachThue: { some: { id: khachThueId } },
        trangThai: 'hoatDong',
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
      },
      select: { ngayKetThuc: true, ngayThanhToan: true },
    }),
  ]);

  // Tạo thông báo nhắc nhở tự động
  const nhacNhoList: { id: string; tieuDe: string; noiDung: string; ngayGui: string; daDoc: boolean }[] = [];

  if (hopDong) {
    // 1. Sắp hết hợp đồng
    const daysLeft = Math.ceil((new Date(hopDong.ngayKetThuc).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 60 && daysLeft > 0) {
      nhacNhoList.push({
        id: 'nhac-hop-dong',
        tieuDe: 'Hợp đồng sắp hết hạn',
        noiDung: `Hợp đồng của bạn còn ${daysLeft} ngày nữa sẽ hết hạn (${new Date(hopDong.ngayKetThuc).toLocaleDateString('vi-VN')}). Vui lòng liên hệ quản lý để gia hạn.`,
        ngayGui: now.toISOString(),
        daDoc: false,
      });
    }

    // 2. Đến ngày chốt điện nước (3 ngày trước và đúng ngày)
    const ngayThanhToan = hopDong.ngayThanhToan;
    const ngayHomNay = now.getDate();
    const daysUntil = ngayThanhToan >= ngayHomNay
      ? ngayThanhToan - ngayHomNay
      : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - ngayHomNay + ngayThanhToan;

    if (daysUntil <= 3) {
      nhacNhoList.push({
        id: 'nhac-chot-dien-nuoc',
        tieuDe: daysUntil === 0 ? 'Hôm nay là ngày chốt điện nước' : `Sắp đến ngày chốt điện nước (còn ${daysUntil} ngày)`,
        noiDung: `Ngày chốt điện nước hàng tháng là ngày ${ngayThanhToan}. Vui lòng ghi lại chỉ số điện nước và báo cáo nếu có sự cố.`,
        ngayGui: now.toISOString(),
        daDoc: false,
      });
    }
  }

  // Phân loại thông báo đã lưu
  const mapTB = (tb: (typeof thongBaoList)[0]) => ({
    id: tb.id,
    tieuDe: tb.tieuDe,
    noiDung: tb.noiDung,
    loai: tb.loai,
    ngayGui: tb.ngayGui.toISOString(),
    daDoc: tb.daDoc.includes(khachThueId),
  });

  return NextResponse.json({
    success: true,
    data: {
      hoaDon:   thongBaoList.filter(tb => tb.loai === 'hoaDon').map(mapTB),
      suCo:     thongBaoList.filter(tb => tb.loai === 'suCo').map(mapTB),
      nhacNho:  nhacNhoList,
      khac:     thongBaoList.filter(tb => !['hoaDon', 'suCo'].includes(tb.loai)).map(mapTB),
    },
  });
}

// PATCH - Đánh dấu đã đọc
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id || id.startsWith('nhac-')) {
    return NextResponse.json({ success: true }); // nhacNho tự động không lưu trạng thái
  }

  const tb = await prisma.thongBao.findUnique({ where: { id }, select: { daDoc: true, nguoiNhan: true } });
  if (!tb || !tb.nguoiNhan.includes(session.user.id)) {
    return NextResponse.json({ success: false, message: 'Không tìm thấy' }, { status: 404 });
  }

  if (!tb.daDoc.includes(session.user.id)) {
    await prisma.thongBao.update({
      where: { id },
      data: { daDoc: { push: session.user.id } },
    });
  }

  return NextResponse.json({ success: true });
}
