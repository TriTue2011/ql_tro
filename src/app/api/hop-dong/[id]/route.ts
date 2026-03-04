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
  trangThai: z.enum(['hoatDong', 'hetHan', 'daHuy']).optional(),
});

// Schema cho partial update (chỉ cập nhật một số trường)
const hopDongPartialSchema = hopDongSchema.partial();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const hopDong = await HopDong.findById(id)
      .populate('phong', 'maPhong toaNha')
      .populate('khachThueId', 'hoTen soDienThoai')
      .populate('nguoiDaiDien', 'hoTen soDienThoai');

    if (!hopDong) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: hopDong,
    });

  } catch (error) {
    console.error('Error fetching hop dong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = hopDongPartialSchema.parse(body);

    await dbConnect();
    const { id } = await params;

    // Lấy hợp đồng hiện tại để kiểm tra
    const existingHopDong = await HopDong.findById(id);
    if (!existingHopDong) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    // Nếu có cập nhật phòng, kiểm tra phòng tồn tại
    if (validatedData.phong) {
      const phong = await Phong.findById(validatedData.phong);
      if (!phong) {
        return NextResponse.json(
          { message: 'Phòng không tồn tại' },
          { status: 400 }
        );
      }
    }

    // Nếu có cập nhật khách thuê, kiểm tra khách thuê tồn tại
    if (validatedData.khachThueId) {
      const khachThueList = await KhachThue.find({ _id: { $in: validatedData.khachThueId } });
      if (khachThueList.length !== validatedData.khachThueId.length) {
        return NextResponse.json(
          { message: 'Một hoặc nhiều khách thuê không tồn tại' },
          { status: 400 }
        );
      }
    }

    // Nếu có cập nhật người đại diện, kiểm tra người đại diện có trong danh sách khách thuê không
    if (validatedData.nguoiDaiDien && validatedData.khachThueId) {
      if (!validatedData.khachThueId.includes(validatedData.nguoiDaiDien)) {
        return NextResponse.json(
          { message: 'Người đại diện phải là một trong các khách thuê' },
          { status: 400 }
        );
      }
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData: any = { ...validatedData };
    
    // Xử lý ngày tháng
    if (validatedData.ngayBatDau) {
      updateData.ngayBatDau = new Date(validatedData.ngayBatDau);
    }
    if (validatedData.ngayKetThuc) {
      updateData.ngayKetThuc = new Date(validatedData.ngayKetThuc);
    }

    const hopDong = await HopDong.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('phong', 'maPhong toaNha')
     .populate('khachThueId', 'hoTen soDienThoai')
     .populate('nguoiDaiDien', 'hoTen soDienThoai');

    if (!hopDong) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    // Cập nhật trạng thái phòng và khách thuê tự động
    await updatePhongStatus(hopDong.phong._id.toString());
    if (validatedData.khachThueId) {
      await updateAllKhachThueStatus(validatedData.khachThueId);
    } else {
      await updateAllKhachThueStatus(existingHopDong.khachThueId.map((id: any) => id.toString()));
    }

    return NextResponse.json({
      success: true,
      data: hopDong,
      message: 'Hợp đồng đã được cập nhật thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating hop dong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const hopDong = await HopDong.findById(id);
    if (!hopDong) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    // Lưu thông tin phòng và khách thuê trước khi xóa
    const phongId = hopDong.phong.toString();
    const khachThueIds = hopDong.khachThueId.map((id: any) => id.toString());

    await HopDong.findByIdAndDelete(id);

    // Cập nhật trạng thái phòng và khách thuê sau khi xóa hợp đồng
    await updatePhongStatus(phongId);
    await updateAllKhachThueStatus(khachThueIds);

    return NextResponse.json({
      success: true,
      message: 'Hợp đồng đã được xóa thành công',
    });

  } catch (error) {
    console.error('Error deleting hop dong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
