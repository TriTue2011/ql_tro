/**
 * zalo-bot-client.ts
 * HTTP client kết nối Zalo Bot server (TriTue2011/hass-addon/zalo_bot).
 * Hỗ trợ dual-mode: HTTP bot server HOẶC direct zca-js integration.
 * API chuẩn theo ZaloBotClient JS reference.
 */

import prisma from "@/lib/prisma";
import * as zaloDirect from "@/lib/zalo-direct";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BotConfig {
  serverUrl: string;
  username: string;
  password: string;
  accountId: string;
  ttl: number;
}

type OkResult = { ok: boolean; error?: string };
type DataResult<T = any> = { ok: boolean; data?: T; error?: string };

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getBotConfig(): Promise<BotConfig | null> {
  try {
    const rows = await prisma.caiDat.findMany({
      where: {
        khoa: {
          in: ["zalo_bot_server_url", "zalo_bot_username", "zalo_bot_password",
               "zalo_bot_account_id", "zalo_bot_ttl"],
        },
      },
    });
    const m = Object.fromEntries(rows.map((r) => [r.khoa, r.giaTri?.trim() ?? ""]));
    if (!m["zalo_bot_server_url"]) return null;
    return {
      serverUrl: m["zalo_bot_server_url"].replace(/\/$/, ""),
      username: m["zalo_bot_username"] || "admin",
      password: m["zalo_bot_password"] || "admin",
      accountId: m["zalo_bot_account_id"] || "",
      ttl: parseInt(m["zalo_bot_ttl"] || "0", 10) || 0,
    };
  } catch {
    return null;
  }
}

/** Kiểm tra xem có đang dùng direct mode (zca-js tích hợp) không */
export function isDirectMode(): boolean {
  return zaloDirect.isDirectModeAvailable();
}

/** Bot server mode = có cấu hình bot server URL VÀ không ở direct mode */
export async function isBotServerMode(): Promise<boolean> {
  if (isDirectMode()) return false;
  const config = await getBotConfig();
  return !!config?.serverUrl;
}

/** Kiểm tra chế độ nào đang hoạt động */
export async function getActiveMode(): Promise<"direct" | "bot-server" | "none"> {
  if (isDirectMode()) return "direct";
  const config = await getBotConfig();
  if (config?.serverUrl) return "bot-server";
  return "none";
}

// ─── Auth + cache ─────────────────────────────────────────────────────────────

// Cache auth per serverUrl (hỗ trợ nhiều bot server cùng lúc)
const _authCacheMap = new Map<string, { headers: Record<string, string>; exp: number }>();

async function loginToBotServer(config: BotConfig): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${config.serverUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: config.username, password: config.password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (body?.token) return { Authorization: `Bearer ${body.token}` };
    const cookie = res.headers.get("set-cookie");
    if (cookie) return { Cookie: cookie.split(";")[0] };
    return {};
  } catch {
    return null;
  }
}

async function getAuth(config: BotConfig): Promise<Record<string, string> | null> {
  const cached = _authCacheMap.get(config.serverUrl);
  if (cached && cached.exp > Date.now()) return cached.headers;
  const h = await loginToBotServer(config);
  if (h !== null) _authCacheMap.set(config.serverUrl, { headers: h, exp: Date.now() + 25 * 60 * 1000 });
  return h;
}

// ─── Low-level request ────────────────────────────────────────────────────────

async function botRequest(
  method: string,
  endpoint: string,
  body?: Record<string, any>,
  timeoutMs = 15_000,
  configOverride?: BotConfig | null,
): Promise<DataResult> {
  const config = configOverride ?? await getBotConfig();
  if (!config) return { ok: false, error: "Chưa cấu hình zalo_bot_server_url" };

  let headers = await getAuth(config);
  if (!headers) return { ok: false, error: "Đăng nhập bot server thất bại" };

  const doFetch = async (h: Record<string, string>) => {
    const res = await fetch(`${config.serverUrl}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json", ...h },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  };

  try {
    let { status, text } = await doFetch(headers);

    // 401 → clear cache, retry
    if (status === 401) {
      _authCacheMap.delete(config.serverUrl);
      headers = await getAuth(config);
      if (!headers) return { ok: false, error: "Đăng nhập thất bại" };
      ({ status, text } = await doFetch(headers));
    }

    if (status >= 400) return { ok: false, error: `HTTP ${status}: ${text.slice(0, 200)}` };

    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    if (data && typeof data === "object" &&
        (data.success === false || data.ok === false) &&
        !data.qrCodeImage && !data.qrCode && !data.image) {
      return { ok: false, error: data.error || data.message || "Bot server báo lỗi" };
    }
    // Trường hợp chỉ có error mà không có data hữu ích
    if (data && typeof data === "object" && data.error &&
        typeof data.error === "string" && data.error.length > 0 &&
        !data.qrCodeImage && !data.qrCode && !data.image && !data.data) {
      return { ok: false, error: data.error };
    }

    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Lỗi kết nối bot server" };
  }
}

// Helper lấy accountId mặc định
async function ac(accountSelection?: string, configOverride?: BotConfig | null): Promise<string> {
  if (accountSelection) return accountSelection;
  const c = configOverride ?? await getBotConfig();
  return c?.accountId || "";
}

// ─── Account / Server ─────────────────────────────────────────────────────────

/**
 * Lấy danh sách tài khoản từ bot server HTTP.
 * Luôn gọi thật tới bot server — KHÔNG trả về direct accounts.
 */
export async function getAccountsFromBotServer(configOverride?: BotConfig | null): Promise<{ serverUrl: string; accounts: any[]; error?: string }> {
  const config = configOverride ?? await getBotConfig();
  if (!config) return { serverUrl: "", accounts: [], error: "Chưa cấu hình zalo_bot_server_url" };
  const r = await botRequest("GET", "/api/accounts", undefined, 15_000, config);
  if (!r.ok) return { serverUrl: config.serverUrl, accounts: [], error: r.error };
  const accounts = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.accounts ?? []);
  return { serverUrl: config.serverUrl, accounts };
}

export async function getAccountDetailsFromBotServer(ownId: string): Promise<DataResult> {
  return botRequest("GET", `/api/accounts/${ownId}`);
}

/**
 * Health check bot server — kiểm tra server có phản hồi + từng tài khoản có online không.
 */
export async function verifyBotServerHealth(configOverride?: BotConfig | null): Promise<{
  serverOk: boolean;
  serverError?: string;
  accounts: { ownId: string; alive: boolean; name?: string; error?: string }[];
}> {
  const config = configOverride ?? await getBotConfig();
  if (!config) return { serverOk: false, serverError: "Chưa cấu hình zalo_bot_server_url", accounts: [] };

  // 1. Kiểm tra kết nối bot server
  const r = await botRequest("GET", "/api/accounts", undefined, 10_000, config);
  if (!r.ok) return { serverOk: false, serverError: r.error, accounts: [] };

  const accounts = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.accounts ?? []);
  if (!accounts.length) return { serverOk: true, accounts: [] };

  // 2. Kiểm tra chi tiết từng tài khoản
  const results: { ownId: string; alive: boolean; name?: string; error?: string }[] = [];
  for (const acc of accounts) {
    const id = acc.ownId || acc.id || acc.accountId || "";
    if (!id) continue;
    try {
      const detail = await botRequest("GET", `/api/accounts/${id}`, undefined, 10_000, config);
      const data = detail.data;
      const isOnline = data?.isOnline ?? data?.isConnected ?? data?.loggedIn ?? (detail.ok && !detail.error);
      results.push({
        ownId: id,
        alive: !!isOnline,
        name: data?.name || data?.displayName || acc.name || "",
        error: isOnline ? undefined : "Tài khoản offline trên bot server",
      });
    } catch (e: any) {
      results.push({ ownId: id, alive: false, error: e.message });
    }
  }

  return { serverOk: true, accounts: results };
}

export async function getAccountWebhooksFromBotServer(configOverride?: BotConfig | null): Promise<DataResult> {
  return botRequest("GET", "/api/account-webhooks", undefined, 15_000, configOverride);
}

export async function getAccountWebhookFromBotServer(ownId: string, configOverride?: BotConfig | null): Promise<DataResult> {
  return botRequest("GET", `/api/account-webhook/${ownId}`, undefined, 15_000, configOverride);
}

export async function setWebhookOnBotServer(
  ownId: string,
  messageWebhookUrl: string,
  groupEventWebhookUrl?: string,
  reactionWebhookUrl?: string,
  configOverride?: BotConfig | null,
): Promise<OkResult> {
  const r = await botRequest("POST", "/api/account-webhook", {
    ownId,
    messageWebhookUrl,
    groupEventWebhookUrl: groupEventWebhookUrl || messageWebhookUrl,
    reactionWebhookUrl: reactionWebhookUrl || messageWebhookUrl,
  }, 10_000, configOverride);
  return { ok: r.ok, error: r.error };
}

export async function deleteAccountWebhookFromBotServer(ownId: string, configOverride?: BotConfig | null): Promise<OkResult> {
  const r = await botRequest("DELETE", `/api/account-webhook/${ownId}`, undefined, 15_000, configOverride);
  return { ok: r.ok, error: r.error };
}

export async function getProxiesFromBotServer(): Promise<DataResult> {
  if (isDirectMode()) return { ok: true, data: zaloDirect.getProxies() };
  return botRequest("GET", "/api/proxies");
}

export async function addProxyToBotServer(proxyUrl: string): Promise<OkResult> {
  if (isDirectMode()) { zaloDirect.addProxy(proxyUrl); return { ok: true }; }
  const r = await botRequest("POST", "/api/proxies", { proxyUrl });
  return { ok: r.ok, error: r.error };
}

export async function removeProxyFromBotServer(proxyUrl: string): Promise<OkResult> {
  if (isDirectMode()) return { ok: zaloDirect.removeProxy(proxyUrl) };
  const r = await botRequest("DELETE", "/api/proxies", { proxyUrl });
  return { ok: r.ok, error: r.error };
}

export async function getQRCodeFromBotServer(accountSelection?: string): Promise<{ qrCode?: string; error?: string }> {
  // Chỉ dùng direct mode khi KHÔNG có bot server config
  // Không check isDirectMode() — bot server QR luôn dùng bot server nếu có config
  const botConfig = await getBotConfig();
  if (!botConfig?.serverUrl) {
    const result = await zaloDirect.loginWithQR();
    if (!result.ok) return { error: result.error };
    return { qrCode: result.qrCode };
  }

  const body: Record<string, any> = {};
  if (accountSelection) body.accountSelection = accountSelection;

  // Thử nhiều endpoint paths (bot server có thể dùng /zalo-login hoặc /api/zalo-login)
  let r = await botRequest("POST", "/zalo-login", body, 60_000);
  if (!r.ok && (r.error?.includes("404") || r.error?.includes("Not Found"))) {
    r = await botRequest("POST", "/api/zalo-login", body, 60_000);
  }
  if (!r.ok) return { error: r.error };

  // Trích xuất QR code từ nhiều format response khác nhau
  const d = r.data;

  // Tìm candidate từ nhiều cấu trúc response: flat, nested .data, nested .data.data
  // Cũng check d.data trực tiếp (bot server có thể trả { data: "base64..." })
  const candidate = d?.qrCodeImage || d?.qrCode || d?.image || d?.qr || d?.qrBase64 || d?.qrImage
    || (typeof d?.data === "string" ? d.data : null)
    || d?.data?.qrCodeImage || d?.data?.qrCode || d?.data?.image || d?.data?.qr
    || d?.data?.data?.image || d?.data?.data?.qrCode;

  // Nếu không tìm thấy bằng key cụ thể, tìm string dài nhất trong response (có thể là base64)
  let fallbackCandidate: string | null = null;
  if (!candidate && d && typeof d === "object") {
    const findLongString = (obj: any, depth = 0): string | null => {
      if (depth > 3 || !obj) return null;
      if (typeof obj === "string" && obj.length > 100) return obj;
      if (typeof obj === "object") {
        for (const val of Object.values(obj)) {
          const found = findLongString(val, depth + 1);
          if (found) return found;
        }
      }
      return null;
    };
    fallbackCandidate = findLongString(d);
  }

  const raw = candidate || fallbackCandidate;

  // Validate: phải là base64 string hoặc data URI, không phải HTML/error text
  const qrCode = typeof raw === "string" && raw.length > 50
    && (raw.startsWith("data:image") || /^[A-Za-z0-9+/=\s\-_]+$/.test(raw.slice(0, 200)))
    ? raw
    : null;

  if (!qrCode) {
    const preview = JSON.stringify(d)?.slice(0, 800);
    console.error("[zalo-bot-client] QR response không nhận dạng được:", preview);
    console.error("[zalo-bot-client] candidate:", typeof candidate, candidate ? `len=${String(candidate).length}` : "null");
    console.error("[zalo-bot-client] fallback:", typeof fallbackCandidate, fallbackCandidate ? `len=${fallbackCandidate.length}` : "null");
    return { error: "Bot server không trả về QR code hợp lệ" };
  }
  return { qrCode };
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export async function sendMessageViaBotServer(
  chatId: string,
  text: string,
  threadType: 0 | 1 = 0,
  accountSelection?: string,
  configOverride?: BotConfig | null,
): Promise<OkResult> {
  const truncated = text.length > 2000 ? text.slice(0, 1997) + "..." : text;

  // Direct mode
  if (!configOverride && isDirectMode()) {
    const config = await getBotConfig();
    return zaloDirect.sendMessage(chatId, truncated, threadType, config?.ttl ?? 0, null, accountSelection);
  }

  const config = configOverride ?? await getBotConfig();
  const ttl = config?.ttl ?? 0;
  const r = await botRequest("POST", "/api/sendMessageByAccount", {
    message: { msg: truncated, ttl, quote: null },
    threadId: chatId,
    accountSelection: await ac(accountSelection, config),
    type: threadType,
  }, 15_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendImageViaBotServer(
  chatId: string,
  imageUrl: string,
  caption?: string,
  threadType: 0 | 1 = 0,
  accountSelection?: string,
  configOverride?: BotConfig | null,
): Promise<OkResult> {
  // Direct mode
  if (!configOverride && isDirectMode()) {
    const config = await getBotConfig();
    return zaloDirect.sendImage(chatId, imageUrl, caption?.slice(0, 1024) || "", threadType, config?.ttl ?? 0, accountSelection);
  }

  const config = configOverride ?? await getBotConfig();
  const ttl = config?.ttl ?? 0;
  const r = await botRequest("POST", "/api/sendImageByAccount", {
    imagePath: imageUrl,
    threadId: chatId,
    accountSelection: await ac(accountSelection, config),
    type: threadType === 1 ? "group" : "user",
    message: caption?.slice(0, 1024) || "",
    ttl,
  }, 20_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendFileViaBotServer(
  chatId: string,
  fileUrl: string,
  caption?: string,
  threadType: 0 | 1 = 0,
  accountSelection?: string,
  configOverride?: BotConfig | null,
): Promise<OkResult> {
  // Direct mode
  if (!configOverride && isDirectMode()) {
    const config = await getBotConfig();
    return zaloDirect.sendFile(chatId, fileUrl, caption?.slice(0, 1024) || "", threadType, config?.ttl ?? 0, accountSelection);
  }

  const config = configOverride ?? await getBotConfig();
  const ttl = config?.ttl ?? 0;
  const r = await botRequest("POST", "/api/sendFileByAccount", {
    fileUrl,
    message: caption?.slice(0, 1024) || "",
    threadId: chatId,
    accountSelection: await ac(accountSelection, config),
    type: threadType === 1 ? "group" : "user",
    ttl,
  }, 30_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendVideoViaBotServer(
  chatId: string,
  videoUrl: string,
  opts?: { thumbnailUrl?: string; durationMs?: number; width?: number; height?: number; threadType?: 0 | 1; accountSelection?: string; configOverride?: BotConfig | null },
): Promise<OkResult> {
  // Direct mode
  if (!opts?.configOverride && isDirectMode()) {
    const config = await getBotConfig();
    return zaloDirect.sendVideo(chatId, {
      videoUrl,
      thumbnailUrl: opts?.thumbnailUrl,
      duration: opts?.durationMs,
      width: opts?.width,
      height: opts?.height,
      ttl: config?.ttl ?? 0,
    }, opts?.threadType ?? 0, opts?.accountSelection);
  }

  const config = opts?.configOverride ?? await getBotConfig();
  const ttl = config?.ttl ?? 0;
  const r = await botRequest("POST", "/api/sendVideoByAccount", {
    threadId: String(chatId),
    accountSelection: await ac(opts?.accountSelection, config),
    type: opts?.threadType ?? 0,
    options: {
      videoUrl,
      thumbnailUrl: opts?.thumbnailUrl || videoUrl,
      msg: "",
      duration: opts?.durationMs ?? 10_000,
      width: opts?.width ?? 1280,
      height: opts?.height ?? 720,
      ttl,
    },
  }, 60_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendStickerViaBotServer(
  chatId: string,
  stickerId: number,
  threadType: 0 | 1 = 0,
  accountSelection?: string,
  configOverride?: BotConfig | null,
): Promise<OkResult> {
  const config = configOverride ?? undefined;
  const r = await botRequest("POST", "/api/sendStickerByAccount", {
    accountSelection: await ac(accountSelection, config),
    threadId: chatId,
    sticker: { id: stickerId, cateId: 526, type: 1 },
    type: threadType,
  }, 15_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendVoiceViaBotServer(
  chatId: string,
  voiceUrl: string,
  accountSelection?: string,
  configOverride?: BotConfig | null,
): Promise<OkResult> {
  const config = configOverride ?? undefined;
  const r = await botRequest("POST", "/api/sendVoiceByAccount", {
    threadId: chatId,
    accountSelection: await ac(accountSelection, config),
    options: { voiceUrl },
  }, 15_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendTypingEventViaBotServer(chatId: string, accountSelection?: string, configOverride?: BotConfig | null): Promise<OkResult> {
  const config = configOverride ?? undefined;
  const r = await botRequest("POST", "/api/sendTypingEventByAccount", {
    threadId: chatId,
    accountSelection: await ac(accountSelection, config),
  }, 15_000, config);
  return { ok: r.ok, error: r.error };
}

export async function sendImageToUserViaBotServer(chatId: string, imagePath: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendImageToUserByAccount", { imagePath, threadId: chatId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendImageToGroupViaBotServer(chatId: string, imagePath: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendImageToGroupByAccount", { imagePath, threadId: chatId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendImagesToUserViaBotServer(chatId: string, imagePaths: string[], accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendImagesToUserByAccount", { imagePaths, threadId: chatId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendImagesToGroupViaBotServer(chatId: string, imagePaths: string[], accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendImagesToGroupByAccount", { imagePaths, threadId: chatId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendLinkViaBotServer(chatId: string, link: string, message = "", thumbnail = "", accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendLinkByAccount", { threadId: chatId, options: { link, message, thumbnail }, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendCardViaBotServer(chatId: string, userId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendCardByAccount", { threadId: chatId, options: { userId }, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function forwardMessageViaBotServer(message: any, threadIds: string[], type = "user", accountSelection?: string): Promise<OkResult> {
  if (isDirectMode()) return zaloDirect.forwardMessage(message, threadIds, type, accountSelection);
  const r = await botRequest("POST", "/api/forwardMessageByAccount", { params: message, threadIds, type, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function undoMessageViaBotServer(msgId: string, threadId: string, type = 0, accountSelection?: string): Promise<OkResult> {
  if (isDirectMode()) return zaloDirect.undoMessage({ msgId }, threadId, type, accountSelection);
  const r = await botRequest("POST", "/api/undoByAccount", { payload: { msgId }, threadId, accountSelection: await ac(accountSelection), type });
  return { ok: r.ok, error: r.error };
}

export async function addReactionViaBotServer(icon: string, threadId: string, msgId: string, cliMsgId: string, type = "user", accountSelection?: string): Promise<OkResult> {
  if (isDirectMode()) return zaloDirect.addReaction(icon, { threadId, msgId, cliMsgId, type }, accountSelection);
  const r = await botRequest("POST", "/api/addReactionByAccount", { icon, dest: { threadId, msgId, cliMsgId, type }, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function deleteMessageViaBotServer(
  opts: { threadId: string; msgId: string; cliMsgId: string; uidFrom: string; type?: string; onlyMe?: boolean },
  accountSelection?: string,
): Promise<OkResult> {
  if (isDirectMode()) {
    return zaloDirect.deleteMessage(
      { threadId: opts.threadId, msgId: opts.msgId, cliMsgId: opts.cliMsgId, uidFrom: opts.uidFrom, type: opts.type },
      opts.onlyMe ?? true,
      accountSelection,
    );
  }
  const r = await botRequest("POST", "/api/deleteMessageByAccount", {
    dest: { threadId: opts.threadId, msgId: opts.msgId, cliMsgId: opts.cliMsgId, uidFrom: opts.uidFrom, type: opts.type ?? "user" },
    onlyMe: opts.onlyMe ?? true, accountSelection: await ac(accountSelection),
  });
  return { ok: r.ok, error: r.error };
}

export async function parseLinkViaBotServer(link: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/parseLinkByAccount", { link, accountSelection: await ac(accountSelection) });
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function findUserViaBotServer(phone: string, accountSelection?: string): Promise<DataResult> {
  if (isDirectMode()) return zaloDirect.findUser(phone, accountSelection);
  return botRequest("POST", "/api/findUserByAccount", { phone, accountSelection: await ac(accountSelection) });
}

export async function getUserInfoViaBotServer(userId: string, accountSelection?: string): Promise<DataResult> {
  if (isDirectMode()) return zaloDirect.getUserInfo(userId, accountSelection);
  return botRequest("POST", "/api/getUserInfoByAccount", { userId, accountSelection: await ac(accountSelection) });
}

export async function getAllFriendsFromBotServer(
  accountSelection?: string,
): Promise<{ ok: boolean; friends?: any[]; error?: string }> {
  if (isDirectMode()) {
    const r = await zaloDirect.getAllFriends(accountSelection);
    if (!r.ok) return { ok: false, error: r.error };
    const friends = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.friends ?? []);
    return { ok: true, friends };
  }

  const r = await botRequest("POST", "/api/getAllFriendsByAccount", { accountSelection: await ac(accountSelection) }, 15_000);
  if (!r.ok) return { ok: false, error: r.error };
  const friends = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.friends ?? []);
  return { ok: true, friends };
}

export async function getReceivedFriendRequestsFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getReceivedFriendRequestsByAccount", { accountSelection: await ac(accountSelection) });
}

export async function getSentFriendRequestsFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getSentFriendRequestByAccount", { accountSelection: await ac(accountSelection) });
}

export async function sendFriendRequestViaBotServer(userId: string, message: string, accountSelection?: string): Promise<OkResult> {
  if (isDirectMode()) return zaloDirect.sendFriendRequest(userId, message, accountSelection);
  const r = await botRequest("POST", "/api/sendFriendRequestByAccount", { userId, message, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function acceptFriendRequestViaBotServer(userId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/acceptFriendRequestByAccount", { userId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function undoFriendRequestViaBotServer(friendId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/undoFriendRequestByAccount", { friendId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function removeFriendViaBotServer(friendId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/removeFriendByAccount", { friendId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function blockUserViaBotServer(userId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/blockUserByAccount", { userId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function unblockUserViaBotServer(userId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/unblockUserByAccount", { userId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function changeFriendAliasViaBotServer(friendId: string, alias: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/changeFriendAliasByAccount", { friendId, alias, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function removeFriendAliasViaBotServer(friendId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/removeFriendAliasByAccount", { friendId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function updateProfileViaBotServer(
  opts: { name?: string; dob?: string; gender?: number },
  accountSelection?: string,
): Promise<OkResult> {
  const payload: Record<string, any> = { accountSelection: await ac(accountSelection) };
  if (opts.name !== undefined) payload.name = opts.name;
  if (opts.dob !== undefined) payload.dob = opts.dob;
  if (opts.gender !== undefined) payload.gender = Number(opts.gender);
  const r = await botRequest("POST", "/api/updateProfileByAccount", payload);
  return { ok: r.ok, error: r.error };
}

export async function getAvatarListFromBotServer(count?: number, page?: number, accountSelection?: string): Promise<DataResult> {
  const payload: Record<string, any> = { accountSelection: await ac(accountSelection) };
  if (count !== undefined) payload.count = count;
  if (page !== undefined) payload.page = page;
  return botRequest("POST", "/api/getAvatarListByAccount", payload);
}

export async function lastOnlineViaBotServer(userId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/lastOnlineByAccount", { uid: userId, accountSelection: await ac(accountSelection) });
}

export async function changeAccountAvatarViaBotServer(avatarSource: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/changeAccountAvatarByAccount", { avatarSource, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function blockViewFeedViaBotServer(userId: string, isBlockFeed: boolean, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/blockViewFeedByAccount", { userId, isBlockFeed, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function updateSettingsViaBotServer(type: string, status: number, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateSettingsByAccount", { accountSelection: await ac(accountSelection), type, status: Number(status) });
  return { ok: r.ok, error: r.error };
}

// ─── Group ────────────────────────────────────────────────────────────────────

export async function getAllGroupsFromBotServer(accountSelection?: string): Promise<{ ok: boolean; groups?: any[]; error?: string }> {
  if (isDirectMode()) {
    const r = await zaloDirect.getAllGroups(accountSelection);
    if (!r.ok) return { ok: false, error: r.error };
    const groups = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.groups ?? []);
    return { ok: true, groups };
  }

  const r = await botRequest("POST", "/api/getAllGroupsByAccount", { accountSelection: await ac(accountSelection) }, 15_000);
  if (!r.ok) return { ok: false, error: r.error };
  const groups = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.groups ?? []);
  return { ok: true, groups };
}

export async function getGroupInfoFromBotServer(groupId: string | string[], accountSelection?: string): Promise<DataResult> {
  if (isDirectMode()) return zaloDirect.getGroupInfo(groupId, accountSelection);
  return botRequest("POST", "/api/getGroupInfoByAccount", {
    groupId: Array.isArray(groupId) ? groupId : [groupId],
    accountSelection: await ac(accountSelection),
  });
}

export async function getGroupMembersFromBotServer(groupId: string, accountSelection?: string): Promise<{ ok: boolean; memberIds?: string[]; error?: string }> {
  const r = await botRequest("POST", "/api/getGroupMembersInfoByAccount", { memberId: groupId, accountSelection: await ac(accountSelection) }, 10_000);
  if (!r.ok) return { ok: false, error: r.error };
  const members: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.members ?? r.data?.memberInfos ?? []);
  const memberIds = members.map((m: any) => String(m.uid ?? m.id ?? m.userId ?? m.memberId ?? "")).filter(Boolean);
  return { ok: true, memberIds };
}

export async function createGroupViaBotServer(name: string, members: string[], avatarPath?: string, accountSelection?: string): Promise<DataResult> {
  if (isDirectMode()) return zaloDirect.createGroup(name, members, avatarPath, accountSelection);
  return botRequest("POST", "/api/createGroupByAccount", {
    members, name,
    ...(avatarPath ? { avatarPath } : {}),
    accountSelection: await ac(accountSelection),
  });
}

export async function addUserToGroupViaBotServer(groupId: string, memberId: string | string[], accountSelection?: string): Promise<OkResult> {
  if (isDirectMode()) return zaloDirect.addUserToGroup(groupId, memberId, accountSelection);
  const r = await botRequest("POST", "/api/addUserToGroupByAccount", {
    groupId,
    memberId: Array.isArray(memberId) ? memberId : [memberId],
    accountSelection: await ac(accountSelection),
  });
  return { ok: r.ok, error: r.error };
}

export async function removeUserFromGroupViaBotServer(groupId: string, memberId: string | string[], accountSelection?: string): Promise<OkResult> {
  if (isDirectMode()) return zaloDirect.removeUserFromGroup(groupId, memberId, accountSelection);
  const r = await botRequest("POST", "/api/removeUserFromGroupByAccount", {
    groupId,
    memberId: Array.isArray(memberId) ? memberId : [memberId],
    accountSelection: await ac(accountSelection),
  }, 10_000);
  return { ok: r.ok, error: r.error };
}

export async function changeGroupNameViaBotServer(groupId: string, name: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/changeGroupNameByAccount", { groupId, name, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function changeGroupAvatarViaBotServer(groupId: string, imagePath: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/changeGroupAvatarByAccount", { groupId, avatarSource: imagePath, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function addGroupDeputyViaBotServer(groupId: string, memberId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/addGroupDeputyByAccount", { groupId, memberId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function removeGroupDeputyViaBotServer(groupId: string, memberId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/removeGroupDeputyByAccount", { groupId, memberId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function changeGroupOwnerViaBotServer(groupId: string, memberId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/changeGroupOwnerByAccount", { groupId, memberId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function disperseGroupViaBotServer(groupId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/disperseGroupByAccount", { groupId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function enableGroupLinkViaBotServer(groupId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/enableGroupLinkByAccount", { groupId, accountSelection: await ac(accountSelection) });
}

export async function disableGroupLinkViaBotServer(groupId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/disableGroupLinkByAccount", { groupId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function joinGroupViaBotServer(link: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/joinGroupByAccount", { link, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function leaveGroupViaBotServer(groupId: string, silent = false, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/leaveGroupByAccount", { groupId, silent, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function createNoteGroupViaBotServer(groupId: string, title: string, pinAct = true, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/createNoteByAccount", { groupId, accountSelection: await ac(accountSelection), options: { title, pinAct } });
}

export async function editNoteGroupViaBotServer(groupId: string, topicId: string, title: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/editNoteByAccount", { groupId, accountSelection: await ac(accountSelection), options: { topicId, title } });
  return { ok: r.ok, error: r.error };
}

export async function getListBoardFromBotServer(groupId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getListBoardByAccount", { groupId, accountSelection: await ac(accountSelection) });
}

export async function createPollViaBotServer(
  groupId: string,
  question: string,
  options: string[],
  allowMultiChoices = false,
  accountSelection?: string,
): Promise<DataResult> {
  return botRequest("POST", "/api/createPollByAccount", {
    groupId,
    accountSelection: await ac(accountSelection),
    options: { question, options, allowMultiChoices },
  });
}

export async function getPollDetailFromBotServer(pollId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getPollDetailByAccount", { pollId, accountSelection: await ac(accountSelection) });
}

export async function lockPollViaBotServer(pollId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/lockPollByAccount", { pollId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export async function createReminderViaBotServer(
  threadId: string,
  title: string,
  content: string,
  remindTime: number,
  type = "0",
  accountSelection?: string,
): Promise<DataResult> {
  return botRequest("POST", "/api/createReminderByAccount", {
    threadId, accountSelection: await ac(accountSelection), type,
    options: { title, content, remindTime },
  });
}

export async function removeReminderViaBotServer(reminderId: string, threadId: string, type = "0", accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/removeReminderByAccount", { reminderId, threadId, accountSelection: await ac(accountSelection), type });
  return { ok: r.ok, error: r.error };
}

export async function editReminderViaBotServer(threadId: string, topicId: string, title: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/editReminderByAccount", { threadId, topicId, title, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function getReminderFromBotServer(reminderId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getReminderByAccount", { reminderId, accountSelection: await ac(accountSelection) });
}

export async function getListReminderFromBotServer(threadId: string, type: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getListReminderByAccount", { threadId, accountSelection: await ac(accountSelection), type });
}

export async function getReminderResponsesFromBotServer(reminderId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getReminderResponsesByAccount", { reminderId, accountSelection: await ac(accountSelection) });
}

// ─── Conversation utils ───────────────────────────────────────────────────────

export async function setMuteViaBotServer(threadId: string, duration: number, type = 0, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/setMuteByAccount", {
    params: { action: duration > 0 ? "mute" : "unmute", duration },
    threadID: threadId, type, accountSelection: await ac(accountSelection),
  });
  return { ok: r.ok, error: r.error };
}

export async function getMuteFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getMuteByAccount", { accountSelection: await ac(accountSelection) });
}

export async function setPinnedConversationViaBotServer(threadId: string, pinned: boolean, type = 0, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/setPinnedConversationsByAccount", { accountSelection: await ac(accountSelection), pinned, threadId, type });
  return { ok: r.ok, error: r.error };
}

export async function getPinConversationsFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getPinConversationsByAccount", { accountSelection: await ac(accountSelection) });
}

export async function getUnreadMarkFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getUnreadMarkByAccount", { accountSelection: await ac(accountSelection) });
}

export async function addUnreadMarkViaBotServer(threadId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/addUnreadMarkByAccount", { threadId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function removeUnreadMarkViaBotServer(threadId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/removeUnreadMarkByAccount", { threadId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function deleteChatViaBotServer(threadId: string, lastMessage?: any, type?: number, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/deleteChatByAccount", { threadId, lastMessage: lastMessage || {}, type, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function getArchivedChatListFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getArchivedChatListByAccount", { accountSelection: await ac(accountSelection) });
}

export async function getAutoDeleteChatFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getAutoDeleteChatByAccount", { accountSelection: await ac(accountSelection) });
}

export async function updateAutoDeleteChatViaBotServer(threadId: string, ttl: number, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateAutoDeleteChatByAccount", { threadId, ttl: Number(ttl), accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function getHiddenConversationsFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getHiddenConversationsByAccount", { accountSelection: await ac(accountSelection) });
}

export async function setHiddenConversationsViaBotServer(threadId: string, isHide: boolean, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/setHiddenConversationsByAccount", { threadId, hidden: isHide, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function updateHiddenConversPinViaBotServer(oldPin: string, newPin: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateHiddenConversPinByAccount", { pin: newPin, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function resetHiddenConversPinViaBotServer(accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/resetHiddenConversPinByAccount", { accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function getLabelsFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getLabelsByAccount", { accountSelection: await ac(accountSelection) });
}

// ─── Quick message ────────────────────────────────────────────────────────────

export async function addQuickMessageViaBotServer(keyword: string, title: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/addQuickMessageByAccount", {
    accountSelection: await ac(accountSelection),
    addPayload: { keyword, title, message: { title, params: "" } },
  });
}

export async function getQuickMessageFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getQuickMessageListByAccount", { accountSelection: await ac(accountSelection) });
}

export async function removeQuickMessageViaBotServer(itemIds: string[], accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/removeQuickMessageByAccount", { accountSelection: await ac(accountSelection), itemIds });
  return { ok: r.ok, error: r.error };
}

export async function updateQuickMessageViaBotServer(itemId: string, keyword: string, title: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateQuickMessageByAccount", {
    accountSelection: await ac(accountSelection), itemId,
    updatePayload: { keyword, title, message: { title, params: "" } },
  });
  return { ok: r.ok, error: r.error };
}

// ─── Sticker ──────────────────────────────────────────────────────────────────

export async function getStickersFromBotServer(query: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getStickersByAccount", { query, accountSelection: await ac(accountSelection) });
}

export async function getStickerDetailFromBotServer(stickerId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getStickersDetailByAccount", { stickerAlbum: stickerId, accountSelection: await ac(accountSelection) });
}

// ─── Message events ───────────────────────────────────────────────────────────

export async function sendSeenEventViaBotServer(msgId: string, threadId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendSeenEventByAccount", { messages: { msgId, threadId }, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendDeliveredEventViaBotServer(msgId: string, threadId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendDeliveredEventByAccount", { msgId, threadId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function undoViaBotServer(msgId: string, threadId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/undoByAccount", { msgId, threadId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function sendReportViaBotServer(userId: string, reason: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/sendReportByAccount", { userId, reason, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

// ─── Account extended ─────────────────────────────────────────────────────────

export async function deleteAvatarListViaBotServer(ids: string[], accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/deleteAvatarListByAccount", { ids, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function reuseAvatarViaBotServer(id: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/reuseAvatarByAccount", { id, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function updateLangViaBotServer(lang: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateLangByAccount", { lang, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

// ─── Friend extended ──────────────────────────────────────────────────────────

export async function getAliasListFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getAliasListByAccount", { accountSelection: await ac(accountSelection) });
}

export async function getFriendRecommendationsFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getFriendRecommendationsByAccount", { accountSelection: await ac(accountSelection) });
}

export async function getFriendBoardListFromBotServer(userId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getFriendBoardListByAccount", { userId, accountSelection: await ac(accountSelection) });
}

// ─── Group extended ───────────────────────────────────────────────────────────

export async function getGroupLinkInfoFromBotServer(groupId: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getGroupLinkInfoByAccount", { groupId, accountSelection: await ac(accountSelection) });
}

export async function inviteUserToGroupsViaBotServer(groupId: string, userId: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/inviteUserToGroupsByAccount", { groupId, userId, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

export async function updateGroupSettingsViaBotServer(groupId: string, settings: Record<string, any>, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateGroupSettingsByAccount", { groupId, settings, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

// ─── Note (DM) ────────────────────────────────────────────────────────────────

export async function createNoteViaBotServer(threadId: string, content: string, accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/createNoteByAccount", { groupId: threadId, content, accountSelection: await ac(accountSelection) });
}

export async function editNoteViaBotServer(threadId: string, noteId: string, content: string, accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/editNoteByAccount", { groupId: threadId, noteId, content, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

// ─── Label ────────────────────────────────────────────────────────────────────

export async function updateLabelsViaBotServer(threadId: string, labels: string[], accountSelection?: string): Promise<OkResult> {
  const r = await botRequest("POST", "/api/updateLabelsByAccount", { threadId, labels, accountSelection: await ac(accountSelection) });
  return { ok: r.ok, error: r.error };
}

// ─── Quick message extended ───────────────────────────────────────────────────

export async function getQuickMessageListFromBotServer(accountSelection?: string): Promise<DataResult> {
  return botRequest("POST", "/api/getQuickMessageListByAccount", { accountSelection: await ac(accountSelection) });
}

