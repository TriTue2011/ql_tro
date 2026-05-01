'use client';

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * ZaloHotlineWarning
 *
 * Kiểm tra trạng thái kết nối Zalo Bot Server và hiển thị cảnh báo đỏ
 * ngay dưới lời chào Dashboard nếu có tài khoản Zalo bị mất kết nối.
 *
 * Quy tắc (Section 4.4):
 * - Chỉ hiện lỗi cho tài khoản đã từng kết nối thành công.
 * - In đậm, màu đỏ, nằm ngay dưới lời chào trang Dashboard Tổng quan.
 * - Bắc cầu Zalo: Luôn ưu tiên dùng Bot đang sống để nhắn tin đôn đốc.
 * - Không mất việc: Khi kênh chính hỏng, sự kiện phải còn trong dashboard.
 */
export default function ZaloHotlineWarning() {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/zalo-bot/status?healthCheck=1');
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        const msgs: string[] = [];

        if (!data.ok && data.error) {
          // Bot server không kết nối được hoặc chưa cấu hình
          if (data.error !== 'Chưa cấu hình zalo_bot_server_url trong Cài đặt') {
            msgs.push(`⚠️ Zalo Bot Server: ${data.error}`);
          }
        }

        // Kiểm tra health của từng tài khoản
        if (data.health && Array.isArray(data.health.results)) {
          data.health.results.forEach((r: any) => {
            if (!r.ok && r.accountId) {
              msgs.push(`🔴 Tài khoản Zalo "${r.accountId}" mất kết nối: ${r.error || 'Không xác định'}`);
            }
          });
        }

        // Kiểm tra danh sách accounts — nếu có account nào đã từng login mà giờ offline
        if (Array.isArray(data.accounts)) {
          data.accounts.forEach((acc: any) => {
            // Nếu account có trạng thái và không online
            if (acc.status === 'offline' || acc.status === 'error') {
              msgs.push(`🔴 Zalo "${acc.displayName || acc.id}" đang offline`);
            }
          });
        }

        setWarnings(msgs);
      } catch {
        // Silent fail — không hiện warning nếu API lỗi
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();

    // Tự động kiểm tra lại mỗi 60 giây
    const interval = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading || warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {warnings.map((msg, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm font-semibold"
        >
          <WifiOff className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
          <span>{msg}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs">
        <RefreshCw className="h-3 w-3 flex-shrink-0" />
        <span>
          Hệ thống Zalo đang gặp sự cố kết nối. Một số thông báo có thể không được gửi qua Zalo.
          Vui lòng kiểm tra trong{' '}
          <a href="/dashboard/cai-dat" className="underline font-medium hover:text-amber-800">
            Cài đặt Zalo
          </a>{' '}
          để khắc phục.
        </span>
      </div>
    </div>
  );
}
