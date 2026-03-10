#!/bin/bash
# Script khởi động tất cả dịch vụ cho ql-tro
# Thêm vào crontab: @reboot /home/user/ql_tro/scripts/start-services.sh

set -e

echo "[$(date)] Khởi động PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || echo "PostgreSQL đã chạy hoặc lỗi khởi động"

# Đợi PostgreSQL sẵn sàng
echo "[$(date)] Đợi PostgreSQL sẵn sàng..."
for i in {1..10}; do
  pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1 && break
  echo "  Thử lần $i..."
  sleep 2
done

pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1 \
  && echo "[$(date)] PostgreSQL sẵn sàng." \
  || echo "[$(date)] CẢNH BÁO: PostgreSQL chưa sẵn sàng sau 20 giây!"

echo "[$(date)] Khởi động ql-tro qua PM2..."
cd "$(dirname "$0")/.."
pm2 start ecosystem.config.js --env production 2>/dev/null \
  || pm2 restart ql-tro 2>/dev/null \
  || echo "PM2 đã chạy hoặc lỗi."

pm2 save

echo "[$(date)] Hoàn tất."
