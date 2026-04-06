/**
 * GET /api/zalo/user-info?chatId=XXX&account=YYY
 *
 * Trả về thông tin user từ getUserInfo + SĐT đã chuẩn hóa.
 * Cho phép admin, chủ trọ, quản lý sử dụng.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserInfoViaBotServer } from '@/lib/zalo-bot-client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chatId = req.nextUrl.searchParams.get('chatId');
  const account = req.nextUrl.searchParams.get('account') || undefined;

  if (!chatId) {
    return NextResponse.json({ error: 'Thiếu chatId' }, { status: 400 });
  }

  try {
    const info = await getUserInfoViaBotServer(chatId, account);

    if (!info.ok) {
      return NextResponse.json({ ok: false, error: info.error }, { status: 500 });
    }

    // Parse changed_profiles
    const d = info.data as any;
    const profile = d?.changed_profiles?.[chatId] ?? d;

    let phone = profile?.phoneNumber || profile?.phone || '';
    let phoneChuanHoa = '';
    if (phone) {
      phoneChuanHoa = phone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
    }

    return NextResponse.json({
      ok: true,
      raw: info.data,
      parsed: {
        userId: profile?.userId ?? chatId,
        displayName: profile?.displayName ?? null,
        zaloName: profile?.zaloName ?? null,
        phoneNumber: phone || null,
        phoneChuanHoa: phoneChuanHoa || null,
        avatar: profile?.avatar ?? null,
        isFriend: profile?.isFr ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
