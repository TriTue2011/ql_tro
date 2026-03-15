/**
 * GET /api/zalo/updates
 * Lấy danh sách tin nhắn gửi tới bot để tra cứu chat_id của từng số điện thoại.
 * Dùng khi KHÔNG có webhook (long polling).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json({ error: 'Chưa cấu hình zalo_access_token' }, { status: 503 });
    }

    const response = await fetch(`https://bot-api.zapps.me/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout: 0 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const txt = await response.text();
      return NextResponse.json({ error: `Zalo API lỗi: ${response.status} — ${txt.slice(0, 200)}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout khi gọi Zalo API' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
