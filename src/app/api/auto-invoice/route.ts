import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get all active contracts
    const activeContracts = await prisma.hopDong.findMany({
      where: {
        trangThai: 'hoatDong',
        ngayBatDau: { lte: currentDate },
        ngayKetThuc: { gte: currentDate },
      },
      include: {
        phong: true,
        nguoiDaiDien: true,
      },
    });

    let createdInvoices = 0;
    const errors: string[] = [];

    for (const contract of activeContracts) {
      try {
        // Check if invoice already exists for this contract and month
        const existingInvoice = await prisma.hoaDon.findFirst({
          where: {
            hopDongId: contract.id,
            thang: currentMonth,
            nam: currentYear,
          },
        });

        if (existingInvoice) {
          continue; // Skip if invoice already exists
        }

        // Get utility readings for this month
        const chiSo = await prisma.chiSoDienNuoc.findFirst({
          where: {
            phongId: contract.phongId,
            thang: currentMonth,
            nam: currentYear,
          },
        });

        if (!chiSo) {
          errors.push(`Chưa có chỉ số điện nước cho phòng ${contract.phong.maPhong} tháng ${currentMonth}/${currentYear}`);
          continue;
        }

        // Tính toán số điện nước tiêu thụ
        let soDienTieuThu = chiSo.soDienTieuThu;
        let soNuocTieuThu = chiSo.soNuocTieuThu;

        // Nếu đây là tháng đầu tiên của hợp đồng, tính từ chỉ số ban đầu
        const thangBatDau = new Date(contract.ngayBatDau).getMonth() + 1;
        const namBatDau = new Date(contract.ngayBatDau).getFullYear();

        if (currentMonth === thangBatDau && currentYear === namBatDau) {
          soDienTieuThu = Math.max(0, chiSo.chiSoDienMoi - contract.chiSoDienBanDau);
          soNuocTieuThu = Math.max(0, chiSo.chiSoNuocMoi - contract.chiSoNuocBanDau);
        }

        // Calculate costs
        const tienDien = soDienTieuThu * contract.giaDien;
        const tienNuoc = soNuocTieuThu * contract.giaNuoc;
        const phiDichVuList = contract.phiDichVu as Array<{ ten: string; gia: number }>;
        const tongTienDichVu = phiDichVuList.reduce((sum, dv) => sum + dv.gia, 0);
        const tongTien = contract.giaThue + tienDien + tienNuoc + tongTienDichVu;

        // Generate invoice number
        const invoiceNumber = `HD${currentYear}${currentMonth.toString().padStart(2, '0')}${contract.phong.maPhong}`;

        // Calculate due date (based on contract payment day)
        const dueDate = new Date(currentYear, currentMonth - 1, contract.ngayThanhToan);
        if (dueDate < currentDate) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        // Create invoice
        await prisma.hoaDon.create({
          data: {
            maHoaDon: invoiceNumber,
            hopDongId: contract.id,
            phongId: contract.phongId,
            khachThueId: contract.nguoiDaiDienId,
            thang: currentMonth,
            nam: currentYear,
            tienPhong: contract.giaThue,
            tienDien,
            soDien: soDienTieuThu,
            chiSoDienBanDau: chiSo.chiSoDienCu,
            chiSoDienCuoiKy: chiSo.chiSoDienMoi,
            tienNuoc,
            soNuoc: soNuocTieuThu,
            chiSoNuocBanDau: chiSo.chiSoNuocCu,
            chiSoNuocCuoiKy: chiSo.chiSoNuocMoi,
            phiDichVu: contract.phiDichVu as object[],
            tongTien,
            daThanhToan: 0,
            conLai: tongTien,
            hanThanhToan: dueDate,
            trangThai: 'chuaThanhToan',
          },
        });

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

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Count active contracts
    const activeContractsCount = await prisma.hopDong.count({
      where: {
        trangThai: 'hoatDong',
        ngayBatDau: { lte: currentDate },
        ngayKetThuc: { gte: currentDate },
      },
    });

    // Count existing invoices for this month
    const existingInvoicesCount = await prisma.hoaDon.count({
      where: {
        thang: currentMonth,
        nam: currentYear,
      },
    });

    // Count contracts without utility readings for this month
    const activeContracts = await prisma.hopDong.findMany({
      where: {
        trangThai: 'hoatDong',
        ngayBatDau: { lte: currentDate },
        ngayKetThuc: { gte: currentDate },
      },
      select: { phongId: true },
    });

    const phongIds = activeContracts.map(c => c.phongId);
    const readingsCount = await prisma.chiSoDienNuoc.count({
      where: {
        phongId: { in: phongIds },
        thang: currentMonth,
        nam: currentYear,
      },
    });

    const contractsWithoutReadingsCount = activeContractsCount - readingsCount;

    return NextResponse.json({
      success: true,
      data: {
        currentMonth,
        currentYear,
        activeContractsCount,
        existingInvoicesCount,
        contractsWithoutReadingsCount: Math.max(0, contractsWithoutReadingsCount),
        canRun: activeContractsCount > 0 && contractsWithoutReadingsCount <= 0,
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
