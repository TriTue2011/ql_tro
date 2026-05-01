'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Building2,
  Shield,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  getChucVuOptionsForRole,
  getDefaultChucVuForRole,
  isChucVuAllowedForRole,
} from '@/lib/chuc-vu';

interface Building {
  id: string;
  tenToaNha: string;
}

const ROLE_LABELS: Record<string, string> = {
  chuNha: 'Chủ trọ',
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
};

const DEFAULT_ROLE_LIMITS: Record<string, number> = { chuNha: 1, dongChuTro: 2, quanLy: 3, nhanVien: 5 };

export default function ThemMoiTaiKhoanPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'nhanVien',
    chucVu: 'nhanVienKiemToanBo',
    toaNhaIds: [] as string[],
  });

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    document.title = 'Tạo tài khoản mới';
    fetchBuildings();
    fetchUsers();
    fetchRoleLimits();
  }, []);

  const fetchBuildings = async () => {
    try {
      const res = await fetch('/api/toa-nha?limit=100');
      if (res.ok) {
        const data = await res.json();
        setBuildings(data.data || []);
      }
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {}
  };

  const fetchRoleLimits = async () => {
    try {
      const res = await fetch('/api/admin/role-limits?all=1');
      if (res.ok) {
        const data = await res.json();
        setGlobalLimits(data.global || DEFAULT_ROLE_LIMITS);
        setPerBuildingLimits(data.perBuilding || {});
      }
    } catch {}
  };

  const getSafeChucVuForRole = (role: string, chucVu?: string | null) => {
    const options = getChucVuOptionsForRole(role);
    if (options.length === 0) return '';
    if (chucVu && isChucVuAllowedForRole(role, chucVu)) return chucVu;
    return getDefaultChucVuForRole(role) ?? options[0].value;
  };

  const updateRole = (role: string) => {
    setFormData({
      ...formData,
      role,
      chucVu: getSafeChucVuForRole(role, ''),
      toaNhaIds: [],
    });
  };

  const getRoleCountPerBuilding = (buildingId: string, role: string) => {
    return users.filter((u: any) => {
      const userRole = u.role || u.vaiTro || '';
      return userRole === role && (u.toaNhaIds || []).includes(buildingId);
    }).length;
  };

  const getRoleLimitForBuilding = (toaNhaId: string, role: string): number => {
    const buildingLimits = perBuildingLimits[toaNhaId];
    if (buildingLimits && buildingLimits[role] != null) return buildingLimits[role];
    return globalLimits[role] ?? 0;
  };

  const handleSubmit = async () => {
    if (!formData.phone?.trim() && !formData.email?.trim()) {
      toast.error('Cần nhập ít nhất số điện thoại hoặc email');
      return;
    }

    try {
      setSubmitting(true);
      const safeChucVu = getSafeChucVuForRole(formData.role, formData.chucVu);
      const payload: Record<string, unknown> = { ...formData, chucVu: safeChucVu };
      if (!safeChucVu) delete payload.chucVu;
      if (formData.role === 'admin') {
        delete payload.toaNhaIds;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json().catch(() => null);
      if (response.ok) {
        toast.success('Tạo tài khoản thành công');
        router.push('/dashboard/quan-ly-tai-khoan');
      } else {
        toast.error(responseData?.message || responseData?.error || 'Tạo tài khoản thất bại');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Có lỗi xảy ra khi tạo tài khoản');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/quan-ly-tai-khoan')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tạo tài khoản mới</h1>
          <p className="text-sm text-gray-500">Tạo tài khoản người dùng mới cho hệ thống</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin tài khoản</CardTitle>
          <CardDescription>Nhập thông tin chi tiết cho tài khoản mới</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Họ và tên</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nhập họ và tên"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">
                Số điện thoại <span className="text-muted-foreground text-[10px]">(cần ít nhất SĐT hoặc email)</span>
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Tùy chọn nếu đã có email"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email <span className="text-muted-foreground text-[10px]">(cần ít nhất SĐT hoặc email)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Tùy chọn nếu đã có SĐT"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Mật khẩu
                {['quanLy', 'nhanVien', 'dongChuTro'].includes(formData.role) && (
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">(không bắt buộc)</span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={['quanLy', 'nhanVien', 'dongChuTro'].includes(formData.role) ? 'Để trống nếu không cần đăng nhập web' : 'Nhập mật khẩu'}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm">Vai trò</Label>
              <Select
                value={formData.role}
                onValueChange={updateRole}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin ? (
                    <>
                      <SelectItem value="chuNha">Chủ trọ</SelectItem>
                      <SelectItem value="admin">Quản trị viên</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="dongChuTro">Đồng chủ trọ</SelectItem>
                      <SelectItem value="quanLy">Quản lý</SelectItem>
                      <SelectItem value="nhanVien">Nhân viên</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {getChucVuOptionsForRole(formData.role).length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="chucVu" className="text-sm">Chức vụ</Label>
                <Select
                  value={getSafeChucVuForRole(formData.role, formData.chucVu)}
                  onValueChange={(value) => setFormData({ ...formData, chucVu: value })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {getChucVuOptionsForRole(formData.role).map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.role !== 'admin' && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  Gán tòa nhà
                </Label>
                <div className="border rounded-md p-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {buildings.length === 0 && <p className="text-xs text-muted-foreground">Chưa có tòa nhà</p>}
                  {buildings.map(b => {
                    const max = getRoleLimitForBuilding(b.id, formData.role);
                    const currentCount = max ? getRoleCountPerBuilding(b.id, formData.role) : 0;
                    const isAtLimit = max ? currentCount >= max : false;
                    const isChecked = formData.toaNhaIds.includes(b.id);
                    return (
                      <label key={b.id} className={`flex items-center gap-2 py-0.5 ${isAtLimit && !isChecked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <Checkbox
                          checked={isChecked}
                          disabled={isAtLimit && !isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...formData.toaNhaIds, b.id]
                              : formData.toaNhaIds.filter(id => id !== b.id);
                            setFormData({ ...formData, toaNhaIds: next });
                          }}
                        />
                        <span className="text-sm flex-1">{b.tenToaNha}</span>
                        {max > 0 && (
                          <span className={`text-[10px] ${isAtLimit ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            {currentCount}/{max}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                <Save className="h-4 w-4" />
                {submitting ? 'Đang lưu...' : 'Tạo tài khoản'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/quan-ly-tai-khoan')}>
                Hủy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
