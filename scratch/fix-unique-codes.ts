import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  console.log('--- Loading environment ---');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.join(__dirname, '..');

  // Tự động tìm và nạp env
  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const file of envFiles) {
    const envPath = path.join(rootDir, file);
    if (fs.existsSync(envPath)) {
      console.log(`Loading ${file}...`);
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) {
          const key = m[1];
          const val = m[2].replace(/^['"]|['"]$/g, '').trim();
          if (!process.env[key]) process.env[key] = val;
        }
      });
    }
  }

  if (!process.env.POSTGRESQL_URI && !process.env.DATABASE_URL) {
    console.error('ERROR: No database connection string found in .env files!');
    process.exit(1);
  }

  // Dùng DATABASE_URL làm fallback cho Prisma if needed
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.POSTGRESQL_URI;

  console.log('Connecting to database...');
  // Dynamic import để tránh hoisting lỗi
  const { default: prisma } = await import('../src/lib/prisma.js');

  console.log('Starting migration: Populating toaNhaId for HopDong and HoaDon...');

  // 1. Update HopDong
  const allHopDongs = await prisma.hopDong.findMany({
    include: { phong: { select: { toaNhaId: true } } }
  });
  
  console.log(`Found ${allHopDongs.length} contracts.`);
  for (const hd of allHopDongs) {
    if (!hd.toaNhaId && hd.phong.toaNhaId) {
      await prisma.hopDong.update({
        where: { id: hd.id },
        data: { toaNhaId: hd.phong.toaNhaId }
      });
    }
  }

  // 2. Update HoaDon
  const allHoaDons = await prisma.hoaDon.findMany({
    include: { phong: { select: { toaNhaId: true } } }
  });

  console.log(`Found ${allHoaDons.length} invoices.`);
  for (const hd of allHoaDons) {
    if (!hd.toaNhaId && hd.phong.toaNhaId) {
      await prisma.hoaDon.update({
        where: { id: hd.id },
        data: { toaNhaId: hd.phong.toaNhaId }
      });
    }
  }

  console.log('Migration completed successfully.');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // await prisma.$disconnect(); // disconnected inside catch/finally if possible
  });
