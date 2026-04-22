/**
 * GET  /api/zalo/messages?chatId=xxx&limit=50&before=<cursor_id>
 *   → Lấy tin nhắn của 1 cuộc hội thoại
 *
 * GET  /api/zalo/messages?conversations=1
 *   → Lấy danh sách cuộc hội thoại (tin nhắn cuối mỗi chatId)
 *   → Admin: tất cả; chuNha: chỉ tin nhắn gửi đến tài khoản Zalo của mình (ownId)
 *
 * DELETE /api/zalo/messages
 *   → Xóa tất cả tin nhắn (Xóa tất cả trong theo dõi)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { attachRoomInfo } from "@/lib/zalo-room-info";

// Tắt cache Next.js — tin nhắn cần luôn fresh
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, role: userRole } = session.user;
  const { searchParams } = new URL(request.url);
  const canViewAll = userRole === 'admin';

  const nguoiDung = await prisma.nguoiDung.findUnique({
    where: { id: userId },
    select: { zaloChatId: true, zaloAccountId: true },
  });
  const userZaloChatId = nguoiDung?.zaloChatId ?? null;
  // zaloAccountId = ID tài khoản bot Zalo của user (dùng để filter theo ownId)
  // Fallback sang userId vì per-user webhook inject nd.id khi chưa có zaloAccountId
  const userZaloAccountId = nguoiDung?.zaloAccountId ?? null;
  const userOwnId = userZaloAccountId || userId;

  // Danh sách cuộc hội thoại
  // Admin: xem tất cả; chuNha: chỉ tin nhắn gửi đến tài khoản Zalo của mình
  if (searchParams.get("conversations") === "1") {
    // Filter theo ownId cụ thể (admin: bất kỳ, non-admin: chỉ tài khoản của mình)
    const requestedOwnId = searchParams.get("ownId");
    const adminFilterOwnId = canViewAll ? requestedOwnId : null;

    // Helper expression: dùng rawPayload.threadId làm grouping key cho tin nhắn nhóm,
    // ngược lại dùng chatId. Đảm bảo tất cả tin nhắn cùng nhóm gộp thành 1 hội thoại
    // dù chatId cũ có thể là senderId thay vì threadId.
    if (canViewAll && !adminFilterOwnId) {
      const rows = await prisma.$queryRaw<any[]>`
        WITH latest_user AS (
          SELECT DISTINCT ON (COALESCE("rawPayload"->>'threadId', "chatId"))
            "id",
            COALESCE("rawPayload"->>'threadId', "chatId") AS "chatId",
            "ownId",
            COALESCE(
              CASE WHEN "rawPayload"->>'threadId' IS NOT NULL THEN
                (SELECT "giaTri" FROM "CaiDat"
                 WHERE "khoa" = 'zalo_group_name_' || ("rawPayload"->>'threadId')
                 LIMIT 1)
              END,
              "displayName"
            ) AS "displayName",
            "content", "attachmentUrl", "role", "createdAt", "rawPayload", "eventName"
          FROM "ZaloMessage"
          WHERE "role" = 'user'
          ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
        ),
        latest_bot AS (
          SELECT DISTINCT ON (COALESCE("rawPayload"->>'threadId', "chatId"))
            COALESCE("rawPayload"->>'threadId', "chatId") AS "chatId",
            "content" AS "botContent",
            "createdAt" AS "botCreatedAt"
          FROM "ZaloMessage"
          WHERE "role" = 'bot'
          ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
        )
        SELECT u.*, b."botContent", b."botCreatedAt"
        FROM latest_user u
        LEFT JOIN latest_bot b ON u."chatId" = b."chatId"
        ORDER BY u."createdAt" DESC
      `;
      const rowsWithRoomInfo = await attachRoomInfo(rows);
      return NextResponse.json({ data: rowsWithRoomInfo });
    }

    const filterOwnId = adminFilterOwnId
      || (requestedOwnId && requestedOwnId === userZaloAccountId ? requestedOwnId : null)
      || userOwnId;

    const rows = await prisma.$queryRaw<any[]>`
      WITH latest_user AS (
        SELECT DISTINCT ON (COALESCE("rawPayload"->>'threadId', "chatId"))
          "id",
          COALESCE("rawPayload"->>'threadId', "chatId") AS "chatId",
          "ownId",
          COALESCE(
            CASE WHEN "rawPayload"->>'threadId' IS NOT NULL THEN
              (SELECT "giaTri" FROM "CaiDat"
               WHERE "khoa" = 'zalo_group_name_' || ("rawPayload"->>'threadId')
               LIMIT 1)
            END,
            "displayName"
          ) AS "displayName",
          "content", "attachmentUrl", "role", "createdAt", "rawPayload", "eventName"
        FROM "ZaloMessage"
        WHERE "role" = 'user' AND "ownId" = ${filterOwnId}
        ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
      ),
      latest_bot AS (
        SELECT DISTINCT ON (COALESCE("rawPayload"->>'threadId', "chatId"))
          COALESCE("rawPayload"->>'threadId', "chatId") AS "chatId",
          "content" AS "botContent",
          "createdAt" AS "botCreatedAt"
        FROM "ZaloMessage"
        WHERE "role" = 'bot' AND "ownId" = ${filterOwnId}
        ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
      )
      SELECT u.*, b."botContent", b."botCreatedAt"
      FROM latest_user u
      LEFT JOIN latest_bot b ON u."chatId" = b."chatId"
      ORDER BY u."createdAt" DESC
    `;
    const rowsWithRoomInfo = await attachRoomInfo(rows);
    return NextResponse.json({ data: rowsWithRoomInfo });
  }

  // Tin nhắn theo chatId — admin xem tất cả, chuNha chỉ xem tin của tài khoản mình
  const chatId = searchParams.get("chatId");
  if (!chatId)
    return NextResponse.json({ error: "chatId required" }, { status: 400 });

  if (!canViewAll) {
    const hasAccess = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "ZaloMessage"
      WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
        AND "ownId" = ${userOwnId}
      LIMIT 1
    `;
    if (!hasAccess.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const before = searchParams.get("before");

  // Tìm theo chatId HOẶC rawPayload.threadId để lấy cả tin nhắn cũ (chatId=senderId) lẫn mới
  // Admin xem tất cả; non-admin chỉ xem tin nhắn của tài khoản mình
  const messages = canViewAll
    ? before
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM "ZaloMessage"
          WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
            AND "createdAt" < ${new Date(before)}::timestamptz
          ORDER BY "createdAt" DESC LIMIT ${limit}
        `
      : await prisma.$queryRaw<any[]>`
          SELECT * FROM "ZaloMessage"
          WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
          ORDER BY "createdAt" DESC LIMIT ${limit}
        `
    : before
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM "ZaloMessage"
          WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
            AND "ownId" = ${userOwnId}
            AND "createdAt" < ${new Date(before)}::timestamptz
          ORDER BY "createdAt" DESC LIMIT ${limit}
        `
      : await prisma.$queryRaw<any[]>`
          SELECT * FROM "ZaloMessage"
          WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
            AND "ownId" = ${userOwnId}
          ORDER BY "createdAt" DESC LIMIT ${limit}
        `;

  return NextResponse.json({ data: [...messages].reverse() });
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

  // Xóa theo chatId (hoặc threadId trong rawPayload)
  const chatId = new URL(request.url).searchParams.get("chatId");
  if (chatId) {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "ZaloMessage"
      WHERE "chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId}
    `;
    return NextResponse.json({ success: true, deleted: Number(deleted) });
  }

  // Xóa tất cả
  const { count } = await prisma.zaloMessage.deleteMany({});
  return NextResponse.json({ success: true, deleted: count });
}
