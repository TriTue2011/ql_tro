/**
 * SSE Emitter singleton — broadcast real-time events tới tất cả client đang kết nối.
 *
 * Dùng globalThis để đảm bảo chỉ có 1 instance duy nhất,
 * tránh lỗi Next.js module bundling tạo nhiều instance.
 */

const encoder = new TextEncoder();

type SSEClient = {
  ctrl: ReadableStreamDefaultController<Uint8Array>;
  keepAliveTimer: ReturnType<typeof setInterval>;
};

// ─── Singleton via globalThis (giống cách Prisma xử lý) ──────────────────────

const GLOBAL_KEY = '__sseEmitterClients__' as const;

const globalForSSE = globalThis as unknown as {
  [GLOBAL_KEY]?: Map<string, SSEClient>;
};

function getClients(): Map<string, SSEClient> {
  if (!globalForSSE[GLOBAL_KEY]) {
    globalForSSE[GLOBAL_KEY] = new Map();
  }
  return globalForSSE[GLOBAL_KEY];
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function sseAddClient(
  id: string,
  ctrl: ReadableStreamDefaultController<Uint8Array>
) {
  const clients = getClients();
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
  const clients = getClients();
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
  const clients = getClients();
  console.log(`[SSE] emit "${eventType}" → ${clients.size} client(s)`, JSON.stringify(data));
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
  return getClients().size;
}
