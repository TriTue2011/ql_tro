'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, DollarSign, Home, Users } from 'lucide-react';
import { toast } from 'sonner';

interface HopDong {
  id: string;
  maHopDong: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  giaThue: number;
  tienCoc: number;
  giaDien: number;
  giaNuoc: number;
  dieuKhoan: string;
  trangThai: string;
  phong: {
    maPhong: string;
    toaNha: { tenToaNha: string; diaChi: { duong?: string; phuong?: string } };
  };
  nguoiDaiDien: { id: string; hoTen: string; soDienThoai: string };
  khachThue: { id: string; hoTen: string; soDienThoai: string }[];
}

const trangThaiHD: Record<string, { label: string; class: string }> = {
  hoatDong: { label: 'Đang hoạt động', class: 'bg-green-100 text-green-700' },
  hetHan: { label: 'Hết hạn', class: 'bg-gray-100 text-gray-700' },
  daHuy: { label: 'Đã hủy', class: 'bg-red-100 text-red-700' },
};

export default function HopDongPage() {
  const [hopDongs, setHopDongs] = useState<HopDong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/khach-thue/hop-dong')
      .then(r => r.json())
      .then(res => {
        if (res.success) setHopDongs(res.data);
        else toast.error('Không thể tải hợp đồng');
      })
      .catch(() => toast.error('Có lỗi xảy ra'))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hợp đồng</h1>
        <p className="text-gray-600 text-sm">Lịch sử hợp đồng thuê phòng của bạn</p>
      </div>

      {hopDongs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mb-3 opacity-30" />
            <p>Chưa có hợp đồng nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {hopDongs.map(hd => {
            const tt = trangThaiHD[hd.trangThai] ?? { label: hd.trangThai, class: '' };
            return (
              <Card key={hd.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {hd.maHopDong}
                    </CardTitle>
                    <Badge className={tt.class}>{tt.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <Home className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Phòng</p>
                        <p className="font-medium">{hd.phong.maPhong} — {hd.phong.toaNha.tenToaNha}</p>
                        {hd.phong.toaNha.diaChi?.duong && (
                          <p className="text-xs text-muted-foreground">{hd.phong.toaNha.diaChi.duong}, {hd.phong.toaNha.diaChi.phuong}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Thời hạn</p>
                        <p className="font-medium">{fmtDate(hd.ngayBatDau)} — {fmtDate(hd.ngayKetThuc)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Giá thuê / Tiền cọc</p>
                        <p className="font-medium">{fmt(hd.giaThue)} / {fmt(hd.tienCoc)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Giá điện / Nước</p>
                        <p className="font-medium">{fmt(hd.giaDien)}/kWh · {fmt(hd.giaNuoc)}/m³</p>
                      </div>
                    </div>
                  </div>

                  {hd.khachThue.length > 1 && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                        <Users className="h-3.5 w-3.5" /> Thành viên ({hd.khachThue.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {hd.khachThue.map(kt => (
                          <span key={kt.id} className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                            {kt.hoTen}
                            {kt.id === hd.nguoiDaiDien.id && ' (Đại diện)'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hd.dieuKhoan && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Điều khoản</p>
                      <p className="text-sm whitespace-pre-wrap text-gray-700">{hd.dieuKhoan}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
