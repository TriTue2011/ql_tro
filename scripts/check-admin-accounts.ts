/**
 * Script kiểm tra tài khoản admin bị lỗi "admin biến thành chủ trọ"
 * 
 * Chạy: npx tsx scripts/check-admin-accounts.ts
 * 
 * Hiển thị:
 * - Tất cả user có vaiTro = 'admin' (đúng)
 * - Tất cả user có vaiTro = 'chuNha' nhưng nghi là admin (nguoiTaoId IS NULL)
 * - Các tòa nhà có chuSoHuuId trỏ vào admin
 * - Tất cả chủ trọ và tòa nhà họ quản lý
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.POSTGRESQL_URI || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Loi: Can set bien moi truong POSTGRESQL_URI hoac DATABASE_URL');
  console.error('Vi du:');
  console.error('  export POSTGRESQL_URI="postgresql://postgres:postgres@localhost:5432/ql_tro"');
  console.error('  npx tsx scripts/check-admin-accounts.ts');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== KIEM TRA TAI KHOAN ADMIN & CHU TRO ===\n');

  // ─── 1. Tat ca user co vaiTro = 'admin' ───
  const admins = await prisma.$queryRaw<Array<{ id: string; ten: string; email: string | null; soDienThoai: string | null; vaiTro: string; nguoiTaoId: string | null }>>`
    SELECT id, ten, email, "soDienThoai", "vaiTro", "nguoiTaoId"
    FROM "NguoiDung"
    WHERE "vaiTro" = 'admin'
    ORDER BY ten
  `;
  console.log(`[OK] Tai khoan co vaiTro = 'admin' (${admins.length}):`);
  for (const a of admins) {
    console.log(`   - ${a.ten} | ${a.email || a.soDienThoai} | nguoiTaoId: ${a.nguoiTaoId || 'null'}`);
  }

  // ─── 2. User co vaiTro = 'chuNha' nhung nghi la admin ───
  const fakeChuTro = await prisma.$queryRaw<Array<{ id: string; ten: string; email: string | null; soDienThoai: string | null; vaiTro: string; nguoiTaoId: string | null }>>`
    SELECT id, ten, email, "soDienThoai", "vaiTro", "nguoiTaoId"
    FROM "NguoiDung"
    WHERE "vaiTro" = 'chuNha'
      AND ("nguoiTaoId" IS NULL OR LOWER(email) LIKE '%admin%')
    ORDER BY ten
  `;
  console.log(`\n[SAI] Tai khoan NGHI LA ADMIN nhung dang co vaiTro = 'chuNha' (${fakeChuTro.length}):`);
  if (fakeChuTro.length === 0) {
    console.log('   (khong co)');
  } else {
    for (const a of fakeChuTro) {
      console.log(`   - ${a.ten} | ${a.email || a.soDienThoai} | nguoiTaoId: ${a.nguoiTaoId || 'null'}`);
    }
  }

  // ─── 3. Toan bo chu tro that (vaiTro = 'chuNha' va co nguoiTaoId) ───
  const realChuTroList = await prisma.$queryRaw<Array<{ id: string; ten: string; email: string | null; soDienThoai: string | null; nguoiTaoId: string | null }>>`
    SELECT id, ten, email, "soDienThoai", "nguoiTaoId"
    FROM "NguoiDung"
    WHERE "vaiTro" = 'chuNha'
      AND "nguoiTaoId" IS NOT NULL
      AND LOWER(COALESCE(email, '')) NOT LIKE '%admin%'
    ORDER BY ten
  `;
  console.log(`\n[OK] Chu tro that (vaiTro='chuNha', co nguoiTaoId) (${realChuTroList.length}):`);
  if (realChuTroList.length === 0) {
    console.log('   (khong co)');
  } else {
    for (const c of realChuTroList) {
      // Lay cac toa nha ma chu tro nay quan ly (qua ToaNhaNguoiQuanLy)
      const buildings = await prisma.$queryRaw<Array<{ tenToaNha: string; laChuSoHuu: boolean }>>`
        SELECT tn."tenToaNha",
               CASE WHEN tn."chuSoHuuId" = ${c.id} THEN true ELSE false END AS "laChuSoHuu"
        FROM "ToaNhaNguoiQuanLy" tnql
        JOIN "ToaNha" tn ON tn.id = tnql."toaNhaId"
        WHERE tnql."nguoiDungId" = ${c.id}
        ORDER BY tn."tenToaNha"
      `;
      const buildingNames = buildings.map(b => `${b.tenToaNha}${b.laChuSoHuu ? ' (owner)' : ''}`).join(', ');
      console.log(`   - ${c.ten} | ${c.email || c.soDienThoai}`);
      console.log(`     Toa nha: ${buildingNames || '(khong co)'}`);
    }
  }

  // ─── 4. Toa nha co chuSoHuuId tro vao admin ───
  const adminIds = admins.map((a: any) => a.id);
  if (adminIds.length > 0) {
    const buildingsWithAdminOwner = await prisma.$queryRaw<Array<{ id: string; tenToaNha: string; chuSoHuuId: string; ownerTen: string; ownerEmail: string | null; ownerSdt: string | null }>>`
      SELECT tn.id, tn."tenToaNha", tn."chuSoHuuId",
             nd.ten AS "ownerTen", nd.email AS "ownerEmail", nd."soDienThoai" AS "ownerSdt"
      FROM "ToaNha" tn
      JOIN "NguoiDung" nd ON nd.id = tn."chuSoHuuId"
      WHERE tn."chuSoHuuId" = ANY(${adminIds}::text[])
      ORDER BY tn."tenToaNha"
    `;
    console.log(`\n[BUILDING] Toa nha co chuSoHuuId tro vao admin (${buildingsWithAdminOwner.length}):`);
    if (buildingsWithAdminOwner.length === 0) {
      console.log('   (khong co)');
    } else {
      for (const b of buildingsWithAdminOwner) {
        console.log(`   - "${b.tenToaNha}" (${b.id})`);
        console.log(`     chuSoHuu hien tai: ${b.ownerTen} | ${b.ownerEmail || b.ownerSdt}`);

        // Kiem tra xem co chu tro that trong ToaNhaNguoiQuanLy khong
        const realChuTro = await prisma.$queryRaw<Array<{ id: string; ten: string; sdt: string | null; email: string | null }>>`
          SELECT nd.id, nd.ten, nd."soDienThoai" AS sdt, nd.email
          FROM "ToaNhaNguoiQuanLy" tnql
          JOIN "NguoiDung" nd ON nd.id = tnql."nguoiDungId"
          WHERE tnql."toaNhaId" = ${b.id}
            AND nd."vaiTro" = 'chuNha'
            AND nd.id != ALL(${adminIds}::text[])
          LIMIT 1
        `;
        if (realChuTro.length > 0) {
          console.log(`     => Co chu tro that trong ToaNhaNguoiQuanLy: "${realChuTro[0].ten}" (${realChuTro[0].sdt || realChuTro[0].email})`);
          console.log(`     => Can chay API de gan lai chuSoHuuId`);
        } else {
          console.log(`     => Chua co chu tro that! Can tao chu tro moi`);
        }
      }
    }
  }

  // ─── 5. Tong ket ───
  console.log('\n=== HUONG DAN SUA ===');
  if (fakeChuTro.length > 0) {
    console.log('Cach 1 - Goi API sua tung admin (can dang nhap admin truoc de co cookie session):');
    for (const a of fakeChuTro) {
      const identifier = a.email || a.soDienThoai;
      const key = a.email ? 'email' : 'phone';
      console.log(`\n   curl -X POST http://localhost:3000/api/admin/fix-admin-role \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"${key}": "${identifier}"}'`);
    }
    console.log(`\nCach 2 - Hoac sua tat ca cung luc:`);
    console.log(`   curl -X POST http://localhost:3000/api/admin/fix-admin-role \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"fixAll": true}'`);
  } else {
    console.log('Khong co tai khoan admin nao bi loi.');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
