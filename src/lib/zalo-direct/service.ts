/**
 * zalo-direct/service.ts
 * Core singleton service quản lý zca-js accounts trực tiếp trong Next.js.
 * Port từ bot server api/zalo/zalo.js + server.js
 *
 * Dùng globalThis để persist WebSocket connections qua API route calls.
 * Chỉ hoạt động với `next start` (không serverless).
 */

import fs from "fs";
import path from "path";
import { Zalo, type API as ZcaAPI, type Credentials as ZcaCredentials, type LoginQRCallbackEvent } from "zca-js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { setupListeners } from "./events";
import { proxyService } from "./proxy";
import { getCookiesDir, saveImage, removeImage, saveFileFromUrl, removeFile } from "./helpers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ZaloAccount {
  ownId: string;
  name: string;
  phone?: string;
  proxy?: string;
  api: ZcaAPI;
  zaloInstance: InstanceType<typeof Zalo>;
  loggedIn: boolean;
  loginTime: number;
}

interface LoginResult {
  ok: boolean;
  ownId?: string;
  qrCode?: string;
  error?: string;
}

type OkResult = { ok: boolean; error?: string };
type DataResult<T = any> = { ok: boolean; data?: T; error?: string };

// ─── Global singleton ────────────────────────────────────────────────────────

const GLOBAL_KEY = "__zaloDirectService__";

interface GlobalStore {
  accounts: ZaloAccount[];
  initialized: boolean;
}

function getStore(): GlobalStore {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    (globalThis as any)[GLOBAL_KEY] = { accounts: [], initialized: false };
  }
  return (globalThis as any)[GLOBAL_KEY];
}

// ─── Account helpers ─────────────────────────────────────────────────────────

function findAccount(accountSelection?: string): ZaloAccount | null {
  const store = getStore();
  if (!accountSelection) return store.accounts[0] ?? null;
  return (
    store.accounts.find((a) => a.ownId === accountSelection) ??
    store.accounts.find((a) => a.name === accountSelection) ??
    store.accounts.find((a) => a.phone === accountSelection) ??
    store.accounts[0] ??
    null
  );
}

function getApi(accountSelection?: string): ZcaAPI | null {
  const acc = findAccount(accountSelection);
  return acc?.api ?? null;
}

function cookiePath(ownId: string): string {
  return path.join(getCookiesDir(), `${ownId}.json`);
}

function saveCookies(ownId: string, credentials: any): void {
  try {
    fs.writeFileSync(cookiePath(ownId), JSON.stringify(credentials, null, 2));
  } catch (err: any) {
    console.error(`[ZaloDirect] Lỗi lưu cookies cho ${ownId}:`, err.message);
  }
}

function loadCookies(ownId: string): any | null {
  try {
    const p = cookiePath(ownId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Login bằng QR code. Trả về base64 QR image qua callback.
 * Hàm này sẽ block cho đến khi user scan QR xong hoặc timeout.
 */
export async function loginWithQR(proxyUrl?: string): Promise<LoginResult> {
  try {
    const zalo = new Zalo({
      ...(proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {}),
    });

    let qrCodeImage: string | undefined;

    const api = await zalo.loginQR({}, (event: LoginQRCallbackEvent) => {
      if (event.type === 0 /* QRCodeGenerated */) {
        qrCodeImage = event.data.image;
      }
    });

    if (!api) {
      return { ok: false, error: "Không thể khởi tạo API từ QR login" };
    }

    const ownId = api.getOwnId();
    const ctx = api.getContext();

    const account: ZaloAccount = {
      ownId,
      name: (ctx as any)?.name || "",
      phone: (ctx as any)?.phone || "",
      proxy: proxyUrl,
      api,
      zaloInstance: zalo,
      loggedIn: true,
      loginTime: Date.now(),
    };

    // Lưu credentials cho auto-relogin
    saveCookies(ownId, ctx);

    // Thêm vào store
    const store = getStore();
    const existingIdx = store.accounts.findIndex((a) => a.ownId === ownId);
    if (existingIdx >= 0) {
      store.accounts[existingIdx] = account;
    } else {
      store.accounts.push(account);
    }

    // Setup event listeners
    setupListeners(api, ownId, () => handleRelogin(ownId));

    return { ok: true, ownId, qrCode: qrCodeImage };
  } catch (err: any) {
    console.error("[ZaloDirect] loginWithQR error:", err);
    return { ok: false, error: err.message || "Lỗi đăng nhập QR" };
  }
}

/**
 * Login bằng credentials đã lưu.
 */
export async function loginWithCookies(ownId: string, proxyUrl?: string): Promise<LoginResult> {
  try {
    const credentials = loadCookies(ownId) as ZcaCredentials | null;
    if (!credentials) return { ok: false, error: `Không tìm thấy cookies cho ${ownId}` };

    const zalo = new Zalo({
      ...(proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {}),
    });

    const api = await zalo.login(credentials);
    if (!api) return { ok: false, error: "Không thể login với cookies" };

    const resolvedOwnId = api.getOwnId() || ownId;
    const ctx = api.getContext();

    const account: ZaloAccount = {
      ownId: resolvedOwnId,
      name: (ctx as any)?.name || "",
      phone: (ctx as any)?.phone || "",
      proxy: proxyUrl,
      api,
      zaloInstance: zalo,
      loggedIn: true,
      loginTime: Date.now(),
    };

    // Update credentials
    saveCookies(resolvedOwnId, ctx);

    const store = getStore();
    const existingIdx = store.accounts.findIndex((a) => a.ownId === resolvedOwnId);
    if (existingIdx >= 0) {
      store.accounts[existingIdx] = account;
    } else {
      store.accounts.push(account);
    }

    setupListeners(api, resolvedOwnId, () => handleRelogin(resolvedOwnId));

    return { ok: true, ownId: resolvedOwnId };
  } catch (err: any) {
    console.error(`[ZaloDirect] loginWithCookies error for ${ownId}:`, err);
    return { ok: false, error: err.message || "Lỗi đăng nhập cookies" };
  }
}

/**
 * Auto relogin khi bị disconnect.
 */
async function handleRelogin(ownId: string): Promise<void> {
  console.log(`[ZaloDirect] Attempting relogin for ${ownId}...`);
  const store = getStore();
  const account = store.accounts.find((a) => a.ownId === ownId);
  if (!account) return;

  account.loggedIn = false;

  // Retry 3 lần với delay tăng dần
  for (let attempt = 1; attempt <= 3; attempt++) {
    await new Promise((r) => setTimeout(r, attempt * 5000));
    const result = await loginWithCookies(ownId, account.proxy);
    if (result.ok) {
      console.log(`[ZaloDirect] Relogin thành công cho ${ownId} (attempt ${attempt})`);
      return;
    }
    console.warn(`[ZaloDirect] Relogin attempt ${attempt} thất bại cho ${ownId}: ${result.error}`);
  }
  console.error(`[ZaloDirect] Relogin thất bại cho ${ownId} sau 3 lần thử`);
}

/**
 * Auto-login tất cả accounts đã lưu cookies.
 */
export async function autoLoginAll(): Promise<void> {
  const store = getStore();
  if (store.initialized) return;
  store.initialized = true;

  const cookiesDir = getCookiesDir();
  try {
    const files = fs.readdirSync(cookiesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const ownId = file.replace(".json", "");
      console.log(`[ZaloDirect] Auto-login ${ownId}...`);
      const result = await loginWithCookies(ownId);
      if (result.ok) {
        console.log(`[ZaloDirect] Auto-login thành công: ${ownId}`);
      } else {
        console.warn(`[ZaloDirect] Auto-login thất bại cho ${ownId}: ${result.error}`);
      }
    }
  } catch (err: any) {
    console.error("[ZaloDirect] autoLoginAll error:", err.message);
  }
}

// ─── Account management ──────────────────────────────────────────────────────

export function getAccounts(): Array<{
  ownId: string;
  name: string;
  phone?: string;
  proxy?: string;
  loggedIn: boolean;
  loginTime: number;
}> {
  return getStore().accounts.map((a) => ({
    ownId: a.ownId,
    name: a.name,
    phone: a.phone,
    proxy: a.proxy,
    loggedIn: a.loggedIn,
    loginTime: a.loginTime,
  }));
}

export function getAccountDetails(ownId: string): DataResult {
  const acc = findAccount(ownId);
  if (!acc) return { ok: false, error: "Account not found" };
  return {
    ok: true,
    data: {
      ownId: acc.ownId,
      name: acc.name,
      phone: acc.phone,
      proxy: acc.proxy,
      loggedIn: acc.loggedIn,
      loginTime: acc.loginTime,
    },
  };
}

export async function logoutAccount(ownId: string): Promise<OkResult> {
  const store = getStore();
  const idx = store.accounts.findIndex((a) => a.ownId === ownId);
  if (idx === -1) return { ok: false, error: "Account not found" };

  try {
    const acc = store.accounts[idx];
    if (acc.api?.listener) acc.api.listener.stop();
  } catch { /* ignore */ }

  store.accounts.splice(idx, 1);

  // Xóa cookies
  try {
    const p = cookiePath(ownId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* ignore */ }

  return { ok: true };
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export async function sendMessage(
  threadId: string,
  msg: string,
  type: 0 | 1 = 0,
  ttl = 0,
  quote: any = null,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo nào đang đăng nhập" };

  try {
    const message: any = { msg, ttl };
    if (quote) message.quote = quote;
    await api.sendMessage(message, threadId, type as any);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi gửi tin nhắn" };
  }
}

export async function sendImage(
  threadId: string,
  imagePathOrUrl: string,
  caption = "",
  type: 0 | 1 = 0,
  ttl = 0,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  let localPath: string | null = null;
  let shouldCleanup = false;

  try {
    if (imagePathOrUrl.startsWith("http://") || imagePathOrUrl.startsWith("https://")) {
      localPath = await saveImage(imagePathOrUrl);
      if (!localPath) return { ok: false, error: "Không tải được ảnh" };
      shouldCleanup = true;
    } else {
      localPath = imagePathOrUrl;
    }

    await api.sendMessage(
      {
        msg: caption,
        attachments: [localPath],
        ttl,
      },
      threadId,
      type as any,
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi gửi ảnh" };
  } finally {
    if (shouldCleanup && localPath) removeImage(localPath);
  }
}

export async function sendFile(
  threadId: string,
  fileUrl: string,
  caption = "",
  type: 0 | 1 = 0,
  ttl = 0,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  let localPath: string | null = null;

  try {
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      localPath = await saveFileFromUrl(fileUrl);
      if (!localPath) return { ok: false, error: "Không tải được file" };
    } else {
      localPath = fileUrl;
    }

    await api.sendMessage(
      {
        msg: caption,
        attachments: [localPath],
        ttl,
      },
      threadId,
      type as any,
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi gửi file" };
  } finally {
    if (localPath && fileUrl.startsWith("http")) removeFile(localPath);
  }
}

export async function sendSticker(
  threadId: string,
  sticker: { id: number; cateId?: number; type?: number },
  type: 0 | 1 = 0,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendSticker?.(
      { id: sticker.id, cateId: sticker.cateId ?? 526, type: sticker.type ?? 1 },
      threadId,
      type,
    );
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendVideo(
  threadId: string,
  options: {
    videoUrl: string;
    thumbnailUrl?: string;
    msg?: string;
    duration?: number;
    width?: number;
    height?: number;
    ttl?: number;
  },
  type: 0 | 1 = 0,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendVideo?.(
      {
        videoUrl: options.videoUrl,
        thumbnailUrl: options.thumbnailUrl || options.videoUrl,
        msg: options.msg || "",
        duration: options.duration ?? 10000,
        width: options.width ?? 1280,
        height: options.height ?? 720,
        ttl: options.ttl ?? 0,
      },
      threadId,
      type,
    );
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendVoice(
  threadId: string,
  voiceUrl: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendVoice?.({ url: voiceUrl }, threadId, 0);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendLink(
  threadId: string,
  link: string,
  message = "",
  thumbnail = "",
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendLink?.({ link, msg: message, thumbnail }, threadId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendCard(
  threadId: string,
  userId: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendCard?.({ userId }, threadId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendTypingEvent(
  threadId: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendTyping?.(threadId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function forwardMessage(
  params: any,
  threadIds: string[],
  type = "user",
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    for (const threadId of threadIds) {
      await (api as any).forwardMessage?.(params, threadId, type === "group" ? 1 : 0);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function undoMessage(
  payload: { msgId: string },
  threadId: string,
  type = 0,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).undo?.(payload, threadId, type);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function addReaction(
  icon: string,
  dest: { threadId: string; msgId: string; cliMsgId: string; type?: string },
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).addReaction?.(icon, dest);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function deleteMessage(
  dest: { threadId: string; msgId: string; cliMsgId: string; uidFrom: string; type?: string },
  onlyMe = true,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).deleteMessage?.(dest, onlyMe);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function parseLink(link: string, accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await (api as any).parseLink?.(link);
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function findUser(phone: string, accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await api.findUser(phone);
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function getUserInfo(userId: string, accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await api.getUserInfo(userId);
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function getAllFriends(accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await api.getAllFriends();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendFriendRequest(
  userId: string,
  message: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await api.sendFriendRequest(userId, message);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function acceptFriendRequest(userId: string, accountSelection?: string): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).acceptFriendRequest?.(userId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function removeFriend(friendId: string, accountSelection?: string): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).removeFriend?.(friendId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function blockUser(userId: string, accountSelection?: string): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).blockUser?.(userId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function unblockUser(userId: string, accountSelection?: string): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).unblockUser?.(userId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function changeFriendAlias(
  friendId: string,
  alias: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).changeFriendAlias?.(friendId, alias);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function updateProfile(
  opts: { name?: string; dob?: string; gender?: number },
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).updateProfile?.(opts);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function lastOnline(userId: string, accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await (api as any).lastOnline?.(userId);
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── Group ───────────────────────────────────────────────────────────────────

export async function getAllGroups(accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await api.getAllGroups();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function getGroupInfo(groupId: string | string[], accountSelection?: string): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const ids = Array.isArray(groupId) ? groupId : [groupId];
    const data = await api.getGroupInfo(ids[0]); // zca-js takes single id
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function createGroup(
  name: string,
  members: string[],
  avatarPath?: string,
  accountSelection?: string,
): Promise<DataResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const data = await api.createGroup({ name, members, avatarPath });
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function addUserToGroup(
  groupId: string,
  memberId: string | string[],
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const ids = Array.isArray(memberId) ? memberId : [memberId];
    await api.addUserToGroup(ids, groupId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function removeUserFromGroup(
  groupId: string,
  memberId: string | string[],
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    const ids = Array.isArray(memberId) ? memberId : [memberId];
    await api.removeUserFromGroup(ids, groupId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function changeGroupName(
  groupId: string,
  name: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).changeGroupName?.(groupId, name);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function changeGroupAvatar(
  groupId: string,
  avatarSource: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).changeGroupAvatar?.(groupId, avatarSource);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function disperseGroup(groupId: string, accountSelection?: string): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).disperseGroup?.(groupId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function leaveGroup(groupId: string, accountSelection?: string): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).leaveGroup?.(groupId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── Conversation utils ──────────────────────────────────────────────────────

export async function sendSeenEvent(
  msgId: string,
  threadId: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendSeenEvent?.({ msgId, threadId });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendDeliveredEvent(
  msgId: string,
  threadId: string,
  accountSelection?: string,
): Promise<OkResult> {
  const api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  try {
    await (api as any).sendDeliveredEvent?.({ msgId, threadId });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── Proxy management (direct, no API needed) ───────────────────────────────

export function getProxies() {
  return proxyService.getPROXIES();
}

export function addProxy(proxyUrl: string) {
  return proxyService.addProxy(proxyUrl);
}

export function removeProxy(proxyUrl: string) {
  return proxyService.removeProxy(proxyUrl);
}

// ─── Status check ────────────────────────────────────────────────────────────

export function isDirectModeAvailable(): boolean {
  return getStore().accounts.length > 0 && getStore().accounts.some((a) => a.loggedIn);
}

export function getDirectModeStatus(): {
  available: boolean;
  accountCount: number;
  loggedInCount: number;
} {
  const store = getStore();
  return {
    available: store.accounts.some((a) => a.loggedIn),
    accountCount: store.accounts.length,
    loggedInCount: store.accounts.filter((a) => a.loggedIn).length,
  };
}
