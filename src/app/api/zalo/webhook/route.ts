/**
 * POST /api/zalo/webhook
 * Nhận HTTP POST từ Zalo khi có tương tác từ người dùng.
 * - Xác thực qua header X-Bot-Api-Secret-Token
 * - Lưu tin nhắn vào ZaloMessage để hiển thị trong UI
 * - Phát hiện chat_id và lưu pendingZaloChatId
 */
import { NextRequest, NextResponse } from 'next/server';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';
import NguoiDungRepository from '@/lib/repositories/pg/nguoi-dung';

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

async function saveMessage(update: any): Promise<void> {
  try {
    const msg = update?.message;
    if (!msg?.from?.id) return;

    const chatId = String(msg.from.id);
    const displayName: string = msg.from.display_name || '';
    const content: string = msg.text || msg.attachments?.[0]?.description || '[đính kèm]';
    const eventName: string = update?.event_name || 'message';

    await prisma.zaloMessage.create({
      data: {
        chatId,
        displayName: displayName || null,
        content,
        role: 'user',
        eventName,
        rawPayload: update as any,
      },
    });
  } catch (err) {
    console.error('[zalo/webhook] saveMessage error:', err);
  }
}

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

async function detectNguoiDungPending(update: any): Promise<void> {
  const msg = update?.message;
  if (!msg?.from?.id) return;

  const chatId = String(msg.from.id);
  const displayName: string = msg.from.display_name || '';
  if (!displayName) return;

  try {
    const repo = new NguoiDungRepository();
    const all = await repo.findMany({ limit: 100 });
    const normalizedSender = normalizeName(displayName);

    const matched = all.data.find(nd => {
      const normalizedNd = normalizeName(nd.ten);
      const lastWord = normalizedNd.split(' ').pop() ?? '';
      return normalizedNd === normalizedSender ||
        normalizedSender.includes(lastWord) ||
        normalizedNd.includes(normalizedSender);
    });

    if (!matched) return;
    if (matched.zaloChatId === chatId) return;
    if (matched.pendingZaloChatId === chatId) return;

    await repo.update(matched.id, { pendingZaloChatId: chatId });
  } catch (err) {
    console.error('[zalo/webhook] detectNguoiDungPending error:', err);
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

    // Lưu tin nhắn vào DB + phát hiện chat ID song song
    await Promise.all([
      saveMessage(update),
      detectAndStorePending(update),
      detectNguoiDungPending(update),
    ]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[zalo/webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
