import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { notifyKhachThue, notifyDaiDienHopDong, getToaNhaIdOfKhachThue } from '@/lib/send-zalo';
import { notifyYeuCauPheDuyet } from '@/lib/zalo-notify';
import { autoLinkZaloChatIds } from '@/lib/zalo-auto-link';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';

function canManage(role?: string) {
  return ['chuNha', 'quanLy'].includes(role ?? '');
}

// GET - Chủ trọ / Quản lý xem danh sách yêu cầu thay đổi
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManage(session.user.role)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trangThai = searchParams.get('trangThai') || 'choPheduyet';

  const toaNhaIds = await getUserToaNhaIds(session.user.id, session.user.role);

  // Lọc yêu cầu theo tòa nhà của user
  const toaNhaScopeWhere = toaNhaIds.length > 0
    ? {
        khachThue: {
          hopDong: {
            some: { phong: { toaNhaId: { in: toaNhaIds } } },
          },
        },
      }
    : {};

  const yeuCaus = await prisma.yeuCauThayDoi.findMany({
    where: {
      ...(trangThai !== 'all' ? { trangThai } : {}),
      ...toaNhaScopeWhere,
    },
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

// PUT - Chủ trọ / Quản lý phê duyệt hoặc từ chối + áp dụng thay đổi
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManage(session.user.role)) {
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
      // Nếu SĐT thay đổi, kiểm tra không trùng với người khác
      if (sau.soDienThoai && sau.soDienThoai !== yeuCau.khachThue.soDienThoai) {
        const existing = await prisma.khachThue.findFirst({
          where: { soDienThoai: sau.soDienThoai, id: { not: yeuCau.khachThueId } },
        });
        if (existing) {
          return NextResponse.json({ success: false, message: 'Số điện thoại đã được dùng bởi tài khoản khác' }, { status: 400 });
        }
      }
      await prisma.khachThue.update({
        where: { id: yeuCau.khachThueId },
        data: {
          ...(sau.hoTen && { hoTen: sau.hoTen }),
          // SĐT = tài khoản đăng nhập → cập nhật luôn khi được duyệt
          ...(sau.soDienThoai && { soDienThoai: sau.soDienThoai }),
          ...(sau.email !== undefined && { email: sau.email }),
          ...(sau.cccd && { cccd: sau.cccd }),
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
        const age = Math.floor((Date.now() - new Date(newMember.ngaySinh).getTime()) / (365.25 * 24 * 3600 * 1000));
        const isUnder18 = age < 18;
        // Mật khẩu mặc định admin123 nếu 18+
        const defaultPw = isUnder18 ? null : await bcrypt.hash('admin123', 10);

        const sdt = newMember.soDienThoai || `PENDING_${Date.now()}`;
        const created = await prisma.khachThue.create({
          data: {
            hoTen: newMember.hoTen,
            soDienThoai: sdt,
            cccd: newMember.cccd || `PENDING_${Date.now()}`,
            ngaySinh: new Date(newMember.ngaySinh),
            gioiTinh: newMember.gioiTinh,
            queQuan: newMember.queQuan,
            ngheNghiep: newMember.ngheNghiep,
            trangThai: 'chuaThue',
            matKhau: defaultPw,
          },
        });
        // Liên kết với hợp đồng
        if (sau.hopDongId) {
          await prisma.hopDong.update({
            where: { id: sau.hopDongId },
            data: { khachThue: { connect: { id: created.id } } },
          });
          // Auto-link Zalo cho người mới
          if (!sdt.startsWith('PENDING_')) {
            const toaNhaId = await getToaNhaIdOfKhachThue(created.id);
            if (toaNhaId) autoLinkZaloChatIds('khachThue', created.id, sdt, toaNhaId).catch(() => {});
          }
          // Thông báo cho người đứng hợp đồng
          if (!isUnder18) {
            const loginMsg = `🎉 Tài khoản cho ${newMember.hoTen} đã được tạo!\n📱 Tài khoản: ${sdt.startsWith('PENDING_') ? '(chưa có SĐT)' : sdt}\n🔑 Mật khẩu: admin123\n⚠️ Vui lòng đăng nhập và đổi mật khẩu ngay tại mục Cài đặt > Bảo mật.`;
            notifyDaiDienHopDong(sau.hopDongId, loginMsg).catch(() => {});
            // Gửi trực tiếp cho người mới nếu có SĐT
            if (!sdt.startsWith('PENDING_')) {
              notifyKhachThue(created.id, loginMsg).catch(() => {});
            }
          }
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

  // Thông báo Zalo cho khách thuê về kết quả phê duyệt (theo cài đặt auto_zalo_yeu_cau_phe_duyet)
  notifyYeuCauPheDuyet(id, trangThai as 'daPheduyet' | 'tuChoi', ghiChuPheDuyet, session.user.id).catch(() => {});

  return NextResponse.json({
    success: true,
    data: updated,
    message: trangThai === 'daPheduyet' ? 'Đã phê duyệt và áp dụng thay đổi' : 'Đã từ chối yêu cầu',
  });
}
