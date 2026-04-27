/**
 * zalo-group-auto-match.ts
 *
 * Khi bot nhận được tin nhắn nhóm, tự động đối chiếu tên nhóm
 * với danh sách nhóm đã cài đặt trong zaloNhomChat của các tòa nhà,
 * rồi ghi threadId vào đúng slot botAccountId nếu chưa có.
 *
 * Dùng chung cho cả Bot Server Mode (webhook/route.ts) và Direct Mode (events.ts).
 * Fire-and-forget — gọi không cần await.
 */

import prisma from '@/lib/prisma';

/**
 * So sánh tên nhóm (case-insensitive, normalize dấu cách).
 * Chấp nhận khớp chính xác hoặc chuỗi này chứa trong chuỗi kia.
 */
function groupNameMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Tự động gán threadId của nhóm vào zaloNhomChat của tòa nhà khi tên khớp.
 *
 * @param threadId    - chatId của nhóm (từ tin nhắn đến)
 * @param groupName   - tên nhóm (đã được resolve từ CaiDat hoặc API)
 * @param botAccountId - ownId của tài khoản bot đang nhận tin nhắn
 */
export async function autoMatchGroupThread(
  threadId: string,
  groupName: string,
  botAccountId: string,
): Promise<void> {
  if (!threadId || !groupName || !botAccountId) return;

  try {
    // Lấy tất cả tòa nhà có cấu hình nhóm Zalo
    const buildings = await prisma.toaNha.findMany({
      where: { zaloNhomChat: { not: null } },
      select: { id: true, zaloNhomChat: true },
    });

    for (const b of buildings) {
      const groups: any[] = Array.isArray(b.zaloNhomChat) ? b.zaloNhomChat as any[] : [];
      if (groups.length === 0) continue;

      let changed = false;
      const updated = groups.map((g: any) => {
        // Kiểm tra tên có khớp không
        if (!g.name || !groupNameMatch(g.name, groupName)) return g;

        // Kiểm tra xem threadId cho botAccountId này đã đúng chưa
        const currentId = g.threadIds?.[botAccountId];
        if (currentId === threadId) return g; // đã đúng, không cần cập nhật

        console.log(
          `[zalo-group-auto-match] Tòa nhà ${b.id}: nhóm "${g.name}" → threadId=${threadId} (bot=${botAccountId})`,
        );

        changed = true;
        return {
          ...g,
          threadIds: {
            ...(g.threadIds || {}),
            [botAccountId]: threadId,
          },
        };
      });

      if (changed) {
        await prisma.toaNha.update({
          where: { id: b.id },
          data: { zaloNhomChat: updated as any },
        });
      }
    }
  } catch (err) {
    console.error('[zalo-group-auto-match] Lỗi:', err);
  }
}
