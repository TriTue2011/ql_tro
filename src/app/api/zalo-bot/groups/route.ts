import { NextRequest, NextResponse } from "next/server";
import { getAllGroupsFromBotServer } from "@/lib/zalo-bot-client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const account = searchParams.get("account") ?? undefined;

  const result = await getAllGroupsFromBotServer(account);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, groups: result.groups, total: result.groups?.length ?? 0 });
}
