'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { HoaDon } from '@/types';
import { toast } from 'sonner';

export default function ThemMoiThanhToanPage() {
  const router = useRouter();
  const [hoaDonList, setHoaDonList] = useState<HoaDon[]>([]);
  const [formData, setFormData] = useState({
    hoaDon: '',
    soTien: 0,
    phuongThuc: 'tienMat' as string,
    nganHang: '',
    soGiaoDich: '',
    ngayThanhToan: new Date().toISOString().split('T')[0],
    ghiChu: '',
    anhBienLai: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Thêm thanh toán mới';
    fetchHoaDonList();
  }, []);

  const fetchHoaDonList = async () => {
    try {
      const response = await fetch('/api/hoa-don');
      const data = response.ok ? await response.json() : { data: [] };
      setHoaDonList(data.data || []);
    } catch (error) {
      console.error('Error fetching hoa don:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const requestData = {
        hoaDonId: formData.hoaDon,
        soTien: formData.soTien,
        phuongThuc: formData.phuongThuc,
        thongTinChuyenKhoan: formData.phuongThuc === 'chuyenKhoan' ? {
          nganHang: formData.nganHang,
          soGiaoDich: formData.soGiaoDich,
        } : undefined,
        ngayThanhToan: formData.ngayThanhToan,
        ghiChu: formData.ghiChu,
        anhBienLai: formData.anhBienLai,
      };

      const response = await fetch('/api/thanh-toan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        toast.success('Thêm thanh toán thành công');
        router.push('/dashboard/thanh-toan');
      } else {
        const errorData = await response.json();
        toast.error('Có lỗi xảy ra: ' + (errorData.message || 'Không thể lưu dữ liệu'));
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi dữ liệu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/thanh-toan')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Thêm thanh toán mới</h1>
          <p className="text-sm text-muted-foreground">Nhập thông tin thanh toán mới</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin thanh toán</CardTitle>
          <CardDescription>Nhập thông tin giao dịch thanh toán</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hoaDon" className="text-xs md:text-sm">Hóa đơn</Label>
              <Select value={formData.hoaDon} onValueChange={(value) => setFormData(prev => ({ ...prev, hoaDon: value }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn hóa đơn" />
                </SelectTrigger>
                <SelectContent>
                  {hoaDonList.map((hoaDon) => (
                    <SelectItem key={hoaDon.id} value={hoaDon.id!} className="text-sm">
                      {hoaDon.maHoaDon} - {hoaDon.conLai.toLocaleString('vi-VN')} VNĐ còn lại
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="soTien" className="text-xs md:text-sm">Số tiền (VNĐ)</Label>
              <Input
                id="soTien"
                type="number"
                min="1"
                value={formData.soTien}
                onChange={(e) => setFormData(prev => ({ ...prev, soTien: parseInt(e.target.value) || 0 }))}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phuongThuc" className="text-xs md:text-sm">Phương thức thanh toán</Label>
              <Select value={formData.phuongThuc} onValueChange={(value) => setFormData(prev => ({ ...prev, phuongThuc: value }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn phương thức" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tienMat" className="text-sm">Tiền mặt</SelectItem>
                  <SelectItem value="chuyenKhoan" className="text-sm">Chuyển khoản</SelectItem>
                  <SelectItem value="viDienTu" className="text-sm">Ví điện tử</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.phuongThuc === 'chuyenKhoan' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nganHang" className="text-xs md:text-sm">Ngân hàng</Label>
                  <Input
                    id="nganHang"
                    value={formData.nganHang}
                    onChange={(e) => setFormData(prev => ({ ...prev, nganHang: e.target.value }))}
                    placeholder="Tên ngân hàng"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soGiaoDich" className="text-xs md:text-sm">Số giao dịch</Label>
                  <Input
                    id="soGiaoDich"
                    value={formData.soGiaoDich}
                    onChange={(e) => setFormData(prev => ({ ...prev, soGiaoDich: e.target.value }))}
                    placeholder="Mã giao dịch"
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ngayThanhToan" className="text-xs md:text-sm">Ngày thanh toán</Label>
              <Input
                id="ngayThanhToan"
                type="date"
                value={formData.ngayThanhToan}
                onChange={(e) => setFormData(prev => ({ ...prev, ngayThanhToan: e.target.value }))}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ghiChu" className="text-xs md:text-sm">Ghi chú</Label>
              <Textarea
                id="ghiChu"
                value={formData.ghiChu}
                onChange={(e) => setFormData(prev => ({ ...prev, ghiChu: e.target.value }))}
                rows={3}
                placeholder="Ghi chú về giao dịch..."
                className="text-sm"
              />
            </div>

            <ImageUpload
              imageUrl={formData.anhBienLai}
              onImageChange={(url) => setFormData(prev => ({ ...prev, anhBienLai: url }))}
              label="Ảnh biên lai"
              placeholder="Chọn ảnh biên lai thanh toán"
            />

            <div className="flex flex-col sm:flex-row gap-2 pt-4 md:pt-6 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => router.push('/dashboard/thanh-toan')} className="w-full sm:w-auto">
                Hủy
              </Button>
              <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? 'Đang lưu...' : 'Thêm mới'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
