import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'Thiếu ?phone=' }, { status: 400 });

  const [kt, nd] = await Promise.all([
    prisma.khachThue.findMany({
      where: { soDienThoai: phone },
      select: { id: true, hoTen: true, soDienThoai: true, trangThai: true },
    }),
    prisma.nguoiDung.findMany({
      where: { soDienThoai: phone },
      select: {
        id: true, ten: true, soDienThoai: true, vaiTro: true, trangThai: true,
        toaNhaQuanLy: { select: { toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
      },
    }),
  ]);

  return NextResponse.json({ khachThue: kt, nguoiDung: nd });
}

/**
 * DELETE /api/lookup-phone?id=xxx&type=khachThue|nguoiDung
 * Xóa hẳn record theo ID. Chỉ dùng từ localhost.
 */
export async function DELETE(req: NextRequest) {
  const host = req.headers.get('host') || '';
  if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return NextResponse.json({ error: 'Chỉ dùng từ localhost' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  const type = req.nextUrl.searchParams.get('type');
  if (!id || !type) return NextResponse.json({ error: 'Thiếu ?id=&type=' }, { status: 400 });

  try {
    if (type === 'khachThue') {
      await prisma.khachThue.delete({ where: { id } });
    } else if (type === 'nguoiDung') {
      await prisma.nguoiDung.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: 'type phải là khachThue hoặc nguoiDung' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, deleted: { id, type } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
