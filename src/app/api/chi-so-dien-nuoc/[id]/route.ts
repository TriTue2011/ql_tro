import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import ChiSoDienNuoc from '@/models/ChiSoDienNuoc';
import { z } from 'zod';

const updateChiSoSchema = z.object({
  phong: z.string().min(1, 'Phòng là bắt buộc').optional(),
  thang: z.number().min(1).max(12, 'Tháng phải từ 1-12').optional(),
  nam: z.number().min(2020, 'Năm phải từ 2020 trở lên').optional(),
  chiSoDienCu: z.number().min(0, 'Chỉ số điện cũ phải lớn hơn hoặc bằng 0').optional(),
  chiSoDienMoi: z.number().min(0, 'Chỉ số điện mới phải lớn hơn hoặc bằng 0').optional(),
  chiSoNuocCu: z.number().min(0, 'Chỉ số nước cũ phải lớn hơn hoặc bằng 0').optional(),
  chiSoNuocMoi: z.number().min(0, 'Chỉ số nước mới phải lớn hơn hoặc bằng 0').optional(),
  anhChiSoDien: z.string().optional(),
  anhChiSoNuoc: z.string().optional(),
  ngayGhi: z.string().optional(),
});

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

    const chiSo = await ChiSoDienNuoc.findById(id)
      .populate('phong', 'maPhong toaNha')
      .populate('nguoiGhi', 'ten email');

    if (!chiSo) {
      return NextResponse.json(
        { message: 'Chỉ số điện nước không tồn tại' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chiSo,
    });

  } catch (error) {
    console.error('Error fetching chi so dien nuoc:', error);
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
    const validatedData = updateChiSoSchema.parse(body);
    const { id } = await params;

    await dbConnect();

    const chiSo = await ChiSoDienNuoc.findById(id);
    if (!chiSo) {
      return NextResponse.json(
        { message: 'Chỉ số điện nước không tồn tại' },
        { status: 404 }
      );
    }

    // Check if user has permission to update (only admin or the person who recorded it)
    if (chiSo.nguoiGhi.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Bạn không có quyền cập nhật chỉ số này' },
        { status: 403 }
      );
    }

    // Validate chi so moi >= chi so cu if both are provided
    if (validatedData.chiSoDienMoi !== undefined && validatedData.chiSoDienCu !== undefined) {
      if (validatedData.chiSoDienMoi < validatedData.chiSoDienCu) {
        return NextResponse.json(
          { message: 'Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ' },
          { status: 400 }
        );
      }
    }

    if (validatedData.chiSoNuocMoi !== undefined && validatedData.chiSoNuocCu !== undefined) {
      if (validatedData.chiSoNuocMoi < validatedData.chiSoNuocCu) {
        return NextResponse.json(
          { message: 'Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ' },
          { status: 400 }
        );
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.ngayGhi) {
      updateData.ngayGhi = new Date(validatedData.ngayGhi);
    }

    const updatedChiSo = await ChiSoDienNuoc.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('phong', 'maPhong toaNha').populate('nguoiGhi', 'ten email');

    return NextResponse.json({
      success: true,
      data: updatedChiSo,
      message: 'Chỉ số điện nước đã được cập nhật thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating chi so dien nuoc:', error);
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

    const chiSo = await ChiSoDienNuoc.findById(id);
    if (!chiSo) {
      return NextResponse.json(
        { message: 'Chỉ số điện nước không tồn tại' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete (only admin or the person who recorded it)
    if (chiSo.nguoiGhi.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Bạn không có quyền xóa chỉ số này' },
        { status: 403 }
      );
    }

    await ChiSoDienNuoc.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Chỉ số điện nước đã được xóa thành công',
    });

  } catch (error) {
    console.error('Error deleting chi so dien nuoc:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
