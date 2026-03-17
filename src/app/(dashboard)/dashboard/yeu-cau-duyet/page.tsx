'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, XCircle, Clock, RefreshCw, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface YeuCau {
  id: string;
  loai: string;
  noiDung: any;
  trangThai: string;
  ghiChuPheDuyet?: string;
  ngayTao: string;
  ngayCapNhat: string;
  khachThue: {
    id: string;
    hoTen: string;
    soDienThoai: string;
    hopDong: { phong: { maPhong: string; toaNha: { tenToaNha: string } } }[];
  };
  nguoiPheDuyet?: { ten: string };
}

const loaiLabel: Record<string, string> = {
  thongTin: 'Thông tin cá nhân',
  anhCCCD: 'Ảnh CCCD',
  nguoiCungPhong: 'Người cùng phòng',
  thongBao: 'Cài đặt thông báo',
};

const trangThaiMap: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
  choPheduyet: { label: 'Chờ duyệt', icon: <Clock className="h-3.5 w-3.5" />, class: 'bg-yellow-100 text-yellow-700' },
  daPheduyet: { label: 'Đã duyệt', icon: <CheckCircle2 className="h-3.5 w-3.5" />, class: 'bg-green-100 text-green-700' },
  tuChoi: { label: 'Từ chối', icon: <XCircle className="h-3.5 w-3.5" />, class: 'bg-red-100 text-red-700' },
};

function renderChange(noiDung: any, loai: string) {
  const truoc = noiDung?.truoc ?? {};
  const sau = noiDung?.sau ?? {};

  if (loai === 'thongTin') {
    const fields: Record<string, string> = {
      hoTen: 'Họ tên', email: 'Email', queQuan: 'Quê quán',
      ngheNghiep: 'Nghề nghiệp', gioiTinh: 'Giới tính',
    };
    const rows = Object.entries(fields)
      .filter(([k]) => truoc[k] !== sau[k])
      .map(([k, label]) => (
        <div key={k} className="text-xs">
          <span className="text-muted-foreground">{label}: </span>
          {truoc[k] && <span className="line-through text-red-500 mr-1">{truoc[k] || '(trống)'}</span>}
          <span className="text-green-600">{sau[k] || '(trống)'}</span>
        </div>
      ));
    return rows.length > 0 ? <div className="space-y-1">{rows}</div> : <p className="text-xs text-muted-foreground">Không có thay đổi</p>;
  }

  if (loai === 'anhCCCD') {
    return (
      <div className="space-y-2 text-xs">
        {sau?.anhCCCD?.matTruoc && (
          <div>
            <p className="text-muted-foreground">Mặt trước mới:</p>
            <img src={sau.anhCCCD.matTruoc} alt="CCCD mặt trước" className="h-24 rounded border mt-1" />
          </div>
        )}
        {sau?.anhCCCD?.matSau && (
          <div>
            <p className="text-muted-foreground">Mặt sau mới:</p>
            <img src={sau.anhCCCD.matSau} alt="CCCD mặt sau" className="h-24 rounded border mt-1" />
          </div>
        )}
      </div>
    );
  }

  if (loai === 'nguoiCungPhong') {
    const action = sau?.action;
    if (action === 'them') {
      const tv = sau.thanhVien;
      return (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-green-700">+ Thêm thành viên mới:</p>
          <p>Họ tên: <strong>{tv?.hoTen}</strong></p>
          <p>Ngày sinh: {tv?.ngaySinh ? new Date(tv.ngaySinh).toLocaleDateString('vi-VN') : '—'}</p>
          <p>Giới tính: {tv?.gioiTinh}</p>
          <p>Quê quán: {tv?.queQuan}</p>
          {tv?.soDienThoai && <p>SĐT: {tv.soDienThoai}</p>}
          {tv?.cccd && <p>CCCD: {tv.cccd}</p>}
          {sau.isUnder18 && <p className="text-orange-600">⚠ Dưới 18 tuổi — không cấp tài khoản</p>}
        </div>
      );
    }
    if (action === 'sua') {
      return (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-blue-700">✏ Sửa thông tin thành viên</p>
          {sau.hoTen && <p>Họ tên: <strong>{sau.hoTen}</strong></p>}
          {sau.gioiTinh && <p>Giới tính: {sau.gioiTinh}</p>}
          {sau.queQuan && <p>Quê quán: {sau.queQuan}</p>}
          {sau.ngheNghiep !== undefined && <p>Nghề nghiệp: {sau.ngheNghiep || '(xóa)'}</p>}
        </div>
      );
    }
  }

  if (loai === 'thongBao') {
    return (
      <p className="text-xs">
        Nhận thông báo Zalo:{' '}
        <span className="line-through text-red-500 mr-1">{truoc?.nhanThongBaoZalo ? 'Bật' : 'Tắt'}</span>
        <span className="text-green-600">{sau?.nhanThongBaoZalo ? 'Bật' : 'Tắt'}</span>
      </p>
    );
  }

  return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(sau, null, 2)}</pre>;
}

export default function YeuCauDuyetPage() {
  const [yeuCaus, setYeuCaus] = useState<YeuCau[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTT, setFilterTT] = useState('choPheduyet');
  const [selected, setSelected] = useState<YeuCau | null>(null);
  const [ghiChu, setGhiChu] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = (tt: string) => {
    setLoading(true);
    fetch(`/api/yeu-cau-thay-doi?trangThai=${tt}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setYeuCaus(res.data);
        else toast.error('Không thể tải dữ liệu');
      })
      .catch(() => toast.error('Có lỗi xảy ra'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(filterTT); }, [filterTT]);

  const handleDecision = async (trangThai: 'daPheduyet' | 'tuChoi') => {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/yeu-cau-thay-doi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, trangThai, ghiChuPheDuyet: ghiChu }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message);
        setSelected(null);
        setGhiChu('');
        fetchData(filterTT);
      } else {
        toast.error(result.message || 'Xử lý thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setProcessing(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Yêu cầu phê duyệt</h1>
          <p className="text-muted-foreground text-sm">Xem xét và phê duyệt thay đổi từ khách thuê</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterTT} onValueChange={v => setFilterTT(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="choPheduyet">Chờ duyệt</SelectItem>
              <SelectItem value="daPheduyet">Đã duyệt</SelectItem>
              <SelectItem value="tuChoi">Từ chối</SelectItem>
              <SelectItem value="all">Tất cả</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchData(filterTT)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : yeuCaus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-3 opacity-30" />
            <p>Không có yêu cầu nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {yeuCaus.map(yc => {
            const tt = trangThaiMap[yc.trangThai];
            const phong = yc.khachThue.hopDong?.[0]?.phong;
            return (
              <Card key={yc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelected(yc); setGhiChu(''); }}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{loaiLabel[yc.loai] ?? yc.loai}</Badge>
                        <Badge className={`${tt?.class} flex items-center gap-1 text-xs`}>{tt?.icon}{tt?.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {yc.khachThue.hoTen}
                        <span className="text-muted-foreground font-normal text-xs">· {yc.khachThue.soDienThoai}</span>
                        {phong && <span className="text-xs text-muted-foreground">· P.{phong.maPhong} — {phong.toaNha.tenToaNha}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {fmtDate(yc.ngayTao)}
                      </div>
                    </div>
                    {yc.trangThai === 'choPheduyet' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={e => { e.stopPropagation(); setSelected(yc); setGhiChu(''); }}>
                          Xem xét
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Preview thay đổi */}
                  <div className="mt-3 pt-3 border-t">
                    {renderChange(yc.noiDung, yc.loai)}
                  </div>

                  {yc.ghiChuPheDuyet && (
                    <p className="mt-2 text-xs text-muted-foreground italic">Ghi chú: {yc.ghiChuPheDuyet}</p>
                  )}
                  {yc.nguoiPheDuyet && (
                    <p className="mt-1 text-xs text-muted-foreground">Người duyệt: {yc.nguoiPheDuyet.ten}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog chi tiết + hành động */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Yêu cầu: {loaiLabel[selected.loai] ?? selected.loai}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Khách thuê:</strong> {selected.khachThue.hoTen} ({selected.khachThue.soDienThoai})</p>
                <p><strong>Ngày gửi:</strong> {fmtDate(selected.ngayTao)}</p>
              </div>

              <div className="rounded-md bg-gray-50 border p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Chi tiết thay đổi:</p>
                {renderChange(selected.noiDung, selected.loai)}
              </div>

              {selected.trangThai === 'choPheduyet' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ghi chú (tùy chọn)</label>
                    <Textarea
                      value={ghiChu}
                      onChange={e => setGhiChu(e.target.value)}
                      placeholder="Lý do từ chối hoặc ghi chú..."
                      rows={2}
                    />
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleDecision('tuChoi')}
                      disabled={processing}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {processing ? 'Đang xử lý...' : 'Từ chối'}
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleDecision('daPheduyet')}
                      disabled={processing}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {processing ? 'Đang xử lý...' : 'Phê duyệt'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
