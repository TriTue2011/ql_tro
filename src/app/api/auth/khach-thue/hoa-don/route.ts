import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const hoaDons = await prisma.hoaDon.findMany({
    where: { khachThueId: session.user.id },
    orderBy: [{ nam: 'desc' }, { thang: 'desc' }],
    include: {
      phong: { select: { maPhong: true } },
      hopDong: { select: { maHopDong: true } },
    },
  });

  return NextResponse.json({ success: true, data: hoaDons });
}
