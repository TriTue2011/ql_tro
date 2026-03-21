/**
 * GET  /api/zalo-bot/endpoints  — Trả về toàn bộ endpoint từ DB (admin only)
 * POST /api/zalo-bot/endpoints/sync — Đồng bộ list từ code vào DB (admin only)
 *
 * Sync được gọi tự động khi GET nếu DB trống.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ALL_ZALO_BOT_APIS } from '@/lib/zalo-bot-apis';

async function syncToDB() {
  for (const api of ALL_ZALO_BOT_APIS) {
    await prisma.zaloBotApi.upsert({
      where: { endpoint: api.endpoint },
      create: {
        endpoint: api.endpoint,
        method: api.method,
        nhom: api.nhom,
        tenNhom: api.tenNhom,
        moTa: api.moTa ?? null,
        defaultPayload: api.defaultPayload ? JSON.stringify(api.defaultPayload) : null,
        thuTu: api.thuTu,
      },
      update: {
        method: api.method,
        nhom: api.nhom,
        tenNhom: api.tenNhom,
        moTa: api.moTa ?? null,
        defaultPayload: api.defaultPayload ? JSON.stringify(api.defaultPayload) : null,
        thuTu: api.thuTu,
      },
    });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let apis = await prisma.zaloBotApi.findMany({
    orderBy: [{ nhom: 'asc' }, { thuTu: 'asc' }],
    select: { id: true, endpoint: true, method: true, nhom: true, tenNhom: true, moTa: true, defaultPayload: true, thuTu: true },
  });

  // Auto-seed nếu DB trống
  if (apis.length === 0) {
    await syncToDB();
    apis = await prisma.zaloBotApi.findMany({
      orderBy: [{ nhom: 'asc' }, { thuTu: 'asc' }],
      select: { id: true, endpoint: true, method: true, nhom: true, tenNhom: true, moTa: true, defaultPayload: true, thuTu: true },
    });
  }

  return NextResponse.json({ ok: true, total: apis.length, apis });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await syncToDB();
  const total = await prisma.zaloBotApi.count();
  return NextResponse.json({ ok: true, synced: ALL_ZALO_BOT_APIS.length, total });
}
