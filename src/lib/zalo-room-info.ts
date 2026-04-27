import prisma from "@/lib/prisma";

export interface ZaloRoomInfo {
  tenKhach: string;
  maPhong: string;
  tang: number;
  tenToaNha: string;
  diaChi: unknown;
}

function getLookupIds(message: {
  chatId: string;
  rawPayload?: unknown;
}): string[] {
  const raw = (message.rawPayload ?? {}) as any;
  const ids = new Set<string>();
  if (message.chatId) ids.add(String(message.chatId));
  if (raw?.data?.uidFrom) ids.add(String(raw.data.uidFrom));
  if (raw?.uidFrom) ids.add(String(raw.uidFrom));
  if (raw?.message?.from?.id) ids.add(String(raw.message.from.id));
  if (raw?.sender?.id) ids.add(String(raw.sender.id));
  return Array.from(ids).filter(Boolean);
}

export async function attachRoomInfo<
  T extends { chatId: string; rawPayload?: unknown },
>(messages: T[]): Promise<Array<T & { roomInfo?: ZaloRoomInfo }>> {
  if (messages.length === 0)
    return messages as Array<T & { roomInfo?: ZaloRoomInfo }>;

  const lookupIds = Array.from(new Set(messages.flatMap(getLookupIds)));
  if (lookupIds.length === 0)
    return messages as Array<T & { roomInfo?: ZaloRoomInfo }>;

  // Fetch tenants with multi-bot connections to check if lookupIds are inside their JSON array
  const tenantsWithJson = await prisma.khachThue.findMany({
    where: { zaloChatIds: { not: require('@prisma/client').Prisma.DbNull } },
    select: { id: true, zaloChatIds: true }
  });
  
  const jsonMatchIds = tenantsWithJson.filter(kt => {
    try {
      const parsed = typeof kt.zaloChatIds === 'string' ? JSON.parse(kt.zaloChatIds) : kt.zaloChatIds;
      if (Array.isArray(parsed)) {
        return parsed.some((entry: any) => lookupIds.includes(entry.userId) || lookupIds.includes(entry.threadId));
      }
    } catch {}
    return false;
  }).map(kt => kt.id);

  const tenantRooms = await prisma.khachThue.findMany({
    where: {
      OR: [
        { zaloChatId: { in: lookupIds } },
        { pendingZaloChatId: { in: lookupIds } },
        ...(jsonMatchIds.length > 0 ? [{ id: { in: jsonMatchIds } }] : []),
      ],
    },
    select: {
      zaloChatId: true,
      pendingZaloChatId: true,
      zaloChatIds: true,
      hoTen: true,
      hopDong: {
        where: { trangThai: "hoatDong" },
        take: 1,
        select: {
          phong: {
            select: {
              maPhong: true,
              tang: true,
              toaNha: {
                select: { tenToaNha: true, diaChi: true },
              },
            },
          },
        },
      },
    },
  });

  const roomMap = new Map<string, ZaloRoomInfo>();
  for (const kt of tenantRooms) {
    const hd = kt.hopDong[0];
    if (!hd) continue;
    const info: ZaloRoomInfo = {
      tenKhach: kt.hoTen,
      maPhong: hd.phong.maPhong,
      tang: hd.phong.tang,
      tenToaNha: hd.phong.toaNha.tenToaNha,
      diaChi: hd.phong.toaNha.diaChi,
    };
    if (kt.zaloChatId) roomMap.set(kt.zaloChatId, info);
    if (kt.pendingZaloChatId) roomMap.set(kt.pendingZaloChatId, info);
    
    // Add multi-bot connection IDs from JSON array
    try {
      const parsed = typeof kt.zaloChatIds === 'string' ? JSON.parse(kt.zaloChatIds) : kt.zaloChatIds;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry.userId) roomMap.set(entry.userId, info);
          if (entry.threadId) roomMap.set(entry.threadId, info);
        }
      }
    } catch {}
  }

  return messages.map((message) => {
    const roomInfo = getLookupIds(message)
      .map((id) => roomMap.get(id))
      .find(Boolean);
    return roomInfo ? { ...message, roomInfo } : message;
  });
}
