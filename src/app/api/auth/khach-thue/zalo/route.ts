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
import { getKhachThueRepo } from '@/lib/repositories';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import jwt from 'jsonwebtoken';

function getKhachThueFromToken(request: NextRequest): { id: string } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
    if (decoded.role !== 'khachThue') return null;
    return { id: decoded.id };
  } catch {
    return null;
  }
}

/** PATCH: Xác nhận hoặc từ chối pending chatId của chính mình */
export async function PATCH(request: NextRequest) {
  try {
    const me = getKhachThueFromToken(request);
    if (!me) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = z.object({ action: z.enum(['confirm', 'reject']) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const repo = await getKhachThueRepo();
    const kt = await repo.findById(me.id);
    if (!kt) return NextResponse.json({ success: false, message: 'Không tìm thấy khách thuê' }, { status: 404 });
    if (!kt.pendingZaloChatId) {
      return NextResponse.json({ success: false, message: 'Không có Chat ID chờ xác nhận' }, { status: 400 });
    }

    if (parsed.data.action === 'confirm') {
      const updated = await repo.update(me.id, { zaloChatId: kt.pendingZaloChatId, pendingZaloChatId: '' });
      return NextResponse.json({ success: true, message: 'Đã xác nhận Zalo Chat ID', zaloChatId: updated?.zaloChatId });
    } else {
      await repo.update(me.id, { pendingZaloChatId: '' });
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
    const me = getKhachThueFromToken(request);
    if (!me) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = z.object({ zaloChatId: z.string().max(64) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const repo = await getKhachThueRepo();
    const updated = await repo.update(me.id, {
      zaloChatId: sanitizeText(parsed.data.zaloChatId) || '',
    });

    if (!updated) return NextResponse.json({ success: false, message: 'Cập nhật thất bại' }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Đã cập nhật Zalo Chat ID', zaloChatId: updated.zaloChatId });
  } catch (error) {
    console.error('Error updating zalo chat id for khach thue:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ' }, { status: 500 });
  }
}
