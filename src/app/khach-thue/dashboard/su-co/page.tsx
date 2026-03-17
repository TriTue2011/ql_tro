'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { AlertCircle, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SuCo {
  id: string;
  tieuDe: string;
  moTa: string;
  loaiSuCo: string;
  mucDoUuTien: string;
  trangThai: string;
  ghiChuXuLy?: string;
  ngayBaoCao: string;
  ngayXuLy?: string;
  ngayHoanThanh?: string;
  phong?: { maPhong: string };
  nguoiXuLy?: { ten: string };
}

const loaiLabel: Record<string, string> = {
  dienNuoc: 'Điện nước', noiThat: 'Nội thất', vesinh: 'Vệ sinh',
  anNinh: 'An ninh', khac: 'Khác',
};
const mucDoLabel: Record<string, { label: string; class: string }> = {
  thap: { label: 'Thấp', class: 'bg-gray-100 text-gray-700' },
  trungBinh: { label: 'Trung bình', class: 'bg-yellow-100 text-yellow-700' },
  cao: { label: 'Cao', class: 'bg-orange-100 text-orange-700' },
  khancap: { label: 'Khẩn cấp', class: 'bg-red-100 text-red-700' },
};
const trangThaiLabel: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
  moi: { label: 'Mới', icon: <Clock className="h-3.5 w-3.5" />, class: 'bg-blue-100 text-blue-700' },
  dangXuLy: { label: 'Đang xử lý', icon: <AlertCircle className="h-3.5 w-3.5" />, class: 'bg-yellow-100 text-yellow-700' },
  daXong: { label: 'Đã xử lý', icon: <CheckCircle2 className="h-3.5 w-3.5" />, class: 'bg-green-100 text-green-700' },
  daHuy: { label: 'Đã hủy', icon: <XCircle className="h-3.5 w-3.5" />, class: 'bg-gray-100 text-gray-700' },
};

export default function SuCoPage() {
  const [suCos, setSuCos] = useState<SuCo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tieuDe: '', moTa: '', loaiSuCo: 'khac', mucDoUuTien: 'trungBinh',
  });

  const fetchSuCos = () => {
    fetch('/api/auth/khach-thue/su-co')
      .then(r => r.json())
      .then(res => {
        if (res.success) setSuCos(res.data);
        else toast.error('Không thể tải sự cố');
      })
      .catch(() => toast.error('Có lỗi xảy ra'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSuCos(); }, []);

  const handleSubmit = async () => {
    if (!form.tieuDe.trim() || !form.moTa.trim()) {
      toast.error('Vui lòng nhập tiêu đề và mô tả');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/khach-thue/su-co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || 'Báo cáo sự cố thành công');
        setShowDialog(false);
        setForm({ tieuDe: '', moTa: '', loaiSuCo: 'khac', mucDoUuTien: 'trungBinh' });
        fetchSuCos();
      } else {
        toast.error(result.message || 'Không thể báo cáo sự cố');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sự cố</h1>
          <p className="text-gray-600 text-sm">Theo dõi và báo cáo sự cố trong phòng</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Báo cáo sự cố
        </Button>
      </div>

      {suCos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
            <AlertCircle className="h-12 w-12 mb-3 opacity-30" />
            <p>Chưa có sự cố nào được báo cáo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suCos.map(sc => {
            const tt = trangThaiLabel[sc.trangThai] ?? { label: sc.trangThai, icon: null, class: '' };
            const md = mucDoLabel[sc.mucDoUuTien] ?? { label: sc.mucDoUuTien, class: '' };
            return (
              <Card key={sc.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{sc.tieuDe}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={md.class}>{md.label}</Badge>
                      <Badge className={`${tt.class} flex items-center gap-1`}>
                        {tt.icon}{tt.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {loaiLabel[sc.loaiSuCo] ?? sc.loaiSuCo}
                    {sc.phong && ` · Phòng ${sc.phong.maPhong}`}
                    {' · '}Báo cáo: {fmtDate(sc.ngayBaoCao)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-700">{sc.moTa}</p>
                  {sc.nguoiXuLy && (
                    <p className="text-xs text-muted-foreground">Người xử lý: {sc.nguoiXuLy.ten}</p>
                  )}
                  {sc.ghiChuXuLy && (
                    <p className="text-xs text-muted-foreground">Ghi chú: {sc.ghiChuXuLy}</p>
                  )}
                  {sc.ngayHoanThanh && (
                    <p className="text-xs text-green-600">Hoàn thành: {fmtDate(sc.ngayHoanThanh)}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Báo cáo sự cố</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tieuDe">Tiêu đề *</Label>
              <Input
                id="tieuDe"
                value={form.tieuDe}
                onChange={e => setForm(f => ({ ...f, tieuDe: e.target.value }))}
                placeholder="Mô tả ngắn về sự cố"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="moTa">Mô tả chi tiết *</Label>
              <Textarea
                id="moTa"
                value={form.moTa}
                onChange={e => setForm(f => ({ ...f, moTa: e.target.value }))}
                placeholder="Mô tả chi tiết sự cố..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Loại sự cố</Label>
                <Select value={form.loaiSuCo} onValueChange={v => setForm(f => ({ ...f, loaiSuCo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dienNuoc">Điện nước</SelectItem>
                    <SelectItem value="noiThat">Nội thất</SelectItem>
                    <SelectItem value="vesinh">Vệ sinh</SelectItem>
                    <SelectItem value="anNinh">An ninh</SelectItem>
                    <SelectItem value="khac">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mức độ</Label>
                <Select value={form.mucDoUuTien} onValueChange={v => setForm(f => ({ ...f, mucDoUuTien: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thap">Thấp</SelectItem>
                    <SelectItem value="trungBinh">Trung bình</SelectItem>
                    <SelectItem value="cao">Cao</SelectItem>
                    <SelectItem value="khancap">Khẩn cấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Hủy</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
