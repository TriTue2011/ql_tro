'use client';

/**
 * Component nhập bảng giá lũy tiến (điện/nước).
 * Ví dụ: [{ tu: 0, den: 50, gia: 2000 }, { tu: 50, den: 100, gia: 2500 }, { tu: 100, den: null, gia: 3500 }]
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

export interface TierRow {
  tu: number;
  den: number | null;
  gia: number;
}

interface Props {
  label: string;
  unit: string; // 'kWh' | 'm³'
  tiers: TierRow[] | null;
  onChange: (tiers: TierRow[] | null) => void;
}

export function TierPriceEditor({ label, unit, tiers, onChange }: Props) {
  const enabled = tiers !== null && tiers.length > 0;
  const [local, setLocal] = useState<TierRow[]>(tiers || []);

  const toggle = (on: boolean) => {
    if (on) {
      const defaults: TierRow[] = [
        { tu: 0, den: 50, gia: 2000 },
        { tu: 50, den: 100, gia: 2500 },
        { tu: 100, den: null, gia: 3500 },
      ];
      setLocal(defaults);
      onChange(defaults);
    } else {
      setLocal([]);
      onChange(null);
    }
  };

  const updateRow = (i: number, patch: Partial<TierRow>) => {
    const next = local.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    setLocal(next);
    onChange(next);
  };

  const addRow = () => {
    const last = local[local.length - 1];
    const tu = last ? (last.den ?? (last.tu + 50)) : 0;
    const next = [...local, { tu, den: null, gia: 3000 }];
    setLocal(next);
    onChange(next);
  };

  const removeRow = (i: number) => {
    const next = local.filter((_, idx) => idx !== i);
    setLocal(next);
    onChange(next.length > 0 ? next : null);
  };

  return (
    <div className="border rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-center justify-between mb-2">
        <Label className="font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Giá lũy tiến</span>
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </div>

      {enabled && (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-1">
            <div className="col-span-3">Từ ({unit})</div>
            <div className="col-span-3">Đến ({unit})</div>
            <div className="col-span-5">Đơn giá (VNĐ/{unit})</div>
            <div className="col-span-1"></div>
          </div>
          {local.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-3"
                type="number" min="0"
                value={row.tu}
                onChange={e => updateRow(i, { tu: Number(e.target.value) || 0 })}
              />
              <Input
                className="col-span-3"
                type="number" min="0"
                placeholder="∞ (cao nhất)"
                value={row.den ?? ''}
                onChange={e => updateRow(i, { den: e.target.value === '' ? null : Number(e.target.value) })}
              />
              <Input
                className="col-span-5"
                type="number" min="0"
                value={row.gia}
                onChange={e => updateRow(i, { gia: Number(e.target.value) || 0 })}
              />
              <Button
                type="button" variant="ghost" size="icon"
                className="col-span-1 h-8 w-8 text-red-500"
                onClick={() => removeRow(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full mt-1">
            <Plus className="h-3.5 w-3.5 mr-1" /> Thêm bậc
          </Button>
          <p className="text-xs text-gray-500 italic mt-2">
            Để trống ô "Đến" ở bậc cuối nếu muốn áp dụng cho mọi lượng vượt định mức.
          </p>
        </div>
      )}
    </div>
  );
}
