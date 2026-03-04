import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import HopDong from '@/models/HopDong';
import Phong from '@/models/Phong';
import KhachThue from '@/models/KhachThue';
import { updatePhongStatus, updateAllKhachThueStatus } from '@/lib/status-utils';
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

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const query: any = {};
    
    if (search) {
      query.$or = [
        { maHopDong: { $regex: search, $options: 'i' } },
        { dieuKhoan: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (trangThai) {
      query.trangThai = trangThai;
    }

    const hopDongList = await HopDong.find(query)
      .populate({
        path: 'phong',
        select: 'maPhong toaNha',
        populate: {
          path: 'toaNha',
          select: 'tenToaNha'
        }
      })
      .populate('khachThueId', 'hoTen soDienThoai')
      .populate('nguoiDaiDien', 'hoTen soDienThoai')
      .sort({ ngayTao: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await HopDong.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: hopDongList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

    await dbConnect();

    // Check if phong exists
    const phong = await Phong.findById(validatedData.phong);
    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 400 }
      );
    }

    // Check if all khach thue exist
    const khachThueList = await KhachThue.find({ _id: { $in: validatedData.khachThueId } });
    if (khachThueList.length !== validatedData.khachThueId.length) {
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
    const existingHopDong = await HopDong.findOne({
      phong: validatedData.phong,
      trangThai: 'hoatDong',
      $or: [
        {
          ngayBatDau: { $lte: new Date() },
          ngayKetThuc: { $gte: new Date() }
        },
        {
          ngayBatDau: { $lte: new Date(validatedData.ngayKetThuc) },
          ngayKetThuc: { $gte: new Date(validatedData.ngayBatDau) }
        }
      ]
    });

    if (existingHopDong) {
      return NextResponse.json(
        { message: 'Phòng đã có hợp đồng trong khoảng thời gian này' },
        { status: 400 }
      );
    }

    const newHopDong = new HopDong({
      ...validatedData,
      ngayBatDau: new Date(validatedData.ngayBatDau),
      ngayKetThuc: new Date(validatedData.ngayKetThuc),
      phiDichVu: validatedData.phiDichVu || [],
    });

    await newHopDong.save();

    // Cập nhật trạng thái phòng và khách thuê tự động
    await updatePhongStatus(validatedData.phong);
    await updateAllKhachThueStatus(validatedData.khachThueId);

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
