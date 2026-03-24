/**
 * POST /api/zalo-bot/friend-request
 *
 * action: 'friendRequest' | 'sendMessage'
 *
 * friendRequest: Tìm SĐT → gửi lời kết bạn (max 150 ký tự)
 * sendMessage:   Tìm SĐT → gửi tin nhắn (max 2000 ký tự)
 *
 * Body chung: { phone, accountSelection? }
 * friendRequest thêm: { friendMsg }
 * sendMessage thêm:   { message }
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
const MAX_MSG = 2000;

/** Trích xuất userId từ response findUser — bot server có thể trả nhiều cấu trúc */
function extractUserId(d: any): string {
  if (!d || typeof d !== 'object') return '';
  const tryGet = (o: any) => o?.userId ?? o?.uid ?? o?.id ?? o?.user_id ?? '';
  return String(tryGet(d) || tryGet(d?.data) || tryGet(d?.user) || tryGet(d?.result) || '');
}

function extractUserName(d: any): string {
  if (!d || typeof d !== 'object') return '';
  const pick = (o: any) => o?.displayName ?? o?.display_name ?? o?.zaloName ?? o?.name ?? '';
  return String(pick(d) || pick(d?.data) || pick(d?.user) || pick(d?.result) || '');
}

/** Bước chung: tìm user bằng SĐT, trả về userId + userName */
async function resolveUser(phone: string, accountSelection?: string) {
  const steps: { step: string; ok: boolean; detail?: string }[] = [];
  const findResult = await findUserViaBotServer(phone, accountSelection);

  if (!findResult.ok || !findResult.data) {
    steps.push({ step: 'findUser', ok: false, detail: findResult.error ?? 'Không tìm thấy' });
    return { userId: '', userName: '', steps, rawData: null, error: `Không tìm thấy Zalo user cho SĐT ${phone}` };
  }

  const d = findResult.data as any;
  const userId = extractUserId(d);
  const userName = extractUserName(d);

  if (!userId) {
    steps.push({ step: 'findUser', ok: false, detail: `Không có userId: ${JSON.stringify(d).slice(0, 300)}` });
    return { userId: '', userName: '', steps, rawData: d, error: 'Tìm thấy nhưng không có userId' };
  }

  steps.push({ step: 'findUser', ok: true, detail: `userId=${userId}, name=${userName}` });
  return { userId, userName, steps, rawData: d, error: null };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !['admin', 'chuNha'].includes(session.user.role ?? '')) {
    return NextResponse.json({ ok: false, error: 'Không có quyền' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.phone) {
    return NextResponse.json({ ok: false, error: 'Cần nhập số điện thoại' }, { status: 400 });
  }

  const action = body.action ?? 'friendRequest';
  const { phone, accountSelection } = body as { phone: string; accountSelection?: string };

  // ── Action: Gửi lời kết bạn ──
  if (action === 'friendRequest') {
    const friendMsg = (body.friendMsg ?? '') as string;
    if (!friendMsg.trim()) {
      return NextResponse.json({ ok: false, error: 'Cần nhập nội dung lời mời kết bạn' }, { status: 400 });
    }
    if (friendMsg.length > MAX_FRIEND_MSG) {
      return NextResponse.json({
        ok: false,
        error: `Lời mời kết bạn tối đa ${MAX_FRIEND_MSG} ký tự (hiện ${friendMsg.length})`,
      }, { status: 400 });
    }

    try {
      const resolved = await resolveUser(phone, accountSelection);
      if (resolved.error) {
        return NextResponse.json({ ok: false, error: resolved.error, steps: resolved.steps, rawData: resolved.rawData });
      }

      const { userId, userName, steps } = resolved;

      // Kiểm tra đã là bạn
      const friendsResult = await getAllFriendsFromBotServer(accountSelection);
      const isFriend = friendsResult.ok && Array.isArray(friendsResult.friends) &&
        friendsResult.friends.some((f: any) => String(f.uid ?? f.id ?? f.userId ?? '') === userId);

      if (isFriend) {
        steps.push({ step: 'checkFriend', ok: true, detail: 'Đã là bạn bè rồi' });
        return NextResponse.json({ ok: true, alreadyFriend: true, userId, userName, steps, message: 'Đã là bạn bè rồi, không cần kết bạn' });
      }
      steps.push({ step: 'checkFriend', ok: true, detail: 'Chưa là bạn → gửi kết bạn' });

      const frResult = await sendFriendRequestViaBotServer(userId, friendMsg.trim(), accountSelection);
      steps.push({ step: 'sendFriendRequest', ok: frResult.ok, detail: frResult.ok ? 'Đã gửi lời kết bạn' : frResult.error });

      return NextResponse.json({
        ok: frResult.ok,
        userId, userName, steps,
        message: frResult.ok ? 'Đã gửi lời kết bạn thành công' : frResult.error,
      });
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error?.message ?? 'Lỗi không xác định' }, { status: 500 });
    }
  }

  // ── Action: Gửi tin nhắn sau kết bạn ──
  if (action === 'sendMessage') {
    const message = (body.message ?? '') as string;
    if (!message.trim()) {
      return NextResponse.json({ ok: false, error: 'Cần nhập nội dung tin nhắn' }, { status: 400 });
    }
    if (message.length > MAX_MSG) {
      return NextResponse.json({ ok: false, error: `Tin nhắn tối đa ${MAX_MSG} ký tự` }, { status: 400 });
    }

    try {
      const resolved = await resolveUser(phone, accountSelection);
      if (resolved.error) {
        return NextResponse.json({ ok: false, error: resolved.error, steps: resolved.steps, rawData: resolved.rawData });
      }

      const { userId, userName, steps } = resolved;

      const msgResult = await sendMessageViaBotServer(userId, message.trim(), 0, accountSelection);
      steps.push({ step: 'sendMessage', ok: msgResult.ok, detail: msgResult.ok ? 'Đã gửi tin nhắn' : (msgResult.error ?? 'Có thể chưa accept kết bạn') });

      return NextResponse.json({
        ok: msgResult.ok,
        userId, userName, steps,
        message: msgResult.ok ? 'Đã gửi tin nhắn thành công' : (msgResult.error ?? 'Gửi tin nhắn thất bại'),
      });
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error?.message ?? 'Lỗi không xác định' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: `action không hợp lệ: ${action}` }, { status: 400 });
}
