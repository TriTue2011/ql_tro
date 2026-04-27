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

  const [khachThues, nguoiDungs, danhBaNgoaiRow] = await Promise.all([
    prisma.khachThue.findMany({ select: { zaloChatId: true, zaloChatIds: true, pendingZaloChatId: true } }),
    prisma.nguoiDung.findMany({ select: { zaloChatId: true, zaloChatIds: true, pendingZaloChatId: true } }),
    prisma.caiDat.findUnique({ where: { khoa: 'zalo_danh_ba_ngoai' } }),
  ]);

  const chatIds = new Set<string>();

  const processEntity = (e: any) => {
    if (e.zaloChatId) chatIds.add(e.zaloChatId);
    if (e.pendingZaloChatId) chatIds.add(e.pendingZaloChatId); // khách mới chưa xác nhận
    if (e.zaloChatIds) {
      try {
        const parsed = typeof e.zaloChatIds === 'string' ? JSON.parse(e.zaloChatIds) : e.zaloChatIds;
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.threadId) chatIds.add(item.threadId);
            if (item.userId) chatIds.add(item.userId); // userId cũng là 1 dạng chatId
          });
        } else if (typeof parsed === 'object' && parsed !== null) {
          // If it's a map { [botId]: threadId }
          Object.values(parsed).forEach((tid: any) => {
            if (typeof tid === 'string') chatIds.add(tid);
          });
        }
      } catch {}
    }
  };

  khachThues.forEach(processEntity);
  nguoiDungs.forEach(processEntity);

  if (danhBaNgoaiRow?.giaTri) {
    try {
      const parsed = JSON.parse(danhBaNgoaiRow.giaTri);
      if (Array.isArray(parsed)) {
        parsed.forEach((c: any) => {
          if (c.threadId) chatIds.add(c.threadId);
        });
      }
    } catch {}
  }

  return NextResponse.json({ chatIds: [...chatIds] });
}
