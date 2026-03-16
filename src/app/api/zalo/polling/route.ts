/**
 * GET  /api/zalo/polling  → trả trạng thái polling worker
 * POST /api/zalo/polling  → khởi động polling (body: {} )
 * DELETE /api/zalo/polling → dừng polling  (body: { restoreWebhook?: boolean })
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { startPolling, stopPolling, getPollingStatus } from '@/lib/zalo-polling-worker';

function requireAdmin(session: any) {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  return NextResponse.json({ success: true, ...getPollingStatus() });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  const result = await startPolling();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  let restoreWebhook = false;
  try {
    const body = await request.json();
    restoreWebhook = !!body?.restoreWebhook;
  } catch { /* body optional */ }

  const result = await stopPolling(restoreWebhook);
  return NextResponse.json(result);
}
