/**
 * POST /api/zalo-bot/qr
 * Lấy QR code để quét đăng nhập Zalo trên bot server.
 * Admin: chỉ định accountSelection tùy ý.
 * chuNha / quanLy: có thể truyền accountSelection (zaloAccountId của mình).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQRCodeFromBotServer } from '@/lib/zalo-bot-client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha', 'quanLy', 'dongChuTro'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const accountSelection: string | undefined = body?.accountSelection || undefined;

  const result = await getQRCodeFromBotServer(accountSelection);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error });
  }
  return NextResponse.json({ ok: true, qrCode: result.qrCode });
}
