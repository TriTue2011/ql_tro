/**
 * POST /api/zalo-bot/set-webhook
 * Cài đặt webhook trên bot server cho tài khoản đang được trỏ tới.
 * Body: { ownId?: string, targetUserId?: string }
 *   - targetUserId: ID của NguoiDung cần cài webhook (admin dùng khi xem tài khoản người khác)
 *   - ownId: Zalo Account ID (nếu không truyền, lấy từ targetUser hoặc user đang đăng nhập)
 * Ưu tiên dùng config Bot Server riêng của target user (zaloBotServerUrl), fallback sang global config.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  setWebhookOnBotServer,
  getBotConfig,
  getAccountsFromBotServer,
  deleteAccountWebhookFromBotServer,
  getAccountWebhooksFromBotServer,
  BotConfig,
} from '@/lib/zalo-bot-client';
import prisma from '@/lib/prisma';

async function getLocalBaseUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'app_local_url' } });
    const val = row?.giaTri?.trim();
    return val ? val.replace(/\/$/, '') : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // targetUserId: admin đang xem tài khoản của người khác → cài webhook cho người đó
  const targetUserId: string = body?.targetUserId || session.user.id;

  const targetUser = await prisma.nguoiDung.findUnique({
    where: { id: targetUserId },
    select: {
      id: true, zaloAccountId: true, zaloChatId: true, soDienThoai: true,
      zaloBotServerUrl: true, zaloBotUsername: true, zaloBotPassword: true, zaloBotTtl: true,
    },
  });
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: 'Không tìm thấy người dùng' });
  }

  // Ưu tiên config Bot Server riêng của target user, fallback sang global
  let botConfig: BotConfig | null = null;
  if (targetUser.zaloBotServerUrl) {
    botConfig = {
      serverUrl: targetUser.zaloBotServerUrl.replace(/\/$/, ''),
      username: targetUser.zaloBotUsername || 'admin',
      password: targetUser.zaloBotPassword || 'admin',
      accountId: targetUser.zaloAccountId || '',
      ttl: targetUser.zaloBotTtl ?? 0,
    };
  } else {
    botConfig = await getBotConfig();
  }

  if (!botConfig) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình Bot Server (cả riêng lẫn hệ thống)' });
  }

  // Base URL: bắt buộc dùng app_local_url (IP LAN) — bot server cùng mạng LAN
  const localBase = await getLocalBaseUrl();
  if (!localBase) {
    return NextResponse.json({
      ok: false,
      error: 'Chưa cấu hình app_local_url trong Cài đặt. Cần IP LAN của ứng dụng (VD: http://172.16.10.27:3000)',
    });
  }

  let ownId: string = body?.ownId || targetUser.zaloAccountId || botConfig.accountId || '';

  // Resolve ownId → numeric Zalo ID (không dùng SĐT)
  let accounts: any[] = [];
  try {
    const result = await getAccountsFromBotServer(botConfig);
    accounts = result.accounts;
    if (accounts.length > 0) {
      const match = accounts.find((a: any) =>
        a.id === ownId || a.ownId === ownId ||
        a.phoneNumber === ownId || a.phone === ownId ||
        a.phoneNumber?.replace(/\D/g, '') === ownId.replace(/\D/g, '') ||
        a.phone?.replace(/\D/g, '') === ownId.replace(/\D/g, '')
      );
      if (match) {
        ownId = String(match.id ?? match.ownId ?? ownId);
      } else if (!ownId && targetUser.soDienThoai) {
        const userPhone = targetUser.soDienThoai.replace(/\D/g, '');
        const phoneMatch = accounts.find((a: any) =>
          (a.phoneNumber || a.phone || '').replace(/\D/g, '') === userPhone
        );
        if (phoneMatch) {
          ownId = String(phoneMatch.id ?? phoneMatch.ownId);
        }
      }
    }
  } catch { /* bỏ qua */ }

  if (!ownId) {
    return NextResponse.json({
      ok: false,
      error: 'Không xác định được tài khoản Zalo. Kiểm tra zaloAccountId hoặc SĐT trong hồ sơ.',
    });
  }

  // Webhook URL riêng cho target user (per-nguoiDung)
  const webhookUrl = `${localBase}/api/zalo/webhook/${targetUser.id}`;

  // Cài webhook trên bot server của target user
  const result = await setWebhookOnBotServer(ownId, webhookUrl, webhookUrl, webhookUrl, botConfig);

  if (result.ok) {
    // Cập nhật zaloAccountId cho target user
    await prisma.nguoiDung.update({
      where: { id: targetUser.id },
      data: {
        zaloAccountId: ownId,
        ...(targetUser.zaloChatId ? {} : { zaloChatId: ownId }),
      },
    }).catch(() => {});

    // Auto-link zaloAccountId cho user khác cùng SĐT (nếu chưa có)
    const matchedAcc = accounts.find((a: any) => String(a.id ?? a.ownId) === ownId);
    const accPhone = matchedAcc?.phoneNumber || matchedAcc?.phone || '';
    if (accPhone) {
      const phoneVariants = [accPhone, accPhone.replace(/^\+84/, '0'), accPhone.replace(/^0/, '+84')];
      await prisma.nguoiDung.updateMany({
        where: {
          soDienThoai: { in: phoneVariants },
          id: { not: targetUser.id },
          zaloAccountId: null,
        },
        data: { zaloAccountId: ownId, zaloChatId: ownId },
      }).catch(() => {});
    }

    // Dọn webhook cũ: xóa webhook của account không còn trên server
    try {
      const allWh = await getAccountWebhooksFromBotServer(botConfig);
      const whAccounts: Record<string, any> = allWh.ok && allWh.data
        ? (allWh.data.accounts ?? allWh.data.data?.accounts ?? {})
        : {};
      const activeOwnIds = new Set(accounts.map((a: any) => String(a.id ?? a.ownId)));
      const activePhones = new Set(accounts.map((a: any) => a.phoneNumber || a.phone || '').filter(Boolean));

      for (const key of Object.keys(whAccounts)) {
        if (!activeOwnIds.has(key) && !activePhones.has(key)) {
          await deleteAccountWebhookFromBotServer(key, botConfig).catch(() => {});
        }
      }
    } catch { /* bỏ qua */ }
  }

  return NextResponse.json({ ...result, webhookUrl, ownId });
}
