/**
 * POST /api/admin/migrate
 * Chạy các migration SQL còn thiếu vào database (chỉ dùng 1 lần để fix schema).
 * Yêu cầu: session admin.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const results: string[] = [];

    // Thêm các cột còn thiếu (idempotent — dùng IF NOT EXISTS / DO NOTHING)
    const migrations = [
      {
        name: 'KhachThue.pendingZaloChatId',
        sql: `ALTER TABLE "KhachThue" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT`,
      },
      {
        name: 'NguoiDung.zaloChatId',
        sql: `ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT`,
      },
      {
        name: 'NguoiDung.pendingZaloChatId',
        sql: `ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "pendingZaloChatId" TEXT`,
      },
    ];

    for (const m of migrations) {
      try {
        await prisma.$executeRawUnsafe(m.sql);
        results.push(`✓ ${m.name}`);
      } catch (e: any) {
        results.push(`✗ ${m.name}: ${e.message}`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
