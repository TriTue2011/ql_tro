/**
 * GET /api/zalo-bot/status
 * Kiểm tra kết nối bot server, trả về danh sách tài khoản đang đăng nhập.
 * Chỉ admin / chuNha.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAccountsFromBotServer, getBotConfig, getActiveMode } from '@/lib/zalo-bot-client';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha', 'quanLy', 'dongChuTro', 'nhanVien'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const config = await getBotConfig();
  if (!config) {
    return NextResponse.json({
      ok: false,
      serverUrl: '',
      accounts: [],
      error: 'Chưa cấu hình zalo_bot_server_url trong Cài đặt',
    });
  }

  // Kiểm tra mode thực tế — nếu đang dùng direct thì bot server không nên hiện "kết nối"
  const mode = await getActiveMode();
  if (mode === "direct") {
    return NextResponse.json({
      ok: false,
      serverUrl: config.serverUrl,
      accounts: [],
      error: 'Đang dùng chế độ Trực tiếp (Direct). Bot Server không hoạt động.',
      accountId: config.accountId,
    });
  }

  const result = await getAccountsFromBotServer();
  return NextResponse.json({
    ok: !result.error,
    serverUrl: result.serverUrl,
    accounts: result.accounts,
    error: result.error,
    accountId: config.accountId,
  });
}
