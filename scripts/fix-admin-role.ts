/**
 * Script CLI sửa lỗi "admin biến thành chủ trọ" - chạy trực tiếp trên server
 * 
 * Chạy: npx tsx scripts/fix-admin-role.ts
 * 
 * Công dụng:
 * 1. Tìm tất cả user có vaiTro = 'chuNha' nhưng thực chất là admin
 *    (nguoiTaoId = null hoặc email chứa 'admin')
 * 2. Khôi phục vaiTro của họ về 'admin'
 * 3. Tìm các tòa nhà có chuSoHuuId trỏ vào admin và gán lại cho chủ trọ thật (nếu có)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.POSTGRESQL_URI || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Loi: Can set bien moi truong POSTGRESQL_URI hoac DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixAdminAccount(adminUser: { id: string; ten: string; email: string | null; soDienThoai: string | null; vaiTro: string }): Promise<string[]> {
  const results: string[] = [];

  // 1. Khôi phục vaiTro của admin
  if (adminUser.vaiTro !== 'admin') {
    await prisma.nguoiDung.update({
      where: { id: adminUser.id },
      data: { vaiTro: 'admin' },
    });
    results.push(`  ✅ Đã khôi phục vaiTro của admin "${adminUser.ten}" (${adminUser.email || adminUser.soDienThoai}) từ "${adminUser.vaiTro}" thành "admin"`);
  } else {
    results.push(`  ⏭️ Admin "${adminUser.ten}" (${adminUser.email || adminUser.soDienThoai}) đã có vaiTro = "admin", không cần sửa`);
  }

  // 2. Tìm các tòa nhà có chuSoHuuId trỏ vào admin
  const buildingsOwnedByAdmin = await prisma.toaNha.findMany({
    where: { chuSoHuuId: adminUser.id },
    select: { id: true, tenToaNha: true },
  });

  if (buildingsOwnedByAdmin.length > 0) {
    results.push(`  📋 Tìm thấy ${buildingsOwnedByAdmin.length} tòa nhà có chuSoHuuId trỏ vào admin "${adminUser.ten}":`);
    for (const b of buildingsOwnedByAdmin) {
      results.push(`    - "${b.tenToaNha}" (${b.id})`);
    }

    for (const b of buildingsOwnedByAdmin) {
      const realChuTro = await prisma.toaNhaNguoiQuanLy.findFirst({
        where: {
          toaNhaId: b.id,
          nguoiDung: { vaiTro: 'chuNha', id: { not: adminUser.id } },
        },
        select: {
          nguoiDung: { select: { id: true, ten: true, soDienThoai: true, email: true } },
        },
      });

      if (realChuTro) {
        await prisma.toaNha.update({
          where: { id: b.id },
          data: { chuSoHuuId: realChuTro.nguoiDung.id },
        });
        results.push(`    → Đã gán chuSoHuuId cho "${b.tenToaNha}" về chủ trọ "${realChuTro.nguoiDung.ten}" (${realChuTro.nguoiDung.soDienThoai || realChuTro.nguoiDung.email})`);
      } else {
        results.push(`    → Tòa nhà "${b.tenToaNha}" chưa có chủ trọ thật. Vui lòng tạo chủ trọ mới và chỉnh sửa tòa nhà để gán.`);
      }
    }
  } else {
    results.push(`  📋 Không có tòa nhà nào có chuSoHuuId trỏ vào admin "${adminUser.ten}"`);
  }

  return results;
}

async function main() {
  console.log('=== SỬA LỖI "ADMIN BIẾN THÀNH CHỦ TRỌ" ===\n');

  // Tìm tất cả user có vaiTro = 'chuNha' nhưng thực chất là admin
  // Dùng $queryRaw vì nguoiTaoId không có trong Prisma schema
  const potentialAdmins = await prisma.$queryRaw<Array<{ id: string; ten: string; email: string | null; soDienThoai: string | null; vaiTro: string }>>`
    SELECT id, ten, email, "soDienThoai", "vaiTro"
    FROM "NguoiDung"
    WHERE "vaiTro" = 'chuNha'
      AND ("nguoiTaoId" IS NULL OR LOWER(email) LIKE '%admin%')
    ORDER BY ten
  `;

  if (potentialAdmins.length === 0) {
    console.log('Không tìm thấy tài khoản admin nào bị lỗi (vaiTro = "chuNha")');
    await prisma.$disconnect();
    return;
  }

  console.log(`Tìm thấy ${potentialAdmins.length} tài khoản nghi là admin bị lỗi:\n`);
  for (const acc of potentialAdmins) {
    console.log(`  - "${acc.ten}" (${acc.email || acc.soDienThoai})`);
  }

  console.log('\n--- Bắt đầu sửa ---\n');
  let totalFixed = 0;
  let totalBuildingsFixed = 0;

  for (const acc of potentialAdmins) {
    console.log(`\nĐang xử lý: "${acc.ten}" (${acc.email || acc.soDienThoai})...`);
    const accResults = await fixAdminAccount(acc);
    for (const r of accResults) {
      console.log(r);
    }
    if (accResults.some(r => r.includes('✅'))) totalFixed++;
    if (accResults.some(r => r.includes('Đã gán chuSoHuuId'))) totalBuildingsFixed++;
  }

  console.log(`\n=== HOÀN TẤT ===`);
  console.log(`Đã sửa ${totalFixed} tài khoản admin, ${totalBuildingsFixed} tòa nhà`);
  console.log(`\n⚠️  QUAN TRỌNG: Đăng xuất và đăng nhập lại để thấy thay đổi!`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});
