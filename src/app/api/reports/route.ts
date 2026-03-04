import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import HoaDon from '@/models/HoaDon';
import ThanhToan from '@/models/ThanhToan';
import Phong from '@/models/Phong';
import HopDong from '@/models/HopDong';

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
    const type = searchParams.get('type') || 'revenue';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to current month
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
  // Get revenue by month
  const revenueByMonth = await ThanhToan.aggregate([
    {
      $match: {
        ngayThanhToan: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$ngayThanhToan' },
          month: { $month: '$ngayThanhToan' },
        },
        total: { $sum: '$soTien' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);

  // Get revenue by payment method
  const revenueByMethod = await ThanhToan.aggregate([
    {
      $match: {
        ngayThanhToan: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: '$phuongThuc',
        total: { $sum: '$soTien' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Get total revenue
  const totalRevenue = await ThanhToan.aggregate([
    {
      $match: {
        ngayThanhToan: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$soTien' },
        count: { $sum: 1 },
      },
    },
  ]);

  const data = {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    totalRevenue: totalRevenue[0]?.total || 0,
    totalPayments: totalRevenue[0]?.count || 0,
    revenueByMonth,
    revenueByMethod,
  };

  if (format === 'csv') {
    const csv = generateRevenueCSV(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="revenue-report.csv"',
      },
    });
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

async function getRoomReport(format: string) {
  const roomStats = await Phong.aggregate([
    {
      $group: {
        _id: '$trangThai',
        count: { $sum: 1 },
      },
    },
  ]);

  const totalRooms = await Phong.countDocuments();
  const occupiedRooms = await Phong.countDocuments({ trangThai: 'dangThue' });
  const emptyRooms = await Phong.countDocuments({ trangThai: 'trong' });
  const maintenanceRooms = await Phong.countDocuments({ trangThai: 'baoTri' });

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  const data = {
    totalRooms,
    occupiedRooms,
    emptyRooms,
    maintenanceRooms,
    occupancyRate: Math.round(occupancyRate * 100) / 100,
    roomStats,
  };

  if (format === 'csv') {
    const csv = generateRoomCSV(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="room-report.csv"',
      },
    });
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

async function getContractReport(start: Date, end: Date, format: string) {
  const contracts = await HopDong.find({
    ngayTao: {
      $gte: start,
      $lte: end,
    },
  })
    .populate('phong', 'maPhong toaNha')
    .populate('nguoiDaiDien', 'hoTen soDienThoai')
    .sort({ ngayTao: -1 });

  const contractStats = await HopDong.aggregate([
    {
      $match: {
        ngayTao: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: '$trangThai',
        count: { $sum: 1 },
        totalValue: { $sum: '$giaThue' },
      },
    },
  ]);

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
    const csv = generateContractCSV(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="contract-report.csv"',
      },
    });
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

async function getPaymentReport(start: Date, end: Date, format: string) {
  const payments = await ThanhToan.find({
    ngayThanhToan: {
      $gte: start,
      $lte: end,
    },
  })
    .populate('hoaDon', 'maHoaDon tongTien')
    .populate('nguoiNhan', 'ten email')
    .sort({ ngayThanhToan: -1 });

  const paymentStats = await ThanhToan.aggregate([
    {
      $match: {
        ngayThanhToan: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: '$phuongThuc',
        total: { $sum: '$soTien' },
        count: { $sum: 1 },
      },
    },
  ]);

  const data = {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    totalPayments: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.soTien, 0),
    payments,
    paymentStats,
  };

  if (format === 'csv') {
    const csv = generatePaymentCSV(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="payment-report.csv"',
      },
    });
  }

  return NextResponse.json({
    success: true,
    data,
  });
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
    csv += `${item._id.month},${item._id.year},${item.total.toLocaleString('vi-VN')},${item.count}\n`;
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
    csv += `${contract.maHopDong},${contract.phong.maPhong},${contract.nguoiDaiDien.hoTen},${contract.ngayBatDau.toISOString().split('T')[0]},${contract.ngayKetThuc.toISOString().split('T')[0]},${contract.giaThue.toLocaleString('vi-VN')},${status}\n`;
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
    csv += `${payment.ngayThanhToan.toISOString().split('T')[0]},${payment.hoaDon.maHoaDon},${payment.soTien.toLocaleString('vi-VN')},${method},${payment.nguoiNhan.ten}\n`;
  });
  
  return csv;
}
