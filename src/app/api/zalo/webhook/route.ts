/**
 * POST /api/zalo/webhook
 * Nhận HTTP POST từ Zalo khi có tương tác từ người dùng.
 * - Xác thực qua header X-Bot-Api-Secret-Token
 * - Delegate toàn bộ xử lý sang zalo-message-handler
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleZaloUpdate } from '@/lib/zalo-message-handler';

async function getWebhookSecret(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_secret' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = await getWebhookSecret();
    const headerSecret = request.headers.get('X-Bot-Api-Secret-Token');

    if (!secret) {
      console.warn('[zalo/webhook] zalo_webhook_secret chưa được cấu hình');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
    }

    if (!headerSecret || headerSecret !== secret) {
      console.warn('[zalo/webhook] X-Bot-Api-Secret-Token không hợp lệ');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update = body?.result ?? body;
    const token = await getZaloToken();

    if (token) {
      await handleZaloUpdate(update, token);
    } else {
      console.warn('[zalo/webhook] zalo_access_token chưa cấu hình — bỏ qua reply');
    }

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[zalo/webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
