import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const role = session.user.role;

    // 1. Lấy danh sách tòa nhà của user
    const myBuildingIds = await prisma.toaNha.findMany({
      where: role === 'admin' ? {} : {
        OR: [
          { chuSoHuuId: userId },
          { nguoiQuanLy: { some: { nguoiDungId: userId } } },
        ],
      },
      select: { id: true },
    }).then(rows => rows.map(r => r.id));

    if (myBuildingIds.length === 0 && role !== 'admin') {
      return NextResponse.json({ success: true, data: [] });
    }

    const buildingFilter = role === 'admin' ? {} : { toaNhaId: { in: myBuildingIds } };

    // 2. Fetch data từ các bảng khác nhau
    const [payments, issues, contracts, tenants] = await Promise.all([
      // Thanh toán mới nhất
      prisma.thanhToan.findMany({
        where: { hoaDon: { phong: buildingFilter } },
        take: 5,
        orderBy: { ngayThanhToan: 'desc' },
        include: { hoaDon: { include: { phong: true } } },
      }),
      // Sự cố mới nhất
      prisma.suCo.findMany({
        where: { phong: buildingFilter },
        take: 5,
        orderBy: { ngayTao: 'desc' },
        include: { phong: true },
      }),
      // Hợp đồng mới nhất
      prisma.hopDong.findMany({
        where: { phong: buildingFilter },
        take: 5,
        orderBy: { ngayTao: 'desc' },
        include: { phong: true, nguoiDaiDien: true },
      }),
      // Khách thuê mới nhất (tạo bởi user hoặc trong tòa nhà của user)
      prisma.khachThue.findMany({
        where: role === 'admin' ? {} : {
           hopDong: { some: { phong: buildingFilter } }
        },
        take: 5,
        orderBy: { ngayTao: 'desc' },
      }),
    ]);

    // 3. Chuẩn hóa về một format duy nhất
    const activities: any[] = [];

    payments.forEach(p => {
      activities.push({
        type: 'payment',
        icon: 'bi-check-circle-fill',
        iconColor: '#10b981',
        iconBg: 'rgba(16,185,129,0.1)',
        text: 'Thanh toán thành công',
        meta: `Phòng ${p.hoaDon.phong.maPhong} — ${p.soTien.toLocaleString('vi-VN')}₫`,
        time: p.ngayThanhToan,
        badge: { label: 'Thanh toán', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
      });
    });

    issues.forEach(s => {
      activities.push({
        type: 'issue',
        icon: 'bi-exclamation-circle-fill',
        iconColor: '#ef4444',
        iconBg: 'rgba(239,68,68,0.1)',
        text: 'Báo cáo sự cố mới',
        meta: `Phòng ${s.phong.maPhong} — ${s.tieuDe}`,
        time: s.ngayTao,
        badge: { 
          label: s.trangThai === 'moi' ? 'Cần xử lý' : 'Đang xử lý', 
          color: '#ef4444', 
          bg: 'rgba(239,68,68,0.1)' 
        },
      });
    });

    contracts.forEach(h => {
      activities.push({
        type: 'contract',
        icon: 'bi-file-earmark-check-fill',
        iconColor: '#f59e0b',
        iconBg: 'rgba(245,158,11,0.1)',
        text: 'Hợp đồng mới được ký',
        meta: `${h.nguoiDaiDien.hoTen} — Phòng ${h.phong.maPhong}`,
        time: h.ngayTao,
        badge: { label: 'Hợp đồng', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      });
    });

    tenants.forEach(k => {
      activities.push({
        type: 'tenant',
        icon: 'bi-person-plus-fill',
        iconColor: '#6366f1',
        iconBg: 'rgba(99,102,241,0.1)',
        text: 'Khách thuê mới',
        meta: `${k.hoTen}`,
        time: k.ngayTao,
        badge: { label: 'Khách thuê', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
      });
    });

    // 4. Sắp xếp tất cả theo thời gian
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return NextResponse.json({
      success: true,
      data: activities.slice(0, 10),
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
