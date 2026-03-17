import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/** Lấy danh sách quản lý/chủ trọ của tòa nhà mà khách thuê đang ở */
async function getAdminIdsForKhachThue(khachThueId: string): Promise<string[]> {
  const now = new Date();
  const hopDong = await prisma.hopDong.findFirst({
    where: {
      khachThue: { some: { id: khachThueId } },
      trangThai: 'hoatDong',
      ngayBatDau: { lte: now },
      ngayKetThuc: { gte: now },
    },
    include: {
      phong: {
        include: {
          toaNha: {
            include: {
              chuSoHuu: { select: { id: true } },
              nguoiQuanLy: { select: { nguoiDungId: true } },
            },
          },
        },
      },
    },
  });

  if (!hopDong) return [];

  const toaNha = hopDong.phong.toaNha;
  const ids = new Set<string>();
  ids.add(toaNha.chuSoHuuId);
  toaNha.nguoiQuanLy.forEach(q => ids.add(q.nguoiDungId));
  return Array.from(ids);
}

// GET - Xem yêu cầu thay đổi của bản thân
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const yeuCaus = await prisma.yeuCauThayDoi.findMany({
    where: { khachThueId: session.user.id },
    orderBy: { ngayTao: 'desc' },
    include: {
      nguoiPheDuyet: { select: { ten: true } },
    },
  });

  return NextResponse.json({ success: true, data: yeuCaus });
}

// POST - Tạo yêu cầu thay đổi (thay cho cập nhật trực tiếp)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { loai, noiDung } = await request.json();

  if (!loai || !noiDung) {
    return NextResponse.json({ success: false, message: 'Thiếu thông tin' }, { status: 400 });
  }

  // Kiểm tra đã có yêu cầu cùng loại đang chờ duyệt chưa
  const existing = await prisma.yeuCauThayDoi.findFirst({
    where: {
      khachThueId: session.user.id,
      loai,
      trangThai: 'choPheduyet',
    },
  });

  if (existing) {
    // Cập nhật yêu cầu cũ thay vì tạo mới
    const updated = await prisma.yeuCauThayDoi.update({
      where: { id: existing.id },
      data: { noiDung },
    });
    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Đã cập nhật yêu cầu đang chờ duyệt',
    });
  }

  const yeuCau = await prisma.yeuCauThayDoi.create({
    data: {
      khachThueId: session.user.id,
      loai,
      noiDung,
    },
  });

  // Thông báo cho quản lý/chủ trọ (không block nếu lỗi)
  try {
    const adminIds = await getAdminIdsForKhachThue(session.user.id);
    const khachThue = await prisma.khachThue.findUnique({
      where: { id: session.user.id },
      select: { hoTen: true },
    });

    const loaiLabel: Record<string, string> = {
      thongTin: 'thông tin cá nhân',
      anhCCCD: 'ảnh CCCD',
      nguoiCungPhong: 'người cùng phòng',
      thongBao: 'cài đặt thông báo',
    };

    if (adminIds.length > 0) {
      // Tìm system user để làm người gửi (chuNha hoặc admin đầu tiên)
      await prisma.thongBao.create({
        data: {
          tieuDe: `Yêu cầu thay đổi ${loaiLabel[loai] ?? loai}`,
          noiDung: `Khách thuê ${khachThue?.hoTen ?? session.user.id} yêu cầu thay đổi ${loaiLabel[loai] ?? loai}. Vui lòng vào mục "Yêu cầu duyệt" để xem chi tiết và phê duyệt.`,
          loai: 'khac',
          nguoiGuiId: adminIds[0],
          nguoiNhan: adminIds,
        },
      });
    }
  } catch (e) {
    console.error('Lỗi gửi thông báo:', e);
  }

  return NextResponse.json({
    success: true,
    data: yeuCau,
    message: 'Yêu cầu đã được gửi. Vui lòng đợi quản lý phê duyệt.',
  }, { status: 201 });
}
