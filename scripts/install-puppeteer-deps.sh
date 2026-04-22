#!/bin/bash
# Cài dependencies hệ thống cho Puppeteer (xuất PDF hóa đơn)
# Chạy 1 lần khi setup server mới, hoặc deploy.sh tự gọi nếu phát hiện thiếu.
# Idempotent: đã cài rồi thì bỏ qua.

set -e

# Kiểm tra nhanh bằng libnspr4 — nếu có rồi coi như đủ
if ldconfig -p 2>/dev/null | grep -q "libnspr4.so" \
  && ldconfig -p 2>/dev/null | grep -q "libasound.so.2"; then
  echo "[puppeteer-deps] Đã cài đủ deps, bỏ qua."
  exit 0
fi

echo "[puppeteer-deps] Cài deps cho Puppeteer..."

# Ubuntu 24.04+ / Debian trixie dùng libasound2t64, cũ hơn dùng libasound2
ASOUND_PKG="libasound2t64"
if ! apt-cache show "$ASOUND_PKG" >/dev/null 2>&1; then
  ASOUND_PKG="libasound2"
fi

apt-get install -y --no-install-recommends \
  libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libx11-6 libxext6 libxss1 \
  "$ASOUND_PKG" \
  fonts-noto fonts-noto-cjk fonts-liberation

echo "[puppeteer-deps] Hoàn tất."

# Verify
CHROME_BIN=$(ls -1 /root/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | head -1)
if [ -n "$CHROME_BIN" ]; then
  MISSING=$(ldd "$CHROME_BIN" 2>/dev/null | grep "not found" || true)
  if [ -n "$MISSING" ]; then
    echo "[puppeteer-deps] CẢNH BÁO: vẫn còn lib thiếu:"
    echo "$MISSING"
    exit 1
  fi
  echo "[puppeteer-deps] Chrome kiểm tra OK — sạch lib."
fi
