/**
 * GET  /api/zalo/pending-chat-id
 * Lấy danh sách khách thuê có pendingZaloChatId chờ xác nhận.
 *
 * POST /api/zalo/pending-chat-id
 * Xác nhận hoặc từ chối một pendingZaloChatId.
 * Body: { khachThueId: string, action: 'confirm' | 'reject' }
 *
 * ⚠️ Rủi ro khi TỰ ĐỘNG lưu chat_id khác:
 *   - Tên Zalo không đáng tin (người khác có thể đặt tên giống khách thuê)
 *   - Không có xác minh số điện thoại → có thể gửi hóa đơn/thông tin nội bộ sai người
 *   - Giải pháp: luôn lưu vào pendingZaloChatId, admin xác nhận trước khi áp dụng
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo } from '@/lib/repositories';
import { z } from 'zod';

const confirmSchema = z.object({
  khachThueId: z.string().min(1, 'khachThueId không được trống'),
  action: z.enum(['confirm', 'reject'], { message: "action phải là 'confirm' hoặc 'reject'" }),
});

/** GET: Danh sách khách thuê có pending chat_id chờ xác nhận */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const repo = await getKhachThueRepo();
    const all = await repo.findMany({ limit: 1000 });

    const pending = all.data
      .filter(kt => kt.pendingZaloChatId)
      .map(kt => ({
        khachThueId: kt.id,
        hoTen: kt.hoTen,
        soDienThoai: kt.soDienThoai,
        zaloChatId: kt.zaloChatId ?? null,
        pendingZaloChatId: kt.pendingZaloChatId,
      }));

    return NextResponse.json({ success: true, total: pending.length, data: pending });
  } catch (error) {
    console.error('Error fetching pending chat IDs:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

/**
 * POST: Xác nhận hoặc từ chối pending chat_id
 * - confirm: ghi đè zaloChatId bằng pendingZaloChatId, xóa pending
 * - reject: xóa pendingZaloChatId, giữ nguyên zaloChatId cũ
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { khachThueId, action } = parsed.data;

    const repo = await getKhachThueRepo();
    const kt = await repo.findById(khachThueId);
    if (!kt) {
      return NextResponse.json({ error: 'Không tìm thấy khách thuê' }, { status: 404 });
    }
    if (!kt.pendingZaloChatId) {
      return NextResponse.json({ error: 'Không có pendingZaloChatId cần xác nhận' }, { status: 400 });
    }

    if (action === 'confirm') {
      // Xác nhận: gán pendingZaloChatId thành zaloChatId chính thức
      const updated = await repo.update(khachThueId, {
        zaloChatId: kt.pendingZaloChatId,
        pendingZaloChatId: '',  // xóa pending
      });
      return NextResponse.json({
        success: true,
        message: `Đã xác nhận Zalo Chat ID mới cho ${kt.hoTen}`,
        zaloChatId: updated?.zaloChatId,
      });
    } else {
      // Từ chối: xóa pending, giữ nguyên zaloChatId cũ
      await repo.update(khachThueId, { pendingZaloChatId: '' });
      return NextResponse.json({
        success: true,
        message: `Đã từ chối Zalo Chat ID chờ xác nhận của ${kt.hoTen}`,
      });
    }
  } catch (error) {
    console.error('Error confirming pending chat ID:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
