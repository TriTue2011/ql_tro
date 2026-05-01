'use client';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export interface PermissionItem {
  key: string;
  label: string;
  group?: string;
  description?: string;
}

interface PermissionGridProps {
  items: PermissionItem[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
  className?: string;
  /** Hiển thị group label */
  showGroup?: boolean;
}

/**
 * PermissionGrid — Lưới checkbox phân quyền.
 * Items theo hàng dọc bên trái, ô vuông tích/không tích bên phải.
 * Dùng grid với số cột tùy chỉnh.
 */
export default function PermissionGrid({
  items,
  values,
  onChange,
  disabled = false,
  columns = 2,
  className,
  showGroup = false,
}: PermissionGridProps) {
  const grouped = showGroup
    ? items.reduce<Record<string, PermissionItem[]>>((acc, item) => {
        const g = item.group || 'default';
        if (!acc[g]) acc[g] = [];
        acc[g].push(item);
        return acc;
      }, {})
    : null;

  const renderItem = (item: PermissionItem) => {
    const checked = values[item.key] ?? false;
    return (
      <label
        key={item.key}
        className={cn(
          'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer',
          checked
            ? 'border-blue-200 bg-blue-50/50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(val) => onChange(item.key, val === true)}
          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
        />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-700">{item.label}</span>
          {item.description && (
            <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
          )}
        </div>
      </label>
    );
  };

  const gridCols = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={cn('space-y-3', className)}>
      {grouped ? (
        Object.entries(grouped).map(([group, groupItems]) => (
          <div key={group}>
            {showGroup && (
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {group}
              </h4>
            )}
            <div className={cn('grid gap-2', gridCols)}>
              {groupItems.map(renderItem)}
            </div>
          </div>
        ))
      ) : (
        <div className={cn('grid gap-2', gridCols)}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}
