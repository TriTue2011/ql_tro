/**
 * GET /api/zalo-bot/webhook-status?ownId=xxx
 * Kiểm tra webhook đã cài trên bot server cho từng account.
 * Trả về danh sách account + webhook URL đã cài (3 loại).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAccountsFromBotServer,
  getAccountWebhooksFromBotServer,
  getAccountWebhookFromBotServer,
} from '@/lib/zalo-bot-client';

interface WebhookInfo {
  ownId: string;
  phoneNumber: string;
  isOnline: boolean;
  messageWebhookUrl: string | null;
  groupEventWebhookUrl: string | null;
  reactionWebhookUrl: string | null;
  hasWebhook: boolean;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha', 'quanLy'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ownId = req.nextUrl.searchParams.get('ownId') || undefined;

  try {
    const { accounts, error: accError } = await getAccountsFromBotServer();
    if (accError) {
      return NextResponse.json({ ok: false, error: accError, webhooks: [] });
    }

    // Build map ownId → account info
    const accMap = new Map<string, any>();
    for (const acc of accounts) {
      const accId = String(acc.id ?? acc.ownId);
      accMap.set(accId, acc);
      if (acc.phoneNumber) accMap.set(acc.phoneNumber, acc);
      if (acc.phone) accMap.set(acc.phone, acc);
    }

    const webhooks: WebhookInfo[] = [];

    if (ownId) {
      // Query 1 account
      const acc = accMap.get(ownId);
      const wh = await getAccountWebhookFromBotServer(ownId);
      const d = wh.data;
      const msgUrl = d?.messageWebhookUrl || null;
      const grpUrl = d?.groupEventWebhookUrl || null;
      const reactUrl = d?.reactionWebhookUrl || null;
      webhooks.push({
        ownId,
        phoneNumber: acc?.phoneNumber || acc?.phone || '',
        isOnline: acc?.isOnline ?? !!acc,
        messageWebhookUrl: msgUrl,
        groupEventWebhookUrl: grpUrl,
        reactionWebhookUrl: reactUrl,
        hasWebhook: !!(msgUrl || grpUrl || reactUrl),
      });
    } else {
      // Batch: /api/account-webhooks trả về { data: { default: {...}, accounts: { [key]: {...} } } }
      const allWh = await getAccountWebhooksFromBotServer();
      const whAccounts: Record<string, any> = allWh.ok && allWh.data
        ? (allWh.data.accounts ?? allWh.data.data?.accounts ?? {})
        : {};

      // Collect tất cả keys (ownId + phoneNumber) từ cả accounts online và webhooks
      const allKeys = new Set<string>();
      for (const acc of accounts) {
        allKeys.add(String(acc.id ?? acc.ownId));
      }
      for (const key of Object.keys(whAccounts)) {
        allKeys.add(key);
      }

      for (const key of allKeys) {
        const acc = accMap.get(key);
        const accId = acc ? String(acc.id ?? acc.ownId) : key;

        // Tìm webhook: thử bằng ownId trước, rồi phoneNumber
        const whData = whAccounts[accId] || whAccounts[acc?.phoneNumber] || whAccounts[acc?.phone] || null;

        // Nếu đã thêm account này rồi (trùng ownId/phone) → bỏ qua
        if (webhooks.some(w => w.ownId === accId)) continue;

        const msgUrl = whData?.messageWebhookUrl || null;
        const grpUrl = whData?.groupEventWebhookUrl || null;
        const reactUrl = whData?.reactionWebhookUrl || null;

        webhooks.push({
          ownId: accId,
          phoneNumber: acc?.phoneNumber || acc?.phone || (key.startsWith('+') ? key : ''),
          isOnline: acc?.isOnline ?? false,
          messageWebhookUrl: msgUrl,
          groupEventWebhookUrl: grpUrl,
          reactionWebhookUrl: reactUrl,
          hasWebhook: !!(msgUrl || grpUrl || reactUrl),
        });
      }
    }

    return NextResponse.json({ ok: true, webhooks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra webhook';
    return NextResponse.json({ ok: false, error: msg, webhooks: [] });
  }
}
