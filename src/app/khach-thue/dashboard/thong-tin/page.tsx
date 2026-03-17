'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CCCDUpload } from '@/components/ui/cccd-upload';
import { User, Lock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface KhachThue {
  id: string;
  hoTen: string;
  soDienThoai: string;
  email?: string;
  cccd: string;
  ngaySinh: string;
  gioiTinh: string;
  queQuan: string;
  ngheNghiep?: string;
  anhCCCD?: { matTruoc: string; matSau: string } | null;
}

export default function ThongTinPage() {
  const [khachThue, setKhachThue] = useState<KhachThue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form thông tin
  const [form, setForm] = useState({
    hoTen: '', email: '', queQuan: '', ngheNghiep: '', gioiTinh: 'nam',
  });

  // Form CCCD
  const [anhCCCD, setAnhCCCD] = useState({ matTruoc: '', matSau: '' });
  const [savingCCCD, setSavingCCCD] = useState(false);

  // Form mật khẩu
  const [pwForm, setPwForm] = useState({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch('/api/auth/khach-thue/me')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const kt = res.data.khachThue;
          setKhachThue(kt);
          setForm({
            hoTen: kt.hoTen || '',
            email: kt.email || '',
            queQuan: kt.queQuan || '',
            ngheNghiep: kt.ngheNghiep || '',
            gioiTinh: kt.gioiTinh || 'nam',
          });
          const cccd = kt.anhCCCD as { matTruoc?: string; matSau?: string } | null;
          setAnhCCCD({
            matTruoc: cccd?.matTruoc || '',
            matSau: cccd?.matSau || '',
          });
        } else {
          toast.error('Không thể tải thông tin');
        }
      })
      .catch(() => toast.error('Có lỗi xảy ra'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/khach-thue/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Cập nhật thông tin thành công');
        setKhachThue(prev => prev ? { ...prev, ...form } : prev);
      } else {
        toast.error(result.message || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCCCD = async () => {
    setSavingCCCD(true);
    try {
      const res = await fetch('/api/auth/khach-thue/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anhCCCD }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Lưu ảnh CCCD thành công');
      } else {
        toast.error(result.message || 'Lưu thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSavingCCCD(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.matKhauMoi) { toast.error('Vui lòng nhập mật khẩu mới'); return; }
    if (pwForm.matKhauMoi.length < 6) { toast.error('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    if (pwForm.matKhauMoi !== pwForm.xacNhan) { toast.error('Mật khẩu xác nhận không khớp'); return; }
    setSavingPw(true);
    try {
      const res = await fetch('/api/auth/khach-thue/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matKhauCu: pwForm.matKhauCu, matKhauMoi: pwForm.matKhauMoi }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || 'Đổi mật khẩu thành công');
        setPwForm({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
      } else {
        toast.error(result.message || 'Đổi mật khẩu thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!khachThue) return <div className="text-center text-gray-600">Không có dữ liệu</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thông tin cá nhân</h1>
        <p className="text-gray-600 text-sm">Quản lý hồ sơ và bảo mật tài khoản</p>
      </div>

      <Tabs defaultValue="thongtin">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="thongtin" className="flex items-center gap-1.5">
            <User className="h-4 w-4" /> Thông tin
          </TabsTrigger>
          <TabsTrigger value="cccd" className="flex items-center gap-1.5">
            <CreditCard className="h-4 w-4" /> Ảnh CCCD
          </TabsTrigger>
          <TabsTrigger value="matkhau" className="flex items-center gap-1.5">
            <Lock className="h-4 w-4" /> Mật khẩu
          </TabsTrigger>
        </TabsList>

        {/* Tab Thông tin */}
        <TabsContent value="thongtin">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hoTen">Họ tên</Label>
                  <Input
                    id="hoTen"
                    value={form.hoTen}
                    onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Số điện thoại</Label>
                  <Input value={khachThue.soDienThoai} disabled className="bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CCCD</Label>
                  <Input value={khachThue.cccd} disabled className="bg-gray-50 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày sinh</Label>
                  <Input
                    value={khachThue.ngaySinh ? new Date(khachThue.ngaySinh).toLocaleDateString('vi-VN') : ''}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Giới tính</Label>
                  <Select value={form.gioiTinh} onValueChange={v => setForm(f => ({ ...f, gioiTinh: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nam">Nam</SelectItem>
                      <SelectItem value="nu">Nữ</SelectItem>
                      <SelectItem value="khac">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="queQuan">Quê quán</Label>
                  <Input
                    id="queQuan"
                    value={form.queQuan}
                    onChange={e => setForm(f => ({ ...f, queQuan: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngheNghiep">Nghề nghiệp</Label>
                  <Input
                    id="ngheNghiep"
                    value={form.ngheNghiep}
                    onChange={e => setForm(f => ({ ...f, ngheNghiep: e.target.value }))}
                    placeholder="Sinh viên, Kỹ sư..."
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveInfo} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab CCCD */}
        <TabsContent value="cccd">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <CCCDUpload anhCCCD={anhCCCD} onCCCDChange={setAnhCCCD} />
              <div className="flex justify-end">
                <Button onClick={handleSaveCCCD} disabled={savingCCCD}>
                  {savingCCCD ? 'Đang lưu...' : 'Lưu ảnh CCCD'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Mật khẩu */}
        <TabsContent value="matkhau">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Đổi mật khẩu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="matKhauCu">Mật khẩu hiện tại</Label>
                <Input
                  id="matKhauCu"
                  type="password"
                  value={pwForm.matKhauCu}
                  onChange={e => setPwForm(f => ({ ...f, matKhauCu: e.target.value }))}
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="matKhauMoi">Mật khẩu mới</Label>
                <Input
                  id="matKhauMoi"
                  type="password"
                  value={pwForm.matKhauMoi}
                  onChange={e => setPwForm(f => ({ ...f, matKhauMoi: e.target.value }))}
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xacNhan">Xác nhận mật khẩu mới</Label>
                <Input
                  id="xacNhan"
                  type="password"
                  value={pwForm.xacNhan}
                  onChange={e => setPwForm(f => ({ ...f, xacNhan: e.target.value }))}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
              {pwForm.matKhauMoi && pwForm.xacNhan && pwForm.matKhauMoi !== pwForm.xacNhan && (
                <p className="text-sm text-red-500">Mật khẩu xác nhận không khớp</p>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} disabled={savingPw}>
                  {savingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
