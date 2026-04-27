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

    const { searchParams } = new URL(request.url);
    const currentYear = new Date().getFullYear();
    const year = Math.min(
      Math.max(parseInt(searchParams.get('year') || String(currentYear)), 2000),
      currentYear + 1
    );

    const userId = session.user.id;
    const role = session.user.role;

    // 1. Lấy danh sách tòa nhà của user (Scoping)
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
      return NextResponse.json({
        success: true,
        year,
        months: Array(12).fill(0).map((_, i) => ({ month: i + 1, revenue: 0 })),
      });
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    // 2. Query ThanhToan có scope tòa nhà và trạng thái hóa đơn "đã thanh toán"
    const buildingFilter = role === 'admin' ? {} : { toaNhaId: { in: myBuildingIds } };

    const payments = await prisma.thanhToan.findMany({
      where: { 
        ngayThanhToan: { gte: startOfYear, lte: endOfYear },
        hoaDon: { 
          phong: buildingFilter,
          trangThai: 'daThanhToan' // Theo yêu cầu: chỉ lấy khi hóa đơn đã thanh toán
        }
      },
      select: { soTien: true, ngayThanhToan: true },
    });

    // Aggregate by month (0-indexed)
    const monthly: number[] = Array(12).fill(0);
    for (const p of payments) {
      const m = new Date(p.ngayThanhToan).getMonth();
      monthly[m] += p.soTien;
    }

    return NextResponse.json({
      success: true,
      year,
      months: monthly.map((revenue, i) => ({ month: i + 1, revenue })),
    });
  } catch (error) {
    console.error('Error fetching monthly revenue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
