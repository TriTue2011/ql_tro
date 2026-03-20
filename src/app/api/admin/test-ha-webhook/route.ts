import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, payload } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, message: "Thiếu URL" }, { status: 400 });
    }

    const body = payload ?? {
      message: "Test từ hệ thống quản lý phòng trọ",
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Allow self-signed certs in local network
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(url.startsWith("http://") ? {} : { agent: undefined }),
    });

    const text = await res.text().catch(() => "");
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? `HA Webhook phản hồi OK (HTTP ${res.status})`
        : `HTTP ${res.status} — HA không phản hồi`,
      body: text.slice(0, 200),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: `Lỗi kết nối: ${msg}` },
      { status: 500 },
    );
  }
}
