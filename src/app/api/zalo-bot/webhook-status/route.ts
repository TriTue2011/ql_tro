/**
 * GET /api/zalo-bot/webhook-status?ownId=xxx
 * Kiểm tra webhook đã cài trên bot server cho từng account.
 * Trả về danh sách account + webhook URL đã cài + test kết nối.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAccountsFromBotServer,
  getAccountWebhooksFromBotServer,
  getAccountWebhookFromBotServer,
} from '@/lib/zalo-bot-client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha', 'quanLy'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ownId = req.nextUrl.searchParams.get('ownId') || undefined;

  try {
    // Lấy danh sách tài khoản online
    const { accounts, error: accError } = await getAccountsFromBotServer();
    if (accError) {
      return NextResponse.json({ ok: false, error: accError, webhooks: [] });
    }

    // Lấy webhook của từng account
    const webhooks: {
      ownId: string;
      phoneNumber: string;
      isOnline: boolean;
      webhookUrl: string | null;
      hasWebhook: boolean;
    }[] = [];

    // Nếu chỉ query 1 account
    if (ownId) {
      const acc = accounts.find((a: any) => (a.id ?? a.ownId) === ownId || a.ownId === ownId);
      const wh = await getAccountWebhookFromBotServer(ownId);
      const whData = wh.data;
      const whUrl = whData?.messageWebhookUrl || whData?.webhookUrl || whData?.url || null;
      webhooks.push({
        ownId,
        phoneNumber: acc?.phoneNumber || acc?.phone || '',
        isOnline: acc?.isOnline ?? !!acc,
        webhookUrl: whUrl,
        hasWebhook: !!whUrl,
      });
    } else {
      // Lấy tất cả webhooks (thử batch trước, fallback per-account)
      const allWh = await getAccountWebhooksFromBotServer();
      const whMap = new Map<string, any>();

      if (allWh.ok && allWh.data) {
        const whList = Array.isArray(allWh.data) ? allWh.data : (allWh.data?.data ?? []);
        for (const w of whList) {
          const id = w.ownId || w.id;
          if (id) whMap.set(String(id), w);
        }
      }

      for (const acc of accounts) {
        const accId = String(acc.id ?? acc.ownId);
        let whUrl: string | null = null;

        // Từ batch result
        const cached = whMap.get(accId);
        if (cached) {
          whUrl = cached.messageWebhookUrl || cached.webhookUrl || cached.url || null;
        } else if (!allWh.ok) {
          // Batch fail → query per-account
          const wh = await getAccountWebhookFromBotServer(accId);
          const whData = wh.data;
          whUrl = whData?.messageWebhookUrl || whData?.webhookUrl || whData?.url || null;
        }

        webhooks.push({
          ownId: accId,
          phoneNumber: acc.phoneNumber || acc.phone || '',
          isOnline: acc.isOnline ?? true,
          webhookUrl: whUrl,
          hasWebhook: !!whUrl,
        });
      }
    }

    return NextResponse.json({ ok: true, webhooks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra webhook';
    return NextResponse.json({ ok: false, error: msg, webhooks: [] });
  }
}
