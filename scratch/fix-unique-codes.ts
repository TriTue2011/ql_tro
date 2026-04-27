import prisma from '../src/lib/prisma';

async function main() {
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
    await prisma.$disconnect();
  });
