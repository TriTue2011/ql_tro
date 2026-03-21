/**
 * POST /api/zalo-bot/proxy
 * Proxy request đến bot server với auth tự động.
 * Body: { endpoint: string, method?: 'GET'|'POST'|'DELETE', payload?: object }
 *
 * Whitelist endpoint lấy từ DB (ZaloBotApi), chỉ nhóm không phải "auth".
 * Admin only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBotConfig } from '@/lib/zalo-bot-client';
import prisma from '@/lib/prisma';
import { ALL_ZALO_BOT_APIS, PROXY_ALLOWED_NHOM } from '@/lib/zalo-bot-apis';

// Cache whitelist trong memory để tránh query DB mỗi request
let _allowedCache: Set<string> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 phút

async function getAllowedEndpoints(): Promise<Set<string>> {
  if (_allowedCache && Date.now() - _cacheTime < CACHE_TTL) return _allowedCache;

  try {
    const apis = await prisma.zaloBotApi.findMany({
      where: { nhom: { in: Array.from(PROXY_ALLOWED_NHOM) } },
      select: { endpoint: true },
    });
    if (apis.length > 0) {
      _allowedCache = new Set(apis.map(a => a.endpoint));
      _cacheTime = Date.now();
      return _allowedCache;
    }
  } catch {
    // fallback nếu DB chưa có dữ liệu
  }

  // Fallback về code nếu DB trống
  _allowedCache = new Set(
    ALL_ZALO_BOT_APIS.filter(a => PROXY_ALLOWED_NHOM.has(a.nhom)).map(a => a.endpoint)
  );
  _cacheTime = Date.now();
  return _allowedCache;
}

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

  const allowed = await getAllowedEndpoints();
  if (!allowed.has(endpoint)) {
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
