'use client';

import { cn } from '@/lib/utils';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface InlineEditTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  renderExpanded?: (item: T) => React.ReactNode;
  expandedId?: string | null;
  onToggleExpand?: (id: string | null) => void;
  searchTerm?: string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  /** Nếu true, click vào hàng sẽ toggle expand. Mặc định: true */
  expandOnClick?: boolean;
  /** Render nút actions tùy chỉnh */
  renderActions?: (item: T) => React.ReactNode;
}

/**
 * InlineEditTable — Bảng với expandable rows.
 * Click vào hàng để mở panel inline (thay thế Dialog).
 */
export default function InlineEditTable<T>({
  data,
  columns,
  keyExtractor,
  onEdit,
  onDelete,
  renderExpanded,
  expandedId,
  onToggleExpand,
  searchTerm,
  loading,
  emptyMessage = 'Không có dữ liệu',
  className,
  expandOnClick = true,
  renderActions,
}: InlineEditTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleRowClick = (id: string) => {
    if (!expandOnClick || !onToggleExpand) return;
    onToggleExpand(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">Đang tải...</span>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl text-gray-300 mb-2">📋</div>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-gray-200', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {expandOnClick && onToggleExpand && (
              <th className="w-10 px-2 py-3" />
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500',
                  col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                  col.className,
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-blue-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </span>
              </th>
            ))}
            {(onEdit || onDelete || renderActions) && (
              <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Thao tác
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sortedData.map((item) => {
            const id = keyExtractor(item);
            const isExpanded = expandedId === id;
            return (
              <tr key={id} className="group">
                <td colSpan={columns.length + (expandOnClick && onToggleExpand ? 1 : 0) + ((onEdit || onDelete || renderActions) ? 1 : 0)} className="p-0">
                  <div
                    className={cn(
                      'flex items-center border-b border-gray-100 transition-colors',
                      isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50 cursor-pointer',
                    )}
                    onClick={() => handleRowClick(id)}
                  >
                    {expandOnClick && onToggleExpand && (
                      <div className="flex-shrink-0 w-10 px-2 py-3 flex justify-center">
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-gray-400 transition-transform duration-200',
                            isExpanded && 'rotate-90',
                          )}
                        />
                      </div>
                    )}
                    {columns.map((col) => (
                      <div
                        key={col.key}
                        className={cn('flex-1 px-4 py-3 text-sm text-gray-700 min-w-0', col.className)}
                      >
                        {col.render(item)}
                      </div>
                    ))}
                    {(onEdit || onDelete || renderActions) && (
                      <div
                        className="flex-shrink-0 w-24 px-4 py-3 flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderActions ? (
                          renderActions(item)
                        ) : (
                          <>
                            {onEdit && (
                              <button
                                onClick={() => onEdit(item)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                title="Sửa"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(item)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                title="Xóa"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Expanded panel */}
                  {isExpanded && renderExpanded && (
                    <div className="border-b border-gray-100 bg-gray-50/50">
                      <div className="px-4 py-4 md:px-6 md:py-6">
                        {renderExpanded(item)}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
