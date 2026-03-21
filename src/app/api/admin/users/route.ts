import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const createUserSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(128),
  phone: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ').optional(),
  role: z.enum(['admin', 'chuNha', 'quanLy', 'nhanVien']),
  toaNhaId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.nguoiDung.findMany({
      take: 1000,
      orderBy: { ngayTao: 'desc' },
      select: {
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
          select: { toaNha: { select: { id: true, tenToaNha: true } } },
          take: 1,
        },
      },
    });

    const result = users.map(u => {
      const ownedBuilding = u.toaNha[0] ?? null;
      const managedBuilding = u.toaNhaQuanLy[0]?.toaNha ?? null;
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

    if (!session?.user?.email || session.user.role !== 'admin') {
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

    const existingUser = await prisma.nguoiDung.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 });
    }

    const hashedPassword = await hash(password, 12);

    const newUser = await prisma.nguoiDung.create({
      data: {
        ten: sanitizeText(name),
        email: email.toLowerCase(),
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
