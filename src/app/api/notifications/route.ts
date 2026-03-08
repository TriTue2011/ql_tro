import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHoaDonRepo, getHopDongRepo, getSuCoRepo, getThongBaoRepo } from '@/lib/repositories';

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
    const type = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    let notifications: any[] = [];

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
  const hoaDonRepo = await getHoaDonRepo();
  const now = new Date();

  const result = await hoaDonRepo.findMany({ limit: 1000 });
  const overdueInvoices = result.data.filter(
    invoice =>
      new Date(invoice.hanThanhToan) < now &&
      (invoice.trangThai === 'chuaThanhToan' || invoice.trangThai === 'daThanhToanMotPhan')
  );

  return overdueInvoices.map(invoice => ({
    id: `overdue_invoice_${invoice.id}`,
    type: 'overdue_invoice',
    title: 'Hóa đơn quá hạn thanh toán',
    message: `Hóa đơn ${invoice.maHoaDon} của phòng ${invoice.phong?.maPhong || invoice.phongId} đã quá hạn thanh toán`,
    data: {
      invoiceId: invoice.id,
      maHoaDon: invoice.maHoaDon,
      phong: invoice.phong?.maPhong || invoice.phongId,
      khachThue: invoice.khachThue?.hoTen || invoice.khachThueId,
      hanThanhToan: invoice.hanThanhToan,
      conLai: invoice.conLai,
    },
    priority: 'high',
    createdAt: invoice.hanThanhToan,
  }));
}

async function getExpiringContracts() {
  const hopDongRepo = await getHopDongRepo();
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);

  const result = await hopDongRepo.findMany({ trangThai: 'hoatDong', limit: 1000 });
  const expiringContracts = result.data.filter(
    contract => new Date(contract.ngayKetThuc) <= nextMonth
  );

  return expiringContracts.map(contract => {
    const daysLeft = Math.ceil((new Date(contract.ngayKetThuc).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: `expiring_contract_${contract.id}`,
      type: 'expiring_contract',
      title: 'Hợp đồng sắp hết hạn',
      message: `Hợp đồng ${contract.maHopDong} của phòng ${contract.phong?.maPhong || contract.phongId} sẽ hết hạn trong ${daysLeft} ngày`,
      data: {
        contractId: contract.id,
        maHopDong: contract.maHopDong,
        phong: contract.phong?.maPhong || contract.phongId,
        khachThue: contract.nguoiDaiDien?.hoTen || contract.nguoiDaiDienId,
        ngayKetThuc: contract.ngayKetThuc,
        daysLeft,
      },
      priority: daysLeft <= 7 ? 'high' : daysLeft <= 15 ? 'medium' : 'low',
      createdAt: contract.ngayKetThuc,
    };
  });
}

async function getPendingIssues() {
  const suCoRepo = await getSuCoRepo();

  const result = await suCoRepo.findMany({ limit: 1000 });
  const pendingIssues = result.data.filter(
    issue => issue.trangThai === 'moi' || issue.trangThai === 'dangXuLy'
  );

  return pendingIssues.map(issue => {
    const priorityMap: Record<string, string> = {
      'khancap': 'critical',
      'cao': 'high',
      'trungBinh': 'medium',
      'thap': 'low',
    };

    const statusMap: Record<string, string> = {
      'moi': 'Mới',
      'dangXuLy': 'Đang xử lý',
    };

    return {
      id: `pending_issue_${issue.id}`,
      type: 'pending_issue',
      title: 'Sự cố cần xử lý',
      message: `Sự cố "${issue.tieuDe}" tại phòng ${issue.phong?.maPhong || issue.phongId} - ${statusMap[issue.trangThai] || issue.trangThai}`,
      data: {
        issueId: issue.id,
        tieuDe: issue.tieuDe,
        phong: issue.phong?.maPhong || issue.phongId,
        khachThue: issue.khachThue?.hoTen || issue.khachThueId,
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
  const thongBaoRepo = await getThongBaoRepo();

  const result = await thongBaoRepo.findMany({ loai: 'chung', limit: 10 });

  return result.data.map(notification => ({
    id: `system_${notification.id}`,
    type: 'system',
    title: notification.tieuDe,
    message: notification.noiDung,
    data: {
      notificationId: notification.id,
      nguoiGui: notification.nguoiGui?.ten || notification.nguoiGuiId,
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
  const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

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

    // For system notifications, mark as read
    if (type === 'system' && notificationId) {
      const thongBaoRepo = await getThongBaoRepo();
      await thongBaoRepo.markAsRead(notificationId, session.user.id);
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
