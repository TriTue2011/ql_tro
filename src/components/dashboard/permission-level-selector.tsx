'use client';

import { cn } from '@/lib/utils';
import { Eye, EyeOff, Pencil } from 'lucide-react';

export type PermissionLevel = 'hidden' | 'viewOnly' | 'fullAccess';

export interface PermissionLevelItem {
  key: string;
  label: string;
  group?: string;
  description?: string;
}

interface PermissionLevelSelectorProps {
  items: PermissionLevelItem[];
  values: Record<string, PermissionLevel>;
  onChange: (key: string, value: PermissionLevel) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
  className?: string;
  showGroup?: boolean;
}

const LEVEL_OPTIONS: { value: PermissionLevel; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'hidden', label: 'Ẩn', icon: EyeOff, color: 'text-red-500 bg-red-50 border-red-200 hover:bg-red-100' },
  { value: 'viewOnly', label: 'Xem', icon: Eye, color: 'text-amber-500 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { value: 'fullAccess', label: 'Sửa', icon: Pencil, color: 'text-green-500 bg-green-50 border-green-200 hover:bg-green-100' },
];

/**
 * PermissionLevelSelector — 3-state selector (hidden / viewOnly / fullAccess).
 * Each permission item renders as a row with 3 radio-style buttons.
 */
export default function PermissionLevelSelector({
  items,
  values,
  onChange,
  disabled = false,
  columns = 2,
  className,
  showGroup = false,
}: PermissionLevelSelectorProps) {
  const grouped = showGroup
    ? items.reduce<Record<string, PermissionLevelItem[]>>((acc, item) => {
        const g = item.group || 'default';
        if (!acc[g]) acc[g] = [];
        acc[g].push(item);
        return acc;
      }, {})
    : null;

  const renderItem = (item: PermissionLevelItem) => {
    const currentValue = values[item.key] ?? 'fullAccess';
    return (
      <div
        key={item.key}
        className={cn(
          'rounded-lg border px-3 py-2.5 transition-colors',
          currentValue === 'hidden'
            ? 'border-red-200 bg-red-50/40'
            : currentValue === 'viewOnly'
              ? 'border-amber-200 bg-amber-50/40'
              : 'border-green-200 bg-green-50/40',
          disabled && 'opacity-60',
        )}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
            {item.description && (
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {LEVEL_OPTIONS.map(opt => {
            const isSelected = currentValue === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(item.key, opt.value)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 border',
                  isSelected
                    ? opt.color + ' shadow-sm'
                    : 'text-gray-400 border-gray-200 bg-white hover:border-gray-300 hover:text-gray-600',
                  disabled && 'cursor-not-allowed',
                )}
                title={opt.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
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
