import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function getActiveHopDong(khachThueId: string) {
  const now = new Date();
  return prisma.hopDong.findFirst({
    where: {
      khachThue: { some: { id: khachThueId } },
      trangThai: 'hoatDong',
      ngayBatDau: { lte: now },
      ngayKetThuc: { gte: now },
    },
    include: {
      khachThue: {
        select: {
          id: true, hoTen: true, soDienThoai: true, ngaySinh: true,
          gioiTinh: true, cccd: true, queQuan: true, ngheNghiep: true,
          trangThai: true, matKhau: true, anhCCCD: true,
        },
      },
      nguoiDaiDien: { select: { id: true } },
    },
  });
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const hopDong = await getActiveHopDong(session.user.id);
  if (!hopDong) {
    return NextResponse.json({ success: true, data: { members: [], isDaiDien: false, hopDongId: null } });
  }

  const isDaiDien = hopDong.nguoiDaiDienId === session.user.id;
  // Loại bỏ user hiện tại khỏi danh sách
  const members = hopDong.khachThue
    .filter((kt) => kt.id !== session.user.id)
    .map(({ matKhau, anhCCCD, ...rest }) => ({
      ...rest,
      coTaiKhoan: !!matKhau,
      thieuAnhCCCD: !anhCCCD || !(anhCCCD as any)?.matTruoc,
    }));

  return NextResponse.json({
    success: true,
    data: { members, isDaiDien, hopDongId: hopDong.id },
  });
}

// POST - Thêm người cùng phòng (chỉ người đại diện)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const hopDong = await getActiveHopDong(session.user.id);
  if (!hopDong || hopDong.nguoiDaiDienId !== session.user.id) {
    return NextResponse.json(
      { success: false, message: 'Chỉ người đứng hợp đồng mới có thể thêm thành viên' },
      { status: 403 }
    );
  }

  const { hoTen, soDienThoai, cccd, ngaySinh, gioiTinh, queQuan, ngheNghiep, anhCCCD } = await request.json();

  if (!hoTen || !ngaySinh || !gioiTinh || !queQuan) {
    return NextResponse.json({ success: false, message: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }

  // Kiểm tra dưới 18 tuổi
  const birthDate = new Date(ngaySinh);
  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
  const isUnder18 = age < 18;

  // Validate CCCD và SĐT nếu có
  if (cccd) {
    const existingCCCD = await prisma.khachThue.findUnique({ where: { cccd } });
    if (existingCCCD) {
      return NextResponse.json({ success: false, message: 'CCCD đã tồn tại trong hệ thống' }, { status: 400 });
    }
  }
  if (soDienThoai) {
    const existingSDT = await prisma.khachThue.findUnique({ where: { soDienThoai } });
    if (existingSDT) {
      return NextResponse.json({ success: false, message: 'Số điện thoại đã tồn tại trong hệ thống' }, { status: 400 });
    }
  }

  const newKhachThue = await prisma.khachThue.create({
    data: {
      hoTen,
      // Nếu không có SĐT hoặc dưới 18, dùng placeholder unique
      soDienThoai: soDienThoai || `PENDING_${Date.now()}`,
      cccd: cccd || `PENDING_${Date.now()}`,
      ngaySinh: birthDate,
      gioiTinh,
      queQuan,
      ngheNghiep,
      ...(anhCCCD && { anhCCCD }),
      trangThai: 'chuaThue',
      // Dưới 18 tuổi hoặc không có SĐT → không cấp tài khoản
      matKhau: null,
    },
  });

  // Liên kết với hợp đồng
  await prisma.hopDong.update({
    where: { id: hopDong.id },
    data: { khachThue: { connect: { id: newKhachThue.id } } },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: newKhachThue.id,
      hoTen: newKhachThue.hoTen,
      soDienThoai: newKhachThue.soDienThoai,
      ngaySinh: newKhachThue.ngaySinh,
      gioiTinh: newKhachThue.gioiTinh,
      queQuan: newKhachThue.queQuan,
      ngheNghiep: newKhachThue.ngheNghiep,
      trangThai: newKhachThue.trangThai,
      coTaiKhoan: false,
      isUnder18,
    },
    message: isUnder18
      ? 'Đã thêm thành viên. Trẻ em dưới 18 tuổi không được cấp tài khoản.'
      : 'Đã thêm thành viên. Tài khoản đăng nhập cần được quản lý phê duyệt.',
  }, { status: 201 });
}

// PUT - Cập nhật thông tin thành viên (chỉ người đại diện)
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'khachThue') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const hopDong = await getActiveHopDong(session.user.id);
  if (!hopDong || hopDong.nguoiDaiDienId !== session.user.id) {
    return NextResponse.json(
      { success: false, message: 'Chỉ người đứng hợp đồng mới có thể sửa thông tin thành viên' },
      { status: 403 }
    );
  }

  const { id, hoTen, queQuan, ngheNghiep, gioiTinh } = await request.json();

  // Kiểm tra thành viên có trong hợp đồng không
  const isMember = hopDong.khachThue.some(kt => kt.id === id);
  if (!isMember) {
    return NextResponse.json({ success: false, message: 'Thành viên không thuộc hợp đồng này' }, { status: 403 });
  }

  // Không cho phép sửa chính người đại diện qua endpoint này
  if (id === hopDong.nguoiDaiDienId) {
    return NextResponse.json({ success: false, message: 'Vui lòng sửa thông tin cá nhân ở mục Thông tin cá nhân' }, { status: 400 });
  }

  const updated = await prisma.khachThue.update({
    where: { id },
    data: {
      ...(hoTen && { hoTen }),
      ...(queQuan && { queQuan }),
      ...(ngheNghiep !== undefined && { ngheNghiep }),
      ...(gioiTinh && { gioiTinh }),
    },
    select: {
      id: true, hoTen: true, soDienThoai: true, ngaySinh: true,
      gioiTinh: true, queQuan: true, ngheNghiep: true, trangThai: true,
    },
  });

  return NextResponse.json({ success: true, data: updated, message: 'Cập nhật thành công' });
}
