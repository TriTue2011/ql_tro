/**
 * POST /api/zalo-bot/set-webhook
 * Cài đặt webhook trên bot server cho tài khoản của user đang đăng nhập.
 * Body: { ownId?: string }
 * Mở cho tất cả role có zaloAccountId.
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

  const config = await getBotConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình zalo_bot_server_url' });
  }

  // Base URL: bắt buộc dùng app_local_url (IP LAN) — bot server cùng mạng LAN
  const localBase = await getLocalBaseUrl();
  if (!localBase) {
    return NextResponse.json({
      ok: false,
      error: 'Chưa cấu hình app_local_url trong Cài đặt. Cần IP LAN của ứng dụng (VD: http://172.16.10.27:3000)',
    });
  }

  const body = await request.json().catch(() => ({}));

  // Xác định ownId: body > user's zaloAccountId > config
  const currentUser = await prisma.nguoiDung.findUnique({
    where: { id: session.user.id },
    select: { zaloAccountId: true, zaloChatId: true, soDienThoai: true },
  });

  let ownId: string = body?.ownId || currentUser?.zaloAccountId || config.accountId || '';

  // Resolve ownId → numeric Zalo ID (không dùng SĐT)
  let accounts: any[] = [];
  try {
    const result = await getAccountsFromBotServer();
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
      } else if (!ownId && currentUser?.soDienThoai) {
        // Thử match theo SĐT của user
        const userPhone = currentUser.soDienThoai.replace(/\D/g, '');
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

  // Webhook URL riêng cho user này (per-nguoiDung)
  const webhookUrl = `${localBase}/api/zalo/webhook/${session.user.id}`;

  // Cài webhook chỉ cho tài khoản của user đang đăng nhập
  const result = await setWebhookOnBotServer(ownId, webhookUrl, webhookUrl, webhookUrl);

  if (result.ok) {
    // Cập nhật zaloAccountId cho user
    await prisma.nguoiDung.update({
      where: { id: session.user.id },
      data: {
        zaloAccountId: ownId,
        ...(currentUser?.zaloChatId ? {} : { zaloChatId: ownId }),
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
          id: { not: session.user.id },
          zaloAccountId: null,
        },
        data: { zaloAccountId: ownId, zaloChatId: ownId },
      }).catch(() => {});
    }

    // Dọn webhook cũ: xóa webhook của account không còn trên server
    try {
      const allWh = await getAccountWebhooksFromBotServer();
      const whAccounts: Record<string, any> = allWh.ok && allWh.data
        ? (allWh.data.accounts ?? allWh.data.data?.accounts ?? {})
        : {};
      const activeOwnIds = new Set(accounts.map((a: any) => String(a.id ?? a.ownId)));
      const activePhones = new Set(accounts.map((a: any) => a.phoneNumber || a.phone || '').filter(Boolean));

      for (const key of Object.keys(whAccounts)) {
        if (!activeOwnIds.has(key) && !activePhones.has(key)) {
          // Webhook cho account không còn tồn tại → xóa
          await deleteAccountWebhookFromBotServer(key).catch(() => {});
        }
      }
    } catch { /* bỏ qua */ }
  }

  return NextResponse.json({ ...result, webhookUrl, ownId });
}
