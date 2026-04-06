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
import { getUserInfoViaBotServer } from '@/lib/zalo-bot-client';

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
  } catch (err) {
    console.error('[saveMessage] Error:', err);
  }
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

// ─── Tự động gán threadID theo SĐT ──────────────────────────────────────────

/**
 * Khi nhận tin nhắn, lấy SĐT người gửi qua getUserInfo.
 * Tìm KhachThue/NguoiDung có cùng SĐT → gán zaloChatId = chatId.
 * Không có SĐT hoặc không match → bỏ qua.
 */
async function autoLinkThreadId(update: any, accountId?: string): Promise<void> {
  const { chatId, ownId } = normalizeWebhookPayload(update);
  if (!chatId) return;
  const botAccount = accountId || ownId || undefined;

  try {
    // Lấy SĐT người gửi
    const info = await getUserInfoViaBotServer(chatId, botAccount);
    if (!info.ok || !info.data) {
      console.log(`[webhook/nguoiDung] getUserInfo failed for chatId=${chatId}:`, info.error);
      return;
    }

    const d = info.data as any;
    const profile = d.changed_profiles?.[chatId] ?? d;
    const rawPhone = profile.phoneNumber || profile.phone || '';
    if (!rawPhone) {
      console.log(`[webhook/nguoiDung] Không lấy được SĐT cho chatId=${chatId}`);
      return;
    }

    const phone = rawPhone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
    console.log(`[webhook/nguoiDung] chatId=${chatId} → SĐT=${phone}`);

    // Tìm KhachThue theo SĐT
    const kt = await prisma.khachThue.findFirst({
      where: { soDienThoai: phone },
      select: { id: true, zaloChatId: true },
    });
    if (kt && kt.zaloChatId !== chatId) {
      await prisma.khachThue.update({
        where: { id: kt.id },
        data: { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true },
      });
      console.log(`[webhook/nguoiDung] Gán threadID cho KhachThue ${kt.id}: ${chatId}`);
      return;
    }

    // Tìm NguoiDung theo SĐT
    const nd = await prisma.nguoiDung.findFirst({
      where: { soDienThoai: phone, trangThai: 'hoatDong' },
      select: { id: true, zaloChatId: true },
    });
    if (nd && nd.zaloChatId !== chatId) {
      await prisma.nguoiDung.update({
        where: { id: nd.id },
        data: { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true },
      });
      console.log(`[webhook/nguoiDung] Gán threadID cho NguoiDung ${nd.id}: ${chatId}`);
    }
  } catch (err) {
    console.error('[webhook/nguoiDung] autoLinkThreadId error:', err);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nguoiDungId: string }> },
) {
  const { nguoiDungId } = await params;
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  const nd = await getNguoiDungInfo(nguoiDungId);
  return NextResponse.json({
    ok: true,
    endpoint: 'zalo-webhook-per-user',
    nguoiDungId,
    accountId: nd?.zaloAccountId ?? null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nguoiDungId: string }> },
) {
  const { nguoiDungId } = await params;
  try {
    // Xác thực qua token trong URL (nguoiDungId chính là zaloWebhookToken)
    // Không cần check zalo_webhook_secret vì bot server không hỗ trợ gửi header secret
    const nd = await getNguoiDungInfo(nguoiDungId);
    console.log(`[webhook/${nguoiDungId}] User found:`, nd ? { id: nd.id, zaloAccountId: nd.zaloAccountId } : 'NOT FOUND');
    if (!nd) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update = body?.result ?? body;

    // Inject ownId từ thông tin user (biết từ token URL)
    // Ưu tiên: zaloAccountId (ID Zalo) > nd.id (ID user trong DB)
    const accountId = nd.zaloAccountId || nd.id;
    if (!update.ownId && !update.toId && !update.idTo && !update.own_id) {
      update.ownId = accountId;
      if (update.data && !update.data.ownId && !update.data.idTo && !update.data.toId) {
        update.data.ownId = accountId;
      }
    }

    const { chatId, content } = normalizeWebhookPayload(update);
    console.log(`[webhook/${nguoiDungId}] accountId=${accountId}, chatId=${chatId}, content=${content?.substring(0, 50)}`);
    if (!chatId) {
      return NextResponse.json({ message: 'No chatId' });
    }

    // Bỏ qua tin nhắn nhóm
    if (update?.type === 1) {
      return NextResponse.json({ message: 'Group message skipped' });
    }

    await Promise.all([
      saveMessage(update),
      cleanupOldMessages(),
      notifyHomeAssistant(update),
      captureThreadId(update, chatId, accountId ?? nguoiDungId),
      autoLinkThreadId(update, accountId),
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
    console.error(`[zalo/webhook/${nguoiDungId}] Error:`, error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
