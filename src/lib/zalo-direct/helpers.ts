/**
 * zalo-direct/helpers.ts
 * File/image utilities cho Zalo direct integration.
 * Port từ bot server utils/helpers.js
 */

import fs from "fs";
import path from "path";
// Thư mục tạm cho file/ảnh
const TEMP_DIR = path.join(process.cwd(), "tmp", "zalo");

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Resolve URL thành local file path nếu file nằm trên chính server này.
 * Tránh lỗi "fetch failed" khi server tự fetch chính nó.
 *
 * - /uploads/xxx → public/uploads/xxx (local storage)
 * - http://host/uploads/xxx → public/uploads/xxx
 * - /api/files/bucket/obj → tải trực tiếp từ MinIO
 * - http://host/api/files/bucket/obj → tải trực tiếp từ MinIO
 */
function resolveLocalUploadPath(url: string): string | null {
  try {
    const parsed = new URL(url, "http://x");
    if (parsed.pathname.startsWith("/uploads/")) {
      const localPath = path.join(process.cwd(), "public", parsed.pathname);
      if (fs.existsSync(localPath)) return localPath;
    }
  } catch { /* ignore */ }
  return null;
}

async function resolveMinioToBuffer(url: string): Promise<Buffer | null> {
  try {
    const { getMinioConfig, createMinioClient } = await import("@/lib/minio");
    const config = await getMinioConfig();
    const client = createMinioClient(config);

    const parsed = new URL(url, "http://x");

    // Case 1: Internal API path /api/files/bucket/objectName
    if (parsed.pathname.startsWith("/api/files/")) {
      const parts = parsed.pathname.replace("/api/files/", "").split("/");
      if (parts.length < 2) return null;
      const bucket = parts[0];
      const objectName = decodeURIComponent(parts.slice(1).join("/"));
      const chunks: Buffer[] = [];
      const stream = await client.getObject(bucket, objectName);
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    }

    // Case 2: Presigned MinIO URL (http://minio-host:port/bucket/obj?X-Amz-...)
    // Nhận dạng bằng cách so sánh hostname/port với MinIO config
    const minioHost = config.endpoint.replace(/^https?:\/\//, "");
    if (
      (parsed.hostname === minioHost || parsed.host === `${minioHost}:${config.port}`) &&
      parsed.searchParams.has("X-Amz-Credential")
    ) {
      // Trích xuất bucket/objectName từ pathname: /bucket/folder/file.pdf
      const pathParts = parsed.pathname.replace(/^\//, "").split("/");
      if (pathParts.length < 2) return null;
      const bucket = pathParts[0];
      const objectName = decodeURIComponent(pathParts.slice(1).join("/"));
      console.log(`[ZaloDirect] Tải presigned MinIO: bucket=${bucket}, obj=${objectName}`);
      const chunks: Buffer[] = [];
      const stream = await client.getObject(bucket, objectName);
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    }

    return null;
  } catch (err: any) {
    console.error("[ZaloDirect] Lỗi tải từ MinIO:", err.message);
    return null;
  }
}

/**
 * Đọc dữ liệu file từ URL — ưu tiên đọc local, fallback fetch HTTP.
 */
async function fetchBuffer(url: string): Promise<Buffer> {
  // 1. Local uploads → đọc trực tiếp từ disk
  const localPath = resolveLocalUploadPath(url);
  if (localPath) return fs.readFileSync(localPath);

  // 2. MinIO → tải trực tiếp từ MinIO server (không qua HTTP API)
  const minioBuf = await resolveMinioToBuffer(url);
  if (minioBuf) return minioBuf;

  // 3. Kiểm tra self-fetch trước khi HTTP fetch
  try {
    const parsed = new URL(url);
    if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/uploads/"))) {
      throw new Error(`Không thể tải file từ chính server (${parsed.pathname}). Kiểm tra cấu hình storage.`);
    }
  } catch (e: any) {
    if (e.message?.includes("Không thể tải")) throw e;
  }

  // 4. HTTP fetch bình thường (external URLs, Cloudinary, etc.)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Tải ảnh từ URL, lưu tạm, trả về đường dẫn local (giữ nguyên extension gốc) */
export async function saveImage(url: string): Promise<string | null> {
  try {
    ensureTempDir();
    const buf = await fetchBuffer(url);

    // Xác định extension từ URL hoặc content-type
    let ext = ".png";
    try {
      const pathname = new URL(url, "http://x").pathname;
      const urlExt = path.extname(pathname).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(urlExt)) {
        ext = urlExt;
      }
    } catch { /* ignore */ }
    // Fallback: detect từ magic bytes
    if (ext === ".png") {
      if (buf[0] === 0xFF && buf[1] === 0xD8) ext = ".jpg";
      else if (buf[0] === 0x89 && buf[1] === 0x50) ext = ".png";
      else if (buf[0] === 0x47 && buf[1] === 0x49) ext = ".gif";
      else if (buf[0] === 0x52 && buf[1] === 0x49) ext = ".webp"; // RIFF
    }

    const imgPath = path.join(TEMP_DIR, `img_${Date.now()}${ext}`);
    fs.writeFileSync(imgPath, buf);
    return imgPath;
  } catch (error: any) {
    console.error("[ZaloDirect] Lỗi saveImage:", error.message);
    return null;
  }
}

/** Xóa file ảnh tạm */
export function removeImage(imgPath: string) {
  try {
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  } catch (error: any) {
    console.error(`[ZaloDirect] Lỗi removeImage ${imgPath}:`, error.message);
  }
}

/** Tải file từ URL, lưu tạm, trả về đường dẫn local */
export async function saveFileFromUrl(url: string): Promise<string | null> {
  try {
    ensureTempDir();

    // Thử đọc local trước, fallback fetch HTTP
    const localPath = resolveLocalUploadPath(url);
    if (localPath) {
      const filename = path.basename(localPath);
      const tempFilePath = path.join(TEMP_DIR, `${Date.now()}-${filename}`);
      fs.copyFileSync(localPath, tempFilePath);
      return tempFilePath;
    }

    const minioBuf = await resolveMinioToBuffer(url);
    if (minioBuf) {
      let filename = `file_${Date.now()}`;
      try {
        const base = path.basename(new URL(url, "http://x").pathname);
        if (base && base.includes(".")) filename = base;
      } catch { /* ignore */ }
      const tempFilePath = path.join(TEMP_DIR, `${Date.now()}-${filename}`);
      fs.writeFileSync(tempFilePath, minioBuf);
      return tempFilePath;
    }

    // Kiểm tra nếu URL trỏ về chính server này (self-fetch) → không thể fetch
    try {
      const parsed = new URL(url);
      if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
          (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/uploads/"))) {
        console.error(`[ZaloDirect] saveFileFromUrl: URL trỏ về chính server (${url}) nhưng local resolve thất bại`);
        return null;
      }
    } catch { /* ignore - not a valid URL, proceed with fetch */ }

    // HTTP fetch cho external URLs
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Lấy filename từ header hoặc URL
    const contentDisposition = res.headers.get("content-disposition");
    let filename = `file_${Date.now()}`;
    if (contentDisposition) {
      const m = /filename="?([^"]+)"?/.exec(contentDisposition);
      if (m?.[1]) filename = m[1];
    } else {
      try {
        const base = path.basename(new URL(url).pathname);
        if (base && base.includes('.')) filename = base;
      } catch { /* ignore */ }
    }

    const tempFilePath = path.join(TEMP_DIR, `${Date.now()}-${filename}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tempFilePath, buf);

    return tempFilePath;
  } catch (error: any) {
    console.error("[ZaloDirect] Lỗi saveFileFromUrl:", error.message);
    return null;
  }
}

/** Xóa file tạm */
export function removeFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error: any) {
    console.error(`[ZaloDirect] Lỗi removeFile ${filePath}:`, error.message);
  }
}

/** Lấy metadata ảnh (width, height, size) */
export async function getImageMetadata(filePath: string): Promise<{ width: number; height: number; size: number }> {
  const defaults = { width: 1280, height: 720, size: 300000 };

  try {
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return defaults;
    }

    if (!fs.existsSync(filePath)) return defaults;

    const stats = fs.statSync(filePath);

    // Thử dùng image-size
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

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = (buffer[16] << 24) + (buffer[17] << 16) + (buffer[18] << 8) + buffer[19];
      const height = (buffer[20] << 24) + (buffer[21] << 16) + (buffer[22] << 8) + buffer[23];
      return { width, height, size: stats.size };
    }

    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      const fileData = fs.readFileSync(filePath);
      let pos = 2;
      while (pos < fileData.length) {
        if (fileData[pos] !== 0xff) { pos++; continue; }
        if (fileData[pos + 1] >= 0xc0 && fileData[pos + 1] <= 0xcf && fileData[pos + 1] !== 0xc4 && fileData[pos + 1] !== 0xc8) {
          const h = (fileData[pos + 5] << 8) + fileData[pos + 6];
          const w = (fileData[pos + 7] << 8) + fileData[pos + 8];
          return { width: w, height: h, size: stats.size };
        }
        pos += 2 + (fileData[pos + 2] << 8) + fileData[pos + 3];
      }
    }

    return { ...defaults, size: stats.size };
  } catch {
    return defaults;
  }
}

/** Thư mục lưu cookies/credentials */
export function getCookiesDir(): string {
  const dir = path.join(process.cwd(), "tmp", "zalo", "cookies");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Đường dẫn file proxies.json */
export function getProxiesFilePath(): string {
  const dir = path.join(process.cwd(), "tmp", "zalo");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "proxies.json");
}
