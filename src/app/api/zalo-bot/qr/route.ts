/**
 * POST /api/zalo-bot/qr
 * Lấy QR code để quét đăng nhập Zalo trên bot server.
 * Admin: chỉ định accountSelection tùy ý.
 * chuNha / quanLy: lấy QR cho tài khoản của họ (không chỉ định accountSelection).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQRCodeFromBotServer } from '@/lib/zalo-bot-client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha', 'quanLy'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // Admin có thể chỉ định accountSelection bất kỳ
  const accountSelection: string | undefined =
    session.user.role === 'admin' ? (body?.accountSelection || undefined) : undefined;

  const result = await getQRCodeFromBotServer(accountSelection);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error });
  }
  return NextResponse.json({ ok: true, qrCode: result.qrCode });
}
