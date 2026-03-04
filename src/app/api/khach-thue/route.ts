import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';
import HopDong from '@/models/HopDong';
import Phong from '@/models/Phong';
import { updateKhachThueStatus } from '@/lib/status-utils';
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
        { hoTen: { $regex: search, $options: 'i' } },
        { soDienThoai: { $regex: search, $options: 'i' } },
        { cccd: { $regex: search, $options: 'i' } },
        { queQuan: { $regex: search, $options: 'i' } },
        { ngheNghiep: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (trangThai) {
      query.trangThai = trangThai;
    }

    const khachThueList = await KhachThue.find(query)
      .select('+matKhau') // Include password field to check if exists
      .sort({ hoTen: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Cập nhật trạng thái khách thuê dựa trên hợp đồng
    await Promise.all(
      khachThueList.map(khach => updateKhachThueStatus(khach._id.toString()))
    );

    // Lấy lại dữ liệu với trạng thái đã cập nhật
    const updatedKhachThueList = await KhachThue.find(query)
      .select('+matKhau') // Include password field to check if exists
      .sort({ hoTen: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Thêm thông tin hợp đồng và phòng cho mỗi khách thuê
    const khachThueListWithContracts = await Promise.all(
      updatedKhachThueList.map(async (khachThue) => {
        const hopDong = await HopDong.findOne({
          khachThueId: khachThue._id,
          trangThai: 'hoatDong',
          $or: [
            {
              ngayBatDau: { $lte: new Date() },
              ngayKetThuc: { $gte: new Date() }
            }
          ]
        })
        .populate('phong', 'maPhong toaNha')
        .populate({
          path: 'phong',
          populate: {
            path: 'toaNha',
            select: 'tenToaNha'
          }
        });
        
        const khachThueObj = khachThue.toObject();
        // Chuyển matKhau thành boolean để frontend biết đã có mật khẩu hay chưa
        // Không trả về giá trị thực của mật khẩu (đã hash)
        return {
          ...khachThueObj,
          matKhau: !!khachThueObj.matKhau ? '******' : undefined,
          hopDongHienTai: hopDong
        };
      })
    );

    const total = await KhachThue.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: khachThueListWithContracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching khach thue:', error);
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
    const validatedData = khachThueSchema.parse(body);

    await dbConnect();

    // Check if phone or CCCD already exists
    const existingKhachThue = await KhachThue.findOne({
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

    const newKhachThue = new KhachThue({
      ...validatedData,
      ngaySinh: new Date(validatedData.ngaySinh),
      anhCCCD: validatedData.anhCCCD || { matTruoc: '', matSau: '' },
      trangThai: 'chuaThue', // Mặc định là chưa thuê, sẽ được cập nhật tự động
    });

    await newKhachThue.save();

    // Cập nhật trạng thái dựa trên hợp đồng
    await updateKhachThueStatus(newKhachThue._id.toString());

    return NextResponse.json({
      success: true,
      data: newKhachThue,
      message: 'Khách thuê đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating khach thue:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
