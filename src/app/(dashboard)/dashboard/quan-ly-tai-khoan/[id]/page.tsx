'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Loader2,
  Building2,
  Shield,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  getChucVuLabel,
  getChucVuOptionsForRole,
  getDefaultChucVuForRole,
  isChucVuAllowedForRole,
} from '@/lib/chuc-vu';

interface Building {
  id: string;
  tenToaNha: string;
}

interface User {
  _id: string;
  id?: string;
  name?: string;
  ten?: string;
  email: string;
  phone?: string;
  soDienThoai?: string;
  role?: string;
  vaiTro?: string;
  chucVu?: string | null;
  avatar?: string;
  anhDaiDien?: string;
  createdAt?: string;
  ngayTao?: string;
  isActive?: boolean;
  trangThai?: string;
  zaloChatId?: string;
  toaNhaId?: string | null;
  toaNhaTen?: string | null;
  toaNhaIds?: string[];
  nguoiTaoTen?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  chuNha: 'Chủ trọ',
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
};

const DEFAULT_ROLE_LIMITS: Record<string, number> = { chuNha: 1, dongChuTro: 2, quanLy: 3, nhanVien: 5 };

export default function ChinhSuaTaiKhoanPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { data: session } = useSession();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: '',
    chucVu: '',
    toaNhaIds: [] as string[],
  });

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    document.title = 'Chỉnh sửa tài khoản';
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, buildingRes, limitsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/toa-nha?limit=100'),
        fetch('/api/admin/role-limits?all=1'),
      ]);

      if (buildingRes.ok) {
        const data = await buildingRes.json();
        setBuildings(data.data || []);
      }
      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setGlobalLimits(data.global || DEFAULT_ROLE_LIMITS);
        setPerBuildingLimits(data.perBuilding || {});
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUsers(data);
        const user = data.find((u: any) => u.id === userId || u._id === userId);
        if (user) {
          const userRole = user.role || user.vaiTro || 'nhanVien';
          setFormData({
            name: user.name || user.ten || '',
            phone: user.phone || user.soDienThoai || '',
            role: userRole,
            chucVu: getSafeChucVuForRole(userRole, user.chucVu),
            toaNhaIds: user.toaNhaIds?.length ? user.toaNhaIds : (user.toaNhaId ? [user.toaNhaId] : []),
          });
        } else {
          toast.error('Không tìm thấy tài khoản');
          router.push('/dashboard/quan-ly-tai-khoan');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
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
      if (u.id === userId || u._id === userId) return false;
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
    try {
      setSubmitting(true);
      const safeChucVu = getSafeChucVuForRole(formData.role, formData.chucVu);
      const payload: Record<string, unknown> = { ...formData, chucVu: safeChucVu };
      if (!safeChucVu) delete payload.chucVu;
      if (formData.role === 'admin') {
        delete payload.toaNhaIds;
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || error.error || 'Cập nhật tài khoản thất bại');
        return;
      }
      toast.success('Cập nhật tài khoản thành công');
      router.push('/dashboard/quan-ly-tai-khoan');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Có lỗi xảy ra khi cập nhật tài khoản');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Đang tải thông tin tài khoản...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/quan-ly-tai-khoan')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Chỉnh sửa tài khoản</h1>
          <p className="text-sm text-gray-500">Cập nhật thông tin tài khoản: {formData.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin tài khoản</CardTitle>
          <CardDescription>Chỉnh sửa thông tin chi tiết cho tài khoản</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm">Họ và tên</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nhập họ và tên"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone" className="text-sm">Số điện thoại</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Nhập số điện thoại"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-sm">Vai trò</Label>
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
                <Label htmlFor="edit-chucVu" className="text-sm">Chức vụ</Label>
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
                {submitting ? 'Đang lưu...' : 'Cập nhật'}
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
