import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Phong from '@/models/Phong';
import HoaDon from '@/models/HoaDon';
import SuCo from '@/models/SuCo';
import HopDong from '@/models/HopDong';
import ThanhToan from '@/models/ThanhToan';

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

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get room stats
    const totalPhong = await Phong.countDocuments();
    const phongTrong = await Phong.countDocuments({ trangThai: 'trong' });
    const phongDangThue = await Phong.countDocuments({ trangThai: 'dangThue' });
    const phongBaoTri = await Phong.countDocuments({ trangThai: 'baoTri' });

    // Get revenue stats
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    
    const doanhThuThang = await ThanhToan.aggregate([
      {
        $match: {
          ngayThanhToan: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$soTien' }
        }
      }
    ]);

    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
    
    const doanhThuNam = await ThanhToan.aggregate([
      {
        $match: {
          ngayThanhToan: {
            $gte: startOfYear,
            $lte: endOfYear
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$soTien' }
        }
      }
    ]);

    // Get pending invoices (due in next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const hoaDonSapDenHan = await HoaDon.countDocuments({
      hanThanhToan: { $lte: nextWeek },
      trangThai: { $in: ['chuaThanhToan', 'daThanhToanMotPhan'] }
    });

    // Get pending issues
    const suCoCanXuLy = await SuCo.countDocuments({
      trangThai: { $in: ['moi', 'dangXuLy'] }
    });

    // Get contracts expiring in next 30 days
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    
    const hopDongSapHetHan = await HopDong.countDocuments({
      ngayKetThuc: { $lte: nextMonth },
      trangThai: 'hoatDong'
    });

    const stats = {
      tongSoPhong: totalPhong,
      phongTrong,
      phongDangThue,
      phongBaoTri,
      doanhThuThang: doanhThuThang[0]?.total || 0,
      doanhThuNam: doanhThuNam[0]?.total || 0,
      hoaDonSapDenHan,
      suCoCanXuLy,
      hopDongSapHetHan,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
