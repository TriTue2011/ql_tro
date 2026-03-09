import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(9, 'Số điện thoại không hợp lệ'),
  message: z.string().min(1, 'Tin nhắn không được trống'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const { phone, message } = parsed.data;

    const zaloBotUrl = process.env.ZALO_BOT_URL;
    const zaloBotAccount = process.env.ZALO_BOT_ACCOUNT;

    if (!zaloBotUrl) {
      return NextResponse.json(
        { success: false, message: 'Chưa cấu hình ZALO_BOT_URL trong .env' },
        { status: 503 }
      );
    }

    // Chuẩn hoá số điện thoại: 0xxx -> +84xxx
    const normalizedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone.startsWith('84')
      ? '+' + phone
      : phone;

    const payload = {
      type: '1',
      thread_id: normalizedPhone,
      account_selection: zaloBotAccount || '',
      message,
    };

    const response = await fetch(`${zaloBotUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zalo Bot error:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: `Zalo Bot lỗi: ${response.status}` },
        { status: 502 }
      );
    }

    const result = await response.json().catch(() => ({}));
    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn Zalo thành công', data: result });
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return NextResponse.json(
        { success: false, message: 'Zalo Bot không phản hồi (timeout). Kiểm tra server có đang chạy không.' },
        { status: 504 }
      );
    }
    console.error('Error sending Zalo message:', error);
    return NextResponse.json({ success: false, message: 'Lỗi khi gửi tin nhắn Zalo' }, { status: 500 });
  }
}
