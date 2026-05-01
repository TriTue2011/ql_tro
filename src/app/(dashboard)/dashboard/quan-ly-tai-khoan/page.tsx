'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Shield,
  Phone,
  Calendar,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getChucVuLabel,
  getChucVuOptionsForRole,
  getDefaultChucVuForRole,
  isChucVuAllowedForRole,
} from '@/lib/chuc-vu';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import ConfirmPopover from '@/components/dashboard/confirm-popover';

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
  zaloChatIds?: { ten: string; userId: string; threadId: string }[];
  nhanThongBaoZalo?: boolean;
  toaNhaId?: string | null;
  toaNhaTen?: string | null;
  toaNhaIds?: string[];
  nguoiTaoTen?: string | null;
  zaloViTri?: Record<string, number> | null;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  chucVu: string;
  toaNhaId: string;
  toaNhaIds: string[];
  zaloViTri: Record<string, number>;
}

export default function AccountManagementPage() {
  const { data: session } = useSession();
  const cache = useCache<{ users: User[] }>({ key: 'tai-khoan-data', duration: 300000 });
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const hasFetchedRef = useRef(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'nhanVien',
    chucVu: 'nhanVienKiemToanBo',
    toaNhaId: '',
    toaNhaIds: [],
    zaloViTri: {},
  });
  const [editUserData, setEditUserData] = useState({
    name: '',
    phone: '',
    role: '',
    chucVu: '',
    isActive: true,
    zaloChatId: '',
    toaNhaId: '',
    toaNhaIds: [] as string[],
    zaloViTri: {} as Record<string, number>,
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [canManageZaloPerms, setCanManageZaloPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const getSafeChucVuForRole = (role: string, chucVu?: string | null) => {
    const options = getChucVuOptionsForRole(role);
    if (options.length === 0) return '';
    if (chucVu && isChucVuAllowedForRole(role, chucVu)) return chucVu;
    return getDefaultChucVuForRole(role) ?? options[0].value;
  };

  const updateCreateRole = (role: string) => {
    setCreateUserData({
      ...createUserData,
      role,
      chucVu: getSafeChucVuForRole(role, ''),
      toaNhaId: '',
      toaNhaIds: [],
      zaloViTri: {},
    });
  };

  const updateEditRole = (role: string) => {
    setEditUserData({
      ...editUserData,
      role,
      chucVu: getSafeChucVuForRole(role, ''),
      toaNhaId: '',
      toaNhaIds: [],
      zaloViTri: {},
    });
  };

  const getRoleCountPerBuilding = (buildingId: string, role: string, excludeUserId?: string) => {
    return users.filter(u => {
      if (excludeUserId && (u.id === excludeUserId || u._id === excludeUserId)) return false;
      return getUserRole(u) === role && (u.toaNhaIds || []).includes(buildingId);
    }).length;
  };

  const getRoleLimitForBuilding = (toaNhaId: string, role: string): number => {
    const buildingLimits = perBuildingLimits[toaNhaId];
    if (buildingLimits && buildingLimits[role] != null) return buildingLimits[role];
    return globalLimits[role] ?? 0;
  };

  const checkRoleLimitExceeded = (toaNhaIds: string[], role: string, excludeUserId?: string): string | null => {
    for (const tid of toaNhaIds) {
      const max = getRoleLimitForBuilding(tid, role);
      if (!max) continue;
      const count = getRoleCountPerBuilding(tid, role, excludeUserId);
      if (count >= max) {
        const building = buildings.find(b => b.id === tid);
        return `Tòa nhà "${building?.tenToaNha || tid}" đã đạt giới hạn ${max} ${ROLE_LABELS[role] || role}`;
      }
    }
    return null;
  };

  useEffect(() => {
    document.title = 'Quản lý Tài khoản';
  }, []);

  useEffect(() => {
    const role = session?.user?.role;
    const canAccess = role === 'admin' || role === 'chuNha' || role === 'dongChuTro' || role === 'quanLy';
    if (canAccess && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUsers(false);
      fetchBuildings();
      fetchRoleLimits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role]);

  const fetchBuildings = async () => {
    try {
      const res = await fetch('/api/toa-nha?limit=100');
      if (res.ok) {
        const data = await res.json();
        setBuildings(data.data || []);
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

  const getTakenSlots = (buildingId: string, role: string, excludeUserId?: string): Map<number, User> => {
    const map = new Map<number, User>();
    users.forEach(u => {
      if (excludeUserId && (u.id === excludeUserId || u._id === excludeUserId)) return;
      if (getUserRole(u) !== role) return;
      if (!(u.toaNhaIds || []).includes(buildingId)) return;
      const slot = (u.zaloViTri as Record<string, number> | null | undefined)?.[buildingId];
      if (typeof slot === 'number') map.set(slot, u);
    });
    return map;
  };

  useEffect(() => {
    const role = session?.user?.role;
    if (role === 'admin' || !role) return;
    if (buildings.length === 0) return;
    (async () => {
      const result: Record<string, boolean> = {};
      for (const b of buildings) {
        try {
          const res = await fetch(`/api/admin/zalo-quyen?toaNhaId=${b.id}`);
          const data = await res.json();
          if (data.ok && data.effective) {
            const matchingKeys = Object.keys(data.effective).filter(k => k === role || k.startsWith(`${role}_`));
            if (matchingKeys.length > 0) {
              const allowed = matchingKeys.some(k => data.effective[k]?.quanLyQuyen !== false);
              result[b.id] = allowed;
            } else {
              result[b.id] = true;
            }
          } else {
            result[b.id] = true;
          }
        } catch { result[b.id] = true; }
      }
      setCanManageZaloPerms(result);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role, buildings.length]);

  const fetchUsers = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setUsers(cachedData.users || []);
          setLoading(false);
          return;
        }
      }
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        cache.setCache({ users: data });
      } else {
        toast.error('Không thể tải danh sách người dùng');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Có lỗi xảy ra khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchUsers(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  const handleCreateUser = async () => {
    if (!createUserData.phone?.trim() && !createUserData.email?.trim()) {
      toast.error('Cần nhập ít nhất số điện thoại hoặc email');
      return;
    }
    if (createUserData.role !== 'admin' && createUserData.toaNhaIds.length > 0) {
      const limitError = checkRoleLimitExceeded(createUserData.toaNhaIds, createUserData.role);
      if (limitError) {
        toast.error(limitError);
        return;
      }
    }
    try {
      setSaving(true);
      const safeChucVu = getSafeChucVuForRole(createUserData.role, createUserData.chucVu);
      const payload: Record<string, unknown> = { ...createUserData, chucVu: safeChucVu };
      if (!safeChucVu) delete payload.chucVu;
      if (createUserData.role === 'admin') { delete payload.toaNhaId; delete payload.toaNhaIds; }
      else {
        delete payload.toaNhaId;
        if (!createUserData.toaNhaIds.length) delete payload.toaNhaIds;
      }
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json().catch(() => null);
      if (response.ok) {
        toast.success('Tạo tài khoản thành công');
        setShowCreateForm(false);
        setCreateUserData({ name: '', email: '', password: '', phone: '', role: 'nhanVien', chucVu: 'nhanVienKiemToanBo', toaNhaId: '', toaNhaIds: [], zaloViTri: {} });
        cache.clearCache();
        fetchUsers(true);
      } else {
        toast.error(responseData?.message || responseData?.error || 'Tạo tài khoản thất bại');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Có lỗi xảy ra khi tạo tài khoản');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    if (editUserData.role !== 'admin' && editUserData.toaNhaIds.length > 0) {
      const limitError = checkRoleLimitExceeded(editUserData.toaNhaIds, editUserData.role, selectedUser.id ?? selectedUser._id);
      if (limitError) {
        toast.error(limitError);
        return;
      }
    }
    try {
      setSaving(true);
      const safeChucVu = getSafeChucVuForRole(editUserData.role, editUserData.chucVu);
      const payload: Record<string, unknown> = { ...editUserData, chucVu: safeChucVu };
      if (!safeChucVu) delete payload.chucVu;
      if (editUserData.role === 'admin') { delete payload.toaNhaId; delete payload.toaNhaIds; }
      else { delete payload.toaNhaId; }
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
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
      setShowEditForm(false);
      setSelectedUser(null);
      cache.clearCache();
      fetchUsers(true);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Có lỗi xảy ra khi cập nhật tài khoản');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (response.ok) {
        cache.clearCache();
        toast.success('Xóa tài khoản thành công');
        fetchUsers(true);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Xóa tài khoản thất bại');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Có lỗi xảy ra khi xóa tài khoản');
    } finally {
      setDeleteTarget(null);
    }
  };

  const openEditForm = (user: User) => {
    setSelectedUser(user);
    setEditUserData({
      name: getUserName(user),
      phone: getUserPhone(user),
      role: getUserRole(user),
      chucVu: getSafeChucVuForRole(getUserRole(user), user.chucVu),
      isActive: getUserIsActive(user),
      zaloChatId: user.zaloChatId || '',
      toaNhaId: user.toaNhaId || '',
      toaNhaIds: user.toaNhaIds?.length ? user.toaNhaIds : (user.toaNhaId ? [user.toaNhaId] : []),
      zaloViTri: (() => {
        const raw = (user.zaloViTri as Record<string, number>) || {};
        const result: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) { if (v) result[k] = Number(v); }
        return result;
      })(),
    });
    setShowEditForm(true);
  };

  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getUserName = (user: User) => user.name || user.ten || 'Không có tên';
  const getUserPhone = (user: User) => user.phone || user.soDienThoai || '';
  const getUserRole = (user: User) => user.role || user.vaiTro || 'nhanVien';
  const getUserChucVuLabel = (user: User) => {
    const safeChucVu = getSafeChucVuForRole(getUserRole(user), user.chucVu);
    return safeChucVu ? getChucVuLabel(safeChucVu) : '';
  };
  const getUserAvatar = (user: User) => user.avatar || user.anhDaiDien || '';
  const getUserIsActive = (user: User) =>
    user.isActive !== undefined ? user.isActive : user.trangThai === 'hoatDong';

  const filteredUsers = users.filter(user => {
    const keyword = searchTerm.toLowerCase();
    return (
      (user.name || user.ten || '').toLowerCase().includes(keyword) ||
      (user.email || '').toLowerCase().includes(keyword) ||
      getUserChucVuLabel(user).toLowerCase().includes(keyword)
    );
  });

  const isAdmin = session?.user?.role === 'admin';
  const isChuNha = session?.user?.role === 'chuNha';
  const isDongChuTro = session?.user?.role === 'dongChuTro';
  const isQuanLy = session?.user?.role === 'quanLy';
  const quanLyReadOnly = isQuanLy && !Object.values(canManageZaloPerms).some(v => v === true);
  const canEdit = isAdmin || isChuNha || isDongChuTro || (isQuanLy && !quanLyReadOnly);

  if (!isAdmin && !isChuNha && !isDongChuTro && !isQuanLy) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-600">Chỉ quản trị viên, chủ trọ, đồng chủ trọ hoặc quản lý mới truy cập được trang này.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải danh sách người dùng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Quản lý tài khoản${quanLyReadOnly ? ' (chỉ xem)' : ''}`}
        description={
          quanLyReadOnly
            ? 'Bạn chỉ có quyền xem, không thể chỉnh sửa'
            : isChuNha || isDongChuTro
              ? 'Quản lý tài khoản đồng chủ trọ, quản lý và nhân viên'
              : isQuanLy
                ? 'Quản lý tài khoản nhân viên'
                : 'Quản lý người dùng, chức vụ và gán tòa nhà'
        }
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Tạo tài khoản"
      />

      {/* Search */}
      <SearchInput
        placeholder="Tìm kiếm tên, email..."
        value={searchTerm}
        onChange={setSearchTerm}
      />

      {/* Create Inline Form */}
      {showCreateForm && (
        <InlineForm
          title="Tạo tài khoản mới"
          description="Tạo tài khoản người dùng mới cho hệ thống"
          onSave={handleCreateUser}
          onCancel={() => setShowCreateForm(false)}
          saving={saving}
          saveLabel="Tạo tài khoản"
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Họ và tên</Label>
              <Input
                id="name"
                value={createUserData.name}
                onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
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
                value={createUserData.phone}
                onChange={(e) => setCreateUserData({ ...createUserData, phone: e.target.value })}
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
                value={createUserData.email}
                onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                placeholder="Tùy chọn nếu đã có SĐT"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Mật khẩu
                {['quanLy', 'nhanVien', 'dongChuTro'].includes(createUserData.role) && (
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">(không bắt buộc)</span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                value={createUserData.password}
                onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                placeholder={['quanLy', 'nhanVien', 'dongChuTro'].includes(createUserData.role) ? 'Để trống nếu không cần đăng nhập web' : 'Nhập mật khẩu'}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm">Vai trò</Label>
              <Select
                value={createUserData.role}
                onValueChange={updateCreateRole}
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
            {getChucVuOptionsForRole(createUserData.role).length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="chucVu" className="text-sm">Chức vụ</Label>
                <Select
                  value={getSafeChucVuForRole(createUserData.role, createUserData.chucVu)}
                  onValueChange={(value) => setCreateUserData({ ...createUserData, chucVu: value })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {getChucVuOptionsForRole(createUserData.role).map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {createUserData.role !== 'admin' && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  Gán tòa nhà
                </Label>
                <div className="border rounded-md p-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {buildings.length === 0 && <p className="text-xs text-muted-foreground">Chưa có tòa nhà</p>}
                  {buildings.map(b => {
                    const max = getRoleLimitForBuilding(b.id, createUserData.role);
                    const currentCount = max ? getRoleCountPerBuilding(b.id, createUserData.role) : 0;
                    const isAtLimit = max ? currentCount >= max : false;
                    const isChecked = createUserData.toaNhaIds.includes(b.id);
                    return (
                      <label key={b.id} className={`flex items-center gap-2 py-0.5 ${isAtLimit && !isChecked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <Checkbox
                          checked={isChecked}
                          disabled={isAtLimit && !isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...createUserData.toaNhaIds, b.id]
                              : createUserData.toaNhaIds.filter(id => id !== b.id);
                            setCreateUserData({ ...createUserData, toaNhaIds: next });
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
            {createUserData.role !== 'admin' && createUserData.toaNhaIds.length > 0 && (
              <div className="space-y-2">
                {createUserData.toaNhaIds.map(tid => {
                  const limit = getRoleLimitForBuilding(tid, createUserData.role);
                  if (limit <= 1) return null;
                  const bName = buildings.find(b => b.id === tid)?.tenToaNha || tid;
                  const taken = getTakenSlots(tid, createUserData.role);
                  return (
                    <div key={tid} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{bName} — Vị trí</Label>
                      <Select
                        value={String(createUserData.zaloViTri[tid] || '')}
                        onValueChange={(v) => setCreateUserData({ ...createUserData, zaloViTri: { ...createUserData.zaloViTri, [tid]: parseInt(v) } })}
                      >
                        <SelectTrigger className="text-sm h-8">
                          <SelectValue placeholder="Chọn vị trí" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: limit }, (_, i) => {
                            const n = i + 1;
                            const takenBy = taken.get(n);
                            return (
                              <SelectItem key={n} value={String(n)} disabled={!!takenBy}>
                                {ROLE_LABELS[createUserData.role] || createUserData.role} {n} {takenBy ? `(${getUserName(takenBy)})` : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </InlineForm>
      )}

      {/* Edit Inline Form */}
      {showEditForm && selectedUser && (
        <InlineForm
          title={`Chỉnh sửa tài khoản: ${getUserName(selectedUser)}`}
          description="Cập nhật thông tin tài khoản người dùng"
          onSave={handleEditUser}
          onCancel={() => { setShowEditForm(false); setSelectedUser(null); }}
          saving={saving}
          saveLabel="Cập nhật"
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm">Họ và tên</Label>
              <Input
                id="edit-name"
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                placeholder="Nhập họ và tên"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone" className="text-sm">Số điện thoại</Label>
              <Input
                id="edit-phone"
                value={editUserData.phone}
                onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })}
                placeholder="Nhập số điện thoại"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-sm">Vai trò</Label>
              <Select
                value={editUserData.role}
                onValueChange={updateEditRole}
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
            {getChucVuOptionsForRole(editUserData.role).length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-chucVu" className="text-sm">Chức vụ</Label>
                <Select
                  value={getSafeChucVuForRole(editUserData.role, editUserData.chucVu)}
                  onValueChange={(value) => setEditUserData({ ...editUserData, chucVu: value })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {getChucVuOptionsForRole(editUserData.role).map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editUserData.role !== 'admin' && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  Gán tòa nhà
                </Label>
                <div className="border rounded-md p-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {buildings.length === 0 && <p className="text-xs text-muted-foreground">Chưa có tòa nhà</p>}
                  {buildings.map(b => {
                    const max = getRoleLimitForBuilding(b.id, editUserData.role);
                    const excludeId = selectedUser?.id ?? selectedUser?._id;
                    const currentCount = max ? getRoleCountPerBuilding(b.id, editUserData.role, excludeId) : 0;
                    const isAtLimit = max ? currentCount >= max : false;
                    const isChecked = editUserData.toaNhaIds.includes(b.id);
                    return (
                      <label key={b.id} className={`flex items-center gap-2 py-0.5 ${isAtLimit && !isChecked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <Checkbox
                          checked={isChecked}
                          disabled={isAtLimit && !isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...editUserData.toaNhaIds, b.id]
                              : editUserData.toaNhaIds.filter(id => id !== b.id);
                            setEditUserData({ ...editUserData, toaNhaIds: next });
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
            {editUserData.role !== 'admin' && editUserData.toaNhaIds.length > 0 && (
              <div className="space-y-2">
                {editUserData.toaNhaIds.map(tid => {
                  const limit = getRoleLimitForBuilding(tid, editUserData.role);
                  if (limit <= 1) return null;
                  const bName = buildings.find(b => b.id === tid)?.tenToaNha || tid;
                  const taken = getTakenSlots(tid, editUserData.role, selectedUser?.id ?? selectedUser?._id);
                  return (
                    <div key={tid} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{bName} — Vị trí</Label>
                      <Select
                        value={String(editUserData.zaloViTri[tid] || '')}
                        onValueChange={(v) => setEditUserData({ ...editUserData, zaloViTri: { ...editUserData.zaloViTri, [tid]: parseInt(v) } })}
                      >
                        <SelectTrigger className="text-sm h-8">
                          <SelectValue placeholder="Chọn vị trí" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: limit }, (_, i) => {
                            const n = i + 1;
                            const takenBy = taken.get(n);
                            return (
                              <SelectItem key={n} value={String(n)} disabled={!!takenBy}>
                                {ROLE_LABELS[editUserData.role] || editUserData.role} {n} {takenBy ? `(${getUserName(takenBy)})` : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </InlineForm>
      )}

      {/* User list grouped by building */}
      <div className="space-y-4">
        {(() => {
          const renderUserRow = (user: User, buildingId?: string, roleKey?: string) => {
            const isCurrentUser = session?.user?.id === user.id;
            const slotNum = buildingId && user.zaloViTri ? (user.zaloViTri as Record<string, number>)[buildingId] : null;
            const limit = buildingId && roleKey ? getRoleLimitForBuilding(buildingId, roleKey) : 0;
            const slotLabel = slotNum && roleKey && limit > 1 ? `${ROLE_LABELS[roleKey] || roleKey} ${slotNum}` : null;
            const chucVuLabel = getUserChucVuLabel(user);
            return (
              <div key={user.id ?? user._id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={getUserAvatar(user)} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                    {getInitials(getUserName(user))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 truncate">{getUserName(user)}</span>
                    {slotLabel && <Badge variant="outline" className="text-[10px] h-4 px-1 text-blue-600 border-blue-200 bg-blue-50">{slotLabel}</Badge>}
                    {chucVuLabel && <Badge variant="outline" className="text-[10px] h-4 px-1 text-emerald-700 border-emerald-200 bg-emerald-50">{chucVuLabel}</Badge>}
                    {isCurrentUser && <Badge variant="outline" className="text-[10px] h-4 px-1">Bạn</Badge>}
                    <Badge variant={getUserIsActive(user) ? 'default' : 'secondary'} className="text-[10px] h-4 px-1">
                      {getUserIsActive(user) ? 'Hoạt động' : 'Ngừng'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                    {user.email && <span className="truncate">{user.email}</span>}
                    {getUserPhone(user) && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{getUserPhone(user)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {(() => { const d = new Date(user.createdAt || user.ngayTao || ''); return !isNaN(d.getTime()) ? d.toLocaleDateString('vi-VN') : '&mdash;'; })()}
                    </span>
                  </div>
                </div>
                {!isCurrentUser && !quanLyReadOnly && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(user)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmPopover
                      title="Xóa tài khoản"
                      message={`Bạn có chắc chắn muốn xóa tài khoản "${getUserName(user)}"?`}
                      onConfirm={() => handleDeleteUser(user.id ?? user._id)}
                      variant="danger"
                    >
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </ConfirmPopover>
                  </div>
                )}
              </div>
            );
          };

          const renderSection = (key: string, label: string, sectionUsers: User[], roleKey?: string, buildingId?: string) => {
            if (sectionUsers.length === 0 && !(isAdmin || isChuNha)) return null;
            const isOpen = !!openSections[key];
            const limit = roleKey && buildingId ? getRoleLimitForBuilding(buildingId, roleKey) : null;

            return (
              <div key={key} className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
                  onClick={() => toggleSection(key)}
                >
                  <span className="text-sm font-medium text-gray-700">
                    {label} <span className="text-gray-400 font-normal">({sectionUsers.length}{limit ? `/${limit}` : ''})</span>
                  </span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                </button>
                {isOpen && (
                  <div>
                    <div className="divide-y divide-gray-100 px-1">
                      {sectionUsers.map(u => renderUserRow(u, buildingId, roleKey))}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          const buildingGroups = buildings.map(b => ({
            building: b,
            chuNha: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && getUserRole(u) === 'chuNha'),
            dongChuTro: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && getUserRole(u) === 'dongChuTro'),
            quanLy: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && getUserRole(u) === 'quanLy'),
            nhanVien: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && getUserRole(u) === 'nhanVien'),
          })).filter(g => g.chuNha.length + g.dongChuTro.length + g.quanLy.length + g.nhanVien.length > 0);

          const adminUsers = filteredUsers.filter(u => getUserRole(u) === 'admin');

          return (
            <>
              {buildingGroups.map(g => (
                <div key={g.building.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <h3 className="font-semibold text-gray-800">{g.building.tenToaNha}</h3>
                  </div>
                  <div className="ml-6 space-y-1.5">
                    {renderSection(`${g.building.id}-chuNha`, 'Chủ trọ', g.chuNha, 'chuNha', g.building.id)}
                    {renderSection(`${g.building.id}-dongChuTro`, 'Đồng chủ trọ', g.dongChuTro, 'dongChuTro', g.building.id)}
                    {renderSection(`${g.building.id}-quanLy`, 'Quản lý', g.quanLy, 'quanLy', g.building.id)}
                    {renderSection(`${g.building.id}-nhanVien`, 'Nhân viên', g.nhanVien, 'nhanVien', g.building.id)}
                  </div>
                </div>
              ))}

              {adminUsers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500 shrink-0" />
                    <h3 className="font-semibold text-gray-800">Hệ thống</h3>
                  </div>
                  <div className="ml-6">
                    {renderSection('admin', 'Quản trị viên', adminUsers)}
                  </div>
                </div>
              )}

              {buildingGroups.length === 0 && adminUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Không tìm thấy tài khoản nào</p>
                </div>
              )}
            </>
          );
        })()}
      </div>

    </div>
  );
}
