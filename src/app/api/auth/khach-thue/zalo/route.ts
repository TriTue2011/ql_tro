/**
 * PATCH /api/auth/khach-thue/zalo
 * Khách thuê tự xác nhận / từ chối pendingZaloChatId của mình.
 * Body: { action: 'confirm' | 'reject' }
 *
 * PUT /api/auth/khach-thue/zalo
 * Khách thuê tự nhập zaloChatId thủ công.
 * Body: { zaloChatId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import jwt from 'jsonwebtoken';

/** Lấy KhachThue ID từ NextAuth session hoặc Bearer token */
async function getKhachThueId(request: NextRequest): Promise<string | null> {
  // 1. NextAuth session
  const session = await getServerSession(authOptions);
  if (session?.user?.role === 'khachThue') return session.user.id;

  // 2. Bearer token (legacy)
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
      if (decoded.role === 'khachThue') return decoded.id;
    }
  } catch { /* ignore */ }

  return null;
}

/** PATCH: Xác nhận hoặc từ chối pending chatId của chính mình */
export async function PATCH(request: NextRequest) {
  try {
    const id = await getKhachThueId(request);
    if (!id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = z.object({ action: z.enum(['confirm', 'reject']) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const repo = await getKhachThueRepo();
    const kt = await repo.findById(id);
    if (!kt) return NextResponse.json({ success: false, message: 'Không tìm thấy khách thuê' }, { status: 404 });
    if (!kt.pendingZaloChatId) {
      return NextResponse.json({ success: false, message: 'Không có Chat ID chờ xác nhận' }, { status: 400 });
    }

    if (parsed.data.action === 'confirm') {
      const updated = await repo.update(id, { zaloChatId: kt.pendingZaloChatId, pendingZaloChatId: '' });
      return NextResponse.json({ success: true, message: 'Đã xác nhận Zalo Chat ID', zaloChatId: updated?.zaloChatId });
    } else {
      await repo.update(id, { pendingZaloChatId: '' });
      return NextResponse.json({ success: true, message: 'Đã từ chối Chat ID chờ xác nhận' });
    }
  } catch (error) {
    console.error('Error confirming zalo chat id for khach thue:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ' }, { status: 500 });
  }
}

/** PUT: Khách thuê tự nhập zaloChatId thủ công */
export async function PUT(request: NextRequest) {
  try {
    const id = await getKhachThueId(request);
    if (!id) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = z.object({ zaloChatId: z.string().max(64) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const repo = await getKhachThueRepo();
    const updated = await repo.update(id, {
      zaloChatId: sanitizeText(parsed.data.zaloChatId) || '',
    });

    if (!updated) return NextResponse.json({ success: false, message: 'Cập nhật thất bại' }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Đã cập nhật Zalo Chat ID', zaloChatId: updated.zaloChatId });
  } catch (error) {
    console.error('Error updating zalo chat id for khach thue:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ' }, { status: 500 });
  }
}
