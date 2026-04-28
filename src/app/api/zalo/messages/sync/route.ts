import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as zaloDirect from "@/lib/zalo-direct";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const nguoiDung = await prisma.nguoiDung.findUnique({
    where: { id: session.user.id },
    select: { zaloAccountId: true },
  });
  const ownId = nguoiDung?.zaloAccountId;
  if (!ownId) return NextResponse.json({ error: "Chưa liên kết tài khoản Zalo" }, { status: 403 });

  // Lấy tin nhắn từ SDK
  const result = await zaloDirect.getMessages(chatId, 20, ownId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  const sdkMessages = Array.isArray(result.data) ? result.data : (result.data?.data || []);
  let count = 0;

  for (const m of sdkMessages) {
    // Ưu tiên threadId từ SDK làm chatId
    const currentChatId = m.threadId || chatId;
    
    // Kiểm tra xem đã tồn tại chưa (heuristic: thời gian + nội dung)
    const existing = await prisma.zaloMessage.findFirst({
      where: {
        chatId: currentChatId,
        ownId,
        createdAt: {
            gte: new Date(m.time - 5000),
            lte: new Date(m.time + 5000),
        },
        content: m.content || m.msg || ""
      }
    });

    if (!existing) {
      const isSelf = m.isSelf || m.uidFrom === ownId;
      await prisma.zaloMessage.create({
        data: {
          chatId: currentChatId,
          ownId,
          displayName: isSelf ? "Bạn" : (m.dName || m.displayName || "Người dùng"),
          content: m.content || m.msg || "",
          role: isSelf ? "owner" : "user",
          eventName: "message",
          rawPayload: m as any,
          createdAt: new Date(m.time || Date.now()),
        }
      });
      count++;
    }
  }

  return NextResponse.json({ ok: true, synced: count });
}
