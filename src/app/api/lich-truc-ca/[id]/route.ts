import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { sseEmit } from '@/lib/sse-emitter';

// ─── DELETE: Xóa một lịch trực ca ─────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role === 'admin' || role === 'nhanVien') {
      return NextResponse.json({ message: 'Bạn không có quyền xóa lịch trực ca' }, { status: 403 });
    }

    const { id } = await params;

    // Tìm lịch trực ca
    const shift = await prisma.lichTrucCa.findUnique({
      where: { id },
      select: { id: true, toaNhaId: true, nguoiDungId: true },
    });

    if (!shift) {
      return NextResponse.json({ message: 'Lịch trực ca không tồn tại' }, { status: 404 });
    }

    // Kiểm tra quyền truy cập tòa nhà
    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    if (!toaNhaIds.includes(shift.toaNhaId)) {
      return NextResponse.json({ message: 'Bạn không có quyền quản lý tòa nhà này' }, { status: 403 });
    }

    // Xóa lịch trực ca
    await prisma.lichTrucCa.delete({ where: { id } });

    // Broadcast real-time event
    sseEmit('lich-truc-ca', { action: 'deleted' });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa lịch trực ca',
    });
  } catch (error) {
    console.error('DELETE /api/lich-truc-ca/[id] error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
