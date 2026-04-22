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
import { resolveInvoiceBankInfo } from '@/lib/invoice-bank-resolver';

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

    const [phong, khachThue, cauHinh] = await Promise.all([
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
      resolveInvoiceBankInfo(hoaDon.nguoiTaoId),
    ]);

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
