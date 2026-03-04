import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import ThongBao from '@/models/ThongBao';
import { z } from 'zod';

const thongBaoSchema = z.object({
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc'),
  noiDung: z.string().min(1, 'Nội dung là bắt buộc'),
  loai: z.enum(['chung', 'hoaDon', 'suCo', 'hopDong', 'khac']).optional(),
  nguoiNhan: z.array(z.string()).min(1, 'Phải có ít nhất 1 người nhận'),
  phong: z.array(z.string()).optional(),
  toaNha: z.string().optional(),
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
    const loai = searchParams.get('loai') || '';

    const query: any = {};
    
    if (search) {
      query.$or = [
        { tieuDe: { $regex: search, $options: 'i' } },
        { noiDung: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (loai) {
      query.loai = loai;
    }

    const thongBaoList = await ThongBao.find(query)
      .populate('nguoiGui', 'ten email')
      .populate('phong', 'maPhong')
      .populate('toaNha', 'tenToaNha')
      .sort({ ngayGui: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await ThongBao.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: thongBaoList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching thong bao:', error);
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
    const validatedData = thongBaoSchema.parse(body);

    await dbConnect();

    const newThongBao = new ThongBao({
      ...validatedData,
      nguoiGui: session.user.id,
      loai: validatedData.loai || 'chung',
      phong: validatedData.phong || [],
      daDoc: [],
    });

    await newThongBao.save();

    return NextResponse.json({
      success: true,
      data: newThongBao,
      message: 'Thông báo đã được gửi thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating thong bao:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID thông báo là bắt buộc' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = thongBaoSchema.parse(body);

    await dbConnect();

    const updatedThongBao = await ThongBao.findByIdAndUpdate(
      id,
      {
        ...validatedData,
        loai: validatedData.loai || 'chung',
        phong: validatedData.phong || [],
      },
      { new: true }
    );

    if (!updatedThongBao) {
      return NextResponse.json(
        { message: 'Không tìm thấy thông báo' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedThongBao,
      message: 'Cập nhật thông báo thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating thong bao:', error);
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID thông báo là bắt buộc' },
        { status: 400 }
      );
    }

    await dbConnect();

    const deletedThongBao = await ThongBao.findByIdAndDelete(id);

    if (!deletedThongBao) {
      return NextResponse.json(
        { message: 'Không tìm thấy thông báo' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Xóa thông báo thành công',
    });

  } catch (error) {
    console.error('Error deleting thong bao:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}