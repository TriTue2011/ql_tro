import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Phong from '@/models/Phong';
import ToaNha from '@/models/ToaNha';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const toaNha = searchParams.get('toaNha') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const query: any = {};
    
    if (search) {
      query.$or = [
        { maPhong: { $regex: search, $options: 'i' } },
        { moTa: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (toaNha && toaNha !== 'all') {
      query.toaNha = toaNha;
    }
    
    if (trangThai && trangThai !== 'all') {
      query.trangThai = trangThai;
    }

    // Chỉ lấy phòng có ảnh hoặc phòng trống
    query.$or = [
      { anhPhong: { $exists: true, $not: { $size: 0 } } },
      { trangThai: 'trong' }
    ];

    const phongList = await Phong.find(query)
      .populate('toaNha', 'tenToaNha diaChi')
      .sort({ maPhong: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Phong.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: phongList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching public phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
