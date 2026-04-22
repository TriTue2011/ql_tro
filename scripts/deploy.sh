#!/bin/bash
# Script deploy tự động cho ql-tro
# Cron: * * * * * /opt/ql_tro/scripts/deploy.sh >> /opt/ql_tro/logs/deploy.log 2>&1

APP_DIR="/opt/ql_tro"
POSTGRES_CONTAINER="ql_tro_postgres"
LOCK_FILE="/tmp/ql_tro_deploy.lock"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Tránh chạy song song
if [ -f "$LOCK_FILE" ]; then
  echo "$LOG_PREFIX Deploy đang chạy, bỏ qua."
  exit 0
fi
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

cd "$APP_DIR" || exit 1

# 1. Fetch code mới từ GitHub
git fetch origin main --quiet 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0  # Không có gì mới, thoát im lặng
fi

echo "$LOG_PREFIX ============================================"
echo "$LOG_PREFIX Phát hiện code mới: $LOCAL -> $REMOTE"
echo "$LOG_PREFIX Bắt đầu deploy..."

# 2. Pull code mới
git pull origin main --quiet
echo "$LOG_PREFIX Pull thành công."

# 3. Đảm bảo PostgreSQL container đang chạy
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  echo "$LOG_PREFIX Khởi động PostgreSQL container..."
  docker start "$POSTGRES_CONTAINER"
  sleep 3
fi

# 4. Tự động apply migrations còn thiếu
echo "$LOG_PREFIX Kiểm tra migrations..."
for sql_file in "$APP_DIR/prisma/migrations"/*/migration.sql; do
  migration_name=$(basename "$(dirname "$sql_file")")
  already_applied=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d ql_tro -tAc \
    "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name='$migration_name';" 2>/dev/null || echo "0")
  if [ "${already_applied// /}" = "0" ]; then
    echo "$LOG_PREFIX   Applying: $migration_name"
    docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d ql_tro < "$sql_file" \
      && docker exec "$POSTGRES_CONTAINER" psql -U postgres -d ql_tro -c \
        "INSERT INTO _prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) \
         VALUES (gen_random_uuid()::text,'auto','$migration_name',NOW(),NOW(),1) ON CONFLICT DO NOTHING;" \
        >/dev/null 2>&1 \
      && echo "$LOG_PREFIX   OK: $migration_name" \
      || echo "$LOG_PREFIX   LỖI: $migration_name"
  fi
done

# 5. Cài dependencies nếu package.json thay đổi
if git diff "$LOCAL" "$REMOTE" --name-only | grep -q "package.json\|package-lock.json"; then
  echo "$LOG_PREFIX Cài dependencies..."
  npm ci --production=false --quiet
fi

# 5b. Đảm bảo system deps cho Puppeteer (xuất PDF) — idempotent
bash "$APP_DIR/scripts/install-puppeteer-deps.sh" 2>&1 | sed "s/^/$LOG_PREFIX   /"

# 6. Build
echo "$LOG_PREFIX Build..."
npm run build
echo "$LOG_PREFIX Build thành công."

# 7. Restart PM2
echo "$LOG_PREFIX Restart PM2..."
pm2 restart ql-tro 2>/dev/null || pm2 start ecosystem.config.js
pm2 save --force >/dev/null

echo "$LOG_PREFIX Deploy hoàn tất! Version: $REMOTE"
echo "$LOG_PREFIX ============================================"
