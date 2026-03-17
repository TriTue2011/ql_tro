import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function getKhachThueId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === 'khachThue') return session.user.id;
  return null;
}

// PUT - Cập nhật thông tin cá nhân (hoTen, email, queQuan, ngheNghiep, anhCCCD)
export async function PUT(request: NextRequest) {
  const id = await getKhachThueId();
  if (!id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { hoTen, email, queQuan, ngheNghiep, anhCCCD } = await request.json();

  const updated = await prisma.khachThue.update({
    where: { id },
    data: {
      ...(hoTen && { hoTen }),
      ...(email !== undefined && { email }),
      ...(queQuan && { queQuan }),
      ...(ngheNghiep !== undefined && { ngheNghiep }),
      ...(anhCCCD !== undefined && { anhCCCD }),
    },
    select: {
      id: true, hoTen: true, soDienThoai: true, email: true,
      cccd: true, ngaySinh: true, gioiTinh: true, queQuan: true,
      ngheNghiep: true, trangThai: true, anhCCCD: true,
    },
  });

  return NextResponse.json({ success: true, data: updated, message: 'Cập nhật thành công' });
}

// PATCH - Đổi mật khẩu
export async function PATCH(request: NextRequest) {
  const id = await getKhachThueId();
  if (!id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { matKhauCu, matKhauMoi } = await request.json();

  if (!matKhauMoi || matKhauMoi.length < 6) {
    return NextResponse.json(
      { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
      { status: 400 }
    );
  }

  const khachThue = await prisma.khachThue.findUnique({ where: { id }, select: { matKhau: true } });
  if (!khachThue) return NextResponse.json({ success: false, message: 'Không tìm thấy' }, { status: 404 });

  // Nếu đã có mật khẩu, yêu cầu xác nhận mật khẩu cũ
  if (khachThue.matKhau) {
    if (!matKhauCu) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại' }, { status: 400 });
    }
    const valid = await bcrypt.compare(matKhauCu, khachThue.matKhau);
    if (!valid) {
      return NextResponse.json({ success: false, message: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    }
  }

  const hashed = await bcrypt.hash(matKhauMoi, 10);
  await prisma.khachThue.update({ where: { id }, data: { matKhau: hashed } });

  return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công' });
}
