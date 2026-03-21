import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const createUserSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(128),
  // Số điện thoại bắt buộc để có thể đăng nhập
  phone: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ (10-11 chữ số)'),
  role: z.enum(['admin', 'chuNha', 'dongChuTro', 'quanLy', 'nhanVien']),
  toaNhaId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const role = session?.user?.role;
    const ALLOWED_MANAGERS = ['admin', 'chuNha', 'dongChuTro'];
    if (!session?.user?.id || !ALLOWED_MANAGERS.includes(role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const selectFields = {
      id: true,
      ten: true,
      email: true,
      soDienThoai: true,
      vaiTro: true,
      anhDaiDien: true,
      trangThai: true,
      zaloChatId: true,
      nhanThongBaoZalo: true,
      zaloAccountId: true,
      ngayTao: true,
      ngayCapNhat: true,
      toaNha: { select: { id: true, tenToaNha: true }, take: 1 },
      toaNhaQuanLy: {
        select: {
          toaNha: { select: { id: true, tenToaNha: true } },
          quyenKichHoatTaiKhoan: true,
        },
      },
    } as const;

    let users;
    if (role === 'admin') {
      // Admin chỉ quản lý admin và chuNha
      users = await prisma.nguoiDung.findMany({
        where: { vaiTro: { in: ['admin', 'chuNha'] } },
        take: 1000,
        orderBy: { ngayTao: 'desc' },
        select: selectFields,
      });
    } else {
      // chuNha/dongChuTro: thấy dongChuTro, quanLy, nhanVien gán vào tòa nhà của mình
      const myBuildingIds = await prisma.toaNha.findMany({
        where: {
          OR: [
            { chuSoHuuId: session.user.id },
            { nguoiQuanLy: { some: { nguoiDungId: session.user.id } } },
          ],
        },
        select: { id: true },
      }).then(rows => rows.map(r => r.id));

      users = await prisma.nguoiDung.findMany({
        where: {
          vaiTro: { in: ['dongChuTro', 'quanLy', 'nhanVien'] },
          toaNhaQuanLy: { some: { toaNhaId: { in: myBuildingIds } } },
        },
        take: 1000,
        orderBy: { ngayTao: 'desc' },
        select: selectFields,
      });
    }

    // Batch-fetch nguoiTaoId via raw SQL (column not in Prisma schema)
    const userIds = users.map(u => u.id);
    const nguoiTaoRows = userIds.length > 0
      ? await prisma.$queryRaw<{ id: string; nguoiTaoId: string | null }[]>`
          SELECT id, "nguoiTaoId" FROM "NguoiDung" WHERE id = ANY(${userIds})`
      : [];
    const nguoiTaoIdByUser = new Map(nguoiTaoRows.map(r => [r.id, r.nguoiTaoId]));

    // Batch-fetch tên người tạo
    const creatorIds = [...new Set(nguoiTaoRows.map(r => r.nguoiTaoId).filter(Boolean) as string[])];
    const creators = creatorIds.length > 0
      ? await prisma.nguoiDung.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, ten: true },
        })
      : [];
    const creatorMap = new Map(creators.map(c => [c.id, c.ten]));

    const result = users.map(u => {
      const ownedBuilding = u.toaNha[0] ?? null;
      const managedEntry = u.toaNhaQuanLy[0] ?? null;
      const managedBuilding = managedEntry?.toaNha ?? null;
      const assignedBuilding = ownedBuilding || managedBuilding;
      const nguoiTaoId = nguoiTaoIdByUser.get(u.id) ?? null;
      // toaNhaIds: tất cả tòa nhà được gán qua ToaNhaNguoiQuanLy (dùng cho multi-select admin)
      const toaNhaIds = u.toaNhaQuanLy.map(q => q.toaNha.id);
      return {
        id: u.id,
        ten: u.ten,
        email: u.email,
        soDienThoai: u.soDienThoai,
        vaiTro: u.vaiTro,
        anhDaiDien: u.anhDaiDien,
        trangThai: u.trangThai,
        zaloChatId: u.zaloChatId,
        nhanThongBaoZalo: u.nhanThongBaoZalo,
        zaloAccountId: u.zaloAccountId,
        nguoiTaoId: nguoiTaoId,
        nguoiTaoTen: nguoiTaoId ? (creatorMap.get(nguoiTaoId) ?? null) : null,
        ngayTao: u.ngayTao.toISOString(),
        createdAt: u.ngayTao.toISOString(),
        toaNhaId: assignedBuilding?.id ?? null,
        toaNhaTen: assignedBuilding?.tenToaNha ?? null,
        toaNhaIds,
        quyenKichHoatTaiKhoan: managedEntry?.quyenKichHoatTaiKhoan ?? false,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const callerRole = session?.user?.role;
    const ALLOWED_CREATORS = ['admin', 'chuNha', 'dongChuTro'];
    if (!session?.user?.id || !ALLOWED_CREATORS.includes(callerRole ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, phone, role, toaNhaId } = parsed.data;
  // toaNhaIds từ body (không qua zod schema vì không dùng cho chuNha)
  const toaNhaIds: string[] = Array.isArray(body.toaNhaIds) ? body.toaNhaIds : (toaNhaId ? [toaNhaId] : []);

    // chuNha/dongChuTro chỉ được tạo dongChuTro/quanLy/nhanVien
    if (callerRole !== 'admin' && ['admin', 'chuNha'].includes(role)) {
      return NextResponse.json({ error: 'Không có quyền tạo tài khoản với vai trò này' }, { status: 403 });
    }

    const cleanEmail = email?.trim() ? email.toLowerCase() : null;

    // Kiểm tra email trùng (nếu có nhập email)
    if (cleanEmail) {
      const byEmail = await prisma.nguoiDung.findUnique({ where: { email: cleanEmail } });
      if (byEmail) return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 });
    }
    // Kiểm tra SĐT trùng
    const bySdt = await prisma.nguoiDung.findFirst({ where: { soDienThoai: phone } });
    if (bySdt) return NextResponse.json({ error: 'Số điện thoại đã được sử dụng' }, { status: 400 });

    const hashedPassword = await hash(password, 12);

    const newUser = await prisma.nguoiDung.create({
      data: {
        ten: sanitizeText(name),
        email: cleanEmail,
        matKhau: hashedPassword,
        soDienThoai: phone,
        vaiTro: role,
      },
    });

    // Lưu người tạo via raw SQL (column not in Prisma schema)
    prisma.$executeRawUnsafe(
      `UPDATE "NguoiDung" SET "nguoiTaoId" = $1 WHERE id = $2`,
      session.user.id,
      newUser.id,
    ).catch((err) => {
      console.error('[admin/users] Failed to save nguoiTaoId:', err);
    });

    // Gán tòa nhà nếu có và không phải admin (hỗ trợ nhiều tòa)
    if (role !== 'admin' && toaNhaIds.length > 0) {
      for (const tid of toaNhaIds) {
        await prisma.toaNhaNguoiQuanLy.create({
          data: { toaNhaId: tid, nguoiDungId: newUser.id },
        }).catch(() => {});
      }
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
