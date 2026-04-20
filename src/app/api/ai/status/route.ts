/**
 * /api/ai/status
 *
 * Kiểm tra trạng thái AI cho tài khoản hiện tại.
 * GET → { enabled: boolean, configured: boolean }
 *   enabled    = admin luôn true; các vai trò khác cần ID có trong ai_enabled_user_ids
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
  const userId = session.user.id;

  // Admin luôn có quyền
  let enabled = role === 'admin';

  if (!enabled) {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'ai_enabled_user_ids' } });
    try {
      const arr: string[] = JSON.parse(row?.giaTri ?? '[]');
      enabled = Array.isArray(arr) && arr.includes(userId);
    } catch {
      enabled = false;
    }
  }

  // Kiểm tra AI đã cấu hình chưa
  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: ['ai_provider', 'ai_api_key'] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.khoa] = r.giaTri ?? '';
  const configured =
    Boolean(map['ai_provider']) &&
    map['ai_provider'] !== 'none' &&
    Boolean(map['ai_api_key']);

  return NextResponse.json({ enabled, configured });
}
