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
 * PillTabs — Tab dạng pill bo tròn với hiệu ứng 3D.
 * Tab active: bg-blue-600 text-white shadow-md, hover chuyển sang xanh nhạt hơn
 * Tab inactive: bg-white text-gray-600 border-2 border-gray-200, hover border-blue-300 + shadow
 */
export default function PillTabs({ tabs, value, onChange, className }: PillTabsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
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
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-500 active:bg-blue-700'
                : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm hover:shadow-blue-100 active:border-blue-400',
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
