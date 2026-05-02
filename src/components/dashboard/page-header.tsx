'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  descriptionClassName?: string;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader — Header đồng bộ cho tất cả trang dashboard.
 * Gồm title, description, nút refresh, nút thêm mới, và children (filter, tabs, etc.)
 */
export default function PageHeader({
  title,
  description,
  descriptionClassName,
  onRefresh,
  onAdd,
  addLabel = 'Thêm mới',
  loading = false,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{title}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {description && (
            <span className={cn('text-gray-500', descriptionClassName || 'text-sm')}>{description}</span>
          )}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="text-gray-600 rounded-xl"
            >
              <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
              {loading ? 'Đang tải...' : 'Làm mới'}
            </Button>
          )}
          {onAdd && (
            <Button
              size="sm"
              onClick={onAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Children (filters, tabs, search, etc.) */}
      {children && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
