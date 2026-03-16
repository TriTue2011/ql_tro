/**
 * GET /api/zalo/updates
 * Lấy danh sách tin nhắn gửi tới bot để tra cứu chat_id.
 * Nếu phát hiện chat_id khác với đã lưu → lưu vào pendingZaloChatId chờ xác nhận.
 * Dùng khi KHÔNG có webhook (long polling).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Chuẩn hóa tên để so sánh gần đúng (bỏ dấu, chữ thường, bỏ khoảng trắng thừa).
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phát hiện các chat_id mới từ updates và lưu vào pendingZaloChatId nếu khác với đã lưu.
 * - Khớp theo tên (gần đúng) với danh sách khách thuê.
 * - KHÔNG tự động ghi đè zaloChatId đã xác thực.
 * - Trả về danh sách các phát hiện mới.
 */
async function detectAndStorePendingChatIds(updates: any[]): Promise<{ detected: number; details: any[] }> {
  const details: any[] = [];

  // Thu thập tất cả sender từ updates
  const senders: Array<{ chatId: string; name: string }> = [];
  for (const update of updates) {
    const msg = update.message ?? update.edited_message;
    if (!msg?.from?.id) continue;
    const chatId = String(msg.from.id);
    const name = msg.from.first_name || msg.from.username || '';
    if (chatId && name) {
      senders.push({ chatId, name });
    }
  }

  if (senders.length === 0) return { detected: 0, details: [] };

  // Lấy tất cả khách thuê để so sánh
  const repo = await getKhachThueRepo();
  const allTenants = await repo.findMany({ limit: 1000 });

  for (const sender of senders) {
    const normalizedSenderName = normalizeName(sender.name);

    // Tìm khách thuê khớp tên gần đúng
    const matched = allTenants.data.find(kt =>
      normalizeName(kt.hoTen).includes(normalizedSenderName) ||
      normalizedSenderName.includes(normalizeName(kt.hoTen).split(' ').pop() ?? '')
    );

    if (!matched) continue;

    // Nếu chat_id này đã là zaloChatId chính thức → bỏ qua
    if (matched.zaloChatId === sender.chatId) continue;

    // Nếu chat_id này đã là pendingZaloChatId → bỏ qua (đã ghi nhận rồi)
    if (matched.pendingZaloChatId === sender.chatId) continue;

    // Lưu vào pendingZaloChatId để admin xem xét
    await repo.update(matched.id, { pendingZaloChatId: sender.chatId });
    details.push({
      khachThueId: matched.id,
      hoTen: matched.hoTen,
      soDienThoai: matched.soDienThoai,
      currentZaloChatId: matched.zaloChatId ?? null,
      pendingZaloChatId: sender.chatId,
      zaloName: sender.name,
    });
  }

  return { detected: details.length, details };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json({ error: 'Chưa cấu hình zalo_access_token' }, { status: 503 });
    }

    const response = await fetch(`https://bot-api.zapps.me/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout: 0 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const txt = await response.text();
      return NextResponse.json({ error: `Zalo API lỗi: ${response.status} — ${txt.slice(0, 200)}` }, { status: 502 });
    }

    const data = await response.json();
    const updates: any[] = Array.isArray(data?.result) ? data.result : [];

    // Phát hiện và lưu pending chat_ids (nếu có updates)
    const pendingInfo = updates.length > 0
      ? await detectAndStorePendingChatIds(updates)
      : { detected: 0, details: [] };

    return NextResponse.json({
      success: true,
      data,
      pendingDetected: pendingInfo.detected,
      pendingDetails: pendingInfo.details,
    });
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout khi gọi Zalo API' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
