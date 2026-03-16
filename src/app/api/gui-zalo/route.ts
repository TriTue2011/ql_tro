import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(9, 'Số điện thoại không hợp lệ').optional(),
  chatId: z.string().min(1).optional(),
  message: z.string().min(1, 'Tin nhắn không được trống').max(2000),
}).refine(d => d.phone || d.chatId, { message: 'Cần cung cấp phone hoặc chatId' });

/** Lấy Zalo Bot Token từ cài đặt hệ thống */
async function getZaloToken(): Promise<string | null> {
  try {
    const setting = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return setting?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

/** Tra cứu zaloChatId từ số điện thoại */
async function resolveChatId(phone: string): Promise<string | null> {
  try {
    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);
    return kt?.zaloChatId ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' },
        { status: 400 }
      );
    }

    const { phone, chatId: explicitChatId, message } = parsed.data;

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Chưa cấu hình Zalo Bot Token trong Cài đặt hệ thống (zalo_access_token)' },
        { status: 503 }
      );
    }

    // Resolve chat_id: ưu tiên truyền trực tiếp, rồi tra DB theo phone
    let chatId = explicitChatId ?? null;
    if (!chatId && phone) {
      chatId = await resolveChatId(phone);
    }
    if (!chatId) {
      return NextResponse.json(
        {
          success: false,
          message: phone
            ? `Chưa liên kết Zalo Chat ID cho số ${phone}. Vui lòng cập nhật trong hồ sơ khách thuê.`
            : 'Thiếu chatId',
        },
        { status: 422 }
      );
    }

    const text = message.length > 2000 ? message.slice(0, 1997) + '...' : message;

    const response = await fetch(`https://bot-api.zapps.me/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zalo API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: `Zalo API lỗi: ${response.status} — ${errorText.slice(0, 100)}` },
        { status: 502 }
      );
    }

    const result = await response.json().catch(() => ({}));
    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn Zalo thành công', data: result });
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return NextResponse.json(
        { success: false, message: 'Zalo API không phản hồi (timeout 10s).' },
        { status: 504 }
      );
    }
    console.error('Error sending Zalo message:', error);
    return NextResponse.json({ success: false, message: 'Lỗi khi gửi tin nhắn Zalo' }, { status: 500 });
  }
}
