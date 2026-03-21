/**
 * POST /api/zalo-bot/proxy
 * Proxy request đến bot server với auth tự động.
 * Body: { endpoint: string, method?: 'GET'|'POST'|'DELETE', payload?: object }
 * Chỉ admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBotConfig } from '@/lib/zalo-bot-client';

// Danh sách endpoint cho phép (whitelist để tránh SSRF)
const ALLOWED_ENDPOINTS = new Set([
  '/api/accounts',
  '/api/login',
  '/zalo-login',
  '/api/sendMessageByAccount',
  '/api/sendImageByAccount',
  '/api/sendFileByAccount',
  '/api/sendVideoByAccount',
  '/api/account-webhook',
  '/api/getAllFriendsByAccount',
  '/api/getAllGroupsByAccount',
  '/api/removeUserFromGroupByAccount',
]);

async function loginToBotServer(config: { serverUrl: string; username: string; password: string }): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${config.serverUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: config.username, password: config.password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (body?.token) return { Authorization: `Bearer ${body.token}` };
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) return { Cookie: setCookie.split(';')[0] };
    return {};
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Cần endpoint' }, { status: 400 });
  }

  const { endpoint, method = 'POST', payload = {} } = body as {
    endpoint: string;
    method?: string;
    payload?: Record<string, unknown>;
  };

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: `Endpoint không được phép: ${endpoint}` }, { status: 400 });
  }

  const config = await getBotConfig();
  if (!config) {
    return NextResponse.json({ error: 'Chưa cấu hình zalo_bot_server_url' }, { status: 503 });
  }

  const authHeaders = await loginToBotServer(config);
  if (!authHeaders) {
    return NextResponse.json({ error: 'Đăng nhập bot server thất bại' }, { status: 502 });
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      signal: AbortSignal.timeout(20_000),
    };
    if (method !== 'GET' && Object.keys(payload).length > 0) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const res = await fetch(`${config.serverUrl}${endpoint}`, fetchOptions);
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }

    return NextResponse.json({ ok: res.ok, status: res.status, data, serverUrl: config.serverUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
    return NextResponse.json({ ok: false, error: msg });
  }
}
