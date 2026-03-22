import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const DEFAULT_LIMITS: Record<string, number> = { dongChuTro: 2, quanLy: 3, nhanVien: 5 };

async function getRoleLimits(): Promise<Record<string, number>> {
  const row = await prisma.caiDat.findUnique({ where: { khoa: 'role_limits' } });
  if (row?.giaTri) {
    try { return { ...DEFAULT_LIMITS, ...JSON.parse(row.giaTri) }; } catch {}
  }
  return DEFAULT_LIMITS;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limits = await getRoleLimits();
    return NextResponse.json(limits);
  } catch (error) {
    console.error('Error fetching role limits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user?.id || !['admin', 'chuNha'].includes(role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate: phải là object với các key hợp lệ và giá trị >= 0
    const validKeys = ['dongChuTro', 'quanLy', 'nhanVien'];
    const limits: Record<string, number> = {};
    for (const key of validKeys) {
      const val = Number(body[key]);
      if (isNaN(val) || val < 0 || val > 100) {
        return NextResponse.json({ error: `Giá trị không hợp lệ cho ${key}` }, { status: 400 });
      }
      limits[key] = val;
    }

    await prisma.caiDat.upsert({
      where: { khoa: 'role_limits' },
      update: { giaTri: JSON.stringify(limits) },
      create: {
        khoa: 'role_limits',
        giaTri: JSON.stringify(limits),
        moTa: 'Giới hạn số lượng mỗi vai trò trên mỗi tòa nhà (JSON)',
        nhom: 'heThong',
      },
    });

    return NextResponse.json(limits);
  } catch (error) {
    console.error('Error updating role limits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
