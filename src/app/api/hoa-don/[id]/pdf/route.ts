/**
 * GET /api/hoa-don/[id]/pdf
 *
 * Xuất hóa đơn ra PDF (Puppeteer server-side) — text crisp, tìm kiếm được.
 * ID hóa đơn (cuid) đóng vai trò access token ngầm; không cần session cho link chia sẻ.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHoaDonRepo } from '@/lib/repositories';
import { buildInvoiceHTML } from '@/lib/invoice-pdf-template';
import { renderPdf } from '@/lib/puppeteer-browser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const hoaDonRepo = await getHoaDonRepo();
    const hoaDon = await hoaDonRepo.findById(id);
    if (!hoaDon) return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });

    const [phong, khachThue, cauHinhRows] = await Promise.all([
      hoaDon.phongId ? prisma.phong.findUnique({
        where: { id: hoaDon.phongId },
        select: {
          id: true, maPhong: true, tang: true, dienTich: true, giaThue: true,
          toaNha: { select: { tenToaNha: true, diaChi: true } },
        },
      }) : null,
      hoaDon.khachThueId ? prisma.khachThue.findUnique({
        where: { id: hoaDon.khachThueId },
        select: { hoTen: true, soDienThoai: true },
      }) : null,
      prisma.caiDat.findMany({
        where: {
          khoa: {
            in: [
              'ten_cong_ty',
              'ngan_hang_so_tai_khoan',
              'ngan_hang_ten',
              'ngan_hang_chu_tai_khoan',
              'logo_url',
            ],
          },
        },
        select: { khoa: true, giaTri: true },
      }),
    ]);
    const rawCfg = Object.fromEntries(cauHinhRows.map(r => [r.khoa, r.giaTri ?? '']));
    const cauHinh = {
      tenChuNha: rawCfg['ten_cong_ty'] ?? '',
      soTaiKhoan: rawCfg['ngan_hang_so_tai_khoan'] ?? '',
      nganHang: rawCfg['ngan_hang_ten'] ?? '',
      chuTaiKhoan: rawCfg['ngan_hang_chu_tai_khoan'] ?? '',
      logoUrl: rawCfg['logo_url'] ?? '',
    };

    const html = buildInvoiceHTML({
      hoaDon: hoaDon as any,
      phong,
      khachThue,
      cauHinh,
    });

    const pdf = await renderPdf(html);

    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="hoa-don-${hoaDon.maHoaDon}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[hoa-don/pdf] Error:', error);
    return NextResponse.json(
      { error: 'Lỗi tạo PDF', message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
