/**
 * POST /api/heartbeat — Cập nhật thời gian hoạt động cuối của user
 * Client gọi định kỳ (mỗi 30 giây) để xác định user đang online trên web.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;

  // NguoiDung roles
  if (["admin", "chuNha", "dongChuTro", "quanLy", "nhanVien"].includes(role ?? "")) {
    await prisma.nguoiDung.update({
      where: { id: session.user.id },
      data: { hoatDongCuoi: new Date() },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
