'use client';

/**
 * Kho - Vật tư - Giai đoạn 6
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface VatTu {
  id: string;
  maVatTu: string;
  tenVatTu: string;
  donViTinh: string;
  moTa?: string | null;
  nhomVatTu: string;
  phanTichABC: string;
  tonKhoToiThieu: number;
  giaMua: number;
  giaBan: number;
}

const NHOM_VAT_TU = [
  'Điện', 'Nước', 'Xây dựng', 'Vệ sinh', 'Văn phòng', 'An ninh', 'Khác',
];

export default function VatTuPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<VatTu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [nhomFilter, setNhomFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    maVatTu: '', tenVatTu: '', donViTinh: '', moTa: '',
    nhomVatTu: 'Khác', phanTichABC: 'C', tonKhoToiThieu: 0, giaMua: 0, giaBan: 0,
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (nhomFilter) params.set('nhomVatTu', nhomFilter);
      const res = await fetch(`/api/kho/vat-tu?${params}`);
      if (!res.ok) {
        console.error('API error:', res.status, await res.text());
        setItems([]);
        return;
      }
      const data = await res.json();
      if (data.success) setItems(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, nhomFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreate = async () => {
    if (!form.maVatTu.trim() || !form.tenVatTu.trim() || !form.donViTinh.trim()) {
      toast.error('Vui lòng nhập đủ mã, tên và đơn vị tính');
      return;
    }
    try {
      const res = await fetch('/api/kho/vat-tu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã thêm vật tư');
        setShowCreate(false);
        setForm({ maVatTu: '', tenVatTu: '', donViTinh: '', moTa: '', nhomVatTu: 'Khác', phanTichABC: 'C', tonKhoToiThieu: 0, giaMua: 0, giaBan: 0 });
        fetchItems();
      } else {
        toast.error(data.message || 'Lỗi tạo');
      }
    } catch { toast.error('Lỗi kết nối'); }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Vật tư" description="Danh mục vật tư, thiết bị" onAdd={() => setShowCreate(true)} />

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)}
          className="max-w-xs" />
        <Select value={nhomFilter} onValueChange={setNhomFilter}>
          <SelectTrigger className="max-w-[180px]"><SelectValue placeholder="Tất cả nhóm" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tất cả</SelectItem>
            {NHOM_VAT_TU.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-muted-foreground">Đang tải...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium">{item.tenVatTu}</p>
                  <p className="text-xs text-muted-foreground">Mã: {item.maVatTu}</p>
                </div>
                <Badge variant="outline">{item.nhomVatTu}</Badge>
              </div>
              <div className="text-sm space-y-1">
                <p>ĐVT: {item.donViTinh}</p>
                <p>Giá mua: {item.giaMua.toLocaleString('vi-VN')}₫</p>
                <p>Giá bán: {item.giaBan.toLocaleString('vi-VN')}₫</p>
                <p>Tồn tối thiểu: {item.tonKhoToiThieu}</p>
              </div>
              <Badge className={`mt-2 ${item.phanTichABC === 'A' ? 'bg-red-100 text-red-700' : item.phanTichABC === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                ABC-{item.phanTichABC}
              </Badge>
            </Card>
          ))}
          {items.length === 0 && <p className="text-muted-foreground col-span-full">Chưa có vật tư</p>}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm vật tư mới</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Mã vật tư *" value={form.maVatTu}
              onChange={e => setForm(p => ({ ...p, maVatTu: e.target.value }))} />
            <Input placeholder="Tên vật tư *" value={form.tenVatTu}
              onChange={e => setForm(p => ({ ...p, tenVatTu: e.target.value }))} />
            <Input placeholder="Đơn vị tính *" value={form.donViTinh}
              onChange={e => setForm(p => ({ ...p, donViTinh: e.target.value }))} />
            <Select value={form.nhomVatTu} onValueChange={v => setForm(p => ({ ...p, nhomVatTu: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NHOM_VAT_TU.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Mô tả" value={form.moTa}
              onChange={e => setForm(p => ({ ...p, moTa: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Tồn min" value={form.tonKhoToiThieu}
                onChange={e => setForm(p => ({ ...p, tonKhoToiThieu: parseInt(e.target.value) || 0 }))} />
              <Input type="number" placeholder="Giá mua" value={form.giaMua}
                onChange={e => setForm(p => ({ ...p, giaMua: parseInt(e.target.value) || 0 }))} />
              <Input type="number" placeholder="Giá bán" value={form.giaBan}
                onChange={e => setForm(p => ({ ...p, giaBan: parseInt(e.target.value) || 0 }))} />
            </div>
            <Button onClick={handleCreate} className="w-full">Thêm vật tư</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
