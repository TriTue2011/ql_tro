import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getThanhToanRepo, getHoaDonRepo } from '@/lib/repositories';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { sseEmit } from '@/lib/sse-emitter';
import { parsePage, parseLimit } from '@/lib/parse-query';
import prisma from '@/lib/prisma';
import { checkQuyen, getToaNhaIdFromHoaDon } from '@/lib/server/check-quyen';

// GET - Lấy danh sách thanh toán
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role === 'admin') {
      return NextResponse.json({ message: 'Admin không quản lý thanh toán' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const hopDongId = searchParams.get('hopDongId');
    const hoaDonId = searchParams.get('hoaDonId');

    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    const hoaDonRepo = await getHoaDonRepo();
    const thanhToanRepo = await getThanhToanRepo();

    if (hopDongId) {
      // Batch-fetch hóa đơn rồi lấy tất cả thanh toán trong 1 query (tránh N+1)
      const hoaDonResult = await hoaDonRepo.findMany({ hopDongId, limit: 1000 });
      const hoaDonIds = hoaDonResult.data.map(hd => hd.id).filter(Boolean) as string[];

      const allThanhToan = await prisma.thanhToan.findMany({
        where: { hoaDonId: { in: hoaDonIds } },
        orderBy: { ngayThanhToan: 'desc' },
      });

      // Paginate in-memory (danh sách đã được sort từ DB)
      allThanhToan.sort((a, b) => new Date(b.ngayThanhToan).getTime() - new Date(a.ngayThanhToan).getTime());
      const total = allThanhToan.length;
      const skip = (page - 1) * limit;
      const paginated = allThanhToan.slice(skip, skip + limit);

      return NextResponse.json({
        success: true,
        data: paginated,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }

    const result = await thanhToanRepo.findMany({
      page,
      limit,
      hoaDonId: hoaDonId || undefined,
      ...(!hoaDonId && { toaNhaIds } as any),
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        pages: result.pagination.totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching thanh toan:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Tạo thanh toán mới
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      hoaDonId,
      soTien,
      phuongThuc,
      thongTinChuyenKhoan,
      ngayThanhToan,
      ghiChu,
      anhBienLai
    } = body;

    // Validate required fields
    if (!hoaDonId || !soTien || !phuongThuc) {
      return NextResponse.json(
        { message: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }

    const hoaDonRepo = await getHoaDonRepo();
    const thanhToanRepo = await getThanhToanRepo();

    // Kiểm tra hóa đơn tồn tại
    const hoaDon = await hoaDonRepo.findById(hoaDonId);
    if (!hoaDon) {
      return NextResponse.json(
        { message: 'Hóa đơn không tồn tại' },
        { status: 404 }
      );
    }

    // Kiểm tra quyền thêm thanh toán
    const role = session.user.role;
    if (role === 'quanLy' || role === 'nhanVien') {
      const toaNhaId = await getToaNhaIdFromHoaDon(hoaDonId);
      if (toaNhaId) {
        const perm = await checkQuyen(session.user.id, role, toaNhaId, 'quyenThanhToan');
        if (!perm.allowed) {
          return NextResponse.json({ message: perm.message }, { status: 403 });
        }
      }
    }

    // Kiểm tra số tiền thanh toán không vượt quá số tiền còn lại
    if (soTien > hoaDon.conLai) {
      return NextResponse.json(
        { message: 'Số tiền thanh toán không được vượt quá số tiền còn lại' },
        { status: 400 }
      );
    }

    // Validate thông tin chuyển khoản nếu phương thức là chuyển khoản
    if (phuongThuc === 'chuyenKhoan' && !thongTinChuyenKhoan) {
      return NextResponse.json(
        { message: 'Thông tin chuyển khoản là bắt buộc' },
        { status: 400 }
      );
    }

    // Tạo thanh toán mới
    const thanhToan = await thanhToanRepo.create({
      hoaDonId,
      soTien,
      phuongThuc,
      thongTinChuyenKhoan: phuongThuc === 'chuyenKhoan' ? thongTinChuyenKhoan : undefined,
      ngayThanhToan: ngayThanhToan ? new Date(ngayThanhToan) : new Date(),
      nguoiNhanId: session.user.id,
      ghiChu,
      anhBienLai
    });

    // Cập nhật hóa đơn (cộng thêm số tiền đã thanh toán)
    const updatedHoaDon = await hoaDonRepo.addPayment(hoaDonId, soTien);

    sseEmit('thanh-toan', { action: 'created' });
    sseEmit('hoa-don', { action: 'updated' }); // hóa đơn cập nhật trạng thái thanh toán
    return NextResponse.json({
      success: true,
      data: {
        thanhToan,
        hoaDon: updatedHoaDon
      },
      message: 'Tạo thanh toán thành công'
    });
  } catch (error) {
    console.error('Error creating thanh toan:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
