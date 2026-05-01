'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

interface InlineFormProps {
  title: string;
  description?: string;
  onSave: () => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Ẩn nút Cancel */
  hideCancel?: boolean;
  /** Ẩn nút Save */
  hideSave?: boolean;
  /** Label cho nút Save */
  saveLabel?: string;
}

/**
 * InlineForm — Form xuất hiện dưới dạng card mở rộng trên trang (thay thế Dialog).
 * Dùng cho create/edit inline, không popup.
 */
export default function InlineForm({
  title,
  description,
  onSave,
  onCancel,
  saving = false,
  children,
  className,
  hideCancel = false,
  hideSave = false,
  saveLabel = 'Lưu thay đổi',
}: InlineFormProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm animate-in slide-in-from-top-2 duration-200',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-3 md:px-6 md:pt-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-sm text-gray-500">{description}</p>
          )}
        </div>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 md:px-6 md:pb-5 space-y-4">
        {children}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-blue-100 px-4 py-3 md:px-6">
        {!hideCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Hủy
          </Button>
        )}
        {!hideSave && (
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {saving ? 'Đang lưu...' : saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
