/**
 * POST /api/zalo/webhook/[nguoiDungId]
 * GET  /api/zalo/webhook/[nguoiDungId]
 *
 * Webhook riêng cho từng tài khoản bot (mỗi NguoiDung chuNha/quanLy có 1 webhook).
 * Bot server được cấu hình để gọi đúng URL này theo nguoiDungId.
 *
 * Ưu điểm so với webhook toàn cục:
 *  - Biết rõ bot/tòa nhà nào đang nhận tin → không cần đoán ngữ cảnh
 *  - Xử lý xác nhận pending scoped theo tòa nhà của chủ tài khoản
 *  - accountSelection luôn được xác định chính xác
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';
import { sseEmit } from '@/lib/sse-emitter';
import { notifyHomeAssistant, handleZaloAutoReply } from '@/lib/zalo-message-handler';
import { storeChatIdForAccount } from '@/lib/zalo-auto-link';
import { handlePendingConfirmation } from '@/lib/zalo-pending-confirm';

// ─── Chuẩn hóa payload ────────────────────────────────────────────────────────

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
} {
  const msg = update?.message;
  const data = update?.data;

  const chatId: string | null =
    msg?.from?.id ? String(msg.from.id) :
    update?.sender?.id ? String(update.sender.id) :
    data?.uidFrom ? String(data.uidFrom) :
    update?.uidFrom ? String(update.uidFrom) : null;

  const displayName: string =
    msg?.from?.display_name || update?.sender?.display_name || update?.sender?.name ||
    data?.dName || data?.fromD || data?.displayName || update?.dName || update?.fromD || '';

  const attachmentUrl = extractAttachmentUrl(msg ?? update);
  const content: string =
    msg?.text || update?.message?.text || msg?.attachments?.[0]?.description ||
    data?.content || data?.msg || update?.content || update?.msg ||
    (attachmentUrl ? '[hình ảnh]' : '[đính kèm]');

  const eventName: string = update?.event_name || update?.event || update?.type || 'message';

  // ownId = ID tài khoản Zalo nhận tin nhắn (bot account)
  const ownId: string | null =
    update?.ownId ? String(update.ownId) :
    update?.toId ? String(update.toId) :
    data?.ownId ? String(data.ownId) :
    data?.idTo ? String(data.idTo) :
    data?.toId ? String(data.toId) :
    update?.idTo ? String(update.idTo) :
    update?.own_id ? String(update.own_id) :
    null;

  return { chatId, ownId, displayName, content, eventName, attachmentUrl };
}

// ─── Lấy thông tin chủ tài khoản ─────────────────────────────────────────────

async function getNguoiDungInfo(nguoiDungIdOrToken: string) {
  // Thử tìm bằng ID trước, nếu không có thì thử bằng zaloWebhookToken
  let nd = await prisma.nguoiDung.findUnique({
    where: { id: nguoiDungIdOrToken },
    select: {
      id: true,
      zaloAccountId: true,
      toaNhaQuanLy: { select: { toaNhaId: true } },
    },
  });
  if (!nd) {
    nd = await prisma.nguoiDung.findUnique({
      where: { zaloWebhookToken: nguoiDungIdOrToken },
      select: {
        id: true,
        zaloAccountId: true,
        toaNhaQuanLy: { select: { toaNhaId: true } },
      },
    });
  }
  return nd;
}

// ─── Lưu tin nhắn ─────────────────────────────────────────────────────────────

async function saveMessage(update: any): Promise<void> {
  try {
    const { chatId, ownId, displayName, content, eventName, attachmentUrl } = normalizeWebhookPayload(update);
    if (!chatId) return;

    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId: ownId || null,
        displayName: displayName || null,
        content,
        attachmentUrl,
        role: 'user',
        eventName: typeof eventName === 'string' ? eventName : String(eventName),
        rawPayload: update as any,
      },
    });
    emitNewMessage({ ...saved, eventName: saved.eventName ?? 'message' });
    sseEmit('zalo-message', { chatId: saved.chatId });
  } catch { /* bỏ qua */ }
}

// ─── Ghi nhớ threadId theo bot account ────────────────────────────────────────

async function captureThreadId(update: any, chatId: string, botAccountId: string): Promise<void> {
  try {
    const [kt, nd] = await Promise.all([
      prisma.khachThue.findFirst({ where: { zaloChatId: chatId }, select: { id: true, zaloChatIds: true } }),
      prisma.nguoiDung.findFirst({ where: { zaloChatId: chatId }, select: { id: true, zaloChatIds: true } }),
    ]);

    if (kt) {
      const entries: any[] = Array.isArray(kt.zaloChatIds) ? (kt.zaloChatIds as any[]) : [];
      const existing = entries.find((e: any) => e.ten === botAccountId || e.userId === chatId);
      if (!existing?.threadId) {
        storeChatIdForAccount('khachThue', kt.id, botAccountId, chatId).catch(() => {});
      }
    }
    if (nd) {
      const entries: any[] = Array.isArray(nd.zaloChatIds) ? (nd.zaloChatIds as any[]) : [];
      const existing = entries.find((e: any) => e.ten === botAccountId || e.userId === chatId);
      if (!existing?.threadId) {
        storeChatIdForAccount('nguoiDung', nd.id, botAccountId, chatId).catch(() => {});
      }
    }
  } catch { /* fire-and-forget */ }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { nguoiDungId: string } },
) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  const nd = await getNguoiDungInfo(params.nguoiDungId);
  return NextResponse.json({
    ok: true,
    endpoint: 'zalo-webhook-per-user',
    nguoiDungId: params.nguoiDungId,
    accountId: nd?.zaloAccountId ?? null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { nguoiDungId: string } },
) {
  try {
    // Xác thực secret (dùng chung secret toàn cục)
    const secretRow = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_secret' } });
    const secret = secretRow?.giaTri?.trim() || null;
    if (secret) {
      const headerSecret = request.headers.get('X-Bot-Api-Secret-Token');
      if (!headerSecret || headerSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    let body: any;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update = body?.result ?? body;
    const { chatId, content } = normalizeWebhookPayload(update);
    if (!chatId) {
      return NextResponse.json({ message: 'No chatId' });
    }

    // Bỏ qua tin nhắn nhóm
    if (update?.type === 1) {
      return NextResponse.json({ message: 'Group message skipped' });
    }

    // Lấy thông tin chủ bot (để biết accountId khi gửi phản hồi)
    const nd = await getNguoiDungInfo(params.nguoiDungId);
    const accountId = nd?.zaloAccountId ?? undefined;

    await Promise.all([
      saveMessage(update),
      cleanupOldMessages(),
      notifyHomeAssistant(update),
      captureThreadId(update, chatId, accountId ?? params.nguoiDungId),
    ]);

    // Xử lý xác nhận pending trước (ưu tiên cao nhất)
    const confirmedPending = await handlePendingConfirmation(chatId, content, accountId);
    if (confirmedPending) {
      return NextResponse.json({ message: 'Pending confirmed' });
    }

    // Xử lý auto-reply thông thường (truyền accountId để gửi đúng bot)
    await handleZaloAutoReply(update, '', accountId);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error(`[zalo/webhook/${params.nguoiDungId}] Error:`, error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
