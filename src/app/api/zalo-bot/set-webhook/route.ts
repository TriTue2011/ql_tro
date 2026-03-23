/**
 * POST /api/zalo-bot/set-webhook
 * Cài đặt webhook trên bot server để nhận tin nhắn Zalo.
 * Body: { ownId?: string, webhookUrl?: string }
 * Chỉ admin / chuNha.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { setWebhookOnBotServer, getBotConfig, getAccountsFromBotServer } from '@/lib/zalo-bot-client';
import prisma from '@/lib/prisma';

function getPublicBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/$/, '');
}

async function getLocalBaseUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'app_local_url' } });
    const val = row?.giaTri?.trim();
    return val ? val.replace(/\/$/, '') : null;
  } catch { return null; }
}

async function getSavedWebhookUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_url' } });
    return row?.giaTri?.trim() || null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const config = await getBotConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình zalo_bot_server_url' });
  }

  const body = await request.json().catch(() => ({}));
  let ownId: string = body?.ownId || config.accountId;
  if (!ownId) {
    return NextResponse.json({ ok: false, error: 'Cần nhập Zalo Account ID (zalo_bot_account_id) trong Cài đặt' });
  }

  // Resolve ownId: bot server cần numeric Zalo ID, không phải số điện thoại.
  // Fetch danh sách tài khoản → tìm account khớp id hoặc phoneNumber/phone.
  try {
    const { accounts } = await getAccountsFromBotServer();
    if (accounts.length > 0) {
      const match = accounts.find((a: any) =>
        a.id === ownId ||
        a.ownId === ownId ||
        a.phoneNumber === ownId ||
        a.phone === ownId ||
        // normalize: bỏ dấu + và so sánh
        a.phoneNumber?.replace(/\D/g, '') === ownId.replace(/\D/g, '') ||
        a.phone?.replace(/\D/g, '') === ownId.replace(/\D/g, '')
      );
      if (match) {
        ownId = match.id ?? match.ownId ?? ownId;
      } else if (accounts.length === 1) {
        // Chỉ có 1 tài khoản → dùng luôn
        ownId = accounts[0].id ?? ownId;
      }
    }
  } catch { /* bỏ qua, dùng ownId gốc */ }

  // Ưu tiên: 1) URL do user nhập, 2) URL đã lưu trong DB, 3) dùng zalo_webhook_id đã sinh
  const localBase = await getLocalBaseUrl();
  const base = localBase || getPublicBaseUrl() || 'http://localhost:3000';
  const saved = await getSavedWebhookUrl();
  const validSaved = saved && (saved.startsWith('http://') || saved.startsWith('https://')) ? saved : null;

  let webhookUrl: string = (body?.webhookUrl?.trim()) || validSaved || '';
  if (!webhookUrl) {
    // Lấy webhook_id đã sinh ngẫu nhiên từ DB (key: zalo_webhook_id)
    let webhookId = (await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_id' } }))?.giaTri?.trim() || '';
    if (!webhookId) {
      // Chưa có → sinh mới và lưu
      const { randomBytes } = await import('crypto');
      webhookId = randomBytes(32).toString('base64url');
      await prisma.caiDat.upsert({
        where: { khoa: 'zalo_webhook_id' },
        update: { giaTri: webhookId },
        create: { khoa: 'zalo_webhook_id', giaTri: webhookId },
      }).catch(() => {});
    }
    webhookUrl = `${base}/api/webhook/${webhookId}`;
  }

  const result = await setWebhookOnBotServer(ownId, webhookUrl);

  // Lưu URL vào DB để form load lại đúng
  if (result.ok) {
    await prisma.caiDat.upsert({
      where: { khoa: 'zalo_webhook_url' },
      update: { giaTri: webhookUrl },
      create: { khoa: 'zalo_webhook_url', giaTri: webhookUrl },
    }).catch(() => {});

    // Tự động liên kết Zalo cho user hiện tại (zaloAccountId + zaloChatId)
    const currentUser = await prisma.nguoiDung.findUnique({
      where: { id: session.user.id },
      select: { zaloChatId: true },
    });
    await prisma.nguoiDung.update({
      where: { id: session.user.id },
      data: {
        zaloAccountId: ownId,
        // Nếu chưa có zaloChatId → set = ownId (tài khoản bot = tài khoản cá nhân)
        ...(currentUser?.zaloChatId ? {} : { zaloChatId: ownId }),
      },
    }).catch(() => {});

    // Đồng bộ webhook riêng cho từng tài khoản bot (mỗi account → webhook per-nguoiDung)
    try {
      const { accounts } = await getAccountsFromBotServer();

      // Auto-link zaloAccountId cho các user (match theo SĐT)
      for (const acc of accounts) {
        const accId = acc.id ?? acc.ownId;
        if (!accId) continue;

        const phone = acc.phoneNumber || acc.phone || '';
        if (phone) {
          const phoneVariants = [phone, phone.replace(/^\+84/, '0'), phone.replace(/^0/, '+84')];

          // Gán cho user chưa có zaloAccountId (match SĐT)
          await prisma.nguoiDung.updateMany({
            where: {
              soDienThoai: { in: phoneVariants },
              zaloAccountId: null,
              vaiTro: { in: ['admin', 'chuNha'] },
            },
            data: { zaloAccountId: accId, zaloChatId: accId },
          }).catch(() => {});

          // Fix: user có zaloAccountId = SĐT (sai) → cập nhật thành ownId (Zalo ID số)
          await prisma.nguoiDung.updateMany({
            where: {
              zaloAccountId: { in: phoneVariants },
              vaiTro: { in: ['admin', 'chuNha'] },
            },
            data: { zaloAccountId: accId, zaloChatId: accId },
          }).catch(() => {});
        }
      }

      // Nếu chỉ có 1 tài khoản bot → gán cho tất cả chuNha/admin chưa link
      if (accounts.length === 1) {
        const singleAccId = accounts[0].id ?? accounts[0].ownId;
        if (singleAccId) {
          await prisma.nguoiDung.updateMany({
            where: {
              zaloAccountId: null,
              zaloChatId: null,
              vaiTro: { in: ['admin', 'chuNha'] },
            },
            data: { zaloAccountId: singleAccId, zaloChatId: singleAccId },
          }).catch(() => {});
        }
      }

      // Set webhook riêng cho từng tài khoản bot → per-nguoiDung webhook URL
      for (const acc of accounts) {
        const accId = acc.id ?? acc.ownId;
        if (!accId || accId === ownId) continue; // ownId đã set ở trên

        // Tìm NguoiDung có zaloAccountId = accId → dùng webhook riêng
        const linkedUser = await prisma.nguoiDung.findFirst({
          where: { zaloAccountId: accId, vaiTro: { in: ['admin', 'chuNha'] } },
          select: { id: true },
        });

        const accWebhookUrl = linkedUser
          ? `${base}/api/zalo/webhook/${linkedUser.id}`
          : webhookUrl; // fallback dùng webhook chung nếu chưa link user

        await setWebhookOnBotServer(accId, accWebhookUrl).catch(() => {});
      }

      // Set webhook riêng cho user hiện tại (ownId) nếu khác webhook chung
      const perUserUrl = `${base}/api/zalo/webhook/${session.user.id}`;
      if (perUserUrl !== webhookUrl) {
        await setWebhookOnBotServer(ownId, perUserUrl).catch(() => {});
      }
    } catch { /* bỏ qua nếu không lấy được danh sách */ }
  }

  return NextResponse.json({ ...result, webhookUrl, ownId });
}
