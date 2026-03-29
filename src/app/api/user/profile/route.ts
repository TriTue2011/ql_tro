import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getNguoiDungRepo } from '@/lib/repositories';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const zaloChatEntrySchema = z.object({
  ten: z.string().max(100).optional().default(''),
  userId: z.string().max(64).optional().default(''),
  threadId: z.string().max(64).optional().default(''),
});

const updateProfileSchema = z.object({
  ten: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100).optional(),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ').optional(),
  // anhDaiDien chỉ cho phép đường dẫn nội bộ hoặc URL Cloudinary/MinIO hợp lệ
  anhDaiDien: z.string().max(500).regex(
    /^(\/api\/files\/[\w\-./]+|https:\/\/res\.cloudinary\.com\/[\w\-./]+|https?:\/\/[^<>"']+)$/,
    'URL ảnh đại diện không hợp lệ'
  ).optional().nullable(),
  zaloChatId: z.string().max(64).optional(),
  zaloChatIds: z.array(zaloChatEntrySchema).max(20).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tìm bằng ID (đáng tin cậy hơn email vì nhiều TK chỉ có SĐT)
    const user = await prisma.nguoiDung.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      ten: user.ten,
      email: user.email,
      soDienThoai: user.soDienThoai,
      vaiTro: user.vaiTro,
      anhDaiDien: user.anhDaiDien,
      trangThai: user.trangThai,
      zaloChatId: user.zaloChatId ?? null,
      zaloChatIds: user.zaloChatIds ?? null,
      zaloAccountId: user.zaloAccountId ?? null,
      pendingZaloChatId: user.pendingZaloChatId ?? null,
      ngayTao: user.ngayTao?.toISOString(),
      ngayCapNhat: user.ngayCapNhat?.toISOString(),
      hoatDongCuoi: user.hoatDongCuoi?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate và sanitize input
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { ten, soDienThoai, anhDaiDien, zaloChatId, zaloChatIds } = parsed.data;

    const repo = await getNguoiDungRepo();

    // Find user by email first to get id
    const existingUser = await repo.findByEmail(session.user.email);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Tính zaloChatId chính từ zaloChatIds nếu có
    const validEntries = zaloChatIds?.filter(e => e.threadId || e.userId);
    const derivedZaloChatId = validEntries?.length
      ? (validEntries[0].threadId || validEntries[0].userId)
      : undefined;

    const updatedUser = await repo.update(existingUser.id, {
      ten: ten ? sanitizeText(ten) : undefined,
      soDienThoai,
      anhDaiDien: anhDaiDien ?? undefined,
      ...(zaloChatId !== undefined && { zaloChatId: sanitizeText(zaloChatId) }),
      ...(validEntries !== undefined && { zaloChatIds: validEntries as any }),
      ...(derivedZaloChatId !== undefined && !zaloChatId && { zaloChatId: derivedZaloChatId }),
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updatedUser.id,
      ten: updatedUser.ten,
      email: updatedUser.email,
      soDienThoai: updatedUser.soDienThoai,
      vaiTro: updatedUser.vaiTro,
      anhDaiDien: updatedUser.anhDaiDien,
      trangThai: updatedUser.trangThai,
      zaloChatId: updatedUser.zaloChatId ?? null,
      pendingZaloChatId: updatedUser.pendingZaloChatId ?? null,
      ngayTao: updatedUser.ngayTao?.toISOString(),
      ngayCapNhat: updatedUser.ngayCapNhat?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
