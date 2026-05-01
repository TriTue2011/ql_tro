'use client';

import { cn } from '@/lib/utils';

interface PermissionToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

/**
 * A smaller, rounded toggle switch for permissions.
 * - sm: 20px × 36px (thumb 16px)
 * - md: 24px × 40px (thumb 18px)
 * Green when on, gray when off, with smooth transition.
 */
export default function PermissionToggle({
  checked,
  disabled = false,
  onChange,
  size = 'sm',
}: PermissionToggleProps) {
  const dimensions =
    size === 'md'
      ? { track: 'h-6 w-10', thumb: 'h-[18px] w-[18px]', translate: 'translate-x-4' }
      : { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-[18px]' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        dimensions.track,
        // 3D shadow effect
        checked
          ? 'bg-green-500 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.1)]'
          : 'bg-gray-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white transition-transform duration-200',
          'shadow-[0_1px_3px_rgba(0,0,0,0.25)]',
          dimensions.thumb,
          checked ? dimensions.translate : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
