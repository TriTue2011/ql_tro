/**
 * POST /api/zalo-bot/test-webhook
 * Gửi request test đến webhook URL để kiểm tra hoạt động.
 * Body: { webhookUrl: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha', 'quanLy'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const webhookUrl: string = body?.webhookUrl?.trim();
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return NextResponse.json({ ok: false, error: 'Webhook URL không hợp lệ' });
  }

  const testPayload = {
    event: 'test',
    message: 'Ping từ hệ thống QL Trọ — kiểm tra kết nối webhook',
    timestamp: Date.now(),
    from: { id: 'system', displayName: 'QL Trọ System' },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(8_000),
    });
    const text = await res.text().catch(() => '');
    return NextResponse.json({ ok: res.ok || res.status < 500, status: res.status, body: text.slice(0, 200) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Timeout hoặc lỗi mạng';
    return NextResponse.json({ ok: false, error: msg });
  }
}
