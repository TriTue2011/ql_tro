/**
 * /api/ai/status
 *
 * Kiểm tra trạng thái AI cho tài khoản hiện tại.
 * GET → { enabled: boolean, configured: boolean }
 *   enabled    = admin luôn true; các vai trò khác cần aiEnabled = true trong DB
 *   configured = ai_provider != 'none' && ai_api_key != ''
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ enabled: false, configured: false });
  }

  const role = session.user.role ?? '';

  // Admin luôn có quyền dùng AI
  let enabled = role === 'admin';

  if (!enabled) {
    const user = await prisma.nguoiDung.findUnique({
      where: { id: session.user.id },
      select: { aiEnabled: true },
    });
    enabled = user?.aiEnabled === true;
  }

  // Kiểm tra AI đã cấu hình chưa
  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: ['ai_provider', 'ai_api_key'] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.khoa] = r.giaTri ?? '';
  const configured = map['ai_provider'] !== 'none' && Boolean(map['ai_provider']) && Boolean(map['ai_api_key']);

  return NextResponse.json({ enabled, configured });
}
