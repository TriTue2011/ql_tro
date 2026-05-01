'use client';

import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface BuildingOption {
  id: string;
  tenToaNha: string;
}

interface BuildingSelectorProps {
  buildings: BuildingOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  allOption?: boolean;
  allLabel?: string;
}

/**
 * BuildingSelector — Select tòa nhà đồng bộ.
 * Hiển thị icon Building2 bên trái.
 */
export default function BuildingSelector({
  buildings,
  value,
  onChange,
  className,
  placeholder = 'Chọn tòa nhà',
  allOption = false,
  allLabel = 'Tất cả tòa nhà',
}: BuildingSelectorProps) {
  return (
    <div className={cn('w-full sm:w-64', className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white rounded-xl">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <SelectValue placeholder={placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {allOption && (
            <SelectItem value="all">{allLabel}</SelectItem>
          )}
          {buildings.map((building) => (
            <SelectItem key={building.id} value={building.id}>
              {building.tenToaNha}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
