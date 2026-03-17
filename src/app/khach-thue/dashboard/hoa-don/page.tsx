'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface HoaDon {
  id: string;
  maHoaDon: string;
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  tienNuoc: number;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  trangThai: string;
  hanThanhToan: string;
  phiDichVu: { ten: string; gia: number }[];
  phong?: { maPhong: string };
  hopDong?: { maHopDong: string };
}

const trangThaiLabel: Record<string, { label: string; class: string }> = {
  chuaThanhToan: { label: 'Chưa thanh toán', class: 'border border-yellow-400 text-yellow-700 bg-yellow-50' },
  daThanhToanMotPhan: { label: 'Thanh toán một phần', class: 'bg-blue-100 text-blue-700' },
  daThanhToan: { label: 'Đã thanh toán', class: 'bg-green-100 text-green-700' },
  quaHan: { label: 'Quá hạn', class: 'bg-red-100 text-red-700' },
};

export default function HoaDonPage() {
  const [hoaDons, setHoaDons] = useState<HoaDon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/khach-thue/hoa-don')
      .then(r => r.json())
      .then(res => {
        if (res.success) setHoaDons(res.data);
        else toast.error('Không thể tải hóa đơn');
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
        <h1 className="text-2xl font-bold text-gray-900">Hóa đơn</h1>
        <p className="text-gray-600 text-sm">Danh sách hóa đơn hàng tháng của bạn</p>
      </div>

      {hoaDons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mb-3 opacity-30" />
            <p>Chưa có hóa đơn nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {hoaDons.map(hd => {
            const tt = trangThaiLabel[hd.trangThai] ?? { label: hd.trangThai, class: '' };
            return (
              <Card key={hd.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {hd.maHoaDon}
                    </CardTitle>
                    <Badge className={tt.class}>{tt.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tháng {hd.thang}/{hd.nam}
                    {hd.phong && ` · Phòng ${hd.phong.maPhong}`}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tiền phòng</p>
                      <p className="font-medium">{fmt(hd.tienPhong)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Điện + Nước</p>
                      <p className="font-medium">{fmt(hd.tienDien + hd.tienNuoc)}</p>
                    </div>
                    {hd.phiDichVu?.length > 0 && (
                      <div>
                        <p className="text-muted-foreground">Dịch vụ</p>
                        <p className="font-medium">{fmt(hd.phiDichVu.reduce((s, p) => s + p.gia, 0))}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground font-semibold">Tổng cộng</p>
                      <p className="font-bold text-blue-700">{fmt(hd.tongTien)}</p>
                    </div>
                  </div>

                  {hd.trangThai !== 'daThanhToan' && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Hạn: {fmtDate(hd.hanThanhToan)}
                      </span>
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <DollarSign className="h-3.5 w-3.5" />
                        Còn lại: {fmt(hd.conLai)}
                      </span>
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
