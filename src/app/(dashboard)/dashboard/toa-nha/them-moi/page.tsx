'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Phone,
  UserCircle,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LienHePhuTrach } from '@/types';

const tienNghiOptions = [
  { value: 'wifi', label: 'WiFi' },
  { value: 'camera', label: 'Camera an ninh' },
  { value: 'baoVe', label: 'Bảo vệ 24/7' },
  { value: 'giuXe', label: 'Giữ xe' },
  { value: 'thangMay', label: 'Thang máy' },
  { value: 'sanPhoi', label: 'Sân phơi' },
  { value: 'nhaVeSinhChung', label: 'Nhà vệ sinh chung' },
  { value: 'khuBepChung', label: 'Khu bếp chung' },
];

export default function ThemMoiToaNhaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    tenToaNha: '',
    soNha: '',
    duong: '',
    phuong: '',
    thanhPho: '',
    moTa: '',
    tienNghiChung: [] as string[],
  });
  const [lienHePhuTrach, setLienHePhuTrach] = useState<LienHePhuTrach[]>([]);
  const [newContact, setNewContact] = useState<LienHePhuTrach>({ ten: '', soDienThoai: '', vaiTro: '' });

  const handleTienNghiChange = (tienNghi: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tienNghiChung: checked
        ? [...prev.tienNghiChung, tienNghi]
        : prev.tienNghiChung.filter(t => t !== tienNghi),
    }));
  };

  const handleAddContact = () => {
    const ten = newContact.ten.trim();
    const soDienThoai = newContact.soDienThoai.trim();
    if (!ten || !soDienThoai) return;
    setLienHePhuTrach(prev => [...prev, { ten, soDienThoai, vaiTro: newContact.vaiTro?.trim() || undefined }]);
    setNewContact({ ten: '', soDienThoai: '', vaiTro: '' });
  };

  const handleRemoveContact = (index: number) => {
    setLienHePhuTrach(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitData = {
        tenToaNha: formData.tenToaNha,
        diaChi: {
          soNha: formData.soNha,
          duong: formData.duong,
          phuong: formData.phuong,
          thanhPho: formData.thanhPho,
        },
        moTa: formData.moTa,
        tienNghiChung: formData.tienNghiChung,
        lienHePhuTrach,
      };

      const response = await fetch('/api/toa-nha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Thêm tòa nhà thành công!');
          router.push('/dashboard/toa-nha');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="flex items-center gap-3 md:gap-4 p-4 md:p-6">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-bold">Thêm tòa nhà mới</h1>
            <p className="text-sm text-gray-500">Nhập thông tin tòa nhà mới</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/toa-nha')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Quay lại
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base">Thông tin tòa nhà</CardTitle>
          <CardDescription className="text-sm">Vui lòng điền đầy đủ thông tin bên dưới</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenToaNha" className="text-sm">Tên tòa nhà</Label>
              <Input
                id="tenToaNha"
                value={formData.tenToaNha}
                onChange={(e) => setFormData(prev => ({ ...prev, tenToaNha: e.target.value }))}
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="soNha" className="text-sm">Số nhà</Label>
                <Input
                  id="soNha"
                  value={formData.soNha}
                  onChange={(e) => setFormData(prev => ({ ...prev, soNha: e.target.value }))}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duong" className="text-sm">Tên đường</Label>
                <Input
                  id="duong"
                  value={formData.duong}
                  onChange={(e) => setFormData(prev => ({ ...prev, duong: e.target.value }))}
                  required
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="phuong" className="text-sm">Phường/Xã</Label>
                <Input
                  id="phuong"
                  value={formData.phuong}
                  onChange={(e) => setFormData(prev => ({ ...prev, phuong: e.target.value }))}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thanhPho" className="text-sm">Tỉnh/Thành phố</Label>
                <Input
                  id="thanhPho"
                  value={formData.thanhPho}
                  onChange={(e) => setFormData(prev => ({ ...prev, thanhPho: e.target.value }))}
                  required
                  className="text-sm"
                />
              </div>
            </div>

            {!isAdmin && (
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
            )}

            {!isAdmin && (
              <div className="space-y-2">
                <Label className="text-sm">Tiện nghi chung</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tienNghiOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={option.value}
                        checked={formData.tienNghiChung.includes(option.value)}
                        onChange={(e) => handleTienNghiChange(option.value, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={option.value} className="text-sm">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isAdmin && (
              /* Liên hệ phụ trách */
              <div className="space-y-2">
                <Label className="text-sm font-medium">Liên hệ phụ trách</Label>
                <p className="text-xs text-gray-500">Thêm các đầu mối liên hệ để khách thuê liên hệ khi cần hỗ trợ.</p>

                {lienHePhuTrach.length > 0 && (
                  <div className="space-y-2">
                    {lienHePhuTrach.map((lh, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                        <UserCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{lh.ten}</span>
                          {lh.vaiTro && <span className="text-xs text-gray-500 ml-1">({lh.vaiTro})</span>}
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Phone className="h-3 w-3" />
                            {lh.soDienThoai}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveContact(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 p-2 border rounded-md border-dashed">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Tên liên hệ *"
                      value={newContact.ten}
                      onChange={e => setNewContact(prev => ({ ...prev, ten: e.target.value }))}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Số điện thoại *"
                      value={newContact.soDienThoai}
                      onChange={e => setNewContact(prev => ({ ...prev, soDienThoai: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Vai trò (vd: Quản lý, Bảo vệ...)"
                      value={newContact.vaiTro || ''}
                      onChange={e => setNewContact(prev => ({ ...prev, vaiTro: e.target.value }))}
                      className="text-sm flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddContact}
                      disabled={!newContact.ten.trim() || !newContact.soDienThoai.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Thêm
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 md:pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/toa-nha')} className="text-sm w-full sm:w-auto">
                Hủy
              </Button>
              <Button type="submit" disabled={saving} className="text-sm w-full sm:w-auto">
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Đang lưu...' : 'Thêm mới'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
