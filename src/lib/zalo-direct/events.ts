/**
 * zalo-direct/events.ts
 * Event listeners cho zca-js SDK v2.
 * Port từ bot server eventListeners.js - xử lý trực tiếp thay vì qua HTTP webhook.
 *
 * zca-js v2 emits wrapped objects (Message, GroupEvent, Reaction),
 * không phải raw data. Cần unwrap .data trước khi xử lý.
 */

import prisma from "@/lib/prisma";
import { emitNewMessage, cleanupOldMessages } from "@/lib/zalo-message-events";
import { sseEmit } from "@/lib/sse-emitter";
import { handleZaloAutoReply } from "@/lib/zalo-message-handler";
import { storeChatIdForAccount } from "@/lib/zalo-auto-link";
import { handlePendingConfirmation } from "@/lib/zalo-pending-confirm";
import { getUserInfoViaBotServer } from "@/lib/zalo-bot-client";
import { getGroupInfo } from "@/lib/zalo-direct/service";
import { uploadFile } from "@/lib/storage";
import { autoMatchGroupThread } from "@/lib/zalo-group-auto-match";

/** Tải ảnh từ Zalo CDN và lưu vào storage vĩnh viễn. Fire-and-forget — không ném lỗi. */
async function persistAttachmentUrl(cdnUrl: string, ext = '.jpg'): Promise<string | null> {
  try {
    const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Detect extension từ magic bytes
    let detectedExt = ext;
    if (buf[0] === 0xFF && buf[1] === 0xD8) detectedExt = '.jpg';
    else if (buf[0] === 0x89 && buf[1] === 0x50) detectedExt = '.png';
    else if (buf[0] === 0x47 && buf[1] === 0x49) detectedExt = '.gif';
    else if (buf[0] === 0x52 && buf[1] === 0x49) detectedExt = '.webp';
    const file = new File([buf], `zalo_${Date.now()}${detectedExt}`, {
      type: detectedExt === '.jpg' ? 'image/jpeg' : detectedExt === '.png' ? 'image/png' : 'image/jpeg',
    });
    const result = await uploadFile(file, 'zalo/images');
    return result.secure_url;
  } catch {
    return null;
  }
}

/**
 * Xử lý tin nhắn nhận được từ zca-js listener.
 * Tương đương triggerWebhook() trong bot server nhưng xử lý in-process.
 *
 * zca-js v2 Message format:
 *   { type: ThreadType, data: TMessage, threadId: string, isSelf: boolean }
 *   TMessage: { uidFrom, dName, content, idTo, msgId, cliMsgId, ... }
 */
/**
 * Tự động gán zaloChatId theo SĐT.
 * getUserInfo(chatId) → lấy phoneNumber → tìm KhachThue/NguoiDung → gán zaloChatId.
 */
async function autoLinkThreadId(chatId: string, ownId: string): Promise<void> {
  try {
    const info = await getUserInfoViaBotServer(chatId, ownId);
    if (!info.ok || !info.data) {
      console.log(`[ZaloDirect] getUserInfo failed for chatId=${chatId}:`, info.error);
      return;
    }

    const d = info.data as any;
    const profile = d.changed_profiles?.[chatId] ?? d;
    const rawPhone = profile.phoneNumber || profile.phone || '';
    if (!rawPhone) {
      console.log(`[ZaloDirect] Không lấy được SĐT cho chatId=${chatId}`);
      return;
    }

    const phone = rawPhone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
    console.log(`[ZaloDirect] chatId=${chatId} → SĐT=${phone}`);

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
      console.log(`[ZaloDirect] Gán threadID cho KhachThue ${kt.id}: ${chatId}`);
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
      console.log(`[ZaloDirect] Gán threadID cho NguoiDung ${nd.id}: ${chatId}`);
    }
  } catch (err) {
    console.error('[ZaloDirect] autoLinkThreadId error:', err);
  }
}

// ─── Group name cache (in-memory, TTL 6h) ────────────────────────────────────
const _groupNameCache = new Map<string, { name: string; ts: number }>();
const GROUP_CACHE_TTL = 6 * 60 * 60 * 1000;
const groupCaiDatKey = (gid: string) => `zalo_group_name_${gid}`;

async function resolveGroupName(threadId: string, accountSelection?: string): Promise<string | null> {
  const cached = _groupNameCache.get(threadId);
  if (cached && Date.now() - cached.ts < GROUP_CACHE_TTL) return cached.name;

  // CaiDat
  try {
    const row = await prisma.caiDat.findUnique({ where: { khoa: groupCaiDatKey(threadId) } });
    if (row?.giaTri) {
      _groupNameCache.set(threadId, { name: row.giaTri, ts: Date.now() });
      return row.giaTri;
    }
  } catch { /* ignore */ }

  // zca-js API
  try {
    const r = await getGroupInfo(threadId, accountSelection);
    if (!r.ok || !r.data) return null;
    const info = (r.data.gridInfoMap ?? r.data)?.[threadId];
    const name: string | null = info?.name || null;
    if (name) {
      _groupNameCache.set(threadId, { name, ts: Date.now() });
      prisma.caiDat.upsert({
        where: { khoa: groupCaiDatKey(threadId) },
        create: { khoa: groupCaiDatKey(threadId), giaTri: name, nhom: 'zalo' },
        update: { giaTri: name },
      }).catch(() => {});
    }
    return name;
  } catch { return null; }
}

export async function handleIncomingMessage(
  ownId: string,
  msg: any
): Promise<void> {
  const raw = msg?.data ?? msg;
  const senderUid = String(raw?.uidFrom || msg?.uidFrom || "");
  if (!senderUid) return;

  const isSelf = !!msg?.isSelf;

  const displayName = raw.dName || raw.fromD || "";
  const contentRaw = raw.content || raw.msg || "";
  const msgType: string = raw.msgType || raw.type_msg || "";
  const isGroupMessage = msg?.type === 1 || (raw.idTo && raw.idTo !== ownId && !isSelf);

  // Bỏ qua reaction events (không lưu vào ZaloMessage)
  if (msgType === 'reaction' || (typeof contentRaw === 'string' && contentRaw.startsWith('[reaction:'))) return;

  // Trích xuất URL và content từ attachment object
  let attachmentUrl: string | null = null;
  let content: string;

  if (typeof contentRaw === 'object' && contentRaw !== null) {
    const cdnUrl: string | null =
      contentRaw.href || contentRaw.hdUrl || contentRaw.normalUrl ||
      contentRaw.thumb || contentRaw.url || contentRaw.fileUrl || null;

    const isImageMsg = msgType === 'chat.photo' || msgType === 'chat.gif' || !!(contentRaw.href || contentRaw.hdUrl);

    if (isImageMsg && cdnUrl) {
      // Lưu ảnh vĩnh viễn vào storage ngay khi nhận để tránh CDN hết hạn
      const permanent = await persistAttachmentUrl(cdnUrl).catch(() => null);
      attachmentUrl = permanent || cdnUrl;
    } else {
      attachmentUrl = cdnUrl;
    }

    if (isImageMsg) {
      content = '[hình ảnh]';
    } else if (msgType === 'chat.sticker') {
      content = '[sticker]';
    } else if (msgType === 'share.file') {
      content = `[file: ${contentRaw.title || contentRaw.fileName || ''}]`.trim();
    } else if (msgType === 'chat.video.msg') {
      content = '[video]';
    } else if (msgType === 'chat.voice') {
      content = '[tin nhắn thoại]';
    } else {
      content = contentRaw.title || contentRaw.description || contentRaw.name || '[đính kèm]';
    }
  } else {
    content = (contentRaw as string) || '';
    // Sticker JSON dạng string: {"id":...,"catId":...}
    if (!content && msgType === 'chat.sticker') content = '[sticker]';
    if (content.startsWith('{') && content.includes('"catId"')) content = '[sticker]';
  }

  // threadId: ID hội thoại (zca-js v2 cung cấp sẵn trong msg.threadId)
  // Đối với nhóm: threadId = groupId
  // Đối với DM: threadId = đối phương (nếu là tin nhắn đến) hoặc người nhận (nếu là isSelf)
  const threadId = msg?.threadId || (isGroupMessage ? String(raw.idTo || senderUid) : (isSelf ? String(raw.idTo) : senderUid));

  // chatId: Luôn dùng threadId làm định danh cuộc hội thoại chính
  const chatId = threadId;

  const update = {
    data: raw,
    uidFrom: senderUid,
    dName: displayName,
    content,
    ownId,
    idTo: raw.idTo,
    type: isGroupMessage ? 1 : 0,
    threadId,
    isSelf,
  };

  try {
    let saveDisplayName: string | null = displayName || null;

    if (isGroupMessage) {
      // Lấy tên nhóm (cache → CaiDat → API)
      const groupName = await resolveGroupName(threadId, ownId);
      saveDisplayName = groupName || null;

      // Tự động gán threadId vào zaloNhomChat nếu tên nhóm khớp
      if (groupName && ownId) {
        autoMatchGroupThread(threadId, groupName, ownId).catch(() => {});
      }
    }

    // Lưu tin nhắn vào DB (chatId = threadId cho nhóm)
    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName: saveDisplayName,
        content,
        attachmentUrl: attachmentUrl || null,
        role: isSelf ? "owner" : "user",
        eventName: isGroupMessage ? "group_message" : "message",
        rawPayload: update as any,
      },
    });
    emitNewMessage({ ...saved, eventName: saved.eventName ?? "message" });
    sseEmit("zalo-message", { chatId: saved.chatId });

    cleanupOldMessages().catch(() => {});

    // Bỏ qua tin nhắn nhóm hoặc tin nhắn từ chính mình (không auto-reply)
    if (isGroupMessage || isSelf) return;

    // Lưu threadId cho bot account
    captureThreadId(ownId, chatId).catch(() => {});

    // Tự động gán threadID theo SĐT
    autoLinkThreadId(chatId, ownId).catch(() => {});

    // Xử lý pending confirmation
    if (content) {
      const confirmed = await handlePendingConfirmation(chatId, content);
      if (confirmed) return;
    }

    // Auto reply
    await handleZaloAutoReply(update, "", ownId);
  } catch (err) {
    console.error("[ZaloDirect] handleIncomingMessage error:", err);
  }
}

/**
 * Xử lý sự kiện group (join, leave, kick, promote, etc.)
 *
 * zca-js v2 GroupEvent format:
 *   { type: GroupEventType, data: TGroupEvent, act, threadId, isSelf }
 *   TGroupEvent: { groupId, creatorId, groupName, sourceId, updateMembers, ... }
 */
export async function handleGroupEvent(
  ownId: string,
  event: any
): Promise<void> {
  try {
    // Unwrap .data nếu có
    const raw = event?.data ?? event;
    const chatId = String(raw?.groupId || event?.threadId || raw?.uidFrom || "");
    if (!chatId) return;

    const update = {
      data: raw,
      ownId,
      type: 1,
      event_name: "group_event",
      threadId: event?.threadId || chatId,
    };

    // Nếu payload có groupName → persist vào CaiDat
    const groupName: string | null = raw.groupName || null;
    if (groupName) {
      _groupNameCache.set(chatId, { name: groupName, ts: Date.now() });
      prisma.caiDat.upsert({
        where: { khoa: groupCaiDatKey(chatId) },
        create: { khoa: groupCaiDatKey(chatId), giaTri: groupName, nhom: 'zalo' },
        update: { giaTri: groupName },
      }).catch(() => {});
    }

    const displayName = groupName || (await resolveGroupName(chatId, ownId)) || raw.dName || null;

    await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName,
        content: raw.content || raw.msg || `[sự kiện nhóm: ${event?.type || "unknown"}]`,
        attachmentUrl: null,
        role: "system",
        eventName: "group_event",
        rawPayload: update as any,
      },
    });
    sseEmit("zalo-message", { chatId });
  } catch (err) {
    console.error("[ZaloDirect] handleGroupEvent error:", err);
  }
}

/**
 * Xử lý reaction (thả cảm xúc)
 *
 * zca-js v2 Reaction format:
 *   { data: TReaction, threadId, isSelf, isGroup }
 *   TReaction: { uidFrom, idTo, dName, content: { rIcon, rType, ... }, ... }
 */
export async function handleReaction(
  ownId: string,
  reaction: any
): Promise<void> {
  try {
    // Unwrap .data nếu có
    const raw = reaction?.data ?? reaction;
    const chatId = String(raw?.uidFrom || "");
    if (!chatId) return;

    const icon = raw?.content?.rIcon || raw?.icon || raw?.content || "";

    await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName: raw.dName || null,
        content: `[reaction: ${icon}]`,
        attachmentUrl: null,
        role: "system",
        eventName: "reaction",
        rawPayload: reaction as any,
      },
    });
    sseEmit("zalo-message", { chatId });
  } catch (err) {
    console.error("[ZaloDirect] handleReaction error:", err);
  }
}

/**
 * Setup tất cả listeners cho một zca-js API instance.
 * Gọi sau khi login thành công.
 */
export function setupListeners(
  api: any,
  ownId: string,
  onClose?: () => void
): void {
  if (!api?.listener) {
    console.warn("[ZaloDirect] API không có listener, bỏ qua setupListeners");
    return;
  }

  api.listener.on("message", (msg: any) => {
    handleIncomingMessage(ownId, msg).catch((err) =>
      console.error("[ZaloDirect] message listener error:", err)
    );
  });

  api.listener.on("group_event", (event: any) => {
    handleGroupEvent(ownId, event).catch((err) =>
      console.error("[ZaloDirect] group_event listener error:", err)
    );
  });

  api.listener.on("reaction", (reaction: any) => {
    handleReaction(ownId, reaction).catch((err) =>
      console.error("[ZaloDirect] reaction listener error:", err)
    );
  });

  // "disconnected" = WS đóng nhưng zca-js có thể tự reconnect (retryOnClose)
  api.listener.on("disconnected", (code: any, reason: any) => {
    console.warn(`[ZaloDirect] WebSocket disconnected for ${ownId}: code=${code}, reason=${reason} (sẽ tự retry)`);
  });

  // "closed" = tất cả retry đã hết, WS thật sự đóng → cần relogin
  api.listener.on("closed", (code: any, reason: any) => {
    console.warn(`[ZaloDirect] Connection closed (all retries exhausted) for ${ownId}: code=${code}, reason=${reason}`);
    onClose?.();
  });

  // Fallback: cũng lắng nghe "close" nếu version cũ
  api.listener.on("close", () => {
    console.warn(`[ZaloDirect] Connection close event for account ${ownId}`);
    onClose?.();
  });

  api.listener.on("error", (err: any) => {
    console.error(`[ZaloDirect] Listener error for account ${ownId}:`, err);
  });

  api.listener.on("connected", () => {
    console.log(`[ZaloDirect] WebSocket connected for account ${ownId}`);
  });

  // Bắt đầu lắng nghe — retryOnClose để zca-js tự reconnect WS
  api.listener.start({ retryOnClose: true });
  console.log(`[ZaloDirect] Listeners started for account ${ownId}`);
}

/**
 * Lưu threadId mapping khi nhận tin nhắn.
 * Tương đương captureThreadIdForBotAccount trong webhook/route.ts
 */
async function captureThreadId(botAccountId: string, chatId: string): Promise<void> {
  if (!botAccountId || botAccountId === chatId) return;

  const [kt, nd] = await Promise.all([
    prisma.khachThue.findFirst({
      where: { zaloChatId: chatId },
      select: { id: true, zaloChatIds: true },
    }),
    prisma.nguoiDung.findFirst({
      where: { zaloChatId: chatId },
      select: { id: true, zaloChatIds: true },
    }),
  ]);

  if (kt) {
    const entries: any[] = Array.isArray(kt.zaloChatIds)
      ? (kt.zaloChatIds as any[])
      : [];
    const existing = entries.find(
      (e: any) => e.ten === botAccountId || e.userId === chatId
    );
    if (!existing?.threadId) {
      storeChatIdForAccount("khachThue", kt.id, botAccountId, chatId).catch(
        () => {}
      );
    }
  }
  if (nd) {
    const entries: any[] = Array.isArray(nd.zaloChatIds)
      ? (nd.zaloChatIds as any[])
      : [];
    const existing = entries.find(
      (e: any) => e.ten === botAccountId || e.userId === chatId
    );
    if (!existing?.threadId) {
      storeChatIdForAccount("nguoiDung", nd.id, botAccountId, chatId).catch(
        () => {}
      );
    }
  }
}
