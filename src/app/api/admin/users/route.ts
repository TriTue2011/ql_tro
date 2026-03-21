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
  role: z.enum(['admin', 'chuNha', 'quanLy', 'nhanVien']),
  toaNhaId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const role = session?.user?.role;
    if (!session?.user?.id || (role !== 'admin' && role !== 'chuNha')) {
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
        take: 1,
      },
    } as const;

    let users;
    if (role === 'chuNha') {
      // chuNha chỉ thấy quanLy/nhanVien được gán vào tòa nhà của mình
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
          vaiTro: { in: ['quanLy', 'nhanVien'] },
          toaNhaQuanLy: { some: { toaNhaId: { in: myBuildingIds } } },
        },
        take: 1000,
        orderBy: { ngayTao: 'desc' },
        select: selectFields,
      });
    } else {
      users = await prisma.nguoiDung.findMany({
        take: 1000,
        orderBy: { ngayTao: 'desc' },
        select: selectFields,
      });
    }

    const result = users.map(u => {
      const ownedBuilding = u.toaNha[0] ?? null;
      const managedEntry = u.toaNhaQuanLy[0] ?? null;
      const managedBuilding = managedEntry?.toaNha ?? null;
      const assignedBuilding = ownedBuilding || managedBuilding;
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
        ngayTao: u.ngayTao.toISOString(),
        createdAt: u.ngayTao.toISOString(),
        toaNhaId: assignedBuilding?.id ?? null,
        toaNhaTen: assignedBuilding?.tenToaNha ?? null,
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

    if (!session?.user?.id || session.user.role !== 'admin') {
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

    // Gán tòa nhà nếu có và không phải admin
    if (toaNhaId && role !== 'admin') {
      await prisma.toaNhaNguoiQuanLy.create({
        data: { toaNhaId, nguoiDungId: newUser.id },
      }).catch(() => {}); // ignore if already exists
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
