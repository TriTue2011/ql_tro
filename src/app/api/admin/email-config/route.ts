/**
 * API route: /api/admin/email-config
 *
 * Giai đoạn 4.2: Gmail Automation
 * Quản lý cấu hình email SMTP cho người dùng.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const emailConfigSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  appPassword: z.string().min(1, 'Mật khẩu ứng dụng là bắt buộc'),
  host: z.string().min(1, 'Host là bắt buộc').default('smtp.gmail.com'),
  port: z.number().int().positive().default(587),
  tenHienThi: z.string().optional(),
  tuDongGuiHoaDon: z.boolean().default(false),
  tuDongGuiNhacNo: z.boolean().default(false),
  tuDongGuiBaoCao: z.boolean().default(false),
  tuDongGuiBaoTri: z.boolean().default(false),
});

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const config = await prisma.caiDatEmail.findUnique({
      where: { nguoiDungId: session.user.id },
    });

    // Không trả về appPassword cho client
    if (config) {
      const { appPassword, ...safeConfig } = config;
      return NextResponse.json({ success: true, data: safeConfig });
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error('Error fetching email config:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = emailConfigSchema.parse(body);

    await prisma.caiDatEmail.upsert({
      where: { nguoiDungId: session.user.id },
      update: validated,
      create: { nguoiDungId: session.user.id, ...validated },
    });

    return NextResponse.json({
      success: true,
      message: 'Cấu hình email đã được lưu',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error saving email config:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await prisma.caiDatEmail.deleteMany({
      where: { nguoiDungId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa cấu hình email',
    });
  } catch (error) {
    console.error('Error deleting email config:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
