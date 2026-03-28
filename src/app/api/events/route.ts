import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sseAddClient, sseRemoveClient, sseClientCount, sseEmit } from '@/lib/sse-emitter';
import prisma from '@/lib/prisma';

// Bắt buộc dynamic để Next.js không cache route này
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const clientId = crypto.randomUUID();
  const encoder = new TextEncoder();

  // Hỗ trợ query ?debug=1 để kiểm tra SSE status
  const { searchParams } = new URL(request.url);
  if (searchParams.get('debug') === '1') {
    return new Response(JSON.stringify({
      clients: sseClientCount(),
      clientId: 'debug-check',
      timestamp: new Date().toISOString(),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const userId = session.user.id;
  const userName = session.user.name || '';
  let registered = false;

  function handleDisconnect() {
    if (!registered) return;
    registered = false;
    sseRemoveClient(clientId);
    // Emit offline event tức thì khi client đóng kết nối
    sseEmit("user-status", { action: "offline", userId, userName });
    // Cập nhật DB (không chờ)
    prisma.nguoiDung.update({
      where: { id: userId },
      data: { hoatDongCuoi: new Date() },
    }).catch(() => {});
  }

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      sseAddClient(clientId, ctrl);
      registered = true;
      console.log(`[SSE] Client connected: ${clientId} (total: ${sseClientCount()})`);
      // Ping ban đầu để xác nhận kết nối
      try {
        ctrl.enqueue(encoder.encode(': connected\n\n'));
      } catch { /* ignore */ }
      // Emit online event tức thì khi client kết nối
      sseEmit("user-status", { action: "online", userId, userName });
    },
    cancel() {
      handleDisconnect();
    },
  });

  // Cleanup khi client đóng kết nối
  request.signal.addEventListener('abort', () => {
    handleDisconnect();
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Tắt buffering nginx
    },
  });
}
