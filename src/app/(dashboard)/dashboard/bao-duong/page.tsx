'use client';

/**
 * Bảo dưỡng - Giai đoạn 6
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/components/dashboard/page-header';
import BuildingSelector from '@/components/dashboard/building-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BaoDuong {
  id: string;
  tieuDe: string;
  moTa?: string | null;
  toaNha: { id: string; tenToaNha: string };
  phong?: { id: string; maPhong: string } | null;
  thietBi: string;
  loaiBaoDuong: string;
  chuKyNgay: number;
  ngayBaoDuongTruoc?: string | null;
  ngayBaoDuongSau?: string | null;
  nguoiPhuTrach?: { id: string; ten: string } | null;
  trangThai: string;
  ketQua?: string | null;
  ngayTao: string;
}

interface Building {
  id: string;
  tenToaNha: string;
}

const TRANG_THAI_LABELS: Record<string, string> = {
  sapDen: 'Sắp đến',
  quaHan: 'Quá hạn',
  daHoanThanh: 'Hoàn thành',
  tamHoan: 'Tạm hoãn',
};

const TRANG_THAI_COLORS: Record<string, string> = {
  sapDen: 'bg-blue-100 text-blue-700',
  quaHan: 'bg-red-100 text-red-700',
  daHoanThanh: 'bg-green-100 text-green-700',
  tamHoan: 'bg-yellow-100 text-yellow-700',
};

export default function BaoDuongPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<BaoDuong[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    tieuDe: '', moTa: '', thietBi: '', loaiBaoDuong: 'dinhKy',
    chuKyNgay: 30, ngayBaoDuongSau: '', nguoiPhuTrachId: '',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set('toaNhaId', selectedBuildingId);
      const res = await fetch(`/api/bao-duong?${params}`);
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

  const handleCreate = async () => {
    if (!form.tieuDe.trim() || !form.thietBi.trim() || !selectedBuildingId) {
      toast.error('Vui lòng nhập đủ thông tin');
      return;
    }
    try {
      const res = await fetch('/api/bao-duong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          toaNhaId: selectedBuildingId,
          ngayBaoDuongSau: form.ngayBaoDuongSau || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã thêm lịch bảo dưỡng');
        setShowCreate(false);
        setForm({ tieuDe: '', moTa: '', thietBi: '', loaiBaoDuong: 'dinhKy', chuKyNgay: 30, ngayBaoDuongSau: '', nguoiPhuTrachId: '' });
        fetchItems();
      } else toast.error(data.message || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleStatusChange = async (id: string, trangThai: string) => {
    try {
      const res = await fetch(`/api/bao-duong/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trangThai }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã chuyển: ${TRANG_THAI_LABELS[trangThai]}`);
        fetchItems();
      }
    } catch { toast.error('Lỗi'); }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Bảo dưỡng" description="Quản lý lịch bảo dưỡng thiết bị" onAdd={() => setShowCreate(true)} />

      <BuildingSelector buildings={buildings} value={selectedBuildingId} onChange={setSelectedBuildingId} />

      {loading ? <p className="text-muted-foreground">Đang tải...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="font-medium">{item.tieuDe}</p>
                <Badge className={TRANG_THAI_COLORS[item.trangThai] || ''}>
                  {TRANG_THAI_LABELS[item.trangThai] || item.trangThai}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <p>Thiết bị: <strong>{item.thietBi}</strong></p>
                <p>Tòa nhà: {item.toaNha.tenToaNha}</p>
                {item.phong && <p>Phòng: {item.phong.maPhong}</p>}
                <p>Loại: {item.loaiBaoDuong === 'dinhKy' ? 'Định kỳ' : 'Đột xuất'}</p>
                <p>Chu kỳ: {item.chuKyNgay} ngày</p>
                {item.nguoiPhuTrach && <p>Phụ trách: {item.nguoiPhuTrach.ten}</p>}
                {item.ngayBaoDuongSau && (
                  <p>Hạn: {new Date(item.ngayBaoDuongSau).toLocaleDateString('vi-VN')}</p>
                )}
              </div>
              {item.trangThai !== 'daHoanThanh' && (
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  {item.trangThai === 'sapDen' && (
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => handleStatusChange(item.id, 'daHoanThanh')}>
                      Hoàn thành
                    </Button>
                  )}
                  {item.trangThai === 'quaHan' && (
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => handleStatusChange(item.id, 'daHoanThanh')}>
                      Hoàn thành
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-7"
                    onClick={() => handleStatusChange(item.id, 'tamHoan')}>
                    Tạm hoãn
                  </Button>
                </div>
              )}
            </Card>
          ))}
          {items.length === 0 && <p className="text-muted-foreground col-span-full">Chưa có lịch bảo dưỡng</p>}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm lịch bảo dưỡng</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Tiêu đề *" value={form.tieuDe}
              onChange={e => setForm(p => ({ ...p, tieuDe: e.target.value }))} />
            <Input placeholder="Tên thiết bị *" value={form.thietBi}
              onChange={e => setForm(p => ({ ...p, thietBi: e.target.value }))} />
            <Textarea placeholder="Mô tả" value={form.moTa}
              onChange={e => setForm(p => ({ ...p, moTa: e.target.value }))} />
            <Select value={form.loaiBaoDuong} onValueChange={v => setForm(p => ({ ...p, loaiBaoDuong: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinhKy">Định kỳ</SelectItem>
                <SelectItem value="dotXuat">Đột xuất</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Chu kỳ (ngày)" value={form.chuKyNgay}
              onChange={e => setForm(p => ({ ...p, chuKyNgay: parseInt(e.target.value) || 30 }))} />
            <Input type="date" placeholder="Ngày bảo dưỡng sau" value={form.ngayBaoDuongSau}
              onChange={e => setForm(p => ({ ...p, ngayBaoDuongSau: e.target.value }))} />
            <Button onClick={handleCreate} className="w-full">Thêm lịch bảo dưỡng</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
