import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  console.log('--- Loading environment ---');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.join(__dirname, '..');

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

  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.POSTGRESQL_URI;

  const { default: prisma } = await import('../src/lib/prisma.js');

  console.log('Starting migration: Assigning owners to their own buildings...');

  const allBuildings = await prisma.toaNha.findMany({
    select: { id: true, chuSoHuuId: true, tenToaNha: true }
  });

  console.log(`Found ${allBuildings.length} buildings.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const building of allBuildings) {
    const existing = await prisma.toaNhaNguoiQuanLy.findUnique({
      where: {
        toaNhaId_nguoiDungId: {
          toaNhaId: building.id,
          nguoiDungId: building.chuSoHuuId,
        }
      }
    });

    if (!existing) {
      await prisma.toaNhaNguoiQuanLy.create({
        data: {
          toaNhaId: building.id,
          nguoiDungId: building.chuSoHuuId,
          quyenKichHoatTaiKhoan: true,
          quyenHopDong: true,
          quyenHoaDon: true,
          quyenThanhToan: true,
          quyenSuCo: true,
        }
      });
      console.log(`Migrated: Owner of building "${building.tenToaNha}" assigned.`);
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log('Migration completed.');
  console.log(`Total: ${allBuildings.length} | Migrated: ${migratedCount} | Skipped: ${skippedCount}`);
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
