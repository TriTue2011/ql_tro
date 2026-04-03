import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  ten: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  matKhau: z.string().min(6),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/).optional().or(z.literal('')),
  // Phải cung cấp đúng SECRET để tránh ai đó gọi endpoint này tùy tiện
  setupSecret: z.string().min(1),
}).refine(
  data => (data.soDienThoai && data.soDienThoai.trim() !== '') || (data.email && data.email.trim() !== ''),
  { message: 'Cần ít nhất số điện thoại hoặc email', path: ['soDienThoai'] }
);

/**
 * POST /api/admin/create-first
 *
 * Tạo tài khoản admin đầu tiên.
 * Endpoint TỰ ĐỘNG TẮT sau khi đã có admin trong database.
 * Yêu cầu ADMIN_SETUP_SECRET trong request body khớp với biến môi trường.
 */
export async function POST(request: NextRequest) {
  try {
    // Kiểm tra secret
    const setupSecret = process.env.ADMIN_SETUP_SECRET;
    if (!setupSecret) {
      return NextResponse.json(
        { message: 'Chưa cấu hình ADMIN_SETUP_SECRET trong .env.local' },
        { status: 503 }
      );
    }

    // Kiểm tra đã có admin chưa — nếu có thì đóng endpoint
    const existingAdmin = await prisma.nguoiDung.findFirst({
      where: { vaiTro: 'admin' },
      select: { id: true },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { message: 'Đã có tài khoản admin. Endpoint này đã bị vô hiệu hóa.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = schema.parse(body);

    // Xác minh secret
    if (data.setupSecret !== setupSecret) {
      return NextResponse.json(
        { message: 'Setup secret không đúng' },
        { status: 401 }
      );
    }

    const cleanEmail = data.email?.trim() ? data.email.toLowerCase() : null;
    const cleanPhone = data.soDienThoai?.trim() || null;

    // Kiểm tra email đã tồn tại chưa
    if (cleanEmail) {
      const existing = await prisma.nguoiDung.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return NextResponse.json({ message: 'Email đã được sử dụng' }, { status: 400 });
      }
    }

    const hashedPassword = await hash(data.matKhau, 12);

    const admin = await prisma.nguoiDung.create({
      data: {
        ten: data.ten,
        email: cleanEmail,
        matKhau: hashedPassword,
        soDienThoai: cleanPhone,
        vaiTro: 'admin',
        trangThai: 'hoatDong',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tạo tài khoản admin thành công',
      data: { email: admin.email, ten: admin.ten },
    }, { status: 201 });

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ', details: error.issues }, { status: 400 });
    }
    console.error('[create-first-admin]', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
