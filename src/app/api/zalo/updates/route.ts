/**
 * GET /api/zalo/updates
 * Lấy tin nhắn mới nhất gửi tới bot để tra cứu chat_id.
 * Nếu phát hiện chat_id khác với đã lưu → lưu vào pendingZaloChatId chờ xác nhận.
 * Dùng khi KHÔNG có webhook (polling thủ công).
 *
 * Zalo Bot API: getUpdates trả về 1 update object (không phải array):
 *   result.message.from.id          → chat_id
 *   result.message.from.display_name → tên hiển thị
 *   result.event_name               → loại sự kiện
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';

const ZALO_API = 'https://bot-api.zaloplatforms.com';

async function getZaloToken(): Promise<string | null> {
  try {
    const s = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return s?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

/** Chuẩn hóa tên để so sánh gần đúng (bỏ dấu, chữ thường). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phát hiện chat_id từ một update và lưu vào pendingZaloChatId nếu khác với đã lưu.
 * - Khớp theo display_name (gần đúng) với danh sách khách thuê.
 * - KHÔNG tự động ghi đè zaloChatId đã xác thực.
 */
async function detectAndStorePending(update: any): Promise<{ detected: number; details: any[] }> {
  const msg = update?.message;
  if (!msg?.from?.id) return { detected: 0, details: [] };

  const chatId = String(msg.from.id);
  // Zalo Bot API dùng display_name, không phải first_name
  const displayName: string = msg.from.display_name || '';
  if (!displayName) return { detected: 0, details: [] };

  const repo = await getKhachThueRepo();
  const allTenants = await repo.findMany({ limit: 1000 });

  const normalizedSender = normalizeName(displayName);

  // Tìm khách thuê khớp tên (so sánh tên đầy đủ hoặc họ/tên cuối)
  const matched = allTenants.data.find(kt => {
    const normalizedKt = normalizeName(kt.hoTen);
    const lastWordKt = normalizedKt.split(' ').pop() ?? '';
    return normalizedKt === normalizedSender ||
      normalizedSender.includes(lastWordKt) ||
      normalizedKt.includes(normalizedSender);
  });

  if (!matched) return { detected: 0, details: [] };
  // Đã là chat_id chính thức rồi
  if (matched.zaloChatId === chatId) return { detected: 0, details: [] };
  // Đã là pending rồi
  if (matched.pendingZaloChatId === chatId) return { detected: 0, details: [] };

  await repo.update(matched.id, { pendingZaloChatId: chatId });

  return {
    detected: 1,
    details: [{
      khachThueId: matched.id,
      hoTen: matched.hoTen,
      soDienThoai: matched.soDienThoai,
      currentZaloChatId: matched.zaloChatId ?? null,
      pendingZaloChatId: chatId,
      zaloDisplayName: displayName,
    }],
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json({ error: 'Chưa cấu hình zalo_access_token' }, { status: 503 });
    }

    const response = await fetch(`${ZALO_API}/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout: 30 }),
      signal: AbortSignal.timeout(40000),
    });

    if (!response.ok) {
      const txt = await response.text();
      return NextResponse.json(
        { error: `Zalo API lỗi: ${response.status} — ${txt.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // result là một object update đơn (không phải array)
    const update = data?.result ?? null;
    const pendingInfo = update?.message
      ? await detectAndStorePending(update)
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
