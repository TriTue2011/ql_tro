/**
 * POST /api/zalo/messages/reply
 * Gửi tin nhắn từ bot đến người dùng và lưu vào DB.
 *
 * Body: { chatId: string, message: string, displayName?: string }
 *
 * Thiết kế sẵn cho AI: sau này AI có thể gọi endpoint này
 * sau khi đọc lịch sử từ GET /api/zalo/messages.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNewMessage } from "@/lib/zalo-message-events";
import {
  isBotServerMode,
  sendMessageViaBotServer,
} from "@/lib/zalo-bot-client";

const ZALO_API = "https://bot-api.zaloplatforms.com";

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({
      where: { khoa: "zalo_access_token" },
    });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { chatId, message, displayName } = body ?? {};
  if (!chatId || !message?.trim()) {
    return NextResponse.json(
      { error: "chatId và message là bắt buộc" },
      { status: 400 },
    );
  }

  let zalOk = false;
  let zaloError: string | null = null;

  try {
    if (await isBotServerMode()) {
      // Xác định type từ rawPayload của tin nhắn gần nhất trong thread
      let threadType: 0 | 1 = 0;
      try {
        const lastMsg = await prisma.zaloMessage.findFirst({
          where: { chatId, role: "user" },
          orderBy: { createdAt: "desc" },
          select: { rawPayload: true },
        });
        const raw = lastMsg?.rawPayload as any;
        if (raw?.type === 1) threadType = 1;
      } catch {
        /* fallback to user */
      }

      // Bot server mode (Docker zca-js)
      const result = await sendMessageViaBotServer(
        chatId,
        message.trim(),
        threadType,
      );
      zalOk = result.ok;
      if (!result.ok)
        zaloError = result.error || "Bot server lỗi khi gửi tin nhắn";
    } else {
      // Zalo OA Bot API
      const token = await getZaloToken();
      if (!token) {
        return NextResponse.json(
          { error: "Chưa cấu hình zalo_access_token" },
          { status: 503 },
        );
      }
      const res = await fetch(`${ZALO_API}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message.trim() }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data?.error === 0 || data?.error_code === 0) {
        zalOk = true;
      } else {
        zaloError =
          data?.message || data?.error_message || `Zalo lỗi ${data?.error}`;
      }
    }
  } catch (e: any) {
    zaloError = e?.message || "Timeout gửi Zalo";
  }

  // Lưu vào DB dù gửi thành công hay thất bại (để UI biết trạng thái)
  const saved = await prisma.zaloMessage.create({
    data: {
      chatId,
      displayName: displayName || null,
      content: message.trim(),
      role: "bot",
      eventName: zalOk ? "bot_reply" : "bot_reply_failed",
    },
  });

  // Emit để SSE stream cập nhật real-time
  emitNewMessage({ ...saved });

  if (!zalOk) {
    return NextResponse.json(
      { success: false, error: zaloError, saved },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, saved });
}
