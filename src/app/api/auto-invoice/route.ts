import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import HopDong from '@/models/HopDong';
import HoaDon from '@/models/HoaDon';
import ChiSoDienNuoc from '@/models/ChiSoDienNuoc';
import Phong from '@/models/Phong';

export async function POST(request: NextRequest) {
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

    // Get all active contracts
    const activeContracts = await HopDong.find({
      trangThai: 'hoatDong',
      ngayBatDau: { $lte: currentDate },
      ngayKetThuc: { $gte: currentDate },
    }).populate('phong').populate('nguoiDaiDien');

    let createdInvoices = 0;
    let errors = [];

    for (const contract of activeContracts) {
      try {
        // Check if invoice already exists for this contract and month
        const existingInvoice = await HoaDon.findOne({
          hopDong: contract._id,
          thang: currentMonth,
          nam: currentYear,
        });

        if (existingInvoice) {
          continue; // Skip if invoice already exists
        }

        // Get utility readings for this month
        const chiSo = await ChiSoDienNuoc.findOne({
          phong: contract.phong._id,
          thang: currentMonth,
          nam: currentYear,
        });

        if (!chiSo) {
          errors.push(`Chưa có chỉ số điện nước cho phòng ${contract.phong.maPhong} tháng ${currentMonth}/${currentYear}`);
          continue;
        }

        // Tính toán số điện nước tiêu thụ dựa trên chỉ số ban đầu từ hợp đồng
        let soDienTieuThu = chiSo.soDienTieuThu;
        let soNuocTieuThu = chiSo.soNuocTieuThu;
        
        // Nếu đây là tháng đầu tiên của hợp đồng, tính từ chỉ số ban đầu
        const thangBatDau = new Date(contract.ngayBatDau).getMonth() + 1;
        const namBatDau = new Date(contract.ngayBatDau).getFullYear();
        
        if (currentMonth === thangBatDau && currentYear === namBatDau) {
          // Tháng đầu tiên: tính từ chỉ số ban đầu đến chỉ số hiện tại
          soDienTieuThu = Math.max(0, chiSo.chiSoDienMoi - contract.chiSoDienBanDau);
          soNuocTieuThu = Math.max(0, chiSo.chiSoNuocMoi - contract.chiSoNuocBanDau);
        }

        // Calculate costs
        const tienDien = soDienTieuThu * contract.giaDien;
        const tienNuoc = soNuocTieuThu * contract.giaNuoc;
        const tongTienDichVu = contract.phiDichVu.reduce((sum: number, dv: { gia: number }) => sum + dv.gia, 0);
        const tongTien = contract.giaThue + tienDien + tienNuoc + tongTienDichVu;

        // Generate invoice number
        const invoiceNumber = `HD${currentYear}${currentMonth.toString().padStart(2, '0')}${contract.phong.maPhong}`;

        // Calculate due date (based on contract payment day)
        const dueDate = new Date(currentYear, currentMonth - 1, contract.ngayThanhToan);
        if (dueDate < currentDate) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        // Create invoice
        const newInvoice = new HoaDon({
          maHoaDon: invoiceNumber,
          hopDong: contract._id,
          phong: contract.phong._id,
          khachThue: contract.nguoiDaiDien._id,
          thang: currentMonth,
          nam: currentYear,
          tienPhong: contract.giaThue,
          tienDien,
          soDien: soDienTieuThu,
          tienNuoc,
          soNuoc: soNuocTieuThu,
          phiDichVu: contract.phiDichVu,
          tongTien,
          daThanhToan: 0,
          conLai: tongTien,
          hanThanhToan: dueDate,
          trangThai: 'chuaThanhToan',
        });

        await newInvoice.save();
        createdInvoices++;

      } catch (error) {
        console.error(`Error creating invoice for contract ${contract.maHopDong}:`, error);
        errors.push(`Lỗi tạo hóa đơn cho hợp đồng ${contract.maHopDong}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        createdInvoices,
        totalContracts: activeContracts.length,
        errors,
      },
      message: `Đã tạo ${createdInvoices} hóa đơn tự động`,
    });

  } catch (error) {
    console.error('Error in auto invoice generation:', error);
    return NextResponse.json(
      { message: 'Lỗi khi tạo hóa đơn tự động' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if auto-invoice can be run
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

    // Count active contracts
    const activeContractsCount = await HopDong.countDocuments({
      trangThai: 'hoatDong',
      ngayBatDau: { $lte: currentDate },
      ngayKetThuc: { $gte: currentDate },
    });

    // Count existing invoices for this month
    const existingInvoicesCount = await HoaDon.countDocuments({
      thang: currentMonth,
      nam: currentYear,
    });

    // Count contracts without utility readings
    const contractsWithoutReadings = await HopDong.aggregate([
      {
        $match: {
          trangThai: 'hoatDong',
          ngayBatDau: { $lte: currentDate },
          ngayKetThuc: { $gte: currentDate },
        }
      },
      {
        $lookup: {
          from: 'chisodiennuocs',
          let: { phongId: '$phong' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$phong', '$$phongId'] },
                    { $eq: ['$thang', currentMonth] },
                    { $eq: ['$nam', currentYear] },
                  ]
                }
              }
            }
          ],
          as: 'readings'
        }
      },
      {
        $match: {
          readings: { $size: 0 }
        }
      },
      {
        $count: 'count'
      }
    ]);

    const contractsWithoutReadingsCount = contractsWithoutReadings[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        currentMonth,
        currentYear,
        activeContractsCount,
        existingInvoicesCount,
        contractsWithoutReadingsCount,
        canRun: activeContractsCount > 0 && contractsWithoutReadingsCount === 0,
      },
    });

  } catch (error) {
    console.error('Error checking auto-invoice status:', error);
    return NextResponse.json(
      { message: 'Lỗi khi kiểm tra trạng thái tạo hóa đơn tự động' },
      { status: 500 }
    );
  }
}
