import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

function isAdmin(role?: string) {
  return ['admin', 'chuNha', 'quanLy'].includes(role ?? '');
}

// GET - Admin xem danh sách yêu cầu thay đổi
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trangThai = searchParams.get('trangThai') || 'choPheduyet';

  const yeuCaus = await prisma.yeuCauThayDoi.findMany({
    where: trangThai === 'all' ? {} : { trangThai },
    orderBy: { ngayTao: 'desc' },
    include: {
      khachThue: {
        select: {
          id: true, hoTen: true, soDienThoai: true,
          hopDong: {
            where: {
              trangThai: 'hoatDong',
              ngayBatDau: { lte: new Date() },
              ngayKetThuc: { gte: new Date() },
            },
            select: {
              phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
            },
            take: 1,
          },
        },
      },
      nguoiPheDuyet: { select: { ten: true } },
    },
  });

  return NextResponse.json({ success: true, data: yeuCaus });
}

// PUT - Admin phê duyệt hoặc từ chối + áp dụng thay đổi
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id, trangThai, ghiChuPheDuyet } = await request.json();

  if (!id || !['daPheduyet', 'tuChoi'].includes(trangThai)) {
    return NextResponse.json({ success: false, message: 'Thiếu thông tin hoặc trạng thái không hợp lệ' }, { status: 400 });
  }

  const yeuCau = await prisma.yeuCauThayDoi.findUnique({
    where: { id },
    include: { khachThue: true },
  });

  if (!yeuCau) {
    return NextResponse.json({ success: false, message: 'Không tìm thấy yêu cầu' }, { status: 404 });
  }

  if (yeuCau.trangThai !== 'choPheduyet') {
    return NextResponse.json({ success: false, message: 'Yêu cầu này đã được xử lý' }, { status: 400 });
  }

  // Nếu phê duyệt → áp dụng thay đổi
  if (trangThai === 'daPheduyet') {
    const noiDung = yeuCau.noiDung as any;
    const sau = noiDung?.sau ?? {};

    if (yeuCau.loai === 'thongTin') {
      await prisma.khachThue.update({
        where: { id: yeuCau.khachThueId },
        data: {
          ...(sau.hoTen && { hoTen: sau.hoTen }),
          ...(sau.email !== undefined && { email: sau.email }),
          ...(sau.queQuan && { queQuan: sau.queQuan }),
          ...(sau.ngheNghiep !== undefined && { ngheNghiep: sau.ngheNghiep }),
          ...(sau.gioiTinh && { gioiTinh: sau.gioiTinh }),
        },
      });
    } else if (yeuCau.loai === 'anhCCCD') {
      await prisma.khachThue.update({
        where: { id: yeuCau.khachThueId },
        data: { anhCCCD: sau.anhCCCD },
      });
    } else if (yeuCau.loai === 'nguoiCungPhong') {
      // Thêm thành viên mới vào hợp đồng
      if (sau.action === 'them') {
        const newMember = sau.thanhVien;
        // Tạo KhachThue mới
        const created = await prisma.khachThue.create({
          data: {
            hoTen: newMember.hoTen,
            soDienThoai: newMember.soDienThoai || `PENDING_${Date.now()}`,
            cccd: newMember.cccd || `PENDING_${Date.now()}`,
            ngaySinh: new Date(newMember.ngaySinh),
            gioiTinh: newMember.gioiTinh,
            queQuan: newMember.queQuan,
            ngheNghiep: newMember.ngheNghiep,
            trangThai: 'chuaThue',
            matKhau: null, // Tài khoản đăng nhập cần admin cấp riêng
          },
        });
        // Liên kết với hợp đồng
        if (sau.hopDongId) {
          await prisma.hopDong.update({
            where: { id: sau.hopDongId },
            data: { khachThue: { connect: { id: created.id } } },
          });
        }
      } else if (sau.action === 'sua') {
        await prisma.khachThue.update({
          where: { id: sau.thanhVienId },
          data: {
            ...(sau.hoTen && { hoTen: sau.hoTen }),
            ...(sau.queQuan && { queQuan: sau.queQuan }),
            ...(sau.ngheNghiep !== undefined && { ngheNghiep: sau.ngheNghiep }),
            ...(sau.gioiTinh && { gioiTinh: sau.gioiTinh }),
          },
        });
      }
    } else if (yeuCau.loai === 'thongBao') {
      await prisma.khachThue.update({
        where: { id: yeuCau.khachThueId },
        data: { nhanThongBaoZalo: sau.nhanThongBaoZalo },
      });
    }
  }

  const updated = await prisma.yeuCauThayDoi.update({
    where: { id },
    data: {
      trangThai,
      nguoiPheDuyetId: session.user.id,
      ghiChuPheDuyet: ghiChuPheDuyet || null,
    },
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: trangThai === 'daPheduyet' ? 'Đã phê duyệt và áp dụng thay đổi' : 'Đã từ chối yêu cầu',
  });
}
