/**
 * POST /api/zalo-bot/auto-setup
 *
 * Tự động thiết lập sau khi quét QR đăng nhập lần đầu:
 * 1. Tìm tài khoản mới trên bot server (match theo SĐT)
 * 2. Tạo webhook token nếu chưa có
 * 3. Cài webhook lên bot server
 * 4. Cập nhật zaloAccountId
 * 5. Nếu là quản lý → tự động cấp quyền (quyenKichHoatTaiKhoan) cho tất cả tòa nhà
 *
 * Body: { targetUserId?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAccountsFromBotServer,
  setWebhookOnBotServer,
  getBotConfig,
  BotConfig,
} from '@/lib/zalo-bot-client';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

async function getLocalBaseUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'app_local_url' } });
    const val = row?.giaTri?.trim();
    return val ? val.replace(/\/$/, '') : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId: string = body?.targetUserId || session.user.id;

  // Chỉ admin, chuNha, hoặc chính user đó mới được gọi
  if (session.user.role !== 'admin' && session.user.role !== 'chuNha' && session.user.id !== targetUserId) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  // Lấy thông tin user
  const user = await prisma.nguoiDung.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      ten: true,
      vaiTro: true,
      soDienThoai: true,
      zaloAccountId: true,
      zaloWebhookToken: true,
      zaloBotServerUrl: true,
      zaloBotUsername: true,
      zaloBotPassword: true,
      zaloBotTtl: true,
    },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Không tìm thấy người dùng' });
  }

  // Bot config: ưu tiên config riêng của user, fallback global
  let botConfig: BotConfig | null = null;
  if (user.zaloBotServerUrl) {
    botConfig = {
      serverUrl: user.zaloBotServerUrl.replace(/\/$/, ''),
      username: user.zaloBotUsername || 'admin',
      password: user.zaloBotPassword || 'admin',
      accountId: user.zaloAccountId || '',
      ttl: user.zaloBotTtl ?? 0,
    };
  } else {
    botConfig = await getBotConfig();
  }
  if (!botConfig) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình Bot Server' });
  }

  // Lấy danh sách accounts trên bot server
  const { accounts, error: accError } = await getAccountsFromBotServer(botConfig);
  if (accError) {
    return NextResponse.json({ ok: false, error: accError });
  }

  // Tìm account match theo SĐT hoặc zaloAccountId
  let matchedAccount: any = null;
  if (user.zaloAccountId) {
    matchedAccount = accounts.find(
      (a: any) => String(a.id ?? a.ownId) === user.zaloAccountId,
    );
  }
  if (!matchedAccount && user.soDienThoai) {
    const phone = user.soDienThoai.replace(/\D/g, '');
    const phoneVariants = [phone, phone.replace(/^0/, '+84'), `+84${phone.replace(/^0/, '')}`];
    matchedAccount = accounts.find((a: any) => {
      const accPhone = (a.phoneNumber || a.phone || '').replace(/\D/g, '');
      return phoneVariants.some(v => v.replace(/\D/g, '') === accPhone);
    });
  }

  if (!matchedAccount) {
    return NextResponse.json({
      ok: false,
      error: 'Không tìm thấy tài khoản Zalo trên bot server. Vui lòng quét QR đăng nhập trước.',
      needQR: true,
    });
  }

  const ownId = String(matchedAccount.id ?? matchedAccount.ownId);
  const steps: string[] = [];

  // 1. Tạo webhook token nếu chưa có
  let webhookToken = user.zaloWebhookToken;
  const isFirstSetup = !webhookToken;
  if (!webhookToken) {
    webhookToken = randomBytes(12).toString('hex');
    await prisma.nguoiDung.update({
      where: { id: user.id },
      data: { zaloWebhookToken: webhookToken },
    });
    steps.push('Đã tạo webhook token');
  }

  // 2. Lấy app URL
  const localBase = await getLocalBaseUrl();
  if (!localBase) {
    return NextResponse.json({
      ok: false,
      error: 'Chưa cấu hình app_local_url trong Cài đặt',
      steps,
    });
  }

  // 3. Cài webhook — chỉ lần đầu (chưa có token trước đó)
  const webhookUrl = `${localBase}/api/zalo/webhook/${webhookToken}`;
  if (isFirstSetup) {
    const whResult = await setWebhookOnBotServer(ownId, webhookUrl, webhookUrl, webhookUrl, botConfig);
    if (!whResult.ok) {
      return NextResponse.json({
        ok: false,
        error: `Cài webhook thất bại: ${whResult.error}`,
        steps,
      });
    }
    steps.push('Đã cài webhook');
  } else {
    steps.push('Webhook đã được cài trước đó');
  }

  // 4. Cập nhật zaloAccountId + zaloChatId
  await prisma.nguoiDung.update({
    where: { id: user.id },
    data: {
      zaloAccountId: ownId,
      ...(!user.zaloAccountId ? { zaloChatId: ownId } : {}),
    },
  }).catch(() => {});
  steps.push('Đã cập nhật zaloAccountId');

  // 5. Nếu là chủ trọ/quản lý/đồng chủ trọ → tự động cấp quyền cho tất cả tòa nhà được gán
  if (user.vaiTro === 'chuNha' || user.vaiTro === 'quanLy' || user.vaiTro === 'dongChuTro') {
    const assignments = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { nguoiDungId: user.id },
      select: { toaNhaId: true, quyenKichHoatTaiKhoan: true },
    });

    let grantedCount = 0;
    for (const a of assignments) {
      if (!a.quyenKichHoatTaiKhoan) {
        await prisma.toaNhaNguoiQuanLy.update({
          where: { toaNhaId_nguoiDungId: { toaNhaId: a.toaNhaId, nguoiDungId: user.id } },
          data: { quyenKichHoatTaiKhoan: true },
        }).catch(() => {});
        grantedCount++;
      }
    }
    if (grantedCount > 0) {
      steps.push(`Đã cấp quyền kích hoạt tài khoản cho ${grantedCount} tòa nhà`);
    } else if (assignments.length > 0) {
      steps.push('Đã có quyền kích hoạt tài khoản');
    }
  }

  // 6. Auto-link zaloAccountId cho user khác cùng SĐT
  const accPhone = matchedAccount.phoneNumber || matchedAccount.phone || '';
  if (accPhone) {
    const phoneVariants = [accPhone, accPhone.replace(/^\+84/, '0'), accPhone.replace(/^0/, '+84')];
    await prisma.nguoiDung.updateMany({
      where: {
        soDienThoai: { in: phoneVariants },
        id: { not: user.id },
        zaloAccountId: null,
      },
      data: { zaloAccountId: ownId, zaloChatId: ownId },
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    ownId,
    webhookUrl,
    steps,
    message: `Thiết lập thành công cho ${user.ten || 'tài khoản'}`,
  });
}
