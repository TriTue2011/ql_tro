import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';
import { z } from 'zod';

const khachThueSchema = z.object({
  hoTen: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  soDienThoai: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').optional(),
  cccd: z.string().regex(/^[0-9]{12}$/, 'CCCD phải có 12 chữ số'),
  ngaySinh: z.string().min(1, 'Ngày sinh là bắt buộc'),
  gioiTinh: z.enum(['nam', 'nu', 'khac']),
  queQuan: z.string().min(1, 'Quê quán là bắt buộc'),
  anhCCCD: z.object({
    matTruoc: z.string().optional(),
    matSau: z.string().optional(),
  }).optional(),
  ngheNghiep: z.string().optional(),
  matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
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

    const khachThue = await KhachThue.findById(id);

    if (!khachThue) {
      return NextResponse.json(
        { message: 'Khách thuê không tồn tại' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: khachThue,
    });

  } catch (error) {
    console.error('Error fetching khach thue:', error);
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
    const validatedData = khachThueSchema.parse(body);

    await dbConnect();
    const { id } = await params;

    // Check if phone or CCCD already exists (excluding current record)
    const existingKhachThue = await KhachThue.findOne({
      _id: { $ne: id },
      $or: [
        { soDienThoai: validatedData.soDienThoai },
        { cccd: validatedData.cccd }
      ]
    });

    if (existingKhachThue) {
      return NextResponse.json(
        { message: 'Số điện thoại hoặc CCCD đã được sử dụng' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      ...validatedData,
      ngaySinh: new Date(validatedData.ngaySinh),
      anhCCCD: validatedData.anhCCCD || { matTruoc: '', matSau: '' },
    };

    // Nếu có mật khẩu mới, cập nhật
    // Mật khẩu sẽ tự động hash qua pre-save middleware
    if (validatedData.matKhau) {
      const khachThue = await KhachThue.findById(id);
      if (!khachThue) {
        return NextResponse.json(
          { message: 'Khách thuê không tồn tại' },
          { status: 404 }
        );
      }
      
      // Set mật khẩu mới và save để trigger middleware
      Object.assign(khachThue, updateData);
      khachThue.matKhau = validatedData.matKhau;
      await khachThue.save();
      
      return NextResponse.json({
        success: true,
        data: khachThue,
        message: 'Khách thuê đã được cập nhật thành công',
      });
    }

    // Nếu không có mật khẩu mới, update bình thường
    delete updateData.matKhau;
    const khachThue = await KhachThue.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!khachThue) {
      return NextResponse.json(
        { message: 'Khách thuê không tồn tại' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: khachThue,
      message: 'Khách thuê đã được cập nhật thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating khach thue:', error);
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

    const khachThue = await KhachThue.findById(id);
    if (!khachThue) {
      return NextResponse.json(
        { message: 'Khách thuê không tồn tại' },
        { status: 404 }
      );
    }

    await KhachThue.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Khách thuê đã được xóa thành công',
    });

  } catch (error) {
    console.error('Error deleting khach thue:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
