import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.nguoiDung.findMany({
    where: { ten: { in: ['Nguyễn tuệ nhi', 'Người quản lý'] } },
    select: { id: true, ten: true, vaiTro: true }
  });

  console.log('--- Users ---');
  console.log(users);

  for (const user of users) {
    const owned = await prisma.toaNha.findMany({
      where: { chuSoHuuId: user.id },
      select: { id: true, tenToaNha: true }
    });
    const managed = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { nguoiDungId: user.id },
      include: { toaNha: { select: { id: true, tenToaNha: true } } }
    });

    console.log(`\n--- User: ${user.ten} (${user.vaiTro}) ---`);
    console.log('Owned buildings:', owned.map(t => t.tenToaNha));
    console.log('Managed buildings:', managed.map(m => m.toaNha.tenToaNha));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
