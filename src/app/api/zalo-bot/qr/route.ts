/**
 * POST /api/zalo-bot/qr
 * Lấy QR code để quét đăng nhập Zalo trên bot server.
 * Chỉ admin / chuNha.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQRCodeFromBotServer } from '@/lib/zalo-bot-client';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await getQRCodeFromBotServer();
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error });
  }
  return NextResponse.json({ ok: true, qrCode: result.qrCode });
}
