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

  const tenantRooms = await prisma.khachThue.findMany({
    where: {
      OR: [
        { zaloChatId: { in: lookupIds } },
        { pendingZaloChatId: { in: lookupIds } },
      ],
    },
    select: {
      zaloChatId: true,
      pendingZaloChatId: true,
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
  }

  return messages.map((message) => {
    const roomInfo = getLookupIds(message)
      .map((id) => roomMap.get(id))
      .find(Boolean);
    return roomInfo ? { ...message, roomInfo } : message;
  });
}
