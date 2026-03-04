import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ToaNha from '@/models/ToaNha';
import Phong from '@/models/Phong';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';

    const query = search 
      ? {
          $or: [
            { tenToaNha: { $regex: search, $options: 'i' } },
            { 'diaChi.duong': { $regex: search, $options: 'i' } },
            { 'diaChi.phuong': { $regex: search, $options: 'i' } },
          ]
        }
      : {};

    const toaNhaList = await ToaNha.find(query)
      .select('tenToaNha diaChi moTa tienNghiChung')
      .sort({ tenToaNha: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await ToaNha.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: toaNhaList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching public toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
