/**
 * POST /api/zalo/messages/reply
 * Gửi tin nhắn từ bot đến người dùng và lưu vào DB.
 *
 * Body: { chatId: string, message: string, displayName?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNewMessage } from "@/lib/zalo-message-events";
import { sendMessageViaBotServer } from "@/lib/zalo-bot-client";

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

    const result = await sendMessageViaBotServer(chatId, message.trim(), threadType);
    zalOk = result.ok;
    if (!result.ok)
      zaloError = result.error || "Bot server lỗi khi gửi tin nhắn";
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
