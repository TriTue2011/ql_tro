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
      select: { id: true, ten: true, soDienThoai: true, vaiTro: true, trangThai: true },
    }),
  ]);

  return NextResponse.json({ khachThue: kt, nguoiDung: nd });
}
