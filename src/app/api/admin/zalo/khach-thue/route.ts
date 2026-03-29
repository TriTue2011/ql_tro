/**
 * GET  /api/admin/zalo/khach-thue?toaNhaId=xxx — Lấy danh sách khách thuê (có thông tin Zalo)
 * PUT  /api/admin/zalo/khach-thue — Cập nhật zaloChatId cho khách thuê hoặc người dùng
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
        tang: true,
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
      phong: { maPhong: string; tang: number };
    }[] = [];

    for (const phong of phongs) {
      for (const hd of phong.hopDongs) {
        for (const kt of hd.khachThues) {
          // Avoid duplicates
          if (!khachThues.find(k => k.id === kt.id)) {
            khachThues.push({
              ...kt,
              phong: { maPhong: phong.maPhong, tang: phong.tang },
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

/**
 * PUT /api/admin/zalo/khach-thue
 * Body: { id, type: 'khachThue' | 'nguoiDung', zaloChatId }
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = session.user;
  if (role !== 'admin' && role !== 'chuNha' && role !== 'quanLy') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, type, zaloChatId } = body;

    if (!id || !type) {
      return NextResponse.json({ error: 'Thiếu id hoặc type' }, { status: 400 });
    }

    if (type === 'khachThue') {
      await prisma.khachThue.update({
        where: { id },
        data: { zaloChatId: zaloChatId || null },
      });
    } else if (type === 'nguoiDung') {
      await prisma.nguoiDung.update({
        where: { id },
        data: { zaloChatId: zaloChatId || null },
      });
    } else {
      return NextResponse.json({ error: 'type phải là khachThue hoặc nguoiDung' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[khach-thue PUT] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
