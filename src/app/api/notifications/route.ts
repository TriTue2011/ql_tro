import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import ThongBao from '@/models/ThongBao';
import HoaDon from '@/models/HoaDon';
import SuCo from '@/models/SuCo';
import HopDong from '@/models/HopDong';
import KhachThue from '@/models/KhachThue';

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
    const type = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    let notifications = [];

    switch (type) {
      case 'overdue_invoices':
        notifications = await getOverdueInvoices();
        break;
      case 'expiring_contracts':
        notifications = await getExpiringContracts();
        break;
      case 'pending_issues':
        notifications = await getPendingIssues();
        break;
      case 'system':
        notifications = await getSystemNotifications();
        break;
      default:
        notifications = await getAllNotifications();
    }

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNotifications = notifications.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedNotifications,
      pagination: {
        page,
        limit,
        total: notifications.length,
        totalPages: Math.ceil(notifications.length / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { message: 'Lỗi khi lấy thông báo' },
      { status: 500 }
    );
  }
}

async function getOverdueInvoices() {
  const overdueInvoices = await HoaDon.find({
    hanThanhToan: { $lt: new Date() },
    trangThai: { $in: ['chuaThanhToan', 'daThanhToanMotPhan'] },
  })
    .populate('hopDong', 'maHopDong phong')
    .populate('phong', 'maPhong toaNha')
    .populate('khachThue', 'hoTen soDienThoai')
    .sort({ hanThanhToan: 1 });

  return overdueInvoices.map(invoice => ({
    id: `overdue_invoice_${invoice._id}`,
    type: 'overdue_invoice',
    title: 'Hóa đơn quá hạn thanh toán',
    message: `Hóa đơn ${invoice.maHoaDon} của phòng ${invoice.phong.maPhong} đã quá hạn thanh toán`,
    data: {
      invoiceId: invoice._id,
      maHoaDon: invoice.maHoaDon,
      phong: invoice.phong.maPhong,
      khachThue: invoice.khachThue.hoTen,
      hanThanhToan: invoice.hanThanhToan,
      conLai: invoice.conLai,
    },
    priority: 'high',
    createdAt: invoice.hanThanhToan,
  }));
}

async function getExpiringContracts() {
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);

  const expiringContracts = await HopDong.find({
    ngayKetThuc: { $lte: nextMonth },
    trangThai: 'hoatDong',
  })
    .populate('phong', 'maPhong toaNha')
    .populate('nguoiDaiDien', 'hoTen soDienThoai')
    .sort({ ngayKetThuc: 1 });

  return expiringContracts.map(contract => {
    const daysLeft = Math.ceil((contract.ngayKetThuc.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: `expiring_contract_${contract._id}`,
      type: 'expiring_contract',
      title: 'Hợp đồng sắp hết hạn',
      message: `Hợp đồng ${contract.maHopDong} của phòng ${contract.phong.maPhong} sẽ hết hạn trong ${daysLeft} ngày`,
      data: {
        contractId: contract._id,
        maHopDong: contract.maHopDong,
        phong: contract.phong.maPhong,
        khachThue: contract.nguoiDaiDien.hoTen,
        ngayKetThuc: contract.ngayKetThuc,
        daysLeft,
      },
      priority: daysLeft <= 7 ? 'high' : daysLeft <= 15 ? 'medium' : 'low',
      createdAt: contract.ngayKetThuc,
    };
  });
}

async function getPendingIssues() {
  const pendingIssues = await SuCo.find({
    trangThai: { $in: ['moi', 'dangXuLy'] },
  })
    .populate('phong', 'maPhong toaNha')
    .populate('khachThue', 'hoTen soDienThoai')
    .sort({ mucDoUuTien: -1, ngayBaoCao: -1 });

  return pendingIssues.map(issue => {
    const priorityMap = {
      'khancap': 'critical',
      'cao': 'high',
      'trungBinh': 'medium',
      'thap': 'low',
    };

    const statusMap = {
      'moi': 'Mới',
      'dangXuLy': 'Đang xử lý',
    };

    return {
      id: `pending_issue_${issue._id}`,
      type: 'pending_issue',
      title: 'Sự cố cần xử lý',
      message: `Sự cố "${issue.tieuDe}" tại phòng ${issue.phong.maPhong} - ${statusMap[issue.trangThai]}`,
      data: {
        issueId: issue._id,
        tieuDe: issue.tieuDe,
        phong: issue.phong.maPhong,
        khachThue: issue.khachThue.hoTen,
        loaiSuCo: issue.loaiSuCo,
        mucDoUuTien: issue.mucDoUuTien,
        trangThai: issue.trangThai,
        ngayBaoCao: issue.ngayBaoCao,
      },
      priority: priorityMap[issue.mucDoUuTien] || 'medium',
      createdAt: issue.ngayBaoCao,
    };
  });
}

async function getSystemNotifications() {
  // Get system-wide notifications (like maintenance, updates, etc.)
  const systemNotifications = await ThongBao.find({
    loai: 'chung',
  })
    .populate('nguoiGui', 'ten email')
    .sort({ ngayGui: -1 })
    .limit(10);

  return systemNotifications.map(notification => ({
    id: `system_${notification._id}`,
    type: 'system',
    title: notification.tieuDe,
    message: notification.noiDung,
    data: {
      notificationId: notification._id,
      nguoiGui: notification.nguoiGui.ten,
    },
    priority: 'medium',
    createdAt: notification.ngayGui,
  }));
}

async function getAllNotifications() {
  const [overdueInvoices, expiringContracts, pendingIssues, systemNotifications] = await Promise.all([
    getOverdueInvoices(),
    getExpiringContracts(),
    getPendingIssues(),
    getSystemNotifications(),
  ]);

  // Combine and sort by priority and date
  const allNotifications = [
    ...overdueInvoices,
    ...expiringContracts,
    ...pendingIssues,
    ...systemNotifications,
  ];

  // Sort by priority (critical > high > medium > low) and then by date
  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  
  return allNotifications.sort((a, b) => {
    const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// POST endpoint to mark notifications as read
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
    const { notificationId, type } = body;

    await dbConnect();

    // For system notifications, mark as read
    if (type === 'system' && notificationId) {
      await ThongBao.findByIdAndUpdate(notificationId, {
        $addToSet: { daDoc: session.user.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc',
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { message: 'Lỗi khi đánh dấu thông báo' },
      { status: 500 }
    );
  }
}
