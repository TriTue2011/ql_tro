/**
 * POST /api/zalo/webhook
 * Nhận HTTP POST từ Zalo khi có tương tác từ người dùng.
 * - Xác thực qua header X-Bot-Api-Secret-Token
 * - Lưu tin nhắn vào ZaloMessage để hiển thị trong UI
 * - Phát hiện chat_id và lưu pendingZaloChatId
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';
import { sseEmit } from '@/lib/sse-emitter';
import { notifyHomeAssistant, handleZaloAutoReply } from '@/lib/zalo-message-handler';
import { storeChatIdForAccount } from '@/lib/zalo-auto-link';
import { handlePendingConfirmation } from '@/lib/zalo-pending-confirm';
import { getUserInfoViaBotServer, getGroupInfoFromBotServer } from '@/lib/zalo-bot-client';

// ─── Group name — in-memory cache + CaiDat persistence ───────────────────────
const _groupNameCache = new Map<string, { name: string; ts: number }>();
const GROUP_CACHE_TTL = 6 * 60 * 60 * 1000;
const groupCaiDatKey = (gid: string) => `zalo_group_name_${gid}`;

/** Lưu tên nhóm vào CaiDat và cập nhật displayName cho tất cả tin nhắn cũ của nhóm */
async function persistGroupName(groupId: string, name: string): Promise<void> {
  await Promise.all([
    prisma.caiDat.upsert({
      where: { khoa: groupCaiDatKey(groupId) },
      create: { khoa: groupCaiDatKey(groupId), giaTri: name },
      update: { giaTri: name },
    }),
    prisma.zaloMessage.updateMany({
      where: { chatId: groupId, OR: [{ displayName: null }, { displayName: '' }] },
      data: { displayName: name },
    }),
  ]);
}

/**
 * Lấy tên nhóm theo thứ tự ưu tiên:
 * 1. In-memory cache (TTL 6h)
 * 2. CaiDat (persistent, không mất khi restart)
 * 3. Bot server API → lưu vào CaiDat + backfill
 */
async function fetchGroupName(groupId: string, accountId?: string): Promise<string | null> {
  const cached = _groupNameCache.get(groupId);
  if (cached && Date.now() - cached.ts < GROUP_CACHE_TTL) return cached.name;

  // CaiDat
  try {
    const row = await prisma.caiDat.findUnique({ where: { khoa: groupCaiDatKey(groupId) } });
    if (row?.giaTri) {
      _groupNameCache.set(groupId, { name: row.giaTri, ts: Date.now() });
      return row.giaTri;
    }
  } catch { /* continue */ }

  // Bot server API
  try {
    const r = await getGroupInfoFromBotServer(groupId, accountId);
    if (!r.ok || !r.data) return null;
    const info = (r.data.gridInfoMap ?? r.data)?.[groupId];
    const name: string | null = info?.name || null;
    if (name) {
      _groupNameCache.set(groupId, { name, ts: Date.now() });
      persistGroupName(groupId, name).catch(() => {});
    }
    return name;
  } catch { return null; }
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
  ownId: string | null;
  displayName: string;
  content: string;
  eventName: string;
  attachmentUrl: string | null;
} {
  const msg = update?.message;
  const data = update?.data; // bot server (zca-js) wraps in .data
  // type có thể là number 1 hoặc string "1" tùy bot server
  const isGroup = Number(update?.type) === 1 || Number(data?.type) === 1;

  // For group messages, chatId = group thread ID (not the sender's ID)
  const chatId: string | null = isGroup
    ? (update?.threadId ? String(update.threadId) :
       data?.idTo ? String(data.idTo) :
       data?.toId ? String(data.toId) : null)
    : (msg?.from?.id ? String(msg.from.id) :
       update?.sender?.id ? String(update.sender.id) :
       data?.uidFrom ? String(data.uidFrom) :
       update?.uidFrom ? String(update.uidFrom) : null);

  // displayName: for groups = group name (injected as _groupName); for DMs = sender name
  const displayName: string = isGroup
    ? (update?._groupName || '')
    : (msg?.from?.display_name ||
       update?.sender?.display_name ||
       update?.sender?.name ||
       data?.dName || data?.fromD || data?.displayName ||
       update?.dName || update?.fromD || '');

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
  const eventName: string = isGroup ? 'group_message'
    : (update?.event_name || update?.event || String(update?.type || 'message'));

  // ownId = bot account ID (only meaningful for DMs; groups don't have a separate bot account field)
  const ownId: string | null = isGroup ? null : (
    update?.ownId ? String(update.ownId) :
    update?.toId ? String(update.toId) :
    data?.ownId ? String(data.ownId) :
    data?.idTo ? String(data.idTo) :
    data?.toId ? String(data.toId) :
    update?.idTo ? String(update.idTo) :
    update?.own_id ? String(update.own_id) :
    null
  );

  return { chatId, ownId, displayName, content, eventName, attachmentUrl };
}

async function saveMessage(update: any): Promise<void> {
  try {
    const { chatId, ownId, displayName, content, eventName, attachmentUrl } = normalizeWebhookPayload(update);

    if (!chatId) {
      console.warn('[zalo/webhook] Không tìm thấy chatId, raw:', JSON.stringify(update).slice(0, 300));
      return;
    }

    const eventName_compat = eventName; // alias for log below

    console.log(`[zalo/webhook] chatId=${chatId} event=${eventName_compat} content="${content.slice(0,50)}"`);

    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId: ownId || null,
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

/**
 * Tự động gán threadID theo SĐT.
 * getUserInfo(chatId) → lấy SĐT → tìm KhachThue/NguoiDung → gán zaloChatId.
 * Không có SĐT hoặc không match → bỏ qua.
 */
async function autoLinkThreadId(update: any): Promise<void> {
  const { chatId, ownId } = normalizeWebhookPayload(update);
  if (!chatId) return;

  try {
    const info = await getUserInfoViaBotServer(chatId, ownId || undefined);
    if (!info.ok || !info.data) {
      console.log(`[zalo/webhook] getUserInfo failed for chatId=${chatId}:`, info.error);
      return;
    }

    const d = info.data as any;
    const profile = d.changed_profiles?.[chatId] ?? d;
    const rawPhone = profile.phoneNumber || profile.phone || '';
    if (!rawPhone) {
      console.log(`[zalo/webhook] Không lấy được SĐT cho chatId=${chatId}`);
      return;
    }

    const phone = rawPhone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
    console.log(`[zalo/webhook] chatId=${chatId} → SĐT=${phone}`);

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
      console.log(`[zalo/webhook] Gán threadID cho KhachThue ${kt.id}: ${chatId}`);
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
      console.log(`[zalo/webhook] Gán threadID cho NguoiDung ${nd.id}: ${chatId}`);
    }
  } catch (err) {
    console.error('[zalo/webhook] autoLinkThreadId error:', err);
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
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update = body?.result ?? body;

    const { chatId: wChatId, content, ownId: webhookOwnId } = normalizeWebhookPayload(update);

    // Tin nhắn nhóm (type = 1): lưu với tên nhóm, không auto-reply
    if (Number(update?.type) === 1 || Number(update?.data?.type) === 1) {
      const groupId = String(update.threadId || update.data?.idTo || update.data?.threadId || '');
      const accountId = String(update._accountId || update.data?.idTo || '');
      if (groupId) {
        const groupName = await fetchGroupName(groupId, accountId);
        if (groupName) update._groupName = groupName;
      }
      await Promise.all([saveMessage(update), notifyHomeAssistant(update)]);
      return NextResponse.json({ message: 'Group message saved' });
    }

    await Promise.all([
      saveMessage(update),
      autoLinkThreadId(update),
      cleanupOldMessages(),
      notifyHomeAssistant(update),
      wChatId ? captureThreadIdForBotAccount(update, wChatId) : Promise.resolve(),
    ]);

    // Xử lý xác nhận pending trước (ưu tiên cao nhất)
    if (wChatId && content) {
      const confirmedPending = await handlePendingConfirmation(wChatId, content);
      if (confirmedPending) {
        return NextResponse.json({ message: 'Pending confirmed' });
      }
    }

    await handleZaloAutoReply(update, '', webhookOwnId || undefined);
    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[zalo/webhook] Error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
