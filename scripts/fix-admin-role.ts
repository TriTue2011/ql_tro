/**
 * Script CLI sửa lỗi "admin biến thành chủ trọ" - chạy trực tiếp trên server
 *
 * Chạy: npx tsx scripts/fix-admin-role.ts
 *
 * Công dụng:
 * 1. Tìm tài khoản admin thật (email: tritue0610@gmail.com) đang bị vaiTro='chuNha'
 * 2. Khôi phục vaiTro của admin về 'admin'
 * 3. Tìm các tòa nhà có chuSoHuuId trỏ vào admin và gán lại cho chủ trọ thật (nếu có)
 *
 * Có thể chỉ định email admin khác bằng biến môi trường ADMIN_EMAIL
 *   ADMIN_EMAIL="admin@example.com" npx tsx scripts/fix-admin-role.ts
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

  // Xác định email admin cần sửa (mặc định: tritue0610@gmail.com)
  const adminEmail = process.env.ADMIN_EMAIL || 'tritue0610@gmail.com';

  // Tìm admin bằng email
  const adminUser = await prisma.nguoiDung.findFirst({
    where: { email: adminEmail.toLowerCase() },
    select: { id: true, ten: true, email: true, soDienThoai: true, vaiTro: true },
  });

  if (!adminUser) {
    console.log(`Không tìm thấy tài khoản với email "${adminEmail}"`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Tìm thấy tài khoản: "${adminUser.ten}" (${adminUser.email || adminUser.soDienThoai})`);
  console.log(`VaiTro hiện tại: "${adminUser.vaiTro}"\n`);

  if (adminUser.vaiTro === 'admin') {
    console.log('Tài khoản này đã có vaiTro = "admin", không cần sửa.');
    await prisma.$disconnect();
    return;
  }

  console.log('--- Bắt đầu sửa ---\n');
  const results = await fixAdminAccount(adminUser);
  for (const r of results) {
    console.log(r);
  }

  const totalFixed = results.some(r => r.includes('✅')) ? 1 : 0;
  const totalBuildingsFixed = results.filter(r => r.includes('Đã gán chuSoHuuId')).length;

  console.log(`\n=== HOÀN TẤT ===`);
  console.log(`Đã sửa ${totalFixed} tài khoản admin, ${totalBuildingsFixed} tòa nhà`);
  console.log(`\n⚠️  QUAN TRỌNG: Đăng xuất và đăng nhập lại để thấy thay đổi!`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});
