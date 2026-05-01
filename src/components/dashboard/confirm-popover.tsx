'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface ConfirmPopoverProps {
  title?: string;
  message: string;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  children: React.ReactNode;
}

/**
 * ConfirmPopover — Inline confirmation (thay thế Dialog xác nhận).
 * Hiển thị ngay bên dưới nút trigger.
 */
export default function ConfirmPopover({
  title = 'Xác nhận',
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger',
  children,
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel?.();
  };

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      border: 'border-red-200',
      bg: 'bg-red-50',
    },
    warning: {
      icon: 'text-amber-500',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
    },
    info: {
      icon: 'text-blue-500',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      border: 'border-blue-200',
      bg: 'bg-blue-50',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="relative inline-block">
      {/* Trigger */}
      <div onClick={() => setOpen(!open)}>{children}</div>

      {/* Popover */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={handleCancel} />
          {/* Popover content */}
          <div
            className={cn(
              'absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border shadow-lg',
              styles.border,
              styles.bg,
            )}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{message}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={loading}
                  className={styles.button}
                >
                  {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  {loading ? 'Đang xử lý...' : confirmLabel}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
