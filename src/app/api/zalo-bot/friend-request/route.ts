/**
 * POST /api/zalo-bot/friend-request
 * Công cụ kết bạn: tìm user bằng SĐT → gửi lời kết bạn → gửi tin nhắn sau kết bạn.
 *
 * Body: {
 *   phone: string           — SĐT người nhận
 *   friendMsg: string       — Nội dung lời mời kết bạn (max 150 ký tự)
 *   followUpMsg?: string    — Tin nhắn gửi sau khi kết bạn (max 2000 ký tự)
 *   accountSelection?: string — Bot account ID / SĐT bot
 * }
 *
 * GET /api/zalo-bot/friend-request/template
 * → xem route template bên dưới
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  findUserViaBotServer,
  sendFriendRequestViaBotServer,
  sendMessageViaBotServer,
  getAllFriendsFromBotServer,
} from '@/lib/zalo-bot-client';

const MAX_FRIEND_MSG = 150;
const MAX_FOLLOW_UP = 2000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !['admin', 'chuNha'].includes(session.user.role ?? '')) {
    return NextResponse.json({ ok: false, error: 'Không có quyền' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.phone) {
    return NextResponse.json({ ok: false, error: 'Cần nhập số điện thoại' }, { status: 400 });
  }

  const { phone, friendMsg, followUpMsg, accountSelection } = body as {
    phone: string;
    friendMsg: string;
    followUpMsg?: string;
    accountSelection?: string;
  };

  if (!friendMsg?.trim()) {
    return NextResponse.json({ ok: false, error: 'Cần nhập nội dung lời mời kết bạn' }, { status: 400 });
  }

  if (friendMsg.length > MAX_FRIEND_MSG) {
    return NextResponse.json({
      ok: false,
      error: `Lời mời kết bạn tối đa ${MAX_FRIEND_MSG} ký tự (hiện ${friendMsg.length})`,
    }, { status: 400 });
  }

  if (followUpMsg && followUpMsg.length > MAX_FOLLOW_UP) {
    return NextResponse.json({
      ok: false,
      error: `Tin nhắn sau kết bạn tối đa ${MAX_FOLLOW_UP} ký tự`,
    }, { status: 400 });
  }

  const steps: { step: string; ok: boolean; detail?: string }[] = [];

  try {
    // 1. Tìm user bằng SĐT
    const findResult = await findUserViaBotServer(phone, accountSelection);
    if (!findResult.ok || !findResult.data) {
      steps.push({ step: 'findUser', ok: false, detail: findResult.error ?? 'Không tìm thấy' });
      return NextResponse.json({ ok: false, error: `Không tìm thấy Zalo user cho SĐT ${phone}`, steps });
    }

    const d = findResult.data as any;
    const userId = String(d.userId ?? d.uid ?? d.id ?? '');
    const userName = String(d.displayName ?? d.display_name ?? d.zaloName ?? '');
    if (!userId) {
      steps.push({ step: 'findUser', ok: false, detail: 'Không có userId trong response' });
      return NextResponse.json({ ok: false, error: 'Tìm thấy nhưng không có userId', steps });
    }
    steps.push({ step: 'findUser', ok: true, detail: `userId=${userId}, name=${userName}` });

    // 2. Kiểm tra đã là bạn chưa
    const friendsResult = await getAllFriendsFromBotServer(accountSelection);
    const isFriend = friendsResult.ok && Array.isArray(friendsResult.friends) &&
      friendsResult.friends.some((f: any) => String(f.uid ?? f.id ?? f.userId ?? '') === userId);

    if (isFriend) {
      steps.push({ step: 'checkFriend', ok: true, detail: 'Đã là bạn bè' });
      // Đã là bạn → chỉ gửi tin nhắn nếu có
      if (followUpMsg?.trim()) {
        const msgResult = await sendMessageViaBotServer(userId, followUpMsg.trim(), 0, accountSelection);
        steps.push({ step: 'sendMessage', ok: msgResult.ok, detail: msgResult.ok ? 'Đã gửi' : msgResult.error });
      }
      return NextResponse.json({
        ok: true,
        alreadyFriend: true,
        userId,
        userName,
        steps,
        message: 'Đã là bạn bè' + (followUpMsg?.trim() ? ', đã gửi tin nhắn' : ''),
      });
    }

    steps.push({ step: 'checkFriend', ok: true, detail: 'Chưa là bạn → gửi kết bạn' });

    // 3. Gửi lời kết bạn
    const frResult = await sendFriendRequestViaBotServer(userId, friendMsg.trim(), accountSelection);
    steps.push({ step: 'sendFriendRequest', ok: frResult.ok, detail: frResult.ok ? 'Đã gửi lời kết bạn' : frResult.error });

    // 4. Gửi tin nhắn sau kết bạn (có thể fail nếu chưa accept)
    if (followUpMsg?.trim()) {
      try {
        const msgResult = await sendMessageViaBotServer(userId, followUpMsg.trim(), 0, accountSelection);
        steps.push({ step: 'sendFollowUp', ok: msgResult.ok, detail: msgResult.ok ? 'Đã gửi' : (msgResult.error ?? 'Có thể chưa accept') });
      } catch {
        steps.push({ step: 'sendFollowUp', ok: false, detail: 'Chưa accept kết bạn nên không gửi được (bình thường)' });
      }
    }

    return NextResponse.json({
      ok: frResult.ok,
      userId,
      userName,
      steps,
      message: frResult.ok ? 'Đã gửi lời kết bạn thành công' : frResult.error,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message ?? 'Lỗi không xác định',
      steps,
    }, { status: 500 });
  }
}
