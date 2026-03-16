/**
 * GET /api/zalo/messages/stream?chatId=xxx&after=<ISO>
 * SSE endpoint — đẩy tin nhắn mới về client theo thời gian thực.
 * Poll DB mỗi 3 giây, gửi event nếu có tin nhắn mới hơn cursor.
 * Thiết kế sẵn cho AI: mỗi event gồm đủ thông tin để AI xử lý.
 */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId') || undefined;
  const afterParam = searchParams.get('after');

  const encoder = new TextEncoder();
  let cursor = afterParam ? new Date(afterParam) : new Date(Date.now() - 5000);
  let timer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      // Heartbeat ngay lập tức để client biết kết nối thành công
      controller.enqueue(encoder.encode(': connected\n\n'));

      timer = setInterval(async () => {
        try {
          const messages = await prisma.zaloMessage.findMany({
            where: {
              ...(chatId ? { chatId } : {}),
              createdAt: { gt: cursor },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });

          if (messages.length > 0) {
            cursor = messages[messages.length - 1].createdAt;
            const payload = `data: ${JSON.stringify({ type: 'messages', data: messages })}\n\n`;
            controller.enqueue(encoder.encode(payload));
          }
        } catch {
          // DB error - tiếp tục polling
        }
      }, 3000);

      // Heartbeat mỗi 25s để tránh timeout proxy
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      request.signal.addEventListener('abort', () => {
        clearInterval(timer);
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx: tắt buffer để SSE real-time
    },
  });
}
