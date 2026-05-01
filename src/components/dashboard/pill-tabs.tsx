'use client';

import { cn } from '@/lib/utils';

export interface PillTab {
  value: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

interface PillTabsProps {
  tabs: PillTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * PillTabs — Tab dạng pill bo tròn.
 * Tab active: bg-blue-600 text-white shadow-sm
 * Tab inactive: bg-gray-100 text-gray-600 hover:bg-gray-200
 */
export default function PillTabs({ tabs, value, onChange, className }: PillTabsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800',
              tab.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px]',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-700',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
