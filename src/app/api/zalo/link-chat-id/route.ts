/**
 * POST /api/zalo/link-chat-id
 * Liên kết zaloChatId với số điện thoại của khách thuê.
 * Body: { phone: string, chatId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const schema = z.object({
  phone: z.string().min(9, 'Số điện thoại không hợp lệ'),
  chatId: z.string().min(1, 'chatId không được trống').max(64),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'chuNha'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { phone, chatId } = parsed.data;

    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);
    if (!kt) {
      return NextResponse.json({ error: `Không tìm thấy khách thuê với SĐT ${phone}` }, { status: 404 });
    }

    const updated = await repo.update(kt.id, { zaloChatId: sanitizeText(chatId) });
    if (!updated) {
      return NextResponse.json({ error: 'Cập nhật thất bại' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Đã liên kết Zalo Chat ID cho ${kt.hoTen}` });
  } catch (error) {
    console.error('Error linking Zalo chat ID:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

/**
 * GET /api/zalo/link-chat-id?phone=xxx
 * Tra cứu zaloChatId theo số điện thoại
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'chuNha'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const phone = new URL(request.url).searchParams.get('phone');
    if (!phone) return NextResponse.json({ error: 'Thiếu phone' }, { status: 400 });

    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);
    if (!kt) return NextResponse.json({ error: 'Không tìm thấy khách thuê' }, { status: 404 });

    return NextResponse.json({
      success: true,
      phone: kt.soDienThoai,
      hoTen: kt.hoTen,
      zaloChatId: kt.zaloChatId ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
