import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const type = searchParams.get('type') || 'revenue';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    let start: Date, end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    switch (type) {
      case 'revenue':
        return await getRevenueReport(start, end, format);
      case 'rooms':
        return await getRoomReport(format);
      case 'contracts':
        return await getContractReport(start, end, format);
      case 'payments':
        return await getPaymentReport(start, end, format);
      default:
        return NextResponse.json(
          { message: 'Loại báo cáo không hợp lệ' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { message: 'Lỗi khi tạo báo cáo' },
      { status: 500 }
    );
  }
}

async function getRevenueReport(start: Date, end: Date, format: string) {
  const dateWhere = { ngayThanhToan: { gte: start, lte: end } };

  const payments = await prisma.thanhToan.findMany({
    where: dateWhere,
    select: { soTien: true, phuongThuc: true, ngayThanhToan: true },
  });

  // Group by month/year
  const monthMap = new Map<string, { month: number; year: number; total: number; count: number }>();
  const methodMap = new Map<string, { total: number; count: number }>();
  let totalRevenue = 0;

  for (const p of payments) {
    totalRevenue += p.soTien;
    const d = new Date(p.ngayThanhToan);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const existing = monthMap.get(key) || { month: d.getMonth() + 1, year: d.getFullYear(), total: 0, count: 0 };
    existing.total += p.soTien;
    existing.count++;
    monthMap.set(key, existing);

    const mExisting = methodMap.get(p.phuongThuc) || { total: 0, count: 0 };
    mExisting.total += p.soTien;
    mExisting.count++;
    methodMap.set(p.phuongThuc, mExisting);
  }

  const revenueByMonth = Array.from(monthMap.values()).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const revenueByMethod = Array.from(methodMap.entries()).map(([_id, v]) => ({ _id, ...v }));

  const data = {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    totalRevenue,
    totalPayments: payments.length,
    revenueByMonth,
    revenueByMethod,
  };

  if (format === 'csv') {
    return new NextResponse(generateRevenueCSV(data), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="revenue-report.csv"',
      },
    });
  }

  return NextResponse.json({ success: true, data });
}

async function getRoomReport(format: string) {
  const [totalRooms, occupiedRooms, emptyRooms, maintenanceRooms, bookedRooms] = await Promise.all([
    prisma.phong.count(),
    prisma.phong.count({ where: { trangThai: 'dangThue' } }),
    prisma.phong.count({ where: { trangThai: 'trong' } }),
    prisma.phong.count({ where: { trangThai: 'baoTri' } }),
    prisma.phong.count({ where: { trangThai: 'daDat' } }),
  ]);

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  const roomStats = [
    { _id: 'trong', count: emptyRooms },
    { _id: 'dangThue', count: occupiedRooms },
    { _id: 'baoTri', count: maintenanceRooms },
    { _id: 'daDat', count: bookedRooms },
  ].filter(s => s.count > 0);

  const data = {
    totalRooms,
    occupiedRooms,
    emptyRooms,
    maintenanceRooms,
    occupancyRate: Math.round(occupancyRate * 100) / 100,
    roomStats,
  };

  if (format === 'csv') {
    return new NextResponse(generateRoomCSV(data), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="room-report.csv"',
      },
    });
  }

  return NextResponse.json({ success: true, data });
}

async function getContractReport(start: Date, end: Date, format: string) {
  const contracts = await prisma.hopDong.findMany({
    where: { ngayTao: { gte: start, lte: end } },
    include: {
      phong: { select: { maPhong: true } },
      nguoiDaiDien: { select: { hoTen: true, soDienThoai: true } },
    },
    orderBy: { ngayTao: 'desc' },
  });

  const statsMap = new Map<string, { count: number; totalValue: number }>();
  for (const c of contracts) {
    const existing = statsMap.get(c.trangThai) || { count: 0, totalValue: 0 };
    existing.count++;
    existing.totalValue += c.giaThue;
    statsMap.set(c.trangThai, existing);
  }
  const contractStats = Array.from(statsMap.entries()).map(([_id, v]) => ({ _id, ...v }));

  const data = {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    totalContracts: contracts.length,
    contracts,
    contractStats,
  };

  if (format === 'csv') {
    return new NextResponse(generateContractCSV(data), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="contract-report.csv"',
      },
    });
  }

  return NextResponse.json({ success: true, data });
}

async function getPaymentReport(start: Date, end: Date, format: string) {
  const payments = await prisma.thanhToan.findMany({
    where: { ngayThanhToan: { gte: start, lte: end } },
    include: {
      hoaDon: { select: { maHoaDon: true, tongTien: true } },
      nguoiNhan: { select: { ten: true, email: true } },
    },
    orderBy: { ngayThanhToan: 'desc' },
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.soTien, 0);

  const methodMap = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const existing = methodMap.get(p.phuongThuc) || { total: 0, count: 0 };
    existing.total += p.soTien;
    existing.count++;
    methodMap.set(p.phuongThuc, existing);
  }
  const paymentStats = Array.from(methodMap.entries()).map(([_id, v]) => ({ _id, ...v }));

  const data = {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    totalPayments: payments.length,
    totalAmount,
    payments,
    paymentStats,
  };

  if (format === 'csv') {
    return new NextResponse(generatePaymentCSV(data), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="payment-report.csv"',
      },
    });
  }

  return NextResponse.json({ success: true, data });
}

function generateRevenueCSV(data: any): string {
  let csv = 'Báo cáo doanh thu\n';
  csv += `Từ ngày: ${data.period.start}\n`;
  csv += `Đến ngày: ${data.period.end}\n`;
  csv += `Tổng doanh thu: ${data.totalRevenue.toLocaleString('vi-VN')} VNĐ\n`;
  csv += `Tổng số giao dịch: ${data.totalPayments}\n\n`;

  csv += 'Doanh thu theo tháng:\n';
  csv += 'Tháng,Năm,Tổng tiền,Số giao dịch\n';
  data.revenueByMonth.forEach((item: any) => {
    csv += `${item.month},${item.year},${item.total.toLocaleString('vi-VN')},${item.count}\n`;
  });

  csv += '\nDoanh thu theo phương thức:\n';
  csv += 'Phương thức,Tổng tiền,Số giao dịch\n';
  data.revenueByMethod.forEach((item: any) => {
    const method = item._id === 'tienMat' ? 'Tiền mặt' :
                   item._id === 'chuyenKhoan' ? 'Chuyển khoản' : 'Ví điện tử';
    csv += `${method},${item.total.toLocaleString('vi-VN')},${item.count}\n`;
  });

  return csv;
}

function generateRoomCSV(data: any): string {
  let csv = 'Báo cáo phòng\n';
  csv += `Tổng số phòng: ${data.totalRooms}\n`;
  csv += `Phòng đang thuê: ${data.occupiedRooms}\n`;
  csv += `Phòng trống: ${data.emptyRooms}\n`;
  csv += `Phòng bảo trì: ${data.maintenanceRooms}\n`;
  csv += `Tỷ lệ lấp đầy: ${data.occupancyRate}%\n\n`;

  csv += 'Thống kê theo trạng thái:\n';
  csv += 'Trạng thái,Số lượng\n';
  data.roomStats.forEach((item: any) => {
    const status = item._id === 'trong' ? 'Trống' :
                   item._id === 'dangThue' ? 'Đang thuê' :
                   item._id === 'baoTri' ? 'Bảo trì' : 'Đã đặt';
    csv += `${status},${item.count}\n`;
  });

  return csv;
}

function generateContractCSV(data: any): string {
  let csv = 'Báo cáo hợp đồng\n';
  csv += `Từ ngày: ${data.period.start}\n`;
  csv += `Đến ngày: ${data.period.end}\n`;
  csv += `Tổng số hợp đồng: ${data.totalContracts}\n\n`;

  csv += 'Chi tiết hợp đồng:\n';
  csv += 'Mã hợp đồng,Phòng,Khách thuê,Ngày bắt đầu,Ngày kết thúc,Giá thuê,Trạng thái\n';
  data.contracts.forEach((contract: any) => {
    const status = contract.trangThai === 'hoatDong' ? 'Hoạt động' :
                   contract.trangThai === 'hetHan' ? 'Hết hạn' : 'Đã hủy';
    csv += `${contract.maHopDong},${contract.phong?.maPhong || ''},${contract.nguoiDaiDien?.hoTen || ''},${new Date(contract.ngayBatDau).toISOString().split('T')[0]},${new Date(contract.ngayKetThuc).toISOString().split('T')[0]},${contract.giaThue.toLocaleString('vi-VN')},${status}\n`;
  });

  return csv;
}

function generatePaymentCSV(data: any): string {
  let csv = 'Báo cáo thanh toán\n';
  csv += `Từ ngày: ${data.period.start}\n`;
  csv += `Đến ngày: ${data.period.end}\n`;
  csv += `Tổng số giao dịch: ${data.totalPayments}\n`;
  csv += `Tổng số tiền: ${data.totalAmount.toLocaleString('vi-VN')} VNĐ\n\n`;

  csv += 'Chi tiết thanh toán:\n';
  csv += 'Ngày thanh toán,Hóa đơn,Số tiền,Phương thức,Người nhận\n';
  data.payments.forEach((payment: any) => {
    const method = payment.phuongThuc === 'tienMat' ? 'Tiền mặt' :
                   payment.phuongThuc === 'chuyenKhoan' ? 'Chuyển khoản' : 'Ví điện tử';
    csv += `${new Date(payment.ngayThanhToan).toISOString().split('T')[0]},${payment.hoaDon?.maHoaDon || ''},${payment.soTien.toLocaleString('vi-VN')},${method},${payment.nguoiNhan?.ten || ''}\n`;
  });

  return csv;
}
