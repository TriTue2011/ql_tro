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
import type { ImageMetadataGetterResponse } from "zca-js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { setupListeners } from "./events";
import { sseEmit } from "@/lib/sse-emitter";

/**
 * Đọc metadata ảnh (width, height, size) từ file path — cần cho zca-js khi gửi ảnh.
 * Port từ bot server loginZaloAccount → getImageMetadata.
 */
async function imageMetadataGetter(filePath: string): Promise<ImageMetadataGetterResponse> {
  try {
    // Nếu là URL, trả về mặc định
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return { width: 1280, height: 720, size: 300000 };
    }

    if (!fs.existsSync(filePath)) {
      return { width: 1280, height: 720, size: 300000 };
    }

    const stats = fs.statSync(filePath);

    // Thử dùng image-size nếu có
    try {
      const { imageSize } = await import("image-size");
      const dimensions = imageSize(fs.readFileSync(filePath));
      if (dimensions.width && dimensions.height) {
        return { width: dimensions.width, height: dimensions.height, size: stats.size };
      }
    } catch { /* fallback */ }

    // Fallback: đọc header file
    const buffer = Buffer.alloc(24);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // JPEG: tìm SOF marker
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      const fileData = fs.readFileSync(filePath);
      let pos = 2;
      while (pos < fileData.length) {
        if (fileData[pos] !== 0xFF) { pos++; continue; }
        if (fileData[pos + 1] >= 0xC0 && fileData[pos + 1] <= 0xCF && fileData[pos + 1] !== 0xC4 && fileData[pos + 1] !== 0xC8) {
          const h = (fileData[pos + 5] << 8) + fileData[pos + 6];
          const w = (fileData[pos + 7] << 8) + fileData[pos + 8];
          return { width: w, height: h, size: stats.size };
        }
        pos += 2 + (fileData[pos + 2] << 8) + fileData[pos + 3];
      }
    }

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      const width = (buffer[16] << 24) + (buffer[17] << 16) + (buffer[18] << 8) + buffer[19];
      const height = (buffer[20] << 24) + (buffer[21] << 16) + (buffer[22] << 8) + buffer[23];
      return { width, height, size: stats.size };
    }

    return { width: 1280, height: 720, size: stats.size };
  } catch {
    return { width: 1280, height: 720, size: 300000 };
  }
}
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
 * Login bằng QR code.
 *
 * zca-js `loginQR()` BLOCK cho đến khi user scan xong hoặc timeout.
 * Nếu await trực tiếp thì API response không bao giờ trả về QR image.
 *
 * Giải pháp: Trả về QR image ngay khi callback type 0 (QRCodeGenerated) fire,
 * login tiếp tục chạy nền. Khi user scan xong → tự đăng ký account.
 */
export async function loginWithQR(proxyUrl?: string): Promise<LoginResult> {
  try {
    const zalo = new Zalo({
      imageMetadataGetter,
      ...(proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {}),
    });

    return new Promise<LoginResult>((resolve) => {
      let resolved = false;
      // Lưu credentials từ GotLoginInfo callback (type 4) — đây là format đúng để re-login
      let qrCredentials: { imei: string; cookie: any; userAgent: string } | null = null;

      // loginQR returns Promise<API> - blocks until scan complete
      const loginPromise = zalo.loginQR({}, (event: LoginQRCallbackEvent) => {
        // Type 0 = QR image generated → trả về ngay cho frontend
        if (event.type === 0 /* QRCodeGenerated */ && !resolved) {
          resolved = true;
          resolve({ ok: true, qrCode: event.data.image });
        }
        // Type 1 = QR expired
        if (event.type === 1 /* QRCodeExpired */) {
          console.warn("[ZaloDirect] QR code hết hạn");
          sseEmit("zalo-qr-login", { ok: false, error: "QR code hết hạn, vui lòng tạo lại" });
        }
        // Type 2 = QR scanned (user đã quét)
        if (event.type === 2 /* QRCodeScanned */) {
          console.log("[ZaloDirect] QR đã được quét, đang xác thực...");
          sseEmit("zalo-qr-login", { ok: true, status: "scanned" });
        }
        // Type 3 = QR declined
        if (event.type === 3 /* QRCodeDeclined */) {
          console.warn("[ZaloDirect] QR bị từ chối");
          sseEmit("zalo-qr-login", { ok: false, error: "QR bị từ chối" });
        }
        // Type 4 = GotLoginInfo → lưu credentials để dùng cho re-login
        if (event.type === 4 /* GotLoginInfo */) {
          qrCredentials = event.data as any;
          console.log("[ZaloDirect] Nhận được login credentials từ QR");
        }
      });

      // Login hoàn tất ở background → đăng ký account
      loginPromise
        .then((api) => {
          if (!api) {
            sseEmit("zalo-qr-login", { ok: false, error: "Không thể khởi tạo API từ QR login" });
            if (!resolved) { resolved = true; resolve({ ok: false, error: "Không thể khởi tạo API từ QR login" }); }
            return;
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

          // Lưu credentials đúng format {imei, cookie, userAgent} từ GotLoginInfo
          // Fallback: lưu context nếu không bắt được GotLoginInfo
          if (qrCredentials) {
            saveCookies(ownId, qrCredentials);
          } else {
            saveCookies(ownId, {
              imei: (ctx as any)?.imei,
              cookie: (ctx as any)?.cookie,
              userAgent: (ctx as any)?.userAgent,
            });
          }

          const store = getStore();
          const existingIdx = store.accounts.findIndex((a) => a.ownId === ownId);
          if (existingIdx >= 0) {
            store.accounts[existingIdx] = account;
          } else {
            store.accounts.push(account);
          }

          setupListeners(api, ownId, () => handleRelogin(ownId));
          console.log(`[ZaloDirect] QR login thành công: ${ownId} (${account.name})`);
          sseEmit("zalo-qr-login", { ok: true, ownId, name: account.name });
        })
        .catch((err) => {
          console.error("[ZaloDirect] QR login background error:", err);
          sseEmit("zalo-qr-login", { ok: false, error: err.message || "Lỗi đăng nhập QR" });
          if (!resolved) {
            resolved = true;
            resolve({ ok: false, error: err.message || "Lỗi đăng nhập QR" });
          }
        });

      // Timeout 2 phút nếu không nhận được QR
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ ok: false, error: "Timeout: Không tạo được mã QR sau 2 phút" });
        }
      }, 120_000);
    });
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
      imageMetadataGetter,
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

    // Lưu credentials đúng format {imei, cookie, userAgent} cho re-login
    saveCookies(resolvedOwnId, {
      imei: (ctx as any)?.imei,
      cookie: (ctx as any)?.cookie,
      userAgent: (ctx as any)?.userAgent,
    });

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

    // Nếu lỗi zpw_sek / phiên hết hạn → xóa cookies hỏng
    const errMsg = (err.message || "").toLowerCase();
    if (errMsg.includes("zpw_sek") || errMsg.includes("zpw_enk") || errMsg.includes("missing required")) {
      try {
        const p = cookiePath(ownId);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.warn(`[ZaloDirect] Đã xóa cookies hết hạn cho ${ownId}`);
        }
      } catch { /* ignore */ }
      return { ok: false, error: `Phiên đăng nhập hết hạn cho ${ownId}. Cần đăng nhập lại bằng QR.` };
    }

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

  // KHÔNG set loggedIn = false ngay — giữ trạng thái "đang kết nối" trong khi retry
  // Chỉ đánh dấu offline nếu tất cả retry thất bại

  // Retry 3 lần với delay tăng dần
  for (let attempt = 1; attempt <= 3; attempt++) {
    await new Promise((r) => setTimeout(r, attempt * 3000));

    // Nếu cookies đã bị xóa (session hết hạn), dừng retry
    if (!fs.existsSync(cookiePath(ownId))) {
      console.warn(`[ZaloDirect] Cookies đã bị xóa cho ${ownId}, cần đăng nhập lại bằng QR`);
      account.loggedIn = false;
      return;
    }

    const result = await loginWithCookies(ownId, account.proxy);
    if (result.ok) {
      console.log(`[ZaloDirect] Relogin thành công cho ${ownId} (attempt ${attempt})`);
      return;
    }
    console.warn(`[ZaloDirect] Relogin attempt ${attempt} thất bại cho ${ownId}: ${result.error}`);

    // Nếu lỗi session hết hạn, không cần retry nữa
    if (result.error?.includes("QR") || result.error?.includes("hết hạn")) {
      account.loggedIn = false;
      return;
    }
  }
  console.error(`[ZaloDirect] Relogin thất bại cho ${ownId} sau 3 lần thử`);
  account.loggedIn = false;
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

// ─── Session error detection + auto-relogin ─────────────────────────────────

/** Kiểm tra lỗi liên quan đến phiên đăng nhập hết hạn */
function isSessionError(err: any): boolean {
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes("zpw_sek") || msg.includes("zpw_enk")
    || msg.includes("not logged in") || msg.includes("session")
    || msg.includes("phiên") || msg.includes("đăng nhập thất bại");
}

/**
 * Thử relogin tài khoản khi phát hiện session hết hạn.
 * Trả về api mới nếu relogin thành công, null nếu thất bại.
 */
async function trySessionRelogin(accountSelection?: string): Promise<ZcaAPI | null> {
  const acc = findAccount(accountSelection);
  if (!acc) return null;

  console.warn(`[ZaloDirect] Session hết hạn cho ${acc.ownId}, thử đăng nhập lại...`);
  const result = await loginWithCookies(acc.ownId, acc.proxy);
  if (result.ok) {
    console.log(`[ZaloDirect] Relogin thành công cho ${acc.ownId}`);
    return getApi(accountSelection);
  }

  // Cookies hỏng → xóa file cookies và đánh dấu logout
  console.error(`[ZaloDirect] Relogin thất bại cho ${acc.ownId}: ${result.error}`);
  acc.loggedIn = false;
  try {
    const p = cookiePath(acc.ownId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    console.warn(`[ZaloDirect] Đã xóa cookies hết hạn cho ${acc.ownId}`);
  } catch { /* ignore */ }
  return null;
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
  let api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo nào đang đăng nhập" };

  try {
    const message: any = { msg, ttl };
    if (quote) message.quote = quote;
    await api.sendMessage(message, threadId, type as any);
    return { ok: true };
  } catch (err: any) {
    // Session hết hạn → thử relogin 1 lần
    if (isSessionError(err)) {
      api = await trySessionRelogin(accountSelection);
      if (api) {
        try {
          const message: any = { msg, ttl };
          if (quote) message.quote = quote;
          await api.sendMessage(message, threadId, type as any);
          return { ok: true };
        } catch (retryErr: any) {
          return { ok: false, error: retryErr.message || "Lỗi gửi tin nhắn sau relogin" };
        }
      }
      return { ok: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại bằng QR." };
    }
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
  let api = getApi(accountSelection);
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

    const msgPayload = { msg: caption, attachments: [localPath], ttl };

    try {
      await api.sendMessage(msgPayload, threadId, type as any);
      return { ok: true };
    } catch (err: any) {
      if (isSessionError(err)) {
        api = await trySessionRelogin(accountSelection);
        if (api) {
          await api.sendMessage(msgPayload, threadId, type as any);
          return { ok: true };
        }
        return { ok: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại bằng QR." };
      }
      throw err;
    }
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
  let api = getApi(accountSelection);
  if (!api) return { ok: false, error: "Không có tài khoản Zalo" };

  let localPath: string | null = null;

  try {
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      console.log(`[ZaloDirect] sendFile: tải file từ ${fileUrl.slice(0, 120)}...`);
      localPath = await saveFileFromUrl(fileUrl);
      if (!localPath) return { ok: false, error: `Không tải được file từ URL: ${fileUrl.slice(0, 100)}` };
    } else {
      localPath = fileUrl;
    }

    // Kiểm tra file tồn tại và có dữ liệu
    if (!fs.existsSync(localPath)) return { ok: false, error: `File không tồn tại: ${localPath}` };
    const stat = fs.statSync(localPath);
    if (stat.size === 0) return { ok: false, error: "File rỗng (0 bytes)" };

    const ext = path.extname(localPath).toLowerCase();
    console.log(`[ZaloDirect] sendFile: ${localPath} (${stat.size} bytes, ext=${ext}) → ${threadId}`);

    const msgPayload = { msg: caption || "", attachments: [localPath], ttl };

    // Wrap trong timeout vì zca-js file upload chờ WebSocket callback có thể treo
    const sendWithTimeout = (apiInstance: any) =>
      Promise.race([
        apiInstance.sendMessage(msgPayload, threadId, type as any),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout gửi file sau 60 giây")), 60_000)
        ),
      ]);

    try {
      await sendWithTimeout(api);
      console.log(`[ZaloDirect] sendFile thành công: ${ext} → ${threadId}`);
      return { ok: true };
    } catch (err: any) {
      console.error(`[ZaloDirect] sendFile lần 1 lỗi (ext=${ext}):`, err.message, err.stack?.slice(0, 300));
      if (isSessionError(err)) {
        api = await trySessionRelogin(accountSelection);
        if (api) {
          await sendWithTimeout(api);
          return { ok: true };
        }
        return { ok: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại bằng QR." };
      }
      throw err;
    }
  } catch (err: any) {
    console.error("[ZaloDirect] sendFile error:", err.message, err.stack?.slice(0, 300));
    return { ok: false, error: `Lỗi gửi file: ${err.message}` };
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
    // zca-js: forwardMessage(payload, threadIds[], type) — nhận array threadIds
    await (api as any).forwardMessage?.(params, threadIds, type === "group" ? 1 : 0);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function undoMessage(
  payload: { msgId: string; cliMsgId?: string },
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
    // zca-js: deleteMessage({ threadId, type, data: { cliMsgId, msgId, uidFrom } }, onlyMe)
    await (api as any).deleteMessage?.({
      threadId: dest.threadId,
      type: dest.type === "group" ? 1 : 0,
      data: { cliMsgId: dest.cliMsgId, msgId: dest.msgId, uidFrom: dest.uidFrom },
    }, onlyMe);
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
    // zca-js: sendFriendRequest(msg, userId) — msg trước, userId sau
    await api.sendFriendRequest(message, userId);
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
    // zca-js: changeFriendAlias(alias, friendId) — alias trước, friendId sau
    await (api as any).changeFriendAlias?.(alias, friendId);
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
    // zca-js: getGroupInfo(groupId: string | string[]) — nhận cả string lẫn array
    const data = await api.getGroupInfo(groupId);
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
