/**
 * GET  /api/zalo/messages?chatId=xxx&limit=50&before=<cursor_id>
 *   → Lấy tin nhắn của 1 cuộc hội thoại
 *
 * GET  /api/zalo/messages?conversations=1
 *   → Lấy danh sách cuộc hội thoại (tin nhắn cuối mỗi chatId)
 *   → Admin/chuNha: tất cả; các role khác: chỉ chatId của mình (theo zaloChatId)
 *
 * DELETE /api/zalo/messages
 *   → Xóa tất cả tin nhắn (Xóa tất cả trong theo dõi)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { attachRoomInfo } from "@/lib/zalo-room-info";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, role: userRole } = session.user;
  const { searchParams } = new URL(request.url);
  const isAdminOrChuNha = ['admin', 'chuNha'].includes(userRole);

  const nguoiDung = await prisma.nguoiDung.findUnique({
    where: { id: userId },
    select: { zaloChatId: true },
  });
  const userZaloChatId = nguoiDung?.zaloChatId ?? null;

  // Danh sách cuộc hội thoại
  // Admin/chuNha: xem tất cả; các role khác: chỉ chatId của mình
  if (searchParams.get("conversations") === "1") {
    if (!isAdminOrChuNha && !userZaloChatId) return NextResponse.json({ data: [] });

    const rows = isAdminOrChuNha
      ? await prisma.$queryRaw<any[]>`
          WITH latest_user AS (
            SELECT DISTINCT ON ("chatId")
              "id", "chatId", "displayName", "content", "attachmentUrl",
              "role", "createdAt", "rawPayload", "eventName"
            FROM "ZaloMessage"
            WHERE "role" = 'user'
            ORDER BY "chatId", "createdAt" DESC
          ),
          latest_bot AS (
            SELECT DISTINCT ON ("chatId")
              "chatId",
              "content" AS "botContent",
              "createdAt" AS "botCreatedAt"
            FROM "ZaloMessage"
            WHERE "role" = 'bot'
            ORDER BY "chatId", "createdAt" DESC
          )
          SELECT u.*, b."botContent", b."botCreatedAt"
          FROM latest_user u
          LEFT JOIN latest_bot b ON u."chatId" = b."chatId"
          ORDER BY u."createdAt" DESC
        `
      : await prisma.$queryRaw<any[]>`
          WITH latest_user AS (
            SELECT DISTINCT ON ("chatId")
              "id", "chatId", "displayName", "content", "attachmentUrl",
              "role", "createdAt", "rawPayload", "eventName"
            FROM "ZaloMessage"
            WHERE "role" = 'user' AND "chatId" = ${userZaloChatId}
            ORDER BY "chatId", "createdAt" DESC
          ),
          latest_bot AS (
            SELECT DISTINCT ON ("chatId")
              "chatId",
              "content" AS "botContent",
              "createdAt" AS "botCreatedAt"
            FROM "ZaloMessage"
            WHERE "role" = 'bot' AND "chatId" = ${userZaloChatId}
            ORDER BY "chatId", "createdAt" DESC
          )
          SELECT u.*, b."botContent", b."botCreatedAt"
          FROM latest_user u
          LEFT JOIN latest_bot b ON u."chatId" = b."chatId"
          ORDER BY u."createdAt" DESC
        `;
    const rowsWithRoomInfo = await attachRoomInfo(rows);
    return NextResponse.json({ data: rowsWithRoomInfo });
  }

  // Tin nhắn theo chatId — admin/chuNha xem tất cả, các role khác chỉ chatId của mình
  const chatId = searchParams.get("chatId");
  if (!chatId)
    return NextResponse.json({ error: "chatId required" }, { status: 400 });

  if (!isAdminOrChuNha && chatId !== userZaloChatId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const before = searchParams.get("before"); // cursor: createdAt ISO

  const messages = await prisma.zaloMessage.findMany({
    where: {
      chatId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ data: messages.reverse() });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "chuNha"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Xóa 1 tin nhắn theo id
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    await prisma.zaloMessage.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  // Xóa theo chatId
  const chatId = new URL(request.url).searchParams.get("chatId");
  if (chatId) {
    const { count } = await prisma.zaloMessage.deleteMany({ where: { chatId } });
    return NextResponse.json({ success: true, deleted: count });
  }

  // Xóa tất cả
  const { count } = await prisma.zaloMessage.deleteMany({});
  return NextResponse.json({ success: true, deleted: count });
}
