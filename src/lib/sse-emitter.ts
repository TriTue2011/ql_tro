/**
 * SSE Emitter singleton — broadcast real-time events tới tất cả client đang kết nối.
 *
 * Hoạt động trong cùng 1 Node.js process (phù hợp với self-hosted Next.js).
 * Khi dùng serverless/edge, cần thay bằng Pusher/Ably.
 */

const encoder = new TextEncoder();

type SSEClient = {
  ctrl: ReadableStreamDefaultController<Uint8Array>;
  keepAliveTimer: ReturnType<typeof setInterval>;
};

// Map clientId → SSEClient
const clients = new Map<string, SSEClient>();

export function sseAddClient(
  id: string,
  ctrl: ReadableStreamDefaultController<Uint8Array>
) {
  const keepAliveTimer = setInterval(() => {
    try {
      ctrl.enqueue(encoder.encode(': keepalive\n\n'));
    } catch {
      sseRemoveClient(id);
    }
  }, 25000);
  clients.set(id, { ctrl, keepAliveTimer });
}

export function sseRemoveClient(id: string) {
  const client = clients.get(id);
  if (client) {
    clearInterval(client.keepAliveTimer);
    clients.delete(id);
  }
}

/**
 * Phát sự kiện tới tất cả client đang kết nối.
 * @param eventType  Tên event (vd: 'hoa-don', 'phong', 'hop-dong', ...)
 * @param data       Dữ liệu đính kèm (action: 'created' | 'updated' | 'deleted')
 */
export function sseEmit(
  eventType: string,
  data: Record<string, unknown> = {}
) {
  if (clients.size === 0) return;
  const payload = encoder.encode(
    `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  );
  for (const [id, client] of clients) {
    try {
      client.ctrl.enqueue(payload);
    } catch {
      sseRemoveClient(id);
    }
  }
}

export function sseClientCount() {
  return clients.size;
}
