'use client';

/**
 * Kho - Tồn kho - Giai đoạn 6
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/components/dashboard/page-header';
import BuildingSelector from '@/components/dashboard/building-selector';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TonKhoItem {
  id: string;
  vatTuId: string;
  toaNhaId: string;
  soLuong: number;
  viTri?: string | null;
  vatTu: {
    id: string;
    maVatTu: string;
    tenVatTu: string;
    donViTinh: string;
    tonKhoToiThieu: number;
    nhomVatTu: string;
  };
  toaNha?: { id: string; tenToaNha: string };
}

interface Building {
  id: string;
  tenToaNha: string;
}

export default function TonKhoPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<TonKhoItem[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set('toaNhaId', selectedBuildingId);
      const res = await fetch(`/api/kho/ton-kho?${params}`);
      const data = await res.json();
      if (data.success) setItems(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedBuildingId]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/toa-nha').then(r => r.json()).then(res => {
      if (res.success) setBuildings(res.data || []);
    }).catch(console.error);
  }, [session]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Tồn kho" description="Theo dõi tồn kho vật tư theo tòa nhà" />

      <BuildingSelector buildings={buildings} value={selectedBuildingId} onChange={setSelectedBuildingId} />

      {loading ? <p className="text-muted-foreground">Đang tải...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => {
            const isLow = item.soLuong <= item.vatTu.tonKhoToiThieu;
            return (
              <Card key={item.id} className={`p-4 ${isLow ? 'border-red-300 bg-red-50' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{item.vatTu.tenVatTu}</p>
                    <p className="text-xs text-muted-foreground">Mã: {item.vatTu.maVatTu}</p>
                  </div>
                  <Badge variant="outline">{item.vatTu.nhomVatTu}</Badge>
                </div>
                <div className="text-sm space-y-1">
                  <p>ĐVT: {item.vatTu.donViTinh}</p>
                  <p className={`text-lg font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                    {item.soLuong} {item.vatTu.donViTinh}
                  </p>
                  {item.viTri && <p>Vị trí: {item.viTri}</p>}
                  {isLow && <Badge variant="destructive" className="mt-1">Tồn tối thiểu: {item.vatTu.tonKhoToiThieu}</Badge>}
                </div>
              </Card>
            );
          })}
          {items.length === 0 && <p className="text-muted-foreground col-span-full">Chưa có tồn kho</p>}
        </div>
      )}
    </div>
  );
}
