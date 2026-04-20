/**
 * /api/admin/ai-accounts
 *
 * Quản lý kích hoạt AI per tài khoản — chỉ admin.
 * Lưu danh sách user ID được bật trong CaiDat key: ai_enabled_user_ids (JSON array).
 * Không cần thay đổi schema DB.
 *
 * GET  → Danh sách NguoiDung với trạng thái aiEnabled
 * PUT  → { userId, aiEnabled } — bật/tắt AI cho 1 tài khoản
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const CAIDAT_KEY = 'ai_enabled_user_ids';

const VAI_TRO_LABEL: Record<string, string> = {
  chuNha: 'Chủ nhà',
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
};

async function getEnabledIds(): Promise<Set<string>> {
  const row = await prisma.caiDat.findFirst({ where: { khoa: CAIDAT_KEY } });
  try {
    const arr = JSON.parse(row?.giaTri ?? '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveEnabledIds(ids: Set<string>): Promise<void> {
  const value = JSON.stringify([...ids]);
  await prisma.caiDat.upsert({
    where: { khoa: CAIDAT_KEY },
    create: { khoa: CAIDAT_KEY, giaTri: value, moTa: 'Danh sách user ID được dùng AI', nhom: 'ai', laBiMat: false },
    update: { giaTri: value },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [accounts, enabledIds] = await Promise.all([
    prisma.nguoiDung.findMany({
      where: { vaiTro: { not: 'admin' } },
      select: { id: true, ten: true, email: true, soDienThoai: true, vaiTro: true, trangThai: true },
      orderBy: [{ vaiTro: 'asc' }, { ten: 'asc' }],
    }),
    getEnabledIds(),
  ]);

  return NextResponse.json({
    success: true,
    data: accounts.map(a => ({
      ...a,
      vaiTroLabel: VAI_TRO_LABEL[a.vaiTro] ?? a.vaiTro,
      aiEnabled: enabledIds.has(a.id),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { userId, aiEnabled } = body ?? {};
  if (!userId || typeof aiEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const ids = await getEnabledIds();
  aiEnabled ? ids.add(userId) : ids.delete(userId);
  await saveEnabledIds(ids);

  return NextResponse.json({ success: true });
}
