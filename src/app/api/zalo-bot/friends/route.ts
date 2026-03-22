import { NextRequest, NextResponse } from "next/server";
import { getAllFriendsFromBotServer } from "@/lib/zalo-bot-client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const account = searchParams.get("account") ?? undefined;

  const result = await getAllFriendsFromBotServer(account);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, friends: result.friends, total: result.friends?.length ?? 0 });
}
