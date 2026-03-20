import { NextRequest, NextResponse } from "next/server";
import { getAllFriendsFromBotServer } from "@/lib/zalo-bot-client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const account = searchParams.get("account") ?? undefined;
  const count = Number(searchParams.get("count") ?? 200);
  const page = Number(searchParams.get("page") ?? 0);

  const result = await getAllFriendsFromBotServer(account, count, page);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, friends: result.friends, total: result.friends?.length ?? 0 });
}
