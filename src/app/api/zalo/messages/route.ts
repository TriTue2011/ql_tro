/**
 * GET  /api/zalo/messages?chatId=xxx&limit=50&before=<cursor_id>
 *   → Lấy tin nhắn của 1 cuộc hội thoại (chỉ tin nhắn thuộc ownId của người dùng)
 *
 * GET  /api/zalo/messages?conversations=1
 *   → Lấy danh sách cuộc hội thoại — mọi role chỉ thấy ownId của mình
 *
 * DELETE /api/zalo/messages
 *   → Xóa tất cả tin nhắn (Xóa tất cả trong theo dõi)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { attachRoomInfo } from "@/lib/zalo-room-info";

// Tắt cache Next.js — tin nhắn cần luôn fresh
export const dynamic = "force-dynamic";

/** Lấy danh sách ownId mà user có quyền xem tin nhắn.
 *  - chuNha/dongChuTro/admin: chỉ ownId của chính họ
 *  - quanLy/nhanVien: ownId của các chủ trọ trong tòa nhà họ quản lý
 */
async function resolveOwnIds(userId: string, zaloAccountId: string | null | undefined): Promise<string[]> {
  const base = zaloAccountId || userId;
  return [base];
}

/** Lấy whitelist nhóm của user (hoặc kế thừa từ chủ trọ nếu là quanLy) */
async function resolveGroupWhitelist(userId: string, role: string): Promise<string[]> {
  const userGroupKey = (uid: string) => `zalo_group_whitelist_${uid}`;

  if (role === 'admin') {
    const row = await prisma.caiDat.findUnique({ where: { khoa: 'zalo_monitor_group_whitelist' }, select: { giaTri: true } });
    try { return JSON.parse(row?.giaTri || '[]'); } catch { return []; }
  }

  if (role === 'quanLy' || role === 'nhanVien') {
    // Kế thừa whitelist từ tất cả chủ trọ mà họ quản lý
    const managed = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { nguoiDungId: userId },
      select: { toaNha: { select: { chuSoHuuId: true } } },
    });
    const ownerIds = [...new Set(managed.map(m => m.toaNha.chuSoHuuId))];
    const merged: string[] = [];
    for (const oid of ownerIds) {
      const row = await prisma.caiDat.findUnique({ where: { khoa: userGroupKey(oid) }, select: { giaTri: true } });
      try {
        const wl = JSON.parse(row?.giaTri || '[]');
        if (Array.isArray(wl)) merged.push(...wl);
      } catch { /* ignore */ }
    }
    return [...new Set(merged)];
  }

  // chuNha / dongChuTro: whitelist của chính mình
  const row = await prisma.caiDat.findUnique({ where: { khoa: userGroupKey(userId) }, select: { giaTri: true } });
  try { return JSON.parse(row?.giaTri || '[]'); } catch { return []; }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId } = session.user;
  const role = session.user.role as string;
  const { searchParams } = new URL(request.url);

  const nguoiDung = await prisma.nguoiDung.findUnique({
    where: { id: userId },
    select: { zaloAccountId: true, vaiTro: true },
  });
  const effectiveRole = nguoiDung?.vaiTro || role;
  const ownIds = await resolveOwnIds(userId, nguoiDung?.zaloAccountId);
  const ownIdsJoined = Prisma.join(ownIds);

  // ── Danh sách cuộc hội thoại ────────────────────────────────────────────────
  if (searchParams.get("conversations") === "1") {
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
        WHERE "role" = 'user' AND "ownId" IN (${ownIdsJoined})
        ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
      ),
      latest_bot AS (
        SELECT DISTINCT ON (COALESCE("rawPayload"->>'threadId', "chatId"))
          COALESCE("rawPayload"->>'threadId', "chatId") AS "chatId",
          "content" AS "botContent",
          "createdAt" AS "botCreatedAt"
        FROM "ZaloMessage"
        WHERE "role" = 'bot' AND "ownId" IN (${ownIdsJoined})
        ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
      )
      SELECT u.*, b."botContent", b."botCreatedAt"
      FROM latest_user u
      LEFT JOIN latest_bot b ON u."chatId" = b."chatId"
      ORDER BY u."createdAt" DESC
    `;

    // ── Lọc theo Whitelist & DM Filter ──────────────────────────────────────
    const dmRow = await prisma.caiDat.findUnique({ where: { khoa: 'zalo_monitor_dm_filter' }, select: { giaTri: true } });
    const dmFilter = dmRow?.giaTri || 'none';

    const whitelist = await resolveGroupWhitelist(userId, effectiveRole);
    const whitelistLower = whitelist.map(w => w.toLowerCase());

    const filteredRows = rows.filter(row => {
      const payload = (row.rawPayload || {}) as any;
      const isGroup = !!payload.threadId || payload.type === 1 || payload.type === '1';

      if (!isGroup && dmFilter === 'system_only') return false;

      if (isGroup && whitelistLower.length > 0) {
        const groupName = (row.displayName || '').toLowerCase();
        return whitelistLower.some(w => groupName.includes(w));
      }

      return true;
    });

    const rowsWithRoomInfo = await attachRoomInfo(filteredRows);
    return NextResponse.json({ data: rowsWithRoomInfo });
  }

  // ── Tin nhắn theo chatId ────────────────────────────────────────────────────
  const chatId = searchParams.get("chatId");
  if (!chatId)
    return NextResponse.json({ error: "chatId required" }, { status: 400 });

  // Kiểm tra quyền truy cập — cuộc hội thoại phải thuộc ownId của user (hoặc chủ trọ họ quản lý)
  const hasAccess = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "ZaloMessage"
    WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
      AND "ownId" IN (${ownIdsJoined})
    LIMIT 1
  `;
  if (!hasAccess.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const before = searchParams.get("before");

  const messages = before
    ? await prisma.$queryRaw<any[]>`
        SELECT * FROM "ZaloMessage"
        WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
          AND "ownId" IN (${ownIdsJoined})
          AND "createdAt" < ${new Date(before)}::timestamptz
        ORDER BY "createdAt" DESC LIMIT ${limit}
      `
    : await prisma.$queryRaw<any[]>`
        SELECT * FROM "ZaloMessage"
        WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
          AND "ownId" IN (${ownIdsJoined})
        ORDER BY "createdAt" DESC LIMIT ${limit}
      `;

  return NextResponse.json({ data: [...messages].reverse() });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId } = session.user;
  const role = session.user.role as string;

  // Lấy ownIds của user (quanLy dùng ownId của chủ trọ họ quản lý)
  const nguoiDung = await prisma.nguoiDung.findUnique({
    where: { id: userId },
    select: { zaloAccountId: true, vaiTro: true },
  });
  const ownIds = await resolveOwnIds(userId, nguoiDung?.zaloAccountId);
  const ownIdsJoined = Prisma.join(ownIds);

  // Xóa 1 tin nhắn theo id (chỉ admin/chuNha)
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    if (!["admin", "chuNha"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.zaloMessage.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  // Xóa theo chatId — mọi role, chỉ xóa tin thuộc ownIds của mình
  const chatId = new URL(request.url).searchParams.get("chatId");
  if (chatId) {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "ZaloMessage"
      WHERE ("chatId" = ${chatId} OR "rawPayload"->>'threadId' = ${chatId})
        AND "ownId" IN (${ownIdsJoined})
    `;
    return NextResponse.json({ success: true, deleted: Number(deleted) });
  }

  // Xóa tất cả — chỉ admin/chuNha, và chỉ xóa tin thuộc ownIds của mình
  if (!["admin", "chuNha", "quanLy", "dongChuTro"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const deleted = await prisma.$executeRaw`
    DELETE FROM "ZaloMessage"
    WHERE "ownId" IN (${ownIdsJoined})
  `;
  return NextResponse.json({ success: true, deleted: Number(deleted) });
}
