import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { sseEmit } from '@/lib/sse-emitter';

// Các ca làm việc chuẩn
export const SHIFT_TYPES = ['C1', 'C2', 'C3', 'HC'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  C1: 'Sáng (06:00-14:00)',
  C2: 'Chiều (14:00-22:00)',
  C3: 'Đêm (22:00-06:00)',
  HC: 'Hành chính (08:00-17:00)',
};

export const SHIFT_SHORT_LABELS: Record<ShiftType, string> = {
  C1: 'Sáng',
  C2: 'Chiều',
  C3: 'Đêm',
  HC: 'HC',
};

// ─── GET: Lấy danh sách lịch trực ca ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role === 'admin') {
      return NextResponse.json({ message: 'Admin không quản lý lịch trực ca' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const toaNhaId = searchParams.get('toaNhaId');
    const thang = parseInt(searchParams.get('thang') ?? String(new Date().getMonth() + 1), 10);
    const nam = parseInt(searchParams.get('nam') ?? String(new Date().getFullYear()), 10);
    const nguoiDungId = searchParams.get('nguoiDungId'); // Lọc theo người dùng cụ thể

    // Validate month/year
    if (thang < 1 || thang > 12 || nam < 2020 || nam > 2100) {
      return NextResponse.json({ message: 'Tháng hoặc năm không hợp lệ' }, { status: 400 });
    }

    // Tính ngày đầu và cuối tháng
    const ngayDau = new Date(nam, thang - 1, 1);
    const ngayCuoi = new Date(nam, thang, 0, 23, 59, 59, 999);

    // Lấy danh sách tòa nhà user được phép quản lý
    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);

    // Nếu không có toaNhaId cụ thể, dùng tất cả tòa nhà user được gán
    const filterToaNhaIds = toaNhaId ? [toaNhaId] : toaNhaIds;

    if (filterToaNhaIds.length === 0) {
      return NextResponse.json({ success: true, data: [], users: [] });
    }

    // Lấy danh sách lịch trực trong tháng
    const shifts = await prisma.lichTrucCa.findMany({
      where: {
        toaNhaId: { in: filterToaNhaIds },
        ngay: { gte: ngayDau, lte: ngayCuoi },
        ...(nguoiDungId ? { nguoiDungId } : {}),
      },
      include: {
        nguoiDung: {
          select: { id: true, ten: true, chucVu: true, vaiTro: true },
        },
        nguoiTao: {
          select: { id: true, ten: true },
        },
      },
      orderBy: [{ ngay: 'asc' }, { ca: 'asc' }],
    });

    // Lấy danh sách người dùng có trong tòa nhà (để gán ca)
    const usersInBuildings = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { toaNhaId: { in: filterToaNhaIds } },
      include: {
        nguoiDung: {
          select: { id: true, ten: true, chucVu: true, vaiTro: true, soDienThoai: true, email: true },
        },
      },
    });

    // Deduplicate users (same user may be in multiple buildings)
    const userMap = new Map<string, typeof usersInBuildings[number]['nguoiDung']>();
    for (const record of usersInBuildings) {
      if (!userMap.has(record.nguoiDung.id)) {
        userMap.set(record.nguoiDung.id, record.nguoiDung);
      }
    }

    // Nếu là chuNha, cũng lấy chính họ
    if (role === 'chuNha') {
      const owner = await prisma.nguoiDung.findUnique({
        where: { id: session.user.id },
        select: { id: true, ten: true, chucVu: true, vaiTro: true, soDienThoai: true, email: true },
      });
      if (owner && !userMap.has(owner.id)) {
        userMap.set(owner.id, owner);
      }
    }

    return NextResponse.json({
      success: true,
      data: shifts,
      users: Array.from(userMap.values()),
      filters: { thang, nam, toaNhaId: filterToaNhaIds },
    });
  } catch (error) {
    console.error('GET /api/lich-truc-ca error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

// ─── POST: Tạo/cập nhật lịch trực ca (batch) ──────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role === 'admin' || role === 'nhanVien') {
      return NextResponse.json({ message: 'Bạn không có quyền tạo lịch trực ca' }, { status: 403 });
    }

    const body = await request.json();
    const { toaNhaId, shifts } = body as {
      toaNhaId: string;
      shifts: Array<{
        nguoiDungId: string;
        ngay: string; // ISO date string (YYYY-MM-DD)
        ca: string;   // C1 | C2 | C3 | HC
        ghiChu?: string;
      }>;
    };

    if (!toaNhaId || !Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json({ message: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // Validate shift types
    for (const s of shifts) {
      if (!SHIFT_TYPES.includes(s.ca as ShiftType)) {
        return NextResponse.json(
          { message: `Ca không hợp lệ: ${s.ca}. Chỉ chấp nhận: ${SHIFT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Kiểm tra quyền truy cập tòa nhà
    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    if (!toaNhaIds.includes(toaNhaId)) {
      return NextResponse.json({ message: 'Bạn không có quyền quản lý tòa nhà này' }, { status: 403 });
    }

    // Kiểm tra tất cả người dùng được gán có trong tòa nhà không
    const nguoiDungIds = [...new Set(shifts.map((s) => s.nguoiDungId))];
    const validUsers = await prisma.toaNhaNguoiQuanLy.findMany({
      where: {
        toaNhaId,
        nguoiDungId: { in: nguoiDungIds },
      },
      select: { nguoiDungId: true },
    });
    const validUserIds = new Set(validUsers.map((u) => u.nguoiDungId));

    // Nếu là chuNha, họ cũng có thể tự gán ca cho mình
    if (role === 'chuNha') {
      validUserIds.add(session.user.id);
    }

    const invalidUsers = nguoiDungIds.filter((id) => !validUserIds.has(id));
    if (invalidUsers.length > 0) {
      return NextResponse.json(
        { message: `Người dùng không hợp lệ (không thuộc tòa nhà): ${invalidUsers.join(', ')}` },
        { status: 400 }
      );
    }

    // Batch upsert: tạo mới hoặc cập nhật nếu đã tồn tại (cùng người + tòa nhà + ngày)
    const results = [];
    for (const s of shifts) {
      const ngayDate = new Date(s.ngay);
      ngayDate.setHours(0, 0, 0, 0);

      const existing = await prisma.lichTrucCa.findUnique({
        where: {
          nguoiDungId_toaNhaId_ngay: {
            nguoiDungId: s.nguoiDungId,
            toaNhaId,
            ngay: ngayDate,
          },
        },
      });

      if (existing) {
        // Update existing shift
        const updated = await prisma.lichTrucCa.update({
          where: { id: existing.id },
          data: {
            ca: s.ca,
            ghiChu: s.ghiChu ?? existing.ghiChu,
          },
          include: {
            nguoiDung: { select: { id: true, ten: true } },
          },
        });
        results.push(updated);
      } else {
        // Create new shift
        const created = await prisma.lichTrucCa.create({
          data: {
            nguoiDungId: s.nguoiDungId,
            toaNhaId,
            ngay: ngayDate,
            ca: s.ca,
            ghiChu: s.ghiChu,
            nguoiTaoId: session.user.id,
          },
          include: {
            nguoiDung: { select: { id: true, ten: true } },
          },
        });
        results.push(created);
      }
    }

    // Broadcast real-time event
    sseEmit('lich-truc-ca', { action: 'updated' });

    return NextResponse.json({
      success: true,
      data: results,
      message: `Đã lưu ${results.length} lịch trực ca`,
    });
  } catch (error) {
    console.error('POST /api/lich-truc-ca error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
