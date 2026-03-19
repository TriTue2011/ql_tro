/**
 * POST /api/webhook/generate
 * Tạo webhook ID mới cho Zalo Bot — giống cách HA tạo webhook_id.
 * Chỉ admin / chuNha.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

function generateWebhookId(): string {
  return randomBytes(32).toString('base64url');
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const webhookId = generateWebhookId();

  await prisma.caiDat.upsert({
    where: { khoa: 'zalo_webhook_id' },
    update: { giaTri: webhookId },
    create: { khoa: 'zalo_webhook_id', giaTri: webhookId },
  });

  return NextResponse.json({ success: true, webhookId });
}

/** GET: Trả về webhook ID hiện tại (nếu có) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'chuNha'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_id' } });
  const webhookId = row?.giaTri?.trim() || null;

  return NextResponse.json({ webhookId });
}
