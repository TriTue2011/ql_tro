import { useEffect, useRef } from 'react';

export const REALTIME_EVENTS = [
  'hoa-don',
  'hop-dong',
  'phong',
  'khach-thue',
  'thanh-toan',
  'su-co',
  'toa-nha',
  'chi-so-dien-nuoc',
  'zalo-message',
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

/**
 * Hook kết nối SSE và lắng nghe các sự kiện real-time.
 *
 * @param events   Danh sách event cần lắng nghe (vd: ['hoa-don', 'thanh-toan'])
 * @param onEvent  Callback được gọi khi có event (action: 'created' | 'updated' | 'deleted')
 *
 * @example
 * useRealtimeEvents(['hoa-don'], (type, action) => {
 *   cache.clearCache();
 *   fetchData(true);
 * });
 */
export function useRealtimeEvents(
  events: RealtimeEvent[],
  onEvent: (eventType: RealtimeEvent, action: string) => void
) {
  // Dùng ref để tránh phải disconnect/reconnect khi callback thay đổi
  const callbackRef = useRef(onEvent);
  useEffect(() => {
    callbackRef.current = onEvent;
  });

  const eventsKey = events.join(',');

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource('/api/events');

      events.forEach((ev) => {
        es!.addEventListener(ev, (e: Event) => {
          let action = 'updated';
          try {
            const parsed = JSON.parse((e as MessageEvent).data ?? '{}');
            action = parsed.action ?? 'updated';
          } catch { /* ignore */ }
          callbackRef.current(ev, action);
        });
      });

      es.onopen = () => {
        retryDelay = 2000; // reset delay khi kết nối thành công
      };

      es.onerror = () => {
        es?.close();
        if (!destroyed) {
          retryTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000); // exponential backoff tối đa 30s
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
    // eventsKey thay đổi = danh sách event thay đổi → reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);
}
