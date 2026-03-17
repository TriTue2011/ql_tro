import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const hopDongs = await prisma.hopDong.findMany({
    where: { khachThue: { some: { id: session.user.id } } },
    include: {
      phong: { include: { toaNha: { select: { tenToaNha: true, diaChi: true } } } },
      nguoiDaiDien: { select: { id: true, hoTen: true, soDienThoai: true } },
      khachThue: { select: { id: true, hoTen: true, soDienThoai: true } },
    },
    orderBy: { ngayTao: 'desc' },
  });

  return NextResponse.json({ success: true, data: hopDongs });
}
