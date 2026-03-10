#!/bin/bash
# Script khởi động tất cả dịch vụ cho ql-tro
# Thêm vào crontab: @reboot /opt/ql_tro/scripts/start-services.sh

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
POSTGRES_CONTAINER="ql_tro_postgres"
MIGRATIONS_DIR="$APP_DIR/prisma/migrations"

echo "[$(date)] === Khởi động ql-tro ==="

# 1. Đảm bảo Docker container PostgreSQL đang chạy
echo "[$(date)] Kiểm tra PostgreSQL container..."
if docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  echo "[$(date)] PostgreSQL đang chạy."
else
  echo "[$(date)] Khởi động PostgreSQL container..."
  docker start "$POSTGRES_CONTAINER" 2>/dev/null \
    || echo "[$(date)] CẢNH BÁO: Không thể start container $POSTGRES_CONTAINER"
fi

# 2. Đợi PostgreSQL sẵn sàng
echo "[$(date)] Đợi PostgreSQL sẵn sàng..."
for i in {1..15}; do
  docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  echo "  Thử lần $i/15..."
  sleep 2
done

if ! docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
  echo "[$(date)] CẢNH BÁO: PostgreSQL chưa sẵn sàng sau 30 giây!"
  exit 1
fi
echo "[$(date)] PostgreSQL sẵn sàng."

# 3. Tự động apply migrations còn thiếu
echo "[$(date)] Kiểm tra và apply migrations..."
for sql_file in "$MIGRATIONS_DIR"/*/migration.sql; do
  migration_name=$(basename "$(dirname "$sql_file")")
  # Kiểm tra migration đã apply chưa (dựa theo _prisma_migrations table)
  already_applied=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d ql_tro -tAc \
    "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name='$migration_name';" 2>/dev/null || echo "0")
  if [ "$already_applied" = "0" ]; then
    echo "[$(date)]   Applying: $migration_name"
    docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d ql_tro < "$sql_file" \
      && docker exec "$POSTGRES_CONTAINER" psql -U postgres -d ql_tro -c \
        "INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (gen_random_uuid()::text, 'auto', '$migration_name', NOW(), NOW(), 1) ON CONFLICT DO NOTHING;" >/dev/null 2>&1 \
      && echo "[$(date)]   OK: $migration_name" \
      || echo "[$(date)]   LỖI khi apply: $migration_name"
  else
    echo "[$(date)]   Đã có: $migration_name"
  fi
done

# 4. Khởi động app qua PM2
echo "[$(date)] Khởi động ql-tro qua PM2..."
cd "$APP_DIR"
pm2 start ecosystem.config.js --env production 2>/dev/null \
  || pm2 restart ql-tro 2>/dev/null \
  || echo "[$(date)] PM2 đã chạy."

pm2 save

# 5. Thiết lập cron tự động deploy nếu chưa có
if ! crontab -l 2>/dev/null | grep -q "deploy.sh"; then
  echo "[$(date)] Thiết lập cron tự động deploy..."
  mkdir -p "$APP_DIR/logs"
  (crontab -l 2>/dev/null; echo "* * * * * $APP_DIR/scripts/deploy.sh >> $APP_DIR/logs/deploy.log 2>&1") | crontab -
  echo "[$(date)] Cron đã thiết lập: kiểm tra code mới mỗi phút."
fi

echo "[$(date)] === Hoàn tất ==="
