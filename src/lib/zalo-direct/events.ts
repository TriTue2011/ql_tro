/**
 * zalo-direct/events.ts
 * Event listeners cho zca-js SDK.
 * Port từ bot server eventListeners.js - xử lý trực tiếp thay vì qua HTTP webhook.
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
 */
export async function handleIncomingMessage(
  ownId: string,
  data: {
    uidFrom: string;
    dName?: string;
    fromD?: string;
    content?: string;
    msg?: string;
    idTo?: string;
    type?: number;
    msgId?: string;
    cliMsgId?: string;
    [key: string]: any;
  }
): Promise<void> {
  const chatId = String(data.uidFrom || "");
  if (!chatId) return;

  const displayName = data.dName || data.fromD || "";
  const content = data.content || data.msg || "";
  const isGroupMessage = data.idTo !== ownId; // group messages: idTo != ownId

  // Tạo update object tương thích với webhook normalizeWebhookPayload()
  const update = {
    data,
    uidFrom: data.uidFrom,
    dName: displayName,
    content,
    ownId,
    idTo: data.idTo,
    type: isGroupMessage ? 1 : 0,
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
 */
export async function handleGroupEvent(
  ownId: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const chatId = String(data.groupId || data.uidFrom || "");
    if (!chatId) return;

    const update = {
      data,
      ownId,
      type: 1,
      event_name: "group_event",
    };

    await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName: data.dName || data.fromD || null,
        content: data.content || data.msg || "[sự kiện nhóm]",
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
 */
export async function handleReaction(
  ownId: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const chatId = String(data.uidFrom || "");
    if (!chatId) return;

    await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId,
        displayName: data.dName || null,
        content: `[reaction: ${data.icon || data.content || ""}]`,
        attachmentUrl: null,
        role: "system",
        eventName: "reaction",
        rawPayload: data as any,
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

  api.listener.on("group_event", (data: any) => {
    handleGroupEvent(ownId, data).catch((err) =>
      console.error("[ZaloDirect] group_event listener error:", err)
    );
  });

  api.listener.on("reaction", (data: any) => {
    handleReaction(ownId, data).catch((err) =>
      console.error("[ZaloDirect] reaction listener error:", err)
    );
  });

  // Xử lý disconnect/close - auto relogin
  api.listener.on("close", () => {
    console.warn(`[ZaloDirect] Connection closed for account ${ownId}`);
    onClose?.();
  });

  api.listener.on("error", (err: any) => {
    console.error(`[ZaloDirect] Listener error for account ${ownId}:`, err);
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
