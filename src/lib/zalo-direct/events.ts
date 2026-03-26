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

/**
 * Xử lý tin nhắn nhận được từ zca-js listener.
 * Tương đương triggerWebhook() trong bot server nhưng xử lý in-process.
 *
 * zca-js v2 Message format:
 *   { type: ThreadType, data: TMessage, threadId: string, isSelf: boolean }
 *   TMessage: { uidFrom, dName, content, idTo, msgId, cliMsgId, ... }
 */
export async function handleIncomingMessage(
  ownId: string,
  msg: any
): Promise<void> {
  // zca-js v2: msg = { type, data: TMessage, threadId, isSelf }
  // Unwrap .data nếu có, fallback cho raw data (tương thích cũ)
  const raw = msg?.data ?? msg;
  const chatId = String(raw?.uidFrom || msg?.uidFrom || "");
  if (!chatId) return;

  // Bỏ qua tin nhắn do chính mình gửi
  if (msg?.isSelf) return;

  const displayName = raw.dName || raw.fromD || "";
  const contentRaw = raw.content || raw.msg || "";
  // content có thể là string hoặc object (attachment)
  const content = typeof contentRaw === "string" ? contentRaw : JSON.stringify(contentRaw);
  const isGroupMessage = msg?.type === 1 || (raw.idTo && raw.idTo !== ownId);

  // threadId từ zca-js v2 hoặc tính toán
  const threadId = msg?.threadId || (isGroupMessage ? String(raw.idTo || chatId) : chatId);
  const update = {
    data: raw,
    uidFrom: chatId,
    dName: displayName,
    content,
    ownId,
    idTo: raw.idTo,
    type: isGroupMessage ? 1 : 0,
    threadId,
  };

  try {
    // Lưu tin nhắn vào DB
    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName: displayName || null,
        content,
        attachmentUrl: null,
        role: "user",
        eventName: "message",
        rawPayload: update as any,
      },
    });
    emitNewMessage({ ...saved, eventName: saved.eventName ?? "message" });
    sseEmit("zalo-message", { chatId: saved.chatId });

    // Cleanup cũ (throttled)
    cleanupOldMessages().catch(() => {});

    // Bỏ qua tin nhắn nhóm
    if (isGroupMessage) return;

    // Lưu threadId cho bot account
    captureThreadId(ownId, chatId).catch(() => {});

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

    await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName: raw.dName || raw.fromD || raw.groupName || null,
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

  // zca-js v2: event "closed" (not "close") với (code, reason)
  api.listener.on("closed", (code: any, reason: any) => {
    console.warn(`[ZaloDirect] Connection closed for account ${ownId}: code=${code}, reason=${reason}`);
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

  // Bắt đầu lắng nghe
  api.listener.start();
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
