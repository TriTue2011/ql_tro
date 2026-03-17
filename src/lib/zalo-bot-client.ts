/**
 * zalo-bot-client.ts
 *
 * HTTP client để kết nối với Zalo Bot Docker server (smarthomeblack/zalobot).
 * Server chạy trên port 3000, dùng Zalo Web protocol (zca-js / multizlogin) —
 * không cần OA, đăng nhập bằng QR code cá nhân.
 *
 * API của bot server:
 *   POST /api/login                  — xác thực với admin/password
 *   GET  /api/accounts               — danh sách tài khoản đang đăng nhập
 *   POST /zalo-login                 — lấy QR code (base64 PNG)
 *   POST /api/sendMessageByAccount   — gửi tin nhắn
 *   POST /api/account-webhook        — cài đặt webhook nhận tin
 *   DELETE /api/account-webhook/:id  — xóa webhook
 */

import prisma from '@/lib/prisma';

interface BotConfig {
  serverUrl: string;
  username: string;
  password: string;
  accountId: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getBotConfig(): Promise<BotConfig | null> {
  try {
    const rows = await prisma.caiDat.findMany({
      where: {
        khoa: {
          in: [
            'zalo_bot_server_url',
            'zalo_bot_username',
            'zalo_bot_password',
            'zalo_bot_account_id',
          ],
        },
      },
    });
    const map = Object.fromEntries(rows.map((r) => [r.khoa, r.giaTri?.trim() ?? '']));
    const url = map['zalo_bot_server_url'];
    if (!url) return null;
    return {
      serverUrl: url.replace(/\/$/, ''),
      username: map['zalo_bot_username'] || 'admin',
      password: map['zalo_bot_password'] || 'admin',
      accountId: map['zalo_bot_account_id'] || '',
    };
  } catch {
    return null;
  }
}

export async function isBotServerMode(): Promise<boolean> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_mode' } });
    return row?.giaTri?.trim() === 'bot_server';
  } catch {
    return false;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Đăng nhập vào bot server, trả về header Authorization hoặc Cookie dùng
 * cho các request tiếp theo.
 */
async function loginToBotServer(config: BotConfig): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${config.serverUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: config.username, password: config.password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    // Ưu tiên JWT token trong body
    const body = await res.json().catch(() => null);
    if (body?.token) {
      return { Authorization: `Bearer ${body.token}` };
    }

    // Fallback: dùng Set-Cookie
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Lấy phần key=value đầu tiên của cookie
      const cookiePart = setCookie.split(';')[0];
      return { Cookie: cookiePart };
    }

    // Server chấp nhận nhưng không trả token → không cần auth header
    return {};
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Gửi tin nhắn văn bản qua bot server */
export async function sendMessageViaBotServer(chatId: string, text: string): Promise<boolean> {
  try {
    const config = await getBotConfig();
    if (!config || !config.accountId) return false;

    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return false;

    const payload = {
      message: {
        msg: text.length > 2000 ? text.slice(0, 1997) + '...' : text,
        ttl: 0,
      },
      threadId: chatId,
      accountSelection: config.accountId,
      type: 0, // 0 = user, 1 = group
    };

    const res = await fetch(`${config.serverUrl}/api/sendMessageByAccount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lấy danh sách tài khoản đang đăng nhập trên bot server */
export async function getAccountsFromBotServer(): Promise<{
  serverUrl: string;
  accounts: any[];
  error?: string;
}> {
  const config = await getBotConfig();
  if (!config) return { serverUrl: '', accounts: [], error: 'Chưa cấu hình zalo_bot_server_url' };

  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) {
      return { serverUrl: config.serverUrl, accounts: [], error: 'Đăng nhập thất bại — kiểm tra username/password' };
    }

    const res = await fetch(`${config.serverUrl}/api/accounts`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { serverUrl: config.serverUrl, accounts: [], error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const accounts = Array.isArray(data) ? data : (data?.data ?? data?.accounts ?? []);
    return { serverUrl: config.serverUrl, accounts };
  } catch (e: any) {
    return { serverUrl: config.serverUrl, accounts: [], error: e?.message || 'Lỗi kết nối đến bot server' };
  }
}

/** Lấy QR code để quét đăng nhập Zalo */
export async function getQRCodeFromBotServer(): Promise<{ qrCode?: string; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { error: 'Chưa cấu hình zalo_bot_server_url' };

  try {
    const authHeaders = await loginToBotServer(config);

    const res = await fetch(`${config.serverUrl}/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeaders ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };

    const data = await res.json().catch(() => null);
    const qrCode =
      data?.qrCodeImage ||
      data?.qrCode ||
      data?.data?.qrCodeImage ||
      data?.image;

    if (!qrCode) return { error: 'Bot server không trả về QR code — thử lại sau' };
    return { qrCode };
  } catch (e: any) {
    return { error: e?.message || 'Lỗi kết nối đến bot server' };
  }
}

/** Cài đặt webhook nhận tin trên bot server */
export async function setWebhookOnBotServer(
  ownId: string,
  messageWebhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { ok: false, error: 'Chưa cấu hình zalo_bot_server_url' };

  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return { ok: false, error: 'Đăng nhập thất bại' };

    const res = await fetch(`${config.serverUrl}/api/account-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ ownId, messageWebhookUrl }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Lỗi kết nối' };
  }
}
