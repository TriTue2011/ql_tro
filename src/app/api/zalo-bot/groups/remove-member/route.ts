import { NextRequest, NextResponse } from "next/server";
import { removeUserFromGroupViaBotServer } from "@/lib/zalo-bot-client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { groupId, memberId, account } = body ?? {};

  if (!groupId || !memberId) {
    return NextResponse.json({ ok: false, error: "Thiếu groupId hoặc memberId" }, { status: 400 });
  }

  const result = await removeUserFromGroupViaBotServer(groupId, memberId, account);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
