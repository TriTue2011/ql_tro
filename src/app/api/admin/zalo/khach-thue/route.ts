/**
 * GET /api/admin/zalo/khach-thue?toaNhaId=xxx
 * Lấy danh sách khách thuê của tòa nhà (có thông tin Zalo)
 *
 * Dùng cho tính năng "Tin nhắn tự động" — gửi hàng loạt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, role } = session.user;
  const toaNhaId = req.nextUrl.searchParams.get('toaNhaId');

  if (!toaNhaId) {
    return NextResponse.json({ error: 'Cần toaNhaId' }, { status: 400 });
  }

  // Kiểm tra quyền truy cập tòa nhà
  if (role !== 'admin') {
    const toaNha = await prisma.toaNha.findFirst({
      where: {
        id: toaNhaId,
        OR: [
          { chuSoHuuId: userId },
          { nguoiQuanLy: { some: { nguoiDungId: userId } } },
        ],
      },
      select: { id: true },
    });
    if (!toaNha) {
      return NextResponse.json({ error: 'Không có quyền truy cập tòa nhà này' }, { status: 403 });
    }
  }

  try {
    // Lấy khách thuê qua phòng → hopDong → khachThue
    const phongs = await prisma.phong.findMany({
      where: { toaNhaId },
      select: {
        maPhong: true,
        hopDongs: {
          where: { trangThai: 'dangThue' },
          select: {
            khachThues: {
              select: {
                id: true,
                hoTen: true,
                soDienThoai: true,
                zaloChatId: true,
                nhanThongBaoZalo: true,
              },
            },
          },
        },
      },
    });

    const khachThues: {
      id: string;
      hoTen: string;
      soDienThoai: string | null;
      zaloChatId: string | null;
      nhanThongBaoZalo: boolean;
      phong: { maPhong: string };
    }[] = [];

    for (const phong of phongs) {
      for (const hd of phong.hopDongs) {
        for (const kt of hd.khachThues) {
          // Avoid duplicates
          if (!khachThues.find(k => k.id === kt.id)) {
            khachThues.push({
              ...kt,
              phong: { maPhong: phong.maPhong },
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, khachThues });
  } catch (err: any) {
    console.error('[khach-thue GET] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
