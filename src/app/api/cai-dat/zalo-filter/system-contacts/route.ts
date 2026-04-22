/**
 * GET /api/cai-dat/zalo-filter/system-contacts
 * Trả về tập hợp tất cả zaloChatId trong hệ thống (KhachThue + NguoiDung).
 * Dùng để client-side lọc DM "chỉ số trong hệ thống".
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [khachThues, nguoiDungs] = await Promise.all([
    prisma.khachThue.findMany({ select: { zaloChatId: true, soDienThoai: true }, where: { zaloChatId: { not: null } } }),
    prisma.nguoiDung.findMany({ select: { zaloChatId: true }, where: { zaloChatId: { not: null } } }),
  ]);

  const chatIds = new Set<string>();
  for (const k of khachThues) if (k.zaloChatId) chatIds.add(k.zaloChatId);
  for (const n of nguoiDungs) if (n.zaloChatId) chatIds.add(n.zaloChatId);

  return NextResponse.json({ chatIds: [...chatIds] });
}
