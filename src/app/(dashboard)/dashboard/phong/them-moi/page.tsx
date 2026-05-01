'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhongImageUpload } from '@/components/ui/phong-image-upload';
import { buildUploadFolder } from '@/lib/upload-path';
import { ToaNha } from '@/types';
import { ArrowLeft, Info, Image, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const tienNghiOptions = [
  { value: 'dieuhoa', label: 'Điều hòa' },
  { value: 'nonglanh', label: 'Nóng lạnh' },
  { value: 'tulanh', label: 'Tủ lạnh' },
  { value: 'giuong', label: 'Giường' },
  { value: 'tuquanao', label: 'Tủ quần áo' },
  { value: 'banlamviec', label: 'Bàn làm việc' },
  { value: 'ghe', label: 'Ghế' },
  { value: 'tivi', label: 'TV' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'maygiat', label: 'Máy giặt' },
  { value: 'bep', label: 'Bếp' },
  { value: 'noi', label: 'Nồi' },
  { value: 'chen', label: 'Chén' },
  { value: 'bat', label: 'Bát' },
];

export default function ThemMoiPhongPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);

  const [formData, setFormData] = useState({
    maPhong: '',
    toaNha: '',
    tang: 1,
    dienTich: 0,
    giaThue: 0,
    tienCoc: 0,
    moTa: '',
    anhPhong: [] as string[],
    tienNghi: [] as string[],
    soNguoiToiDa: 1,
    ngayTinhTien: 1,
    trangThai: 'trong' as 'trong' | 'daDat' | 'dangThue' | 'baoTri',
  });

  useEffect(() => {
    document.title = 'Thêm phòng mới';
    fetch('/api/toa-nha')
      .then(r => r.json())
      .then(d => {
        if (d.success) setToaNhaList(d.data);
      })
      .catch(() => {});
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const handleTienNghiChange = (tienNghi: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tienNghi: checked
        ? [...prev.tienNghi, tienNghi]
        : prev.tienNghi.filter(t => t !== tienNghi)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/phong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Thêm phòng thành công!');
        router.push('/dashboard/phong');
      } else {
        toast.error(result.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/phong')} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Thêm phòng mới</h1>
          <p className="text-xs md:text-sm text-gray-500">Nhập thông tin phòng mới</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin phòng</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <Tabs defaultValue="thong-tin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="thong-tin" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Info className="h-3 w-3 md:h-4 md:w-4" />
                  Thông tin
                </TabsTrigger>
                <TabsTrigger value="anh-phong" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Image className="h-3 w-3 md:h-4 md:w-4" />
                  Ảnh phòng
                </TabsTrigger>
              </TabsList>

              <TabsContent value="thong-tin" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maPhong" className="text-sm">Mã phòng</Label>
                    <Input
                      id="maPhong"
                      value={formData.maPhong}
                      onChange={(e) => setFormData(prev => ({ ...prev, maPhong: e.target.value.toUpperCase() }))}
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toaNha" className="text-sm">Tòa nhà</Label>
                    <Select value={formData.toaNha} onValueChange={(value) => setFormData(prev => ({ ...prev, toaNha: value }))}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Chọn tòa nhà" />
                      </SelectTrigger>
                      <SelectContent>
                        {toaNhaList.map((toaNha) => (
                          <SelectItem key={toaNha.id} value={toaNha.id!} className="text-sm">
                            {toaNha.tenToaNha}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trangThai" className="text-sm">Trạng thái</Label>
                    <Select value={formData.trangThai} onValueChange={(value) => setFormData(prev => ({ ...prev, trangThai: value as any }))}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trong" className="text-sm">Trống</SelectItem>
                        <SelectItem value="daDat" className="text-sm">Đã đặt</SelectItem>
                        <SelectItem value="dangThue" className="text-sm">Đang thuê</SelectItem>
                        <SelectItem value="baoTri" className="text-sm">Bảo trì</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tang" className="text-sm">Tầng</Label>
                    <Input
                      id="tang"
                      type="number"
                      min="0"
                      value={formData.tang}
                      onChange={(e) => setFormData(prev => ({ ...prev, tang: parseInt(e.target.value) || 0 }))}
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dienTich" className="text-sm">Diện tích (m²)</Label>
                    <Input
                      id="dienTich"
                      type="number"
                      min="1"
                      value={formData.dienTich}
                      onChange={(e) => setFormData(prev => ({ ...prev, dienTich: parseInt(e.target.value) || 0 }))}
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="soNguoiToiDa" className="text-sm">Số người tối đa</Label>
                    <Input
                      id="soNguoiToiDa"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.soNguoiToiDa}
                      onChange={(e) => setFormData(prev => ({ ...prev, soNguoiToiDa: parseInt(e.target.value) || 1 }))}
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ngayTinhTien" className="text-sm">Ngày thu tiền</Label>
                    <Input
                      id="ngayTinhTien"
                      type="number"
                      min="1"
                      max="28"
                      value={formData.ngayTinhTien}
                      onChange={(e) => setFormData(prev => ({ ...prev, ngayTinhTien: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ngày 1-28</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="giaThue" className="text-sm">Giá thuê (VNĐ)</Label>
                    <Input
                      id="giaThue"
                      type="number"
                      min="0"
                      value={formData.giaThue}
                      onChange={(e) => setFormData(prev => ({ ...prev, giaThue: parseInt(e.target.value) || 0 }))}
                      required
                      className="text-sm"
                    />
                    <span className="text-xs md:text-sm text-gray-500 font-medium">
                      {formatCurrency(formData.giaThue)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tienCoc" className="text-sm">Tiền cọc (VNĐ)</Label>
                    <Input
                      id="tienCoc"
                      type="number"
                      min="0"
                      value={formData.tienCoc}
                      onChange={(e) => setFormData(prev => ({ ...prev, tienCoc: parseInt(e.target.value) || 0 }))}
                      required
                      className="text-sm"
                    />
                    <span className="text-xs md:text-sm text-gray-500 font-medium">
                      {formatCurrency(formData.tienCoc)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="moTa" className="text-sm">Mô tả</Label>
                  <Textarea
                    id="moTa"
                    value={formData.moTa}
                    onChange={(e) => setFormData(prev => ({ ...prev, moTa: e.target.value }))}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tiện nghi</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    {tienNghiOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={option.value}
                          checked={formData.tienNghi.includes(option.value)}
                          onChange={(e) => handleTienNghiChange(option.value, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={option.value} className="text-sm">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="anh-phong" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <h3 className="text-base md:text-lg font-medium mb-1 md:mb-2">Quản lý ảnh phòng</h3>
                    <p className="text-xs md:text-sm text-gray-600">
                      Tải lên tối đa 10 ảnh để khách hàng có thể xem chi tiết phòng
                    </p>
                  </div>

                  <PhongImageUpload
                    images={formData.anhPhong}
                    onImagesChange={(images: string[]) => setFormData(prev => ({ ...prev, anhPhong: images }))}
                    maxImages={10}
                    className="w-full"
                    folder={buildUploadFolder(
                      toaNhaList.find(t => t.id === formData.toaNha)?.tenToaNha || formData.toaNha,
                      formData.maPhong,
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/phong')} className="text-sm">
                Hủy
              </Button>
              <Button type="submit" disabled={submitting} className="text-sm">
                {submitting ? 'Đang xử lý...' : 'Thêm mới'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
