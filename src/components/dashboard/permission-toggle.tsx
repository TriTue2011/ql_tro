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
 * - sm: 18px × 34px (thumb 14px)
 * - md: 20px × 38px (thumb 16px)
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
      ? { track: 'h-[20px] w-[38px]', thumb: 'h-[16px] w-[16px]', translate: 'translate-x-[18px]' }
      : { track: 'h-[18px] w-[34px]', thumb: 'h-[14px] w-[14px]', translate: 'translate-x-[16px]' };

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
