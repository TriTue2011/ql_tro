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
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';

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

function extractAttachmentUrl(msg: any): string | null {
  const attachments: any[] = msg?.attachments ?? [];
  for (const att of attachments) {
    const url = att?.payload?.url || att?.payload?.thumbnail || att?.url;
    if (url && typeof url === 'string') return url;
  }
  return null;
}

async function saveMessage(update: any): Promise<void> {
  try {
    const msg = update?.message;

    // Hỗ trợ cả 2 format:
    // Zalo Bot API: message.from.id
    // Zalo OA API:  sender.id
    const chatId: string | undefined =
      msg?.from?.id ? String(msg.from.id) :
      update?.sender?.id ? String(update.sender.id) : undefined;

    if (!chatId) {
      console.warn('[zalo/webhook] Không tìm thấy chatId, raw:', JSON.stringify(update).slice(0, 300));
      return;
    }

    const displayName: string =
      msg?.from?.display_name ||
      update?.sender?.display_name ||
      update?.sender?.name || '';

    const attachmentUrl = extractAttachmentUrl(msg ?? update);
    const content: string =
      msg?.text || update?.message?.text ||
      msg?.attachments?.[0]?.description ||
      (attachmentUrl ? '[hình ảnh]' : '[đính kèm]');
    const eventName: string = update?.event_name || 'message';

    console.log(`[zalo/webhook] chatId=${chatId} event=${eventName} content="${content.slice(0,50)}"`);

    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        displayName: displayName || null,
        content,
        attachmentUrl,
        role: 'user',
        eventName,
        rawPayload: update as any,
      },
    });
    emitNewMessage({ ...saved });
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

/** GET: Zalo gọi để xác minh webhook URL còn hoạt động */
export async function GET(request: NextRequest) {
  // Một số webhook platform gửi challenge query param để verify
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return NextResponse.json({ ok: true, endpoint: 'zalo-webhook' });
}

export async function POST(request: NextRequest) {
  try {
    const secret = await getWebhookSecret();
    const headerSecret = request.headers.get('X-Bot-Api-Secret-Token');

    // Nếu đã cấu hình secret thì bắt buộc header phải khớp
    if (secret) {
      if (!headerSecret || headerSecret !== secret) {
        console.warn('[zalo/webhook] X-Bot-Api-Secret-Token không hợp lệ');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    // Nếu chưa cấu hình secret → chấp nhận tất cả (mode setup ban đầu)

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update = body?.result ?? body;

    // Lưu tin nhắn vào DB + phát hiện chat ID + cleanup song song
    await Promise.all([
      saveMessage(update),
      detectAndStorePending(update),
      cleanupOldMessages(),
    ]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[zalo/webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
