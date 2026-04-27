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

/**
 * Lấy danh sách ownId mà user có quyền xem tin nhắn trong Monitor.
 *
 * Mỗi người dùng (Admin / Chủ trọ / Quản lý) có tài khoản Zalo riêng chạy bot.
 * Tin nhắn khách gửi đến bot ai → lưu vào ZaloMessage với ownId = zaloAccountId người đó.
 * → Mỗi người CHỈ thấy tin nhắn của bot MÌNH.
 *
 * - admin/chuNha/quanLy/dongChuTro : chỉ thấy ownId = zaloAccountId của chính họ
 * - nhanVien    : không có quyền xem Monitor → trả về []
 */
async function resolveOwnIds(userId: string, role: string, zaloAccountId?: string | null): Promise<string[]> {
  // Nhân viên không có quyền xem Monitor
  if (role === 'nhanVien') return [];

  // Admin / Chủ trọ / Quản lý / Đồng chủ trọ: chỉ thấy bot của chính mình
  // zaloAccountId = ID tài khoản Zalo họ đã kết nối làm bot
  const ownId = zaloAccountId || userId;
  return [ownId];
}


/** Lấy whitelist nhóm của user (hoặc kế thừa từ chủ trọ nếu là quanLy) */
/** Lấy whitelist nhóm của user (hoặc kế thừa từ chủ trọ nếu là quanLy) — CHỈ lấy từ các tòa đã BẬT Monitor */
async function resolveGroupWhitelist(userId: string, role: string): Promise<string[]> {
  const buildings = await prisma.toaNha.findMany({
    where: role === 'admin' ? {} : {
      OR: [
        { chuSoHuuId: userId },
        { nguoiQuanLy: { some: { nguoiDungId: userId } } }
      ]
    },
    select: { id: true, zaloNhomChat: true }
  });

  const merged: string[] = [];
  for (const b of buildings) {
    const configRow = await prisma.caiDat.findUnique({ where: { khoa: `zalo_monitor_config_${b.id}` } });
    const config = configRow ? JSON.parse(configRow.giaTri || '{}') : { enabled: true };

    if (config.enabled !== false) {
      if (Array.isArray(b.zaloNhomChat)) {
        b.zaloNhomChat.forEach((g: any) => { if (g?.name) merged.push(g.name); });
      }
    }
  }

  // Admin: merge thêm whitelist toàn cục (nếu có)
  if (role === 'admin') {
    const row = await prisma.caiDat.findUnique({ where: { khoa: 'zalo_monitor_group_whitelist' }, select: { giaTri: true } });
    try {
      const globalWhitelist = JSON.parse(row?.giaTri || '[]');
      if (Array.isArray(globalWhitelist)) merged.push(...globalWhitelist);
    } catch {}
  }

  return [...new Set(merged)];
}

/**
 * Build a Set of all system chatIds (from KhachThue + NguoiDung + DanhBaNgoai)
 * Bao gồm cả:
 * - zaloChatId (đã xác nhận)
 * - zaloChatIds JSON array (multi-bot)
 * - pendingZaloChatId (đang chờ xác nhận — khách mới nhắn tin lần đầu)
 */
async function getSystemChatIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  const [kts, nds, danhBaNgoaiRow] = await Promise.all([
    prisma.khachThue.findMany({ select: { zaloChatId: true, zaloChatIds: true, pendingZaloChatId: true } }),
    prisma.nguoiDung.findMany({ select: { zaloChatId: true, zaloChatIds: true, pendingZaloChatId: true } }),
    prisma.caiDat.findUnique({ where: { khoa: 'zalo_danh_ba_ngoai' } }),
  ]);

  const processEntry = (e: any) => {
    if (e.zaloChatId) ids.add(e.zaloChatId);
    if (e.pendingZaloChatId) ids.add(e.pendingZaloChatId); // khách mới, chưa xác nhận
    if (e.zaloChatIds) {
      try {
        const parsed = typeof e.zaloChatIds === 'string' ? JSON.parse(e.zaloChatIds) : e.zaloChatIds;
        if (Array.isArray(parsed)) parsed.forEach((i: any) => { if (i.threadId) ids.add(i.threadId); if (i.userId) ids.add(i.userId); });
        else if (typeof parsed === 'object' && parsed !== null) Object.values(parsed).forEach((tid: any) => { if (typeof tid === 'string') ids.add(tid); });
      } catch {}
    }
  };

  kts.forEach(processEntry);
  nds.forEach(processEntry);

  if (danhBaNgoaiRow?.giaTri) {
    try {
      const arr = JSON.parse(danhBaNgoaiRow.giaTri);
      if (Array.isArray(arr)) arr.forEach((c: any) => { if (c.threadId) ids.add(c.threadId); });
    } catch {}
  }

  return ids;
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

  if (effectiveRole === "nhanVien") {
    return NextResponse.json({ error: "Forbidden: Nhân viên không có quyền xem tin nhắn Zalo" }, { status: 403 });
  }

  const ownIds = await resolveOwnIds(userId, effectiveRole, nguoiDung?.zaloAccountId);
  if (ownIds.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản Zalo liên kết để xem tin nhắn" }, { status: 403 });
  }

  const ownIdsJoined = Prisma.join(ownIds);

  // ── Danh sách cuộc hội thoại ────────────────────────────────────────────────
  if (searchParams.get("conversations") === "1") {
    const rows = await prisma.$queryRaw<any[]>`
      WITH latest_msgs AS (
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
        WHERE "ownId" IN (${ownIdsJoined})
        ORDER BY COALESCE("rawPayload"->>'threadId', "chatId"), "createdAt" DESC
      )
      SELECT * FROM latest_msgs ORDER BY "createdAt" DESC
    `;

    // ── Lọc theo Whitelist & DM Filter ──────────────────────────────────────
    const whitelist = await resolveGroupWhitelist(userId, effectiveRole);
    const whitelistLower = whitelist.map(w => w.toLowerCase());

    // Tìm hiểu building config của user để biết dmFilter
    // Lấy danh sách building của user (quanLy thì lấy tòa nhà họ quản lý)
    const userBuildings = await prisma.toaNha.findMany({
      where: effectiveRole === 'admin' ? {} : {
        OR: [
          { chuSoHuuId: userId },
          { nguoiQuanLy: { some: { nguoiDungId: userId } } },
        ]
      },
      select: { id: true }
    });

    // Kiểm tra xem có cần lọc system_only không
    // Chỉ lọc nếu TẤT CẢ các tòa nhà đều bật 'system_only'
    // Nếu có BẤT KỲ tòa nhà nào để 'none' → không lọc (hiển thị tất cả DM)
    let dmFilterActive = false;
    let hasAnyBuilding = false;
    
    for (const b of userBuildings) {
      const cfgRow = await prisma.caiDat.findUnique({ where: { khoa: `zalo_monitor_config_${b.id}` } });
      const cfg = cfgRow ? JSON.parse(cfgRow.giaTri || '{}') : { enabled: true, dmFilter: 'none' };
      
      if (cfg.enabled !== false) {
        hasAnyBuilding = true;
        if (cfg.dmFilter !== 'system_only') {
          // Có một tòa nhà không filter → không lọc DM (override)
          dmFilterActive = false;
          break;
        }
        // Tòa này muốn filter
        dmFilterActive = true;
      }
    }
    
    // Nếu không có tòa nhà nào bật Monitor, không cần lọc
    if (!hasAnyBuilding) dmFilterActive = false;

    // Nếu không có per-building config nào bật (hoặc user không có tòa nhà), fallback global
    if (!hasAnyBuilding) {
      const globalDmRow = await prisma.caiDat.findUnique({ where: { khoa: 'zalo_monitor_dm_filter' }, select: { giaTri: true } });
      if (globalDmRow?.giaTri === 'system_only') dmFilterActive = true;
    }

    // Nếu cần lọc system_only, lấy toàn bộ system chatIds một lần
    let systemChatIds: Set<string> | null = null;
    if (dmFilterActive) {
      systemChatIds = await getSystemChatIds();
    }

    const filteredRows = rows.filter(row => {
      const payload = (row.rawPayload || {}) as any;
      const isGroup = Number(payload.type) === 1 || Number(payload.data?.type) === 1;

      if (isGroup) {
        // Không thay đổi filter nhóm
        if (whitelistLower.length === 0) return false;
        const groupName = (row.displayName || '').toLowerCase();
        return whitelistLower.some(w => groupName === w || groupName.includes(w));
      } else {
        // DM: nếu đang bật system_only thì chỉ hiện chatId nằm trong systemChatIds
        if (systemChatIds !== null) {
          return systemChatIds.has(row.chatId);
        }
        return true;
      }
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

  const nguoiDung = await prisma.nguoiDung.findUnique({
    where: { id: userId },
    select: { zaloAccountId: true, vaiTro: true },
  });
  const effectiveRole = nguoiDung?.vaiTro || role;

  if (effectiveRole === "nhanVien") {
    return NextResponse.json({ error: "Forbidden: Nhân viên không có quyền" }, { status: 403 });
  }

  const ownIds = await resolveOwnIds(userId, effectiveRole, nguoiDung?.zaloAccountId);
  if (ownIds.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản Zalo liên kết" }, { status: 403 });
  }
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

  // Xóa tất cả — chỉ admin/chuNha/quanLy/dongChuTro
  const deleted = await prisma.$executeRaw`
    DELETE FROM "ZaloMessage"
    WHERE "ownId" IN (${ownIdsJoined})
  `;
  return NextResponse.json({ success: true, deleted: Number(deleted) });
}
