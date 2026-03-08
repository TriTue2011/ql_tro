import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHopDongRepo, getPhongRepo, getKhachThueRepo } from '@/lib/repositories';
import { z } from 'zod';

const phiDichVuSchema = z.object({
  ten: z.string().min(1, 'Tên dịch vụ là bắt buộc'),
  gia: z.number().min(0, 'Giá dịch vụ phải lớn hơn hoặc bằng 0'),
});

const hopDongSchema = z.object({
  maHopDong: z.string().min(1, 'Mã hợp đồng là bắt buộc'),
  phong: z.string().min(1, 'Phòng là bắt buộc'),
  khachThueId: z.array(z.string()).min(1, 'Phải có ít nhất 1 khách thuê'),
  nguoiDaiDien: z.string().min(1, 'Người đại diện là bắt buộc'),
  ngayBatDau: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  ngayKetThuc: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
  giaThue: z.number().min(0, 'Giá thuê phải lớn hơn hoặc bằng 0'),
  tienCoc: z.number().min(0, 'Tiền cọc phải lớn hơn hoặc bằng 0'),
  chuKyThanhToan: z.enum(['thang', 'quy', 'nam']),
  ngayThanhToan: z.number().min(1).max(31, 'Ngày thanh toán phải từ 1-31'),
  dieuKhoan: z.string().min(1, 'Điều khoản là bắt buộc'),
  giaDien: z.number().min(0, 'Giá điện phải lớn hơn hoặc bằng 0'),
  giaNuoc: z.number().min(0, 'Giá nước phải lớn hơn hoặc bằng 0'),
  chiSoDienBanDau: z.number().min(0, 'Chỉ số điện ban đầu phải lớn hơn hoặc bằng 0'),
  chiSoNuocBanDau: z.number().min(0, 'Chỉ số nước ban đầu phải lớn hơn hoặc bằng 0'),
  phiDichVu: z.array(phiDichVuSchema).optional(),
  fileHopDong: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const repo = await getHopDongRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      trangThai: trangThai as any || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching hop dong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = hopDongSchema.parse(body);

    const phongRepo = await getPhongRepo();
    const khachThueRepo = await getKhachThueRepo();
    const hopDongRepo = await getHopDongRepo();

    // Check if phong exists
    const phong = await phongRepo.findById(validatedData.phong);
    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 400 }
      );
    }

    // Check if all khach thue exist
    const khachThueChecks = await Promise.all(
      validatedData.khachThueId.map(id => khachThueRepo.findById(id))
    );
    if (khachThueChecks.some(k => !k)) {
      return NextResponse.json(
        { message: 'Một hoặc nhiều khách thuê không tồn tại' },
        { status: 400 }
      );
    }

    // Check if nguoi dai dien is in khach thue list
    if (!validatedData.khachThueId.includes(validatedData.nguoiDaiDien)) {
      return NextResponse.json(
        { message: 'Người đại diện phải là một trong các khách thuê' },
        { status: 400 }
      );
    }

    // Kiểm tra phòng có hợp đồng đang hoạt động không
    const existingHopDong = await hopDongRepo.findMany({
      phongId: validatedData.phong,
      trangThai: 'hoatDong',
      limit: 1,
    });

    if (existingHopDong.data.length > 0) {
      return NextResponse.json(
        { message: 'Phòng đã có hợp đồng trong khoảng thời gian này' },
        { status: 400 }
      );
    }

    const newHopDong = await hopDongRepo.create({
      maHopDong: validatedData.maHopDong,
      phongId: validatedData.phong,
      khachThueIds: validatedData.khachThueId,
      nguoiDaiDienId: validatedData.nguoiDaiDien,
      ngayBatDau: new Date(validatedData.ngayBatDau),
      ngayKetThuc: new Date(validatedData.ngayKetThuc),
      giaThue: validatedData.giaThue,
      tienCoc: validatedData.tienCoc,
      chuKyThanhToan: validatedData.chuKyThanhToan,
      ngayThanhToan: validatedData.ngayThanhToan,
      dieuKhoan: validatedData.dieuKhoan,
      giaDien: validatedData.giaDien,
      giaNuoc: validatedData.giaNuoc,
      chiSoDienBanDau: validatedData.chiSoDienBanDau,
      chiSoNuocBanDau: validatedData.chiSoNuocBanDau,
      phiDichVu: validatedData.phiDichVu || [],
      fileHopDong: validatedData.fileHopDong,
    });

    // Cập nhật trạng thái phòng thành 'dangThue'
    await phongRepo.update(validatedData.phong, { trangThai: 'dangThue' });

    return NextResponse.json({
      success: true,
      data: newHopDong,
      message: 'Hợp đồng đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating hop dong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
