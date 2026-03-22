/**
 * zalo-bot-client.ts
 *
 * HTTP client để kết nối với Zalo Bot Docker server (smarthomeblack/zalobot).
 * Server chạy trên port 3000, dùng Zalo Web protocol (zca-js / multizlogin) —
 * không cần OA, đăng nhập bằng QR code cá nhân.
 *
 * API của bot server:
 *   POST /api/login                          — xác thực với admin/password
 *   GET  /api/accounts                       — danh sách tài khoản đang đăng nhập
 *   POST /zalo-login                         — lấy QR code (base64 PNG)
 *   POST /api/sendMessageByAccount           — gửi tin nhắn
 *   POST /api/account-webhook                — cài đặt webhook nhận tin
 *   DELETE /api/account-webhook/:id          — xóa webhook
 *   POST /api/getAllFriendsByAccount         — danh sách bạn bè
 *   POST /api/getAllGroupsByAccount          — danh sách nhóm
 *   POST /api/removeUserFromGroupByAccount  — xóa thành viên khỏi nhóm
 */

import prisma from "@/lib/prisma";

interface BotConfig {
  serverUrl: string;
  username: string;
  password: string;
  accountId: string;
  ttl: number; // TTL tin nhắn (ms), 0 = không tự hủy
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getBotConfig(): Promise<BotConfig | null> {
  try {
    const rows = await prisma.caiDat.findMany({
      where: {
        khoa: {
          in: [
            "zalo_bot_server_url",
            "zalo_bot_username",
            "zalo_bot_password",
            "zalo_bot_account_id",
            "zalo_bot_ttl",
          ],
        },
      },
    });
    const map = Object.fromEntries(
      rows.map((r) => [r.khoa, r.giaTri?.trim() ?? ""]),
    );
    const url = map["zalo_bot_server_url"];
    if (!url) return null;
    return {
      serverUrl: url.replace(/\/$/, ""),
      username: map["zalo_bot_username"] || "admin",
      password: map["zalo_bot_password"] || "admin",
      accountId: map["zalo_bot_account_id"] || "",
      ttl: parseInt(map["zalo_bot_ttl"] || "0", 10) || 0,
    };
  } catch {
    return null;
  }
}

export async function isBotServerMode(): Promise<boolean> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: "zalo_mode" } });
    return row?.giaTri?.trim() === "bot_server";
  } catch {
    return false;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Đăng nhập vào bot server, trả về header Authorization hoặc Cookie dùng
 * cho các request tiếp theo.
 */
async function loginToBotServer(
  config: BotConfig,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${config.serverUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    // Ưu tiên JWT token trong body
    const body = await res.json().catch(() => null);
    if (body?.token) {
      return { Authorization: `Bearer ${body.token}` };
    }

    // Fallback: dùng Set-Cookie
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      // Lấy phần key=value đầu tiên của cookie
      const cookiePart = setCookie.split(";")[0];
      return { Cookie: cookiePart };
    }

    // Server chấp nhận nhưng không trả token → không cần auth header
    return {};
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function callBotServer(
  config: BotConfig,
  authHeaders: Record<string, string>,
  endpoint: string,
  payload: Record<string, any>,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${config.serverUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Bot server HTTP ${res.status}: ${text.slice(0, 250)}`,
      };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Lỗi kết nối bot server" };
  }
}

/** Gửi hình ảnh qua bot server (POST /api/sendImageByAccount) */
export async function sendImageViaBotServer(
  chatId: string,
  imageUrl: string,
  caption?: string,
  threadType: 0 | 1 = 0,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getBotConfig();
    if (!config || !config.accountId)
      return {
        ok: false,
        error:
          "Chưa cấu hình bot server (zalo_bot_server_url / zalo_bot_account_id)",
      };

    const authHeaders = await loginToBotServer(config);
    if (!authHeaders)
      return { ok: false, error: "Không đăng nhập được bot server" };

    const normalizedCaption = caption?.slice(0, 1024);
    const payload: Record<string, any> = {
      imageUrl,
      imagePath: imageUrl,
      url: imageUrl,
      threadId: chatId,
      thread_id: chatId,
      accountSelection: config.accountId,
      type: threadType,
      ttl: config.ttl,
    };
    if (normalizedCaption) {
      payload.message = normalizedCaption;
      payload.caption = normalizedCaption;
    }

    return callBotServer(
      config,
      authHeaders,
      "/api/sendImageByAccount",
      payload,
      20_000,
    );
  } catch (err: any) {
    return { ok: false, error: err?.message || "Lỗi kết nối bot server" };
  }
}

/** Gửi file qua bot server (POST /api/sendFileByAccount) */
export async function sendFileViaBotServer(
  chatId: string,
  fileUrl: string,
  caption?: string,
  threadType: 0 | 1 = 0,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getBotConfig();
    if (!config || !config.accountId)
      return {
        ok: false,
        error:
          "Chưa cấu hình bot server (zalo_bot_server_url / zalo_bot_account_id)",
      };

    const authHeaders = await loginToBotServer(config);
    if (!authHeaders)
      return { ok: false, error: "Không đăng nhập được bot server" };

    const normalizedCaption = caption?.slice(0, 1024);
    const payload: Record<string, any> = {
      fileUrl,
      filePath: fileUrl,
      url: fileUrl,
      threadId: chatId,
      thread_id: chatId,
      accountSelection: config.accountId,
      type: threadType,
      ttl: config.ttl,
    };
    if (normalizedCaption) {
      payload.message = normalizedCaption;
      payload.caption = normalizedCaption;
    }

    return callBotServer(
      config,
      authHeaders,
      "/api/sendFileByAccount",
      payload,
      30_000,
    );
  } catch (err: any) {
    return { ok: false, error: err?.message || "Lỗi kết nối bot server" };
  }
}

/** Gửi video qua bot server (POST /api/sendVideoByAccount) */
export async function sendVideoViaBotServer(
  chatId: string,
  videoUrl: string,
  opts?: {
    thumbnailUrl?: string;
    durationMs?: number; // mặc định 10000ms
    width?: number;
    height?: number;
    threadType?: 0 | 1;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getBotConfig();
    if (!config || !config.accountId)
      return {
        ok: false,
        error:
          "Chưa cấu hình bot server (zalo_bot_server_url / zalo_bot_account_id)",
      };

    const authHeaders = await loginToBotServer(config);
    if (!authHeaders)
      return { ok: false, error: "Không đăng nhập được bot server" };

    const payload = {
      threadId: chatId,
      thread_id: chatId,
      accountSelection: config.accountId,
      type: opts?.threadType ?? 0,
      options: {
        videoUrl,
        videoPath: videoUrl,
        thumbnailUrl: opts?.thumbnailUrl ?? "",
        duration: opts?.durationMs ?? 10_000,
        width: opts?.width ?? 1280,
        height: opts?.height ?? 720,
        ttl: config.ttl,
      },
    };

    return callBotServer(
      config,
      authHeaders,
      "/api/sendVideoByAccount",
      payload as Record<string, any>,
      60_000,
    );
  } catch (err: any) {
    return { ok: false, error: err?.message || "Lỗi kết nối bot server" };
  }
}

/** Gửi tin nhắn văn bản qua bot server */
export async function sendMessageViaBotServer(
  chatId: string,
  text: string,
  threadType: 0 | 1 = 0,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getBotConfig();
    if (!config || !config.accountId)
      return {
        ok: false,
        error:
          "Chưa cấu hình bot server (zalo_bot_server_url / zalo_bot_account_id)",
      };

    const authHeaders = await loginToBotServer(config);
    if (!authHeaders)
      return { ok: false, error: "Không đăng nhập được bot server" };

    const truncated = text.length > 2000 ? text.slice(0, 1997) + "..." : text;
    const payload = {
      message: {
        msg: truncated,
        text: truncated,
        ttl: config.ttl,
      },
      msg: truncated,
      text: truncated,
      content: truncated,
      threadId: chatId,
      thread_id: chatId,
      accountSelection: config.accountId,
      type: threadType, // 0 = user, 1 = group
    };

    return callBotServer(
      config,
      authHeaders,
      "/api/sendMessageByAccount",
      payload,
      15_000,
    );
  } catch (err: any) {
    return { ok: false, error: err?.message || "Lỗi kết nối bot server" };
  }
}

/** Lấy danh sách tài khoản đang đăng nhập trên bot server */
export async function getAccountsFromBotServer(): Promise<{
  serverUrl: string;
  accounts: any[];
  error?: string;
}> {
  const config = await getBotConfig();
  if (!config)
    return {
      serverUrl: "",
      accounts: [],
      error: "Chưa cấu hình zalo_bot_server_url",
    };

  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) {
      return {
        serverUrl: config.serverUrl,
        accounts: [],
        error: "Đăng nhập thất bại — kiểm tra username/password",
      };
    }

    const res = await fetch(`${config.serverUrl}/api/accounts`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        serverUrl: config.serverUrl,
        accounts: [],
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const accounts = Array.isArray(data)
      ? data
      : (data?.data ?? data?.accounts ?? []);
    return { serverUrl: config.serverUrl, accounts };
  } catch (e: any) {
    return {
      serverUrl: config.serverUrl,
      accounts: [],
      error: e?.message || "Lỗi kết nối đến bot server",
    };
  }
}

/** Lấy QR code để quét đăng nhập Zalo */
export async function getQRCodeFromBotServer(accountSelection?: string): Promise<{
  qrCode?: string;
  error?: string;
}> {
  const config = await getBotConfig();
  if (!config) return { error: "Chưa cấu hình zalo_bot_server_url" };

  try {
    const authHeaders = await loginToBotServer(config);

    const body: Record<string, any> = {};
    if (accountSelection) body.accountSelection = accountSelection;

    const res = await fetch(`${config.serverUrl}/zalo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };

    const data = await res.json().catch(() => null);
    const qrCode =
      data?.qrCodeImage ||
      data?.qrCode ||
      data?.data?.qrCodeImage ||
      data?.image;

    if (!qrCode)
      return { error: "Bot server không trả về QR code — thử lại sau" };
    return { qrCode };
  } catch (e: any) {
    return { error: e?.message || "Lỗi kết nối đến bot server" };
  }
}

/** Lấy danh sách bạn bè (POST /api/getAllFriendsByAccount) */
export async function getAllFriendsFromBotServer(
  accountSelection?: string,
  count = 200,
  page = 0,
): Promise<{ ok: boolean; friends?: any[]; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { ok: false, error: "Chưa cấu hình zalo_bot_server_url" };
  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return { ok: false, error: "Đăng nhập thất bại" };
    const res = await fetch(`${config.serverUrl}/api/getAllFriendsByAccount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ accountSelection: accountSelection ?? config.accountId, count, page }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => null);
    const friends = Array.isArray(data) ? data : (data?.data ?? data?.friends ?? []);
    return { ok: true, friends };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Lỗi kết nối bot server" };
  }
}

/** Lấy danh sách nhóm (POST /api/getAllGroupsByAccount) */
export async function getAllGroupsFromBotServer(
  accountSelection?: string,
): Promise<{ ok: boolean; groups?: any[]; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { ok: false, error: "Chưa cấu hình zalo_bot_server_url" };
  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return { ok: false, error: "Đăng nhập thất bại" };
    const res = await fetch(`${config.serverUrl}/api/getAllGroupsByAccount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ accountSelection: accountSelection ?? config.accountId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => null);
    const groups = Array.isArray(data) ? data : (data?.data ?? data?.groups ?? []);
    return { ok: true, groups };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Lỗi kết nối bot server" };
  }
}

/** Lấy thành viên của 1 nhóm (POST /api/getGroupMembersInfoByAccount) */
export async function getGroupMembersFromBotServer(
  groupId: string,
  accountSelection?: string,
): Promise<{ ok: boolean; memberIds?: string[]; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { ok: false, error: "Chưa cấu hình zalo_bot_server_url" };
  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return { ok: false, error: "Đăng nhập thất bại" };
    const res = await fetch(`${config.serverUrl}/api/getGroupMembersInfoByAccount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ accountSelection: accountSelection ?? config.accountId, groupId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => null);
    // Thử nhiều format response phổ biến
    const members: any[] = Array.isArray(data)
      ? data
      : (data?.data ?? data?.members ?? data?.memberInfos ?? []);
    const memberIds = members
      .map((m: any) => String(m.uid ?? m.id ?? m.userId ?? m.memberId ?? ''))
      .filter(Boolean);
    return { ok: true, memberIds };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Lỗi kết nối bot server" };
  }
}

/** Xóa thành viên khỏi nhóm (POST /api/removeUserFromGroupByAccount) */
export async function removeUserFromGroupViaBotServer(
  groupId: string,
  memberId: string,
  accountSelection?: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { ok: false, error: "Chưa cấu hình zalo_bot_server_url" };
  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return { ok: false, error: "Đăng nhập thất bại" };
    const res = await fetch(`${config.serverUrl}/api/removeUserFromGroupByAccount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        groupId,
        memberId,
        accountSelection: accountSelection ?? config.accountId,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Lỗi kết nối bot server" };
  }
}

/** Cài đặt webhook nhận tin trên bot server */
export async function setWebhookOnBotServer(
  ownId: string,
  messageWebhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { ok: false, error: "Chưa cấu hình zalo_bot_server_url" };

  try {
    const authHeaders = await loginToBotServer(config);
    if (!authHeaders) return { ok: false, error: "Đăng nhập thất bại" };

    const res = await fetch(`${config.serverUrl}/api/account-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ ownId, messageWebhookUrl }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }
    // Kiểm tra response body cho lỗi ẩn (một số server trả HTTP 200 nhưng body có error)
    try {
      const data = JSON.parse(text);
      if (data && (data.success === false || data.ok === false || data.error)) {
        return { ok: false, error: data.error || data.message || "Bot server báo lỗi" };
      }
    } catch { /* không phải JSON, bỏ qua */ }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Lỗi kết nối" };
  }
}
