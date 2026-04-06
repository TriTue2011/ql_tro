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
import { getKhachThueRepo } from '@/lib/repositories';
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';
import { sseEmit } from '@/lib/sse-emitter';
import { notifyHomeAssistant, handleZaloAutoReply } from '@/lib/zalo-message-handler';
import { storeChatIdForAccount } from '@/lib/zalo-auto-link';
import { handlePendingConfirmation } from '@/lib/zalo-pending-confirm';
import { getUserInfoViaBotServer, sendMessageViaBotServer } from '@/lib/zalo-bot-client';

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

// ─── Phát hiện và lưu pending (match SĐT + tên) ─────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function detectAndStorePending(update: any, accountId?: string): Promise<void> {
  const { chatId, displayName, ownId } = normalizeWebhookPayload(update);
  if (!chatId) return;
  const botAccount = accountId || ownId || undefined;

  try {
    // Lấy SĐT người gửi từ bot server
    let senderPhone: string | undefined;
    try {
      const info = await getUserInfoViaBotServer(chatId, botAccount);
      if (info.ok && info.data) {
        const d = info.data as any;
        // getUserInfo trả về changed_profiles[userId] chứa phoneNumber
        const profile = d.changed_profiles?.[chatId] ?? d;
        senderPhone = profile.phone || profile.phoneNumber || profile.zaloPhone || undefined;
        if (senderPhone) {
          senderPhone = senderPhone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
        }
      }
    } catch { /* ignore */ }

    // Match KhachThue
    const repo = await getKhachThueRepo();
    const allTenants = await repo.findMany({ limit: 1000 });

    let matchedByPhone = false;

    let matchedKT = senderPhone
      ? allTenants.data.find(kt => kt.soDienThoai === senderPhone)
      : undefined;
    if (matchedKT) matchedByPhone = true;

    if (!matchedKT && displayName) {
      const normalizedSender = normalizeName(displayName);
      matchedKT = allTenants.data.find(kt => {
        const n = normalizeName(kt.hoTen);
        const last = n.split(' ').pop() ?? '';
        return n === normalizedSender || normalizedSender.includes(last) || n.includes(normalizedSender);
      });
    }

    if (matchedKT) {
      if (matchedKT.zaloChatId !== chatId) {
        if (matchedByPhone) {
          // Match bằng SĐT = tin cậy cao → auto-confirm luôn
          await prisma.khachThue.update({
            where: { id: matchedKT.id },
            data: { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true },
          });
          console.log(`[webhook/nguoiDung] Auto-confirmed KT ${matchedKT.id} by phone match`);
        } else if (matchedKT.pendingZaloChatId !== chatId) {
          // Match bằng tên = cần xác nhận
          await repo.update(matchedKT.id, { pendingZaloChatId: chatId });
          sendMessageViaBotServer(
            chatId,
            `Chào bạn, bạn có phải là ${matchedKT.hoTen} không? Vui lòng trả lời "Đúng" hoặc "Không".`,
            0,
            botAccount,
          ).catch(() => {});
        }
      }
      return;
    }

    // Match NguoiDung
    const allUsers = await prisma.nguoiDung.findMany({
      where: { trangThai: 'hoatDong' },
      select: { id: true, ten: true, soDienThoai: true, zaloChatId: true, pendingZaloChatId: true },
    });

    matchedByPhone = false;

    let matchedND = senderPhone
      ? allUsers.find(nd => nd.soDienThoai === senderPhone)
      : undefined;
    if (matchedND) matchedByPhone = true;

    if (!matchedND && displayName) {
      const normalizedSender = normalizeName(displayName);
      matchedND = allUsers.find(nd => {
        const n = normalizeName(nd.ten);
        const last = n.split(' ').pop() ?? '';
        return n === normalizedSender || normalizedSender.includes(last) || n.includes(normalizedSender);
      });
    }

    if (matchedND) {
      if (matchedND.zaloChatId !== chatId) {
        if (matchedByPhone) {
          // Match bằng SĐT = tin cậy cao → auto-confirm luôn
          await prisma.nguoiDung.update({
            where: { id: matchedND.id },
            data: { zaloChatId: chatId, pendingZaloChatId: '', nhanThongBaoZalo: true },
          });
          console.log(`[webhook/nguoiDung] Auto-confirmed ND ${matchedND.id} by phone match`);
        } else if (matchedND.pendingZaloChatId !== chatId) {
          // Match bằng tên = cần xác nhận
          await prisma.nguoiDung.update({
            where: { id: matchedND.id },
            data: { pendingZaloChatId: chatId },
          });
          sendMessageViaBotServer(
            chatId,
            `Chào bạn, bạn có phải là ${matchedND.ten} không? Vui lòng trả lời "Đúng" hoặc "Không".`,
            0,
            botAccount,
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[webhook/nguoiDung] detectAndStorePending error:', err);
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
      detectAndStorePending(update, accountId),
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
