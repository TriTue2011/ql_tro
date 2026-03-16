/**
 * POST /api/zalo/link-chat-id-nguoi-dung
 * Liên kết zaloChatId cho NguoiDung (chủ trọ / admin / nhân viên).
 * Body: { nguoiDungId: string, chatId: string }
 *
 * GET /api/zalo/link-chat-id-nguoi-dung?nguoiDungId=xxx
 * Tra cứu zaloChatId của NguoiDung theo ID.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const linkSchema = z.object({
  nguoiDungId: z.string().min(1, 'nguoiDungId không được trống'),
  chatId: z.string().min(1, 'chatId không được trống').max(64),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'chuNha'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { nguoiDungId, chatId } = parsed.data;

    const nd = await prisma.nguoiDung.findUnique({ where: { id: nguoiDungId } });
    if (!nd) {
      return NextResponse.json({ error: `Không tìm thấy người dùng với ID ${nguoiDungId}` }, { status: 404 });
    }

    const updated = await prisma.nguoiDung.update({
      where: { id: nguoiDungId },
      data: { zaloChatId: sanitizeText(chatId) },
    });

    return NextResponse.json({
      success: true,
      message: `Đã liên kết Zalo Chat ID cho ${updated.ten}`,
    });
  } catch (error) {
    console.error('Error linking Zalo chat ID for NguoiDung:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'chuNha'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nguoiDungId = new URL(request.url).searchParams.get('nguoiDungId');
    if (!nguoiDungId) return NextResponse.json({ error: 'Thiếu nguoiDungId' }, { status: 400 });

    const nd = await prisma.nguoiDung.findUnique({
      where: { id: nguoiDungId },
      select: { id: true, ten: true, soDienThoai: true, vaiTro: true, zaloChatId: true, pendingZaloChatId: true },
    });
    if (!nd) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });

    return NextResponse.json({
      success: true,
      nguoiDungId: nd.id,
      ten: nd.ten,
      vaiTro: nd.vaiTro,
      zaloChatId: nd.zaloChatId ?? null,
      pendingZaloChatId: nd.pendingZaloChatId ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
