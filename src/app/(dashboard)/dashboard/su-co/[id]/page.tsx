'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  ArrowLeft,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SuCoImageUpload } from '@/components/ui/su-co-image-upload';
import { buildUploadFolder } from '@/lib/upload-path';
import { SuCo, Phong, KhachThue, HopDong } from '@/types';

export default function ChinhSuaSuCoPage() {
  const router = useRouter();
  const params = useParams();
  const suCoId = params.id as string;

  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [hopDongList, setHopDongList] = useState<HopDong[]>([]);
  const [loading, setLoading] = useState(true);
  const [suCo, setSuCo] = useState<SuCo | null>(null);

  const [formData, setFormData] = useState({
    phong: '',
    khachThue: '',
    tieuDe: '',
    moTa: '',
    loaiSuCo: 'dienNuoc',
    mucDoUuTien: 'trungBinh',
    trangThai: 'moi',
    ghiChuXuLy: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhong, setSelectedPhong] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'Chỉnh sửa sự cố';
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [suCoRes, phongRes, khachThueRes, hopDongRes] = await Promise.all([
        fetch('/api/su-co'),
        fetch('/api/phong'),
        fetch('/api/khach-thue'),
        fetch('/api/hop-dong'),
      ]);

      const suCoData = await suCoRes.json();
      const suCos: SuCo[] = suCoData.success ? suCoData.data : [];
      const found = suCos.find(s => s.id === suCoId);
      if (!found) {
        toast.error('Không tìm thấy sự cố');
        router.push('/dashboard/su-co');
        return;
      }
      setSuCo(found);

      const phongData = await phongRes.json();
      const khachThueData = await khachThueRes.json();
      const hopDongData = await hopDongRes.json();

      setPhongList(phongData.success ? phongData.data : []);
      setKhachThueList(khachThueData.success ? khachThueData.data : []);
      setHopDongList(hopDongData.success ? hopDongData.data : []);

      setFormData({
        phong: typeof found.phong === 'string' ? found.phong : (found.phong as any)?.id || '',
        khachThue: typeof found.khachThue === 'string' ? found.khachThue : (found.khachThue as any)?.id || '',
        tieuDe: found.tieuDe || '',
        moTa: found.moTa || '',
        loaiSuCo: found.loaiSuCo || 'dienNuoc',
        mucDoUuTien: found.mucDoUuTien || 'trungBinh',
        trangThai: found.trangThai || 'moi',
        ghiChuXuLy: found.ghiChuXuLy || '',
      });
      setImages(found.anhSuCo || []);

      // Set selected phong
      const phongId = typeof found.phong === 'string' ? found.phong : (found.phong as any)?.id;
      if (phongId) {
        const phong = phongData.data?.find((p: Phong) => p.id === phongId);
        setSelectedPhong(phong);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const getKhachThueName = (khachThue: any) => {
    if (typeof khachThue === 'string') {
      const obj = khachThueList.find(k => k.id === khachThue);
      return obj?.hoTen || 'Không xác định';
    }
    return khachThue?.hoTen || 'Không xác định';
  };

  const handlePhongChange = async (phongId: string) => {
    setFormData(prev => ({ ...prev, phong: phongId }));
    const phong = phongList.find(p => p.id === phongId);
    setSelectedPhong(phong);

    if (phong) {
      const hopDongHoatDong = hopDongList.find(hd =>
        (hd.phong as any).id === phongId && hd.trangThai === 'hoatDong'
      );
      if (hopDongHoatDong && hopDongHoatDong.nguoiDaiDien) {
        setFormData(prev => ({
          ...prev,
          khachThue: (hopDongHoatDong.nguoiDaiDien as any)?.id || hopDongHoatDong.nguoiDaiDien,
        }));
      } else {
        setFormData(prev => ({ ...prev, khachThue: '' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phong) {
      toast.error('Vui lòng chọn phòng');
      return;
    }
    if (!formData.khachThue) {
      toast.error('Không tìm thấy khách thuê cho phòng này.');
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        anhSuCo: images,
        ngayBaoCao: suCo?.ngayBaoCao || new Date().toISOString(),
      };

      const response = await fetch(`/api/su-co/${suCoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Cập nhật sự cố thành công');
        router.push('/dashboard/su-co');
      } else {
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chỉnh sửa sự cố</h1>
          <p className="text-sm text-gray-500">Cập nhật thông tin sự cố</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin sự cố</CardTitle>
          <CardDescription>Chỉnh sửa thông tin bên dưới</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="phong" className="text-xs md:text-sm">Phòng</Label>
                <Select value={formData.phong} onValueChange={handlePhongChange}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn phòng" />
                  </SelectTrigger>
                  <SelectContent>
                    {phongList.map((phong) => (
                      <SelectItem key={phong.id} value={phong.id!} className="text-sm">
                        {phong.maPhong}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="khachThue" className="text-xs md:text-sm">Khách thuê</Label>
                {formData.khachThue ? (
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <div className="text-sm font-medium">
                      {getKhachThueName(formData.khachThue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {selectedPhong && `Phòng ${selectedPhong.maPhong}`}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                    <div className="text-sm text-yellow-800">
                      Vui lòng chọn phòng
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tieuDe" className="text-xs md:text-sm">Tiêu đề</Label>
              <Input
                id="tieuDe"
                value={formData.tieuDe}
                onChange={(e) => setFormData(prev => ({ ...prev, tieuDe: e.target.value }))}
                placeholder="Nhập tiêu đề sự cố"
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moTa" className="text-xs md:text-sm">Mô tả chi tiết</Label>
              <Textarea
                id="moTa"
                value={formData.moTa}
                onChange={(e) => setFormData(prev => ({ ...prev, moTa: e.target.value }))}
                rows={4}
                placeholder="Mô tả chi tiết về sự cố..."
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="loaiSuCo" className="text-xs md:text-sm">Loại sự cố</Label>
                <Select value={formData.loaiSuCo} onValueChange={(value) => setFormData(prev => ({ ...prev, loaiSuCo: value as any }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn loại sự cố" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dienNuoc" className="text-sm">Điện nước</SelectItem>
                    <SelectItem value="noiThat" className="text-sm">Nội thất</SelectItem>
                    <SelectItem value="vesinh" className="text-sm">Vệ sinh</SelectItem>
                    <SelectItem value="anNinh" className="text-sm">An ninh</SelectItem>
                    <SelectItem value="khac" className="text-sm">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mucDoUuTien" className="text-xs md:text-sm">Mức độ ưu tiên</Label>
                <Select value={formData.mucDoUuTien} onValueChange={(value) => setFormData(prev => ({ ...prev, mucDoUuTien: value as any }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn mức độ ưu tiên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thap" className="text-sm">Thấp</SelectItem>
                    <SelectItem value="trungBinh" className="text-sm">Trung bình</SelectItem>
                    <SelectItem value="cao" className="text-sm">Cao</SelectItem>
                    <SelectItem value="khancap" className="text-sm">Khẩn cấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trangThai" className="text-xs md:text-sm">Trạng thái</Label>
              <Select value={formData.trangThai} onValueChange={(value) => setFormData(prev => ({ ...prev, trangThai: value as any }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moi" className="text-sm">Mới</SelectItem>
                  <SelectItem value="dangXuLy" className="text-sm">Đang xử lý</SelectItem>
                  <SelectItem value="daXong" className="text-sm">Đã xong</SelectItem>
                  <SelectItem value="daHuy" className="text-sm">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.trangThai === 'dangXuLy' || formData.trangThai === 'daXong' || formData.trangThai === 'daHuy') && (
              <div className="space-y-2">
                <Label htmlFor="ghiChuXuLy" className="text-xs md:text-sm">
                  {formData.trangThai === 'daHuy' ? 'Lý do hủy (tùy chọn)' : 'Ghi chú xử lý'}
                </Label>
                <Textarea
                  id="ghiChuXuLy"
                  value={formData.ghiChuXuLy}
                  onChange={(e) => setFormData(prev => ({ ...prev, ghiChuXuLy: e.target.value }))}
                  rows={3}
                  placeholder={formData.trangThai === 'daHuy' ? 'Ghi chú về lý do hủy sự cố...' : 'Ghi chú về quá trình xử lý...'}
                  className="text-sm"
                />
              </div>
            )}

            <SuCoImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              folder={buildUploadFolder(
                (selectedPhong?.toaNha as any)?.tenToaNha,
                selectedPhong?.maPhong,
              )}
            />

            <div className="flex flex-col sm:flex-row gap-2 pt-4 md:pt-6 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => router.back()} className="w-full sm:w-auto">
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? 'Đang xử lý...' : 'Cập nhật'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
