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
import { sseEmit } from '@/lib/sse-emitter';
import { notifyHomeAssistant, handleZaloAutoReply } from '@/lib/zalo-message-handler';
import { storeChatIdForAccount } from '@/lib/zalo-auto-link';

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

/**
 * Chuẩn hóa payload từ nhiều nguồn thành { chatId, displayName, content, eventName, attachmentUrl }.
 *
 * Format hỗ trợ:
 *   1. Zalo Bot API:   message.from.id + message.text
 *   2. Zalo OA API:    sender.id + message.text
 *   3. Bot server (zca-js / multizlogin):
 *        data.uidFrom + data.dName/fromD + data.content/msg
 *   4. Bot server alt: uidFrom + dName + content (flat)
 */
function normalizeWebhookPayload(update: any): {
  chatId: string | null;
  displayName: string;
  content: string;
  eventName: string;
  attachmentUrl: string | null;
} {
  const msg = update?.message;
  const data = update?.data; // bot server (zca-js) wraps in .data

  // chatId
  const chatId: string | null =
    msg?.from?.id ? String(msg.from.id) :
    update?.sender?.id ? String(update.sender.id) :
    data?.uidFrom ? String(data.uidFrom) :
    update?.uidFrom ? String(update.uidFrom) : null;

  // displayName
  const displayName: string =
    msg?.from?.display_name ||
    update?.sender?.display_name ||
    update?.sender?.name ||
    data?.dName || data?.fromD || data?.displayName ||
    update?.dName || update?.fromD || '';

  // content
  const attachmentUrl = extractAttachmentUrl(msg ?? update);
  const content: string =
    msg?.text ||
    update?.message?.text ||
    msg?.attachments?.[0]?.description ||
    data?.content || data?.msg ||
    update?.content || update?.msg ||
    (attachmentUrl ? '[hình ảnh]' : '[đính kèm]');

  // eventName
  const eventName: string =
    update?.event_name || update?.event || update?.type || 'message';

  return { chatId, displayName, content, eventName, attachmentUrl };
}

async function saveMessage(update: any): Promise<void> {
  try {
    const { chatId, displayName, content, eventName, attachmentUrl } = normalizeWebhookPayload(update);

    if (!chatId) {
      console.warn('[zalo/webhook] Không tìm thấy chatId, raw:', JSON.stringify(update).slice(0, 300));
      return;
    }

    const eventName_compat = eventName; // alias for log below

    console.log(`[zalo/webhook] chatId=${chatId} event=${eventName_compat} content="${content.slice(0,50)}"`);

    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        displayName: displayName || null,
        content,
        attachmentUrl,
        role: 'user',
        eventName: eventName_compat,
        rawPayload: update as any,
      },
    });
    emitNewMessage({ ...saved, eventName: saved.eventName ?? 'message' });
    sseEmit('zalo-message', { chatId: saved.chatId });
  } catch (err) {
    console.error('[zalo/webhook] saveMessage error:', err);
  }
}

/**
 * Khi nhận tin nhắn từ 1 user, lưu threadId vào zaloChatIds cho đúng tài khoản bot đã nhận.
 * Chỉ chạy khi biết được botAccountId (idTo từ bot server / own_id).
 * Fire-and-forget.
 */
async function captureThreadIdForBotAccount(update: any, chatId: string): Promise<void> {
  try {
    const data = update?.data;
    // own_id / idTo = tài khoản bot nhận tin nhắn
    const botAccountId: string =
      String(data?.idTo ?? data?.toId ?? update?.idTo ?? update?.own_id ?? '').trim();
    if (!botAccountId || botAccountId === chatId) return; // không xác định được bot account

    // Tìm KhachThue hoặc NguoiDung có zaloChatId = chatId
    const [kt, nd] = await Promise.all([
      prisma.khachThue.findFirst({ where: { zaloChatId: chatId }, select: { id: true, zaloChatIds: true } }),
      prisma.nguoiDung.findFirst({ where: { zaloChatId: chatId }, select: { id: true, zaloChatIds: true } }),
    ]);

    if (kt) {
      const entries: any[] = Array.isArray(kt.zaloChatIds) ? kt.zaloChatIds as any[] : [];
      const existing = entries.find((e: any) => e.ten === botAccountId || e.userId === chatId);
      if (!existing?.threadId) {
        storeChatIdForAccount('khachThue', kt.id, botAccountId, chatId).catch(() => {});
      }
    }
    if (nd) {
      const entries: any[] = Array.isArray(nd.zaloChatIds) ? nd.zaloChatIds as any[] : [];
      const existing = entries.find((e: any) => e.ten === botAccountId || e.userId === chatId);
      if (!existing?.threadId) {
        storeChatIdForAccount('nguoiDung', nd.id, botAccountId, chatId).catch(() => {});
      }
    }
  } catch { /* fire-and-forget */ }
}

async function detectAndStorePending(update: any): Promise<void> {
  const { chatId, displayName } = normalizeWebhookPayload(update);
  if (!chatId || !displayName) return;

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

    // Lưu tin nhắn vào DB + phát hiện chat ID + cleanup + notify HA song song
    const { chatId: wChatId } = normalizeWebhookPayload(update);
    await Promise.all([
      saveMessage(update),
      detectAndStorePending(update),
      cleanupOldMessages(),
      notifyHomeAssistant(update),
      handleZaloAutoReply(update),
      // Ghi nhớ threadId theo tài khoản bot nếu có own_id trong payload
      wChatId ? captureThreadIdForBotAccount(update, wChatId) : Promise.resolve(),
    ]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[zalo/webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
