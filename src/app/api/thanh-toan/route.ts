import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getThanhToanRepo, getHoaDonRepo } from '@/lib/repositories';

// GET - Lấy danh sách thanh toán
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const hopDongId = searchParams.get('hopDongId');
    const hoaDonId = searchParams.get('hoaDonId');

    const hoaDonRepo = await getHoaDonRepo();
    const thanhToanRepo = await getThanhToanRepo();

    if (hopDongId) {
      // Tìm hóa đơn theo hợp đồng, rồi lấy thanh toán của từng hóa đơn
      const hoaDonResult = await hoaDonRepo.findMany({ hopDongId, limit: 1000 });
      const allThanhToan: any[] = [];

      for (const hd of hoaDonResult.data) {
        const ttList = await thanhToanRepo.findByHoaDon(hd.id);
        allThanhToan.push(...ttList);
      }

      // Sort by ngayThanhToan desc and paginate
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
