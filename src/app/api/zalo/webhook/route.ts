/**
 * POST /api/zalo/webhook
 * Nhận HTTP Request từ Zalo khi có tương tác từ người dùng.
 * Xác thực qua header X-Bot-Api-Secret-Token so với zalo_webhook_secret trong DB.
 * Tự động phát hiện chat_id và lưu vào pendingZaloChatId chờ admin xác nhận.
 *
 * Endpoint này là PUBLIC (không cần session) — được bảo vệ bởi secret token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

/** Chuẩn hóa tên để so sánh gần đúng (bỏ dấu, chữ thường). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getWebhookSecret(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_secret' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Phát hiện chat_id từ update và lưu vào pendingZaloChatId nếu khác với đã lưu.
 */
async function detectAndStorePending(update: any): Promise<void> {
  const msg = update?.message;
  if (!msg?.from?.id) return;

  const chatId = String(msg.from.id);
  const displayName: string = msg.from.display_name || '';
  if (!displayName) return;

  try {
    const repo = await getKhachThueRepo();
    const allTenants = await repo.findMany({ limit: 1000 });

    const normalizedSender = normalizeName(displayName);

    const matched = allTenants.data.find(kt => {
      const normalizedKt = normalizeName(kt.hoTen);
      const lastWordKt = normalizedKt.split(' ').pop() ?? '';
      return normalizedKt === normalizedSender ||
        normalizedSender.includes(lastWordKt) ||
        normalizedKt.includes(normalizedSender);
    });

    if (!matched) return;
    if (matched.zaloChatId === chatId) return;
    if (matched.pendingZaloChatId === chatId) return;

    await repo.update(matched.id, { pendingZaloChatId: chatId });
  } catch (err) {
    console.error('[zalo/webhook] detectAndStorePending error:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Xác thực secret token từ header
    const secret = await getWebhookSecret();
    const headerSecret = request.headers.get('X-Bot-Api-Secret-Token');

    if (!secret) {
      // Nếu chưa cấu hình secret, từ chối tất cả webhook
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

    // Xử lý update — cấu trúc giống getUpdates: body.result.message
    const update = body?.result ?? body;
    await detectAndStorePending(update);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[zalo/webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
