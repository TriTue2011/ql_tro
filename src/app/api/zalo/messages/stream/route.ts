/**
 * GET /api/zalo/messages/stream?chatId=xxx&after=<ISO>
 * SSE endpoint — đẩy tin nhắn mới về client theo thời gian thực.
 *
 * Cơ chế:
 *  1. Lắng nghe EventEmitter (zaloMessageEmitter) → nhận ngay khi có tin mới (< 100ms)
 *  2. Fallback poll DB mỗi 10s → đảm bảo không bỏ sót nếu process restart
 *  3. Heartbeat mỗi 25s → tránh timeout proxy
 */
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  zaloMessageEmitter,
  ZaloMessageEvent,
} from "@/lib/zalo-message-events";
import { attachRoomInfo } from "@/lib/zalo-room-info";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId") || undefined;
  const afterParam = searchParams.get("after");
  const isAdmin = session.user.role === 'admin';

  // Non-admin: chỉ stream tin nhắn của tài khoản bot mình
  let filterOwnId: string | null = null;
  if (!isAdmin) {
    const nd = await prisma.nguoiDung.findUnique({
      where: { id: session.user.id },
      select: { zaloAccountId: true, zaloChatId: true },
    });
    filterOwnId = nd?.zaloAccountId || nd?.zaloChatId || null;
  }

  const encoder = new TextEncoder();
  let cursor = afterParam ? new Date(afterParam) : new Date(Date.now() - 5000);

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      async function send(messages: ZaloMessageEvent[]) {
        if (closed) return;
        try {
          const enriched = await attachRoomInfo(messages);
          const payload = `data: ${JSON.stringify({ type: "messages", data: enriched })}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      }

      // Heartbeat ngay lập tức để client biết kết nối thành công
      controller.enqueue(encoder.encode(": connected\n\n"));

      // ── 1. Lắng nghe event real-time ────────────────────────────────────────
      function onMessage(msg: ZaloMessageEvent) {
        if (closed) return;
        // Lọc theo chatId nếu client chỉ quan tâm 1 cuộc trò chuyện
        if (chatId && msg.chatId !== chatId) return;
        // Non-admin: chỉ nhận tin nhắn thuộc tài khoản bot của mình
        if (filterOwnId && msg.ownId && msg.ownId !== filterOwnId) return;
        if (msg.createdAt <= cursor) return;
        cursor = msg.createdAt;
        void send([msg]);
      }

      const eventChannel = chatId ? `message:${chatId}` : "message";
      zaloMessageEmitter.on(eventChannel, onMessage);

      // ── 2. Fallback poll DB mỗi 10s (phòng process restart / missed events) ─
      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const messages = await prisma.zaloMessage.findMany({
            where: {
              ...(chatId ? { chatId } : {}),
              ...(filterOwnId ? { OR: [{ ownId: filterOwnId }, { ownId: null }] } : {}),
              createdAt: { gt: cursor },
            },
            orderBy: { createdAt: "asc" },
            take: 20,
          });

          if (messages.length > 0) {
            cursor = messages[messages.length - 1].createdAt;
            void send(messages as unknown as ZaloMessageEvent[]);
          }
        } catch {
          // DB error — tiếp tục
        }
      }, 10_000);

      // ── 3. Heartbeat mỗi 25s ────────────────────────────────────────────────
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 25_000);

      // ── Cleanup khi client đóng kết nối ─────────────────────────────────────
      request.signal.addEventListener("abort", () => {
        closed = true;
        zaloMessageEmitter.off(eventChannel, onMessage);
        clearInterval(pollTimer);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx: tắt buffer để SSE real-time
    },
  });
}
