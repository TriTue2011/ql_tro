/**
 * /api/webhook/[id]
 *
 * Webhook endpoint giống Home Assistant — nhận request từ bên ngoài qua IP LAN.
 * Hỗ trợ POST, PUT, GET, HEAD — không yêu cầu xác thực (public endpoint).
 *
 * Webhook ID được lưu trong CaiDat:
 *   - zalo_webhook_id: ID webhook nhận tin nhắn Zalo Bot
 *
 * Ví dụ: http://172.16.10.200:3000/api/webhook/wg5wQbHmzrv5pQEMgcPi_Pr9Vg9K5mQ3FCYLGr0fecU
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';
import { sseEmit } from '@/lib/sse-emitter';
import { notifyHomeAssistant, handleZaloAutoReply } from '@/lib/zalo-message-handler';

// ─── Normalize payload (giống webhook/route.ts) ──────────────────────────────

function extractAttachmentUrl(msg: any): string | null {
  const attachments: any[] = msg?.attachments ?? [];
  for (const att of attachments) {
    const url = att?.payload?.url || att?.payload?.thumbnail || att?.url;
    if (url && typeof url === 'string') return url;
  }
  return null;
}

function normalizeWebhookPayload(update: any): {
  chatId: string | null;
  ownId: string | null;
  displayName: string;
  content: string;
  eventName: string;
  attachmentUrl: string | null;
  isGroup: boolean;
  senderUid: string | null;
} {
  const msg = update?.message;
  const data = update?.data;
  const isGroup = update?.type === 1;

  // Với nhóm: chatId = threadId (ID nhóm), senderUid = uidFrom (người gửi)
  // Với user: chatId = uidFrom hoặc msg.from.id
  const senderUid: string | null =
    data?.uidFrom ? String(data.uidFrom) :
    msg?.from?.id ? String(msg.from.id) :
    update?.sender?.id ? String(update.sender.id) :
    update?.uidFrom ? String(update.uidFrom) : null;

  const chatId: string | null =
    (isGroup && update?.threadId) ? String(update.threadId) : senderUid;

  const displayName: string =
    msg?.from?.display_name ||
    update?.sender?.display_name || update?.sender?.name ||
    data?.dName || data?.fromD || data?.displayName ||
    update?.dName || update?.fromD || '';

  const attachmentUrl =
    extractAttachmentUrl(msg ?? update) ||
    (typeof data?.content === 'object' && typeof (data.content as any)?.href === 'string'
      ? (data.content as any).href as string
      : null);

  // Xử lý content theo msgType
  const msgType: string = data?.msgType || '';
  let content: string;
  if (msgType === 'chat.photo') {
    const c = data?.content ?? {};
    content = typeof c === 'object' ? (c.title || c.description || '[hình ảnh]') : '[hình ảnh]';
  } else if (msgType === 'share.file') {
    const c = data?.content ?? {};
    content = typeof c === 'object' ? (c.title || 'file') : 'file';
  } else {
    content =
      msg?.text || update?.message?.text ||
      msg?.attachments?.[0]?.description ||
      (typeof data?.content === 'string' ? data.content : '') ||
      data?.msg ||
      update?.content || update?.msg ||
      (attachmentUrl ? '[hình ảnh]' : '[đính kèm]');
  }

  const eventName: string =
    update?.event_name || update?.event || String(update?.type ?? 'message');

  // ownId = ID tài khoản Zalo nhận tin nhắn (bot account)
  const ownId: string | null =
    update?.ownId ? String(update.ownId) :
    update?.toId ? String(update.toId) :
    update?.data?.ownId ? String(update.data.ownId) :
    update?.data?.toId ? String(update.data.toId) :
    null;

  return { chatId, ownId, displayName, content, eventName, attachmentUrl, isGroup, senderUid };
}

// ─── Lưu tin nhắn ────────────────────────────────────────────────────────────

async function saveMessage(update: any): Promise<void> {
  try {
    const { chatId, ownId, displayName, content, eventName, attachmentUrl } = normalizeWebhookPayload(update);
    if (!chatId) {
      console.warn('[webhook] Không tìm thấy chatId, raw:', JSON.stringify(update).slice(0, 300));
      return;
    }

    console.log(`[webhook] chatId=${chatId} event=${eventName} content="${content.slice(0, 50)}"`);

    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId: ownId || null,
        displayName: displayName || null,
        content,
        attachmentUrl,
        role: 'user',
        eventName,
        rawPayload: update as any,
      },
    });
    emitNewMessage({ ...saved, eventName: saved.eventName ?? 'message' });
    sseEmit('zalo-message', { chatId });
  } catch (err) {
    console.error('[webhook] saveMessage error:', err);
  }
}

// ─── Detect pending chat ID ──────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

async function detectAndStorePending(update: any): Promise<void> {
  const { chatId, displayName, isGroup } = normalizeWebhookPayload(update);
  if (!chatId || !displayName || isGroup) return; // Bỏ qua nhóm — chỉ match tên cho user

  try {
    const allTenants = await prisma.khachThue.findMany({
      take: 1000,
      select: { id: true, hoTen: true, zaloChatId: true, pendingZaloChatId: true },
    });
    const normalizedSender = normalizeName(displayName);

    const matched = allTenants.find(kt => {
      const normalizedKt = normalizeName(kt.hoTen);
      const lastWordKt = normalizedKt.split(' ').pop() ?? '';
      return normalizedKt === normalizedSender ||
        normalizedSender.includes(lastWordKt) ||
        normalizedKt.includes(normalizedSender);
    });

    if (!matched) return;
    if (matched.zaloChatId === chatId) return;
    if (matched.pendingZaloChatId === chatId) return;

    await prisma.khachThue.update({
      where: { id: matched.id },
      data: { pendingZaloChatId: chatId },
    });
  } catch (err) {
    console.error('[webhook] detectAndStorePending error:', err);
  }
}

// ─── Xác thực webhook ID ────────────────────────────────────────────────────

async function isValidWebhookId(id: string): Promise<boolean> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_id' } });
    return row?.giaTri?.trim() === id;
  } catch {
    return false;
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/** GET / HEAD: Health check — xác minh webhook còn hoạt động */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await isValidWebhookId(id))) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ ok: true, webhook_id: id });
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await isValidWebhookId(id))) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, { status: 200 });
}

/** POST / PUT: Nhận payload tin nhắn */
async function handleIncoming(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await isValidWebhookId(id))) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update = body?.result ?? body;

    await Promise.all([
      saveMessage(update),
      detectAndStorePending(update),
      cleanupOldMessages(),
      notifyHomeAssistant(update),
      handleZaloAutoReply(update),
    ]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = handleIncoming;
export const PUT = handleIncoming;
