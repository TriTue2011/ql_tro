import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import ChiSoDienNuoc from '@/models/ChiSoDienNuoc';
import Phong from '@/models/Phong';
import { z } from 'zod';

const chiSoSchema = z.object({
  phong: z.string().min(1, 'Phòng là bắt buộc'),
  thang: z.number().min(1).max(12, 'Tháng phải từ 1-12'),
  nam: z.number().min(2020, 'Năm phải từ 2020 trở lên'),
  chiSoDienCu: z.number().min(0, 'Chỉ số điện cũ phải lớn hơn hoặc bằng 0'),
  chiSoDienMoi: z.number().min(0, 'Chỉ số điện mới phải lớn hơn hoặc bằng 0'),
  chiSoNuocCu: z.number().min(0, 'Chỉ số nước cũ phải lớn hơn hoặc bằng 0'),
  chiSoNuocMoi: z.number().min(0, 'Chỉ số nước mới phải lớn hơn hoặc bằng 0'),
  anhChiSoDien: z.string().optional(),
  anhChiSoNuoc: z.string().optional(),
  ngayGhi: z.string().optional(),
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
    const phong = searchParams.get('phong') || '';
    const thang = searchParams.get('thang') || '';
    const nam = searchParams.get('nam') || '';

    const query: any = {};
    
    if (phong) {
      query.phong = phong;
    }
    
    if (thang) {
      query.thang = parseInt(thang);
    }
    
    if (nam) {
      query.nam = parseInt(nam);
    }

    const chiSoList = await ChiSoDienNuoc.find(query)
      .populate('phong', 'maPhong toaNha')
      .populate('nguoiGhi', 'ten email')
      .sort({ nam: -1, thang: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await ChiSoDienNuoc.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: chiSoList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching chi so dien nuoc:', error);
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
    const validatedData = chiSoSchema.parse(body);

    await dbConnect();

    // Check if phong exists
    const phong = await Phong.findById(validatedData.phong);
    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 400 }
      );
    }

    // Check if chi so already exists for this phong, thang, nam
    const existingChiSo = await ChiSoDienNuoc.findOne({
      phong: validatedData.phong,
      thang: validatedData.thang,
      nam: validatedData.nam,
    });

    if (existingChiSo) {
      return NextResponse.json(
        { message: 'Chỉ số đã được ghi cho phòng này trong tháng này' },
        { status: 400 }
      );
    }

    // Validate chi so moi >= chi so cu
    if (validatedData.chiSoDienMoi < validatedData.chiSoDienCu) {
      return NextResponse.json(
        { message: 'Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ' },
        { status: 400 }
      );
    }

    if (validatedData.chiSoNuocMoi < validatedData.chiSoNuocCu) {
      return NextResponse.json(
        { message: 'Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ' },
        { status: 400 }
      );
    }

    const newChiSo = new ChiSoDienNuoc({
      ...validatedData,
      nguoiGhi: session.user.id,
      ngayGhi: validatedData.ngayGhi ? new Date(validatedData.ngayGhi) : new Date(),
    });

    await newChiSo.save();

    return NextResponse.json({
      success: true,
      data: newChiSo,
      message: 'Chỉ số điện nước đã được ghi thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating chi so dien nuoc:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID là bắt buộc' },
        { status: 400 }
      );
    }

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