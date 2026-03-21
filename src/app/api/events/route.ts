import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sseAddClient, sseRemoveClient } from '@/lib/sse-emitter';

// Bắt buộc dynamic để Next.js không cache route này
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const clientId = crypto.randomUUID();
  const encoder = new TextEncoder();

  let registered = false;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      sseAddClient(clientId, ctrl);
      registered = true;
      // Ping ban đầu để xác nhận kết nối
      try {
        ctrl.enqueue(encoder.encode(': connected\n\n'));
      } catch { /* ignore */ }
    },
    cancel() {
      if (registered) sseRemoveClient(clientId);
    },
  });

  // Cleanup khi client đóng kết nối
  request.signal.addEventListener('abort', () => {
    if (registered) sseRemoveClient(clientId);
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
