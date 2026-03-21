/**
 * GET  /api/zalowebhook/[token]  — Verify challenge từ bot server
 * POST /api/zalowebhook/[token]  — Nhận webhook từ Zalo bot server
 *
 * Token nằm trong URL path (thay vì query param ?secret=...).
 * Token được kiểm tra trong CaiDat (key: zalo_webhook_tokens — JSON array).
 * Nếu chưa có token nào trong DB → chấp nhận tất cả (mode setup ban đầu).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getKhachThueRepo } from '@/lib/repositories';
import { emitNewMessage, cleanupOldMessages } from '@/lib/zalo-message-events';
import { notifyHomeAssistant, handleZaloAutoReply } from '@/lib/zalo-message-handler';

// ─── Token validation ─────────────────────────────────────────────────────────

async function isTokenValid(token: string): Promise<boolean> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: 'zalo_webhook_tokens' } });
    if (!row?.giaTri?.trim()) return true; // chưa cấu hình → cho qua
    const tokens: string[] = JSON.parse(row.giaTri);
    return tokens.includes(token);
  } catch {
    return true; // lỗi parse → cho qua
  }
}

// ─── Payload helpers (giống webhook cũ) ──────────────────────────────────────

function extractAttachmentUrl(msg: Record<string, unknown>): string | null {
  const attachments = (msg?.attachments ?? []) as Record<string, unknown>[];
  for (const att of attachments) {
    const payload = att?.payload as Record<string, unknown> | undefined;
    const url = payload?.url || payload?.thumbnail || att?.url;
    if (url && typeof url === 'string') return url;
  }
  return null;
}

function normalizePayload(update: Record<string, unknown>) {
  const msg = update?.message as Record<string, unknown> | undefined;
  const data = update?.data as Record<string, unknown> | undefined;

  const chatId: string | null =
    (msg?.from as Record<string, unknown>)?.id ? String((msg!.from as Record<string, unknown>).id) :
    (update?.sender as Record<string, unknown>)?.id ? String((update.sender as Record<string, unknown>).id) :
    data?.uidFrom ? String(data.uidFrom) :
    update?.uidFrom ? String(update.uidFrom) : null;

  const displayName: string =
    (msg?.from as Record<string, unknown>)?.display_name as string ||
    (update?.sender as Record<string, unknown>)?.display_name as string ||
    (update?.sender as Record<string, unknown>)?.name as string ||
    data?.dName as string || data?.fromD as string ||
    update?.dName as string || update?.fromD as string || '';

  const attachmentUrl = extractAttachmentUrl(msg ?? update);
  const content: string =
    msg?.text as string ||
    data?.content as string || data?.msg as string ||
    update?.content as string || update?.msg as string ||
    (attachmentUrl ? '[hình ảnh]' : '[đính kèm]');

  const eventName: string =
    update?.event_name as string || update?.event as string || update?.type as string || 'message';

  return { chatId, displayName, content, eventName, attachmentUrl };
}

async function saveMessage(update: Record<string, unknown>): Promise<void> {
  const { chatId, displayName, content, eventName, attachmentUrl } = normalizePayload(update);
  if (!chatId) return;
  try {
    const saved = await prisma.zaloMessage.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { chatId, displayName: displayName || null, content, attachmentUrl, role: 'user', eventName, rawPayload: update as any },
    });
    emitNewMessage({ ...saved, eventName: saved.eventName ?? 'message' });
  } catch (err) {
    console.error('[zalowebhook] saveMessage error:', err);
  }
}

function normalizeName(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

async function detectPending(update: Record<string, unknown>): Promise<void> {
  const { chatId, displayName } = normalizePayload(update);
  if (!chatId || !displayName) return;
  try {
    const repo = await getKhachThueRepo();
    const all = await repo.findMany({ limit: 1000 });
    const norm = normalizeName(displayName);
    const matched = all.data.find(kt => {
      const n = normalizeName(kt.hoTen);
      return n === norm || norm.includes(n.split(' ').pop()!) || n.includes(norm);
    });
    if (!matched || matched.zaloChatId === chatId || matched.pendingZaloChatId === chatId) return;
    await repo.update(matched.id, { pendingZaloChatId: chatId });
  } catch (err) {
    console.error('[zalowebhook] detectPending error:', err);
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!(await isTokenValid(token))) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  return NextResponse.json({ ok: true, endpoint: 'zalowebhook' });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!(await isTokenValid(token))) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const update = (body?.result ?? body) as Record<string, unknown>;

    await Promise.all([
      saveMessage(update),
      detectPending(update),
      cleanupOldMessages(),
      notifyHomeAssistant(update),
      handleZaloAutoReply(update),
    ]);

    return NextResponse.json({ message: 'Success' });
  } catch (err) {
    console.error('[zalowebhook] Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
