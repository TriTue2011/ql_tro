/**
 * POST /api/zalo/trigger-ha-webhook
 * Trigger Home Assistant webhook automation từ QL Trọ.
 * Gửi payload tùy chỉnh đến HA webhook URL.
 *
 * Body: {
 *   thread_id?: string,
 *   display_name?: string,
 *   message?: string,
 *   type?: 'user' | 'group',
 *   custom_data?: Record<string, any>,
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  // Lấy HA webhook URL và webhook ID từ settings
  const [urlRow, webhookIdRow] = await Promise.all([
    prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_notify_url' } }),
    prisma.caiDat.findFirst({ where: { khoa: 'ha_zalo_trigger_webhook_id' } }),
  ]);

  const notifyUrl = urlRow?.giaTri?.trim();
  const triggerWebhookId = webhookIdRow?.giaTri?.trim();

  if (!notifyUrl && !triggerWebhookId) {
    return NextResponse.json({
      error: 'Chưa cấu hình ha_zalo_notify_url hoặc ha_zalo_trigger_webhook_id trong Cài đặt',
    }, { status: 400 });
  }

  // Xây dựng URL trigger: nếu có webhook ID, tạo URL từ HA base + webhook ID
  let targetUrl = notifyUrl || '';
  if (triggerWebhookId) {
    // Lấy HA base URL từ ha_zalo_notify_url hoặc app_local_url
    let haBase = '';
    if (notifyUrl) {
      // Extract base URL từ notify URL (vd: http://172.16.10.200:8123/api/webhook/xxx → http://172.16.10.200:8123)
      try {
        const u = new URL(notifyUrl);
        haBase = `${u.protocol}//${u.host}`;
      } catch { /* fallback */ }
    }
    if (haBase) {
      targetUrl = `${haBase}/api/webhook/${triggerWebhookId}`;
    } else {
      return NextResponse.json({
        error: 'Không xác định được HA base URL. Hãy cấu hình ha_zalo_notify_url trước.',
      }, { status: 400 });
    }
  }

  const payload = {
    source: 'ql_tro_zalo',
    trigger: 'manual',
    thread_id: body.thread_id || '',
    display_name: body.display_name || '',
    message: body.message || '',
    type: body.type || 'user',
    timestamp: new Date().toISOString(),
    ...(body.custom_data || {}),
  };

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    const status = res.status;
    let responseText = '';
    try { responseText = await res.text(); } catch { /* ignore */ }

    if (res.ok) {
      return NextResponse.json({
        success: true,
        webhookUrl: targetUrl,
        status,
        message: 'Đã trigger HA webhook thành công',
      });
    }

    return NextResponse.json({
      success: false,
      webhookUrl: targetUrl,
      status,
      response: responseText,
      message: `HA webhook trả về HTTP ${status}`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      webhookUrl: targetUrl,
      message: err?.name === 'TimeoutError'
        ? 'Timeout — HA không phản hồi trong 10 giây'
        : `Lỗi kết nối: ${err?.message || String(err)}`,
    }, { status: 502 });
  }
}
