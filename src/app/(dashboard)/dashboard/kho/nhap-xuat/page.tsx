'use client';

/**
 * Kho - Nhập/Xuất kho - Giai đoạn 6
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Building {
  id: string;
  tenToaNha: string;
}

interface VatTu {
  id: string;
  maVatTu: string;
  tenVatTu: string;
  donViTinh: string;
}

interface PhieuNhap {
  id: string;
  maPhieu: string;
  toaNha: { id: string; tenToaNha: string };
  nguoiNhap: { id: string; ten: string };
  nhaCungCap?: string | null;
  ghiChu?: string | null;
  tongTien: number;
  ngayNhap: string;
  chiTiet: Array<{ vatTu: { tenVatTu: string }; soLuong: number; donGia: number; thanhTien: number }>;
}

interface PhieuXuat {
  id: string;
  maPhieu: string;
  toaNha: { id: string; tenToaNha: string };
  nguoiXuat: { id: string; ten: string };
  lyDo: string;
  phong?: { maPhong: string } | null;
  ghiChu?: string | null;
  ngayXuat: string;
  chiTiet: Array<{ vatTu: { tenVatTu: string }; soLuong: number }>;
}

export default function NhapXuatPage() {
  const { data: session } = useSession();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [phieuNhap, setPhieuNhap] = useState<PhieuNhap[]>([]);
  const [phieuXuat, setPhieuXuat] = useState<PhieuXuat[]>([]);
  const [vatTuList, setVatTuList] = useState<VatTu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNhap, setShowNhap] = useState(false);
  const [showXuat, setShowXuat] = useState(false);
  const [nhapForm, setNhapForm] = useState({ nhaCungCap: '', ghiChu: '', chiTiet: [{ vatTuId: '', soLuong: 1, donGia: 0 }] });
  const [xuatForm, setXuatForm] = useState({ lyDo: '', phongId: '', ghiChu: '', chiTiet: [{ vatTuId: '', soLuong: 1 }] });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set('toaNhaId', selectedBuildingId);

      const [nhapRes, xuatRes, vatTuRes] = await Promise.all([
        fetch(`/api/kho/phieu-nhap?${params}`),
        fetch(`/api/kho/phieu-xuat?${params}`),
        fetch('/api/kho/vat-tu'),
      ]);

      const nhapData = await nhapRes.json();
      const xuatData = await xuatRes.json();
      const vatTuData = await vatTuRes.json();

      if (nhapData.success) setPhieuNhap(nhapData.data || []);
      if (xuatData.success) setPhieuXuat(xuatData.data || []);
      if (vatTuData.success) setVatTuList(vatTuData.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedBuildingId]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/toa-nha').then(r => r.json()).then(res => {
      if (res.success) setBuildings(res.data || []);
    }).catch(console.error);
  }, [session]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNhap = async () => {
    if (!selectedBuildingId) { toast.error('Chọn tòa nhà'); return; }
    try {
      const res = await fetch('/api/kho/phieu-nhap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nhapForm, toaNhaId: selectedBuildingId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Nhập kho thành công');
        setShowNhap(false);
        setNhapForm({ nhaCungCap: '', ghiChu: '', chiTiet: [{ vatTuId: '', soLuong: 1, donGia: 0 }] });
        fetchData();
      } else toast.error(data.message || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleXuat = async () => {
    if (!selectedBuildingId) { toast.error('Chọn tòa nhà'); return; }
    try {
      const res = await fetch('/api/kho/phieu-xuat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...xuatForm, toaNhaId: selectedBuildingId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Xuất kho thành công');
        setShowXuat(false);
        setXuatForm({ lyDo: '', phongId: '', ghiChu: '', chiTiet: [{ vatTuId: '', soLuong: 1 }] });
        fetchData();
      } else toast.error(data.message || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Nhập - Xuất kho" description="Quản lý phiếu nhập, xuất kho" />

      <div className="flex items-center gap-3">
        <BuildingSelector buildings={buildings} value={selectedBuildingId} onChange={setSelectedBuildingId} />
        <Button onClick={() => setShowNhap(true)} disabled={!selectedBuildingId}>Nhập kho</Button>
        <Button onClick={() => setShowXuat(true)} disabled={!selectedBuildingId} variant="outline">Xuất kho</Button>
      </div>

      <Tabs defaultValue="nhap">
        <TabsList>
          <TabsTrigger value="nhap">Phiếu nhập</TabsTrigger>
          <TabsTrigger value="xuat">Phiếu xuất</TabsTrigger>
        </TabsList>

        <TabsContent value="nhap">
          {loading ? <p>Đang tải...</p> : (
            <div className="space-y-3">
              {phieuNhap.map(pn => (
                <Card key={pn.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{pn.maPhieu}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pn.ngayNhap).toLocaleDateString('vi-VN')} - {pn.nguoiNhap.ten}
                      </p>
                    </div>
                    <Badge variant="outline">{pn.tongTien.toLocaleString('vi-VN')}₫</Badge>
                  </div>
                  {pn.nhaCungCap && <p className="text-sm">NCC: {pn.nhaCungCap}</p>}
                  {pn.ghiChu && <p className="text-sm text-muted-foreground">{pn.ghiChu}</p>}
                  <div className="mt-2 text-sm space-y-1">
                    {pn.chiTiet.map((ct, i) => (
                      <p key={i}>- {ct.vatTu.tenVatTu}: {ct.soLuong} x {ct.donGia.toLocaleString('vi-VN')}₫</p>
                    ))}
                  </div>
                </Card>
              ))}
              {phieuNhap.length === 0 && <p className="text-muted-foreground">Chưa có phiếu nhập</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="xuat">
          {loading ? <p>Đang tải...</p> : (
            <div className="space-y-3">
              {phieuXuat.map(px => (
                <Card key={px.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{px.maPhieu}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(px.ngayXuat).toLocaleDateString('vi-VN')} - {px.nguoiXuat.ten}
                      </p>
                    </div>
                    <Badge>{px.lyDo}</Badge>
                  </div>
                  {px.phong && <p className="text-sm">Phòng: {px.phong.maPhong}</p>}
                  {px.ghiChu && <p className="text-sm text-muted-foreground">{px.ghiChu}</p>}
                  <div className="mt-2 text-sm space-y-1">
                    {px.chiTiet.map((ct, i) => (
                      <p key={i}>- {ct.vatTu.tenVatTu}: {ct.soLuong}</p>
                    ))}
                  </div>
                </Card>
              ))}
              {phieuXuat.length === 0 && <p className="text-muted-foreground">Chưa có phiếu xuất</p>}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Nhập kho */}
      <Dialog open={showNhap} onOpenChange={setShowNhap}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nhập kho</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nhà cung cấp" value={nhapForm.nhaCungCap}
              onChange={e => setNhapForm(p => ({ ...p, nhaCungCap: e.target.value }))} />
            <Textarea placeholder="Ghi chú" value={nhapForm.ghiChu}
              onChange={e => setNhapForm(p => ({ ...p, ghiChu: e.target.value }))} />
            {nhapForm.chiTiet.map((ct, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Select value={ct.vatTuId} onValueChange={v => {
                  const newCT = [...nhapForm.chiTiet];
                  newCT[idx] = { ...newCT[idx], vatTuId: v };
                  setNhapForm(p => ({ ...p, chiTiet: newCT }));
                }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn vật tư" /></SelectTrigger>
                  <SelectContent>
                    {vatTuList.map(vt => <SelectItem key={vt.id} value={vt.id}>{vt.tenVatTu}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" className="w-20" placeholder="SL" value={ct.soLuong}
                  onChange={e => {
                    const newCT = [...nhapForm.chiTiet];
                    newCT[idx] = { ...newCT[idx], soLuong: parseInt(e.target.value) || 0 };
                    setNhapForm(p => ({ ...p, chiTiet: newCT }));
                  }} />
                <Input type="number" className="w-24" placeholder="Đơn giá" value={ct.donGia}
                  onChange={e => {
                    const newCT = [...nhapForm.chiTiet];
                    newCT[idx] = { ...newCT[idx], donGia: parseInt(e.target.value) || 0 };
                    setNhapForm(p => ({ ...p, chiTiet: newCT }));
                  }} />
                <Button variant="ghost" size="sm" onClick={() => {
                  if (nhapForm.chiTiet.length > 1) {
                    setNhapForm(p => ({ ...p, chiTiet: p.chiTiet.filter((_, i) => i !== idx) }));
                  }
                }}>✕</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() =>
              setNhapForm(p => ({ ...p, chiTiet: [...p.chiTiet, { vatTuId: '', soLuong: 1, donGia: 0 }] }))
            }>+ Thêm dòng</Button>
            <Button onClick={handleNhap} className="w-full">Nhập kho</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xuất kho */}
      <Dialog open={showXuat} onOpenChange={setShowXuat}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Xuất kho</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Lý do xuất *" value={xuatForm.lyDo}
              onChange={e => setXuatForm(p => ({ ...p, lyDo: e.target.value }))} />
            <Textarea placeholder="Ghi chú" value={xuatForm.ghiChu}
              onChange={e => setXuatForm(p => ({ ...p, ghiChu: e.target.value }))} />
            {xuatForm.chiTiet.map((ct, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Select value={ct.vatTuId} onValueChange={v => {
                  const newCT = [...xuatForm.chiTiet];
                  newCT[idx] = { ...newCT[idx], vatTuId: v };
                  setXuatForm(p => ({ ...p, chiTiet: newCT }));
                }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn vật tư" /></SelectTrigger>
                  <SelectContent>
                    {vatTuList.map(vt => <SelectItem key={vt.id} value={vt.id}>{vt.tenVatTu}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" className="w-20" placeholder="SL" value={ct.soLuong}
                  onChange={e => {
                    const newCT = [...xuatForm.chiTiet];
                    newCT[idx] = { ...newCT[idx], soLuong: parseInt(e.target.value) || 0 };
                    setXuatForm(p => ({ ...p, chiTiet: newCT }));
                  }} />
                <Button variant="ghost" size="sm" onClick={() => {
                  if (xuatForm.chiTiet.length > 1) {
                    setXuatForm(p => ({ ...p, chiTiet: p.chiTiet.filter((_, i) => i !== idx) }));
                  }
                }}>✕</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() =>
              setXuatForm(p => ({ ...p, chiTiet: [...p.chiTiet, { vatTuId: '', soLuong: 1 }] }))
            }>+ Thêm dòng</Button>
            <Button onClick={handleXuat} className="w-full">Xuất kho</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
