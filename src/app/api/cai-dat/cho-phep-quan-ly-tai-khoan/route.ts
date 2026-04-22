/**
 * GET /api/cai-dat/cho-phep-quan-ly-tai-khoan
 * Trả về trạng thái flag `cho_phep_quan_ly_tai_khoan` (true/false).
 * Public — không cần auth, vì chỉ là feature flag cho UI quyết định hiển thị.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const row = await prisma.caiDat.findUnique({
    where: { khoa: 'cho_phep_quan_ly_tai_khoan' },
    select: { giaTri: true },
  });
  return NextResponse.json({
    enabled: (row?.giaTri ?? 'false') === 'true',
  });
}
