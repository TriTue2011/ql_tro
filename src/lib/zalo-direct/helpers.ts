/**
 * zalo-direct/helpers.ts
 * File/image utilities cho Zalo direct integration.
 * Port từ bot server utils/helpers.js
 */

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

// Thư mục tạm cho file/ảnh
const TEMP_DIR = path.join(process.cwd(), "tmp", "zalo");

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/** Tải ảnh từ URL, lưu tạm, trả về đường dẫn local */
export async function saveImage(url: string): Promise<string | null> {
  try {
    ensureTempDir();
    const imgPath = path.join(TEMP_DIR, `img_${Date.now()}.png`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
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
        filename = path.basename(new URL(url).pathname) || filename;
      } catch { /* ignore */ }
    }

    const tempFilePath = path.join(TEMP_DIR, `${Date.now()}-${filename}`);

    if (!res.body) throw new Error("Response body is empty");

    // @ts-ignore - res.body is a ReadableStream
    const nodeStream = Readable.fromWeb(res.body as any);
    await pipeline(nodeStream, fs.createWriteStream(tempFilePath));

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
