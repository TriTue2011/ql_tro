/**
 * POST /api/zalo-bot/generate-webhook-token
 * Tạo token webhook ngẫu nhiên cho tài khoản (NguoiDung).
 * Body: { targetUserId?: string }
 * Trả về: { ok, token, webhookUrl }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

async function getLocalBaseUrl(): Promise<string | null> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'app_local_url' } });
    const val = row?.giaTri?.trim();
    return val ? val.replace(/\/$/, '') : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId: string = body?.targetUserId || session.user.id;

  // Chỉ admin hoặc chính user đó mới được tạo
  if (session.user.role !== 'admin' && session.user.id !== targetUserId) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  // Base URL: dùng app_local_url (URL app ql_tro, VD: http://172.16.10.27:3000)
  // KHÔNG dùng zaloBotServerUrl vì đó là URL bot server (port khác)
  const localBase = await getLocalBaseUrl();
  if (!localBase) {
    return NextResponse.json({
      ok: false,
      error: 'Chưa cấu hình app_local_url trong Cài đặt. Cần URL ứng dụng (VD: http://172.16.10.27:3000)',
    });
  }

  // Tạo token ngẫu nhiên 24 ký tự hex
  const token = randomBytes(12).toString('hex');

  // Lưu vào DB
  await prisma.nguoiDung.update({
    where: { id: targetUserId },
    data: { zaloWebhookToken: token },
  });

  const webhookUrl = `${localBase}/api/zalo/webhook/${token}`;

  return NextResponse.json({ ok: true, token, webhookUrl });
}
