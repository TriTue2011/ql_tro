#!/usr/bin/env node
/**
 * Tự động apply Prisma migrations vào PostgreSQL trước khi build.
 * Chạy qua: npm run build (prebuild hook)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local nếu chưa được load (Node < 20)
const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}

const connectionString = process.env.POSTGRESQL_URI || process.env.DATABASE_URL;

if (!connectionString) {
  console.log('[migrate] Không có POSTGRESQL_URI, bỏ qua migration.');
  process.exit(0);
}

const pool = new Pool({ connectionString });

async function run() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Kết nối PostgreSQL thành công.');

    // Đảm bảo bảng _prisma_migrations tồn tại
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "applied_steps_count" INT NOT NULL DEFAULT 0
      );
    `);

    const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[migrate] Không tìm thấy thư mục migrations, bỏ qua.');
      return;
    }

    const folders = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort();

    for (const folder of folders) {
      const sqlFile = path.join(migrationsDir, folder, 'migration.sql');
      if (!fs.existsSync(sqlFile)) continue;

      const { rows } = await client.query(
        'SELECT id FROM _prisma_migrations WHERE migration_name = $1',
        [folder]
      );

      if (rows.length > 0) {
        console.log(`[migrate]   Đã có: ${folder}`);
        continue;
      }

      console.log(`[migrate]   Applying: ${folder}...`);
      const sql = fs.readFileSync(sqlFile, 'utf8');
      await client.query(sql);
      await client.query(
        `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, 'auto', $1, NOW(), NOW(), 1)`,
        [folder]
      );
      console.log(`[migrate]   OK: ${folder}`);
    }

    console.log('[migrate] Tất cả migrations đã được apply.');
  } catch (err) {
    console.error('[migrate] LỖI:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
