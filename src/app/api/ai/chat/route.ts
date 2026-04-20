/**
 * /api/ai/chat
 *
 * AI chat endpoint với phân quyền theo vai trò.
 * - Xác thực qua NextAuth session (NguoiDung) hoặc khachThue session
 * - Xây dựng context DB theo vai trò người dùng
 * - Trả lời chỉ trong phạm vi quyền của người hỏi
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { askAI, AiMessage } from '@/lib/ai-chat';
import { buildContextForRole, UserRole } from '@/lib/ai-context';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 40;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const userId = session.user.id;
  const role = (session.user.role ?? 'nhanVien') as UserRole;

  // ── Kiểm tra quyền dùng AI ────────────────────────────────────────────────
  // Admin luôn có quyền; các vai trò khác cần được admin kích hoạt
  if (role !== 'admin') {
    const user = await prisma.nguoiDung.findUnique({
      where: { id: userId },
      select: { aiEnabled: true },
    });
    if (!user?.aiEnabled) {
      return NextResponse.json(
        { error: 'Tính năng AI chưa được kích hoạt cho tài khoản của bạn. Liên hệ admin để được cấp quyền.' },
        { status: 403 },
      );
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'Thiếu messages' }, { status: 400 });
  }

  // Validate message format — chỉ nhận role user/assistant, nội dung là string
  const messages = body.messages as { role: string; content: string }[];
  const validRoles = new Set(['user', 'assistant']);
  if (
    messages.some(
      m => !validRoles.has(m.role) || typeof m.content !== 'string' || m.content.length > 2000,
    )
  ) {
    return NextResponse.json({ error: 'Messages không hợp lệ' }, { status: 400 });
  }

  // ── Build context + system prompt ─────────────────────────────────────────
  let systemPrompt: string;
  try {
    const ctx = await buildContextForRole(userId, role);
    systemPrompt = ctx.systemPrompt;
  } catch (err) {
    console.error('[ai/chat] buildContextForRole error:', err);
    return NextResponse.json({ error: 'Lỗi khi tải dữ liệu' }, { status: 500 });
  }

  // ── Call AI ───────────────────────────────────────────────────────────────
  // Giữ tối đa 12 tin nhắn gần nhất để tránh vượt context limit
  const history = messages.slice(-12) as AiMessage[];
  const aiMessages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  let reply: string | null = null;
  try {
    reply = await askAI(aiMessages, 700);
  } catch (err) {
    console.error('[ai/chat] askAI error:', err);
    return NextResponse.json({ error: 'Lỗi khi gọi AI' }, { status: 502 });
  }

  if (!reply) {
    return NextResponse.json(
      {
        error:
          'AI chưa được cấu hình. Vào Cài đặt → Hệ thống để thiết lập API key và nhà cung cấp AI.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ reply });
}
