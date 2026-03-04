import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SuCo from '@/models/SuCo';
import Phong from '@/models/Phong';
import KhachThue from '@/models/KhachThue';
import { z } from 'zod';

const suCoSchema = z.object({
  phong: z.string().min(1, 'Phòng là bắt buộc'),
  khachThue: z.string().min(1, 'Khách thuê là bắt buộc'),
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc'),
  moTa: z.string().min(1, 'Mô tả là bắt buộc'),
  anhSuCo: z.array(z.string()).optional(),
  loaiSuCo: z.enum(['dienNuoc', 'noiThat', 'vesinh', 'anNinh', 'khac']),
  mucDoUuTien: z.enum(['thap', 'trungBinh', 'cao', 'khancap']).optional(),
  trangThai: z.enum(['moi', 'dangXuLy', 'daXong', 'daHuy']).optional(),
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
    const loaiSuCo = searchParams.get('loaiSuCo') || '';
    const mucDoUuTien = searchParams.get('mucDoUuTien') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const query: any = {};
    
    if (search) {
      query.$or = [
        { tieuDe: { $regex: search, $options: 'i' } },
        { moTa: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (loaiSuCo) {
      query.loaiSuCo = loaiSuCo;
    }
    
    if (mucDoUuTien) {
      query.mucDoUuTien = mucDoUuTien;
    }
    
    if (trangThai) {
      query.trangThai = trangThai;
    }

    const suCoList = await SuCo.find(query)
      .populate('phong', 'maPhong toaNha')
      .populate('khachThue', 'hoTen soDienThoai')
      .populate('nguoiXuLy', 'ten email')
      .sort({ ngayBaoCao: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await SuCo.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: suCoList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching su co:', error);
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
    const validatedData = suCoSchema.parse(body);

    await dbConnect();

    // Check if phong exists
    const phong = await Phong.findById(validatedData.phong);
    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 400 }
      );
    }

    // Check if khach thue exists
    const khachThue = await KhachThue.findById(validatedData.khachThue);
    if (!khachThue) {
      return NextResponse.json(
        { message: 'Khách thuê không tồn tại' },
        { status: 400 }
      );
    }

    const newSuCo = new SuCo({
      ...validatedData,
      anhSuCo: validatedData.anhSuCo || [],
      mucDoUuTien: validatedData.mucDoUuTien || 'trungBinh',
      trangThai: validatedData.trangThai || 'moi',
    });

    await newSuCo.save();

    return NextResponse.json({
      success: true,
      data: newSuCo,
      message: 'Sự cố đã được báo cáo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating su co:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
