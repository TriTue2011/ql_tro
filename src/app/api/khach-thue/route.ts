import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKhachThueRepo, getHopDongRepo } from '@/lib/repositories';
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const repo = await getKhachThueRepo();
    const hopDongRepo = await getHopDongRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
    });

    // Thêm thông tin hợp đồng hiện tại cho mỗi khách thuê
    const khachThueListWithContracts = await Promise.all(
      result.data.map(async (khachThue) => {
        const hopDongResult = await hopDongRepo.findMany({
          khachThueId: khachThue.id,
          trangThai: 'hoatDong',
          limit: 1,
        });
        return {
          ...khachThue,
          hopDongHienTai: hopDongResult.data[0] || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: khachThueListWithContracts,
      pagination: result.pagination,
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

    const repo = await getKhachThueRepo();

    // Check if phone or CCCD already exists
    const existingBySdt = await repo.findMany({ search: validatedData.soDienThoai, limit: 1 });
    const existingByCCCD = await repo.findMany({ search: validatedData.cccd, limit: 1 });

    const sdtExists = existingBySdt.data.some(k => k.soDienThoai === validatedData.soDienThoai);
    const cccdExists = existingByCCCD.data.some(k => k.cccd === validatedData.cccd);

    if (sdtExists || cccdExists) {
      return NextResponse.json(
        { message: 'Số điện thoại hoặc CCCD đã được sử dụng' },
        { status: 400 }
      );
    }

    const newKhachThue = await repo.create({
      hoTen: validatedData.hoTen,
      soDienThoai: validatedData.soDienThoai,
      email: validatedData.email,
      cccd: validatedData.cccd,
      ngaySinh: new Date(validatedData.ngaySinh),
      gioiTinh: validatedData.gioiTinh,
      queQuan: validatedData.queQuan,
      anhCCCD: validatedData.anhCCCD || { matTruoc: '', matSau: '' },
      ngheNghiep: validatedData.ngheNghiep,
      matKhau: validatedData.matKhau,
    });

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
