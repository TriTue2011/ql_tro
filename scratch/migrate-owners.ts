import prisma from '../src/lib/prisma';

async function main() {
  console.log('Starting migration: Assigning owners to their own buildings...');

  // 1. Lấy danh sách tất cả các tòa nhà và chủ sở hữu của chúng
  const allBuildings = await prisma.toaNha.findMany({
    select: {
      id: true,
      chuSoHuuId: true,
      tenToaNha: true,
    }
  });

  console.log(`Found ${allBuildings.length} buildings.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const building of allBuildings) {
    // 2. Kiểm tra xem chủ sở hữu đã có trong bảng ToaNhaNguoiQuanLy chưa
    const existing = await prisma.toaNhaNguoiQuanLy.findUnique({
      where: {
        toaNhaId_nguoiDungId: {
          toaNhaId: building.id,
          nguoiDungId: building.chuSoHuuId,
        }
      }
    });

    if (!existing) {
      // 3. Nếu chưa có, thêm vào
      await prisma.toaNhaNguoiQuanLy.create({
        data: {
          toaNhaId: building.id,
          nguoiDungId: building.chuSoHuuId,
          // Mặc định chủ nhà có tất cả quyền
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

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
