import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(9, 'Số điện thoại không hợp lệ').optional(),
  chatId: z.string().min(1).optional(),
  nguoiDungId: z.string().min(1).optional(), // ID của NguoiDung (chủ trọ/admin)
  phongId: z.string().min(1).optional(),     // Phòng liên quan → tự động notify chủ trọ toà nhà
  message: z.string().min(1, 'Tin nhắn không được trống').max(2000).optional(),
  imageUrl: z.string().url('URL hình ảnh không hợp lệ').optional(),
}).refine(d => d.phone || d.chatId || d.nguoiDungId, { message: 'Cần cung cấp phone, chatId hoặc nguoiDungId' })
  .refine(d => d.message || d.imageUrl, { message: 'Cần cung cấp message hoặc imageUrl' });

const ZALO_API = 'https://bot-api.zaloplatforms.com';

/** Lấy Zalo Bot Token từ cài đặt hệ thống */
async function getZaloToken(): Promise<string | null> {
  try {
    const setting = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_access_token' } });
    return setting?.giaTri?.trim() || null;
  } catch {
    return null;
  }
}

/** Tra cứu zaloChatId của khách thuê từ số điện thoại (chỉ khi bật nhận thông báo) */
async function resolveChatIdKhachThue(phone: string): Promise<{ chatId: string | null; disabled?: boolean }> {
  try {
    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);
    if (!kt) return { chatId: null };
    if (!kt.nhanThongBaoZalo) return { chatId: null, disabled: true };
    return { chatId: kt.zaloChatId ?? null };
  } catch {
    return { chatId: null };
  }
}

/**
 * Gửi bản sao thông báo cho chủ trọ của toà nhà chứa phòng đó.
 * Chỉ gửi nếu chủ trọ đã bật nhanThongBaoZalo và có zaloChatId.
 * Lỗi không ảnh hưởng đến kết quả chính.
 */
async function notifyChuNha(token: string, phongId: string, originalMessage: string): Promise<void> {
  try {
    const phong = await prisma.phong.findUnique({
      where: { id: phongId },
      select: {
        maPhong: true,
        toaNha: {
          select: {
            tenToaNha: true,
            chuSoHuu: { select: { id: true, ten: true, zaloChatId: true, nhanThongBaoZalo: true } },
          },
        },
      },
    });

    const chuNha = phong?.toaNha?.chuSoHuu;
    if (!chuNha?.zaloChatId || !chuNha.nhanThongBaoZalo) return;

    const prefix = `📋 [Thông báo phòng ${phong!.maPhong} - ${phong!.toaNha.tenToaNha}]\n`;
    const ownerMsg = (prefix + originalMessage).slice(0, 2000);
    await sendZaloMessage(token, chuNha.zaloChatId, ownerMsg);
  } catch {
    // Không fail main request vì lỗi notify chủ trọ
  }
}

/** Tra cứu zaloChatId của NguoiDung (chủ trọ/admin/nhân viên) từ ID */
async function resolveChatIdNguoiDung(nguoiDungId: string): Promise<{ chatId: string | null; disabled?: boolean }> {
  try {
    const nd = await prisma.nguoiDung.findUnique({
      where: { id: nguoiDungId },
      select: { zaloChatId: true, nhanThongBaoZalo: true },
    });
    if (!nd) return { chatId: null };
    if (!nd.nhanThongBaoZalo) return { chatId: null, disabled: true };
    return { chatId: nd.zaloChatId ?? null };
  } catch {
    return { chatId: null };
  }
}

/** Gửi tin nhắn văn bản qua Zalo Bot */
async function sendZaloMessage(token: string, chatId: string, text: string) {
  const truncated = text.length > 2000 ? text.slice(0, 1997) + '...' : text;
  return fetch(`${ZALO_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: truncated }),
    signal: AbortSignal.timeout(10000),
  });
}

/** Gửi hình ảnh qua Zalo Bot */
async function sendZaloPhoto(token: string, chatId: string, imageUrl: string, caption?: string) {
  const body: any = { chat_id: chatId, photo: imageUrl };
  if (caption) body.caption = caption.slice(0, 1024);
  return fetch(`${ZALO_API}/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
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

    const { phone, chatId: explicitChatId, nguoiDungId, phongId, message, imageUrl } = parsed.data;

    const token = await getZaloToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Chưa cấu hình Zalo Bot Token trong Cài đặt hệ thống (zalo_access_token)' },
        { status: 503 }
      );
    }

    // Resolve chat_id theo thứ tự ưu tiên: trực tiếp → khách thuê theo SĐT → người dùng theo ID
    let chatId = explicitChatId ?? null;
    if (!chatId && phone) {
      const result = await resolveChatIdKhachThue(phone);
      if (result.disabled) {
        return NextResponse.json(
          { success: false, message: `Khách thuê số ${phone} đã tắt nhận thông báo Zalo.` },
          { status: 422 }
        );
      }
      chatId = result.chatId;
      if (!chatId) {
        return NextResponse.json(
          { success: false, message: `Chưa liên kết Zalo Chat ID cho số ${phone}. Vui lòng cập nhật trong hồ sơ khách thuê.` },
          { status: 422 }
        );
      }
    }
    if (!chatId && nguoiDungId) {
      const result = await resolveChatIdNguoiDung(nguoiDungId);
      if (result.disabled) {
        return NextResponse.json(
          { success: false, message: `Người dùng đã tắt nhận thông báo Zalo.` },
          { status: 422 }
        );
      }
      chatId = result.chatId;
      if (!chatId) {
        return NextResponse.json(
          { success: false, message: `Người dùng chưa liên kết Zalo Chat ID. Vui lòng cập nhật trong hồ sơ.` },
          { status: 422 }
        );
      }
    }
    if (!chatId) {
      return NextResponse.json({ success: false, message: 'Thiếu chatId' }, { status: 422 });
    }

    // Gửi hình ảnh (có thể kèm caption là message)
    if (imageUrl) {
      const response = await sendZaloPhoto(token, chatId, imageUrl, message);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Zalo API sendPhoto error:', response.status, errorText);
        return NextResponse.json(
          { success: false, message: `Zalo API lỗi khi gửi ảnh: ${response.status} — ${errorText.slice(0, 100)}` },
          { status: 502 }
        );
      }
      const result = await response.json().catch(() => ({}));
      if (phongId && message) notifyChuNha(token, phongId, message);
      return NextResponse.json({ success: true, message: 'Đã gửi hình ảnh Zalo thành công', data: result });
    }

    // Gửi tin nhắn văn bản
    const response = await sendZaloMessage(token, chatId, message!);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zalo API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: `Zalo API lỗi: ${response.status} — ${errorText.slice(0, 100)}` },
        { status: 502 }
      );
    }

    const result = await response.json().catch(() => ({}));
    if (phongId) notifyChuNha(token, phongId, message!);
    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn Zalo thành công', data: result });
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return NextResponse.json(
        { success: false, message: 'Zalo API không phản hồi (timeout).' },
        { status: 504 }
      );
    }
    console.error('Error sending Zalo message:', error);
    return NextResponse.json({ success: false, message: 'Lỗi khi gửi tin nhắn Zalo' }, { status: 500 });
  }
}
