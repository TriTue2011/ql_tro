/**
 * GET  /api/admin/zalo-direct — Lấy trạng thái direct mode + danh sách tài khoản
 * POST /api/admin/zalo-direct — Login QR / login cookies / logout / add proxy / remove proxy
 *
 * Chỉ admin mới được truy cập.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getActiveMode,
  getAccountsFromBotServer,
  getProxiesFromBotServer,
  getBotConfig,
} from "@/lib/zalo-bot-client";
import * as zaloDirect from "@/lib/zalo-direct";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ admin mới được truy cập" }, { status: 403 });
  }

  try {
    const mode = await getActiveMode();
    const directStatus = zaloDirect.getDirectModeStatus();
    const botConfig = await getBotConfig();

    // Lấy accounts từ cả 2 nguồn
    let botAccounts: any[] = [];
    let botError: string | undefined;
    if (botConfig?.serverUrl) {
      const result = await getAccountsFromBotServer();
      botAccounts = result.accounts;
      botError = result.error;
    }

    const directAccounts = zaloDirect.getAccounts();

    // Lấy proxies
    let proxies: any[] = [];
    if (mode === "direct") {
      proxies = zaloDirect.getProxies();
    } else if (botConfig?.serverUrl) {
      const r = await getProxiesFromBotServer();
      proxies = r.ok ? (Array.isArray(r.data) ? r.data : []) : [];
    }

    return NextResponse.json({
      mode,
      directStatus,
      botServerUrl: botConfig?.serverUrl || null,
      botAccounts,
      botError,
      directAccounts,
      proxies,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ admin mới được truy cập" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "loginQR": {
        const { proxyUrl } = body;
        const result = await zaloDirect.loginWithQR(proxyUrl || undefined);
        return NextResponse.json(result);
      }

      case "loginCookies": {
        const { ownId, proxyUrl } = body;
        if (!ownId) return NextResponse.json({ ok: false, error: "Thiếu ownId" }, { status: 400 });
        const result = await zaloDirect.loginWithCookies(ownId, proxyUrl || undefined);
        return NextResponse.json(result);
      }

      case "autoLoginAll": {
        await zaloDirect.autoLoginAll();
        return NextResponse.json({ ok: true, accounts: zaloDirect.getAccounts() });
      }

      case "logout": {
        const { ownId } = body;
        if (!ownId) return NextResponse.json({ ok: false, error: "Thiếu ownId" }, { status: 400 });
        const result = await zaloDirect.logoutAccount(ownId);
        return NextResponse.json(result);
      }

      case "addProxy": {
        const { proxyUrl } = body;
        if (!proxyUrl) return NextResponse.json({ ok: false, error: "Thiếu proxyUrl" }, { status: 400 });
        zaloDirect.addProxy(proxyUrl);
        return NextResponse.json({ ok: true });
      }

      case "removeProxy": {
        const { proxyUrl } = body;
        if (!proxyUrl) return NextResponse.json({ ok: false, error: "Thiếu proxyUrl" }, { status: 400 });
        zaloDirect.removeProxy(proxyUrl);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Action không hợp lệ: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
