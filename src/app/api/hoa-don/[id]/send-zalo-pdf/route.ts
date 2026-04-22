/**
 * POST /api/hoa-don/[id]/send-zalo-pdf
 *
 * Generate PDF hóa đơn server-side rồi gửi qua Zalo (direct hoặc bot-server).
 * Tránh self-fetch issue khi direct mode không thể download /api/... path.
 *
 * Body: { chatId?, phone?, message? }
 */
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getHoaDonRepo } from '@/lib/repositories';
import { buildInvoiceHTML } from '@/lib/invoice-pdf-template';
import { renderPdf } from '@/lib/puppeteer-browser';
import { resolveInvoiceBankInfo } from '@/lib/invoice-bank-resolver';
import {
  sendFileViaBotServer,
  getBotConfig,
  getActiveMode,
} from '@/lib/zalo-bot-client';
import { sendFile as directSendFile } from '@/lib/zalo-direct/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'zalo');

function ensureTemp() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { chatId, phone, message } = await request.json().catch(() => ({}));
  if (!chatId && !phone) return NextResponse.json({ error: 'Cần chatId hoặc phone' }, { status: 400 });

  // 1. Lấy dữ liệu hóa đơn
  const hoaDonRepo = await getHoaDonRepo();
  const hoaDon = await hoaDonRepo.findById(id);
  if (!hoaDon) return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });

  // 2. Resolve chatId nếu chỉ có phone
  let resolvedChatId = chatId as string | undefined;
  if (!resolvedChatId && phone) {
    const kt = await prisma.khachThue.findFirst({ where: { soDienThoai: phone }, select: { zaloChatId: true } });
    resolvedChatId = kt?.zaloChatId ?? undefined;
    if (!resolvedChatId) return NextResponse.json({ error: `Chưa liên kết Zalo Chat ID cho số ${phone}` }, { status: 422 });
  }

  // 3. Build + render PDF
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

  const html = buildInvoiceHTML({ hoaDon: hoaDon as any, phong, khachThue, cauHinh });
  const pdfBuffer = await renderPdf(html);

  // 4. Ghi ra temp file
  ensureTemp();
  const tempPath = path.join(TEMP_DIR, `invoice_${hoaDon.maHoaDon}_${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, pdfBuffer as Buffer);

  try {
    const activeMode = await getActiveMode();
    const caption = (message || `Hóa đơn tháng ${hoaDon.thang}/${hoaDon.nam} - ${hoaDon.maHoaDon}`).slice(0, 1024);

    let result: { ok: boolean; error?: string };
    if (activeMode === 'direct') {
      result = await directSendFile(resolvedChatId!, tempPath, caption, 0, 0);
    } else {
      const botConfig = await getBotConfig();
      if (!botConfig) {
        result = { ok: false, error: 'Không có tài khoản Zalo nào đang kết nối' };
      } else {
        result = await sendFileViaBotServer(resolvedChatId!, tempPath, caption, 0, undefined, botConfig);
      }
    }

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Gửi PDF thất bại' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } finally {
    try { fs.unlinkSync(tempPath); } catch { /* ignore cleanup error */ }
  }
}
