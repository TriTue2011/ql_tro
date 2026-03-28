/**
 * GET /api/zalo-bot/status
 * GET /api/zalo-bot/status?healthCheck=1  — health check thật (gọi API từng tài khoản)
 * Kiểm tra kết nối bot server, trả về danh sách tài khoản đang đăng nhập.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAccountsFromBotServer, getBotConfig, getActiveMode, verifyBotServerHealth } from '@/lib/zalo-bot-client';

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const doHealthCheck = searchParams.get('healthCheck') === '1';

  // Health check thật: kiểm tra từng tài khoản trên bot server
  let health: any = undefined;
  if (doHealthCheck) {
    health = await verifyBotServerHealth(config);
  }

  const result = await getAccountsFromBotServer();
  return NextResponse.json({
    ok: !result.error,
    serverUrl: result.serverUrl,
    accounts: result.accounts,
    error: result.error,
    accountId: config.accountId,
    health,
  });
}
