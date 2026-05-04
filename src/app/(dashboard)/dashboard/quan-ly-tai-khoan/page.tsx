'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getChucVuLabel,
  getChucVuOptionsForRole,
  getDefaultChucVuForRole,
  isChucVuAllowedForRole,
} from '@/lib/chuc-vu';
import {
  PageHeader,
  SearchInput,
  ConfirmPopover,
  InlineForm,
  InlineEditTable,
} from '@/components/dashboard';
import type { ColumnDef } from '@/components/dashboard';

interface Building {
  id: string;
  tenToaNha: string;
}

const ROLE_LABELS: Record<string, string> = {
  chuNha: 'Chủ trọ',
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
  admin: 'Quản trị viên',
};

function getRoleOptions(isAdmin: boolean) {
  if (isAdmin) {
    return [
      { value: 'chuNha', label: 'Chủ trọ' },
      { value: 'admin', label: 'Quản trị viên' },
    ];
  }
  return [
    { value: 'dongChuTro', label: 'Đồng chủ trọ' },
    { value: 'quanLy', label: 'Quản lý' },
    { value: 'nhanVien', label: 'Nhân viên' },
  ];
}

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

interface InlineEditUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  chucVu: string | null;
  avatar: string;
  isActive: boolean;
  createdAt: string;
  toaNhaIds: string[];
  buildingNames: string;
}

export default function AccountManagementPage() {
  const { data: session } = useSession();
  const cache = useCache<{ users: User[] }>({ key: 'tai-khoan-data', duration: 300000 });
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const hasFetchedRef = useRef(false);
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [canManageZaloPerms, setCanManageZaloPerms] = useState<Record<string, boolean>>({});

  // Inline create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'nhanVien',
    chucVu: 'nhanVienKiemToanBo',
    toaNhaIds: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    phone: string;
    role: string;
    chucVu: string;
    toaNhaIds: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

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
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getUserName = (user: User) => user.name || user.ten || 'Không có tên';
  const getUserPhone = (user: User) => user.phone || user.soDienThoai || '';
  const getUserRole = (user: User) => user.role || user.vaiTro || 'nhanVien';
  const getUserAvatar = (user: User) => user.avatar || user.anhDaiDien || '';
  const getUserIsActive = (user: User) =>
    user.isActive !== undefined ? user.isActive : user.trangThai === 'hoatDong';

  const getSafeChucVuForRole = (role: string, chucVu?: string | null) => {
    const options = getChucVuOptionsForRole(role);
    if (options.length === 0) return '';
    if (chucVu && isChucVuAllowedForRole(role, chucVu)) return chucVu;
    return getDefaultChucVuForRole(role) ?? options[0].value;
  };

  const getRoleLimitForBuilding = (toaNhaId: string, role: string): number => {
    const buildingLimits = perBuildingLimits[toaNhaId];
    if (buildingLimits && buildingLimits[role] != null) return buildingLimits[role];
    return globalLimits[role] ?? 0;
  };

  const filteredUsers = users.filter(user => {
    // Admin only sees chuNha and admin users
    if (isAdmin) {
      const role = getUserRole(user);
      if (role !== 'chuNha' && role !== 'admin') return false;
    }
    const keyword = searchTerm.toLowerCase();
    const chucVuLabel = getChucVuLabel(getSafeChucVuForRole(getUserRole(user), user.chucVu));
    return (
      (user.name || user.ten || '').toLowerCase().includes(keyword) ||
      (user.email || '').toLowerCase().includes(keyword) ||
      chucVuLabel.toLowerCase().includes(keyword) ||
      (user.soDienThoai || '').includes(keyword)
    );
  });

  const isAdmin = session?.user?.role === 'admin';
  const isChuNha = session?.user?.role === 'chuNha';
  const isDongChuTro = session?.user?.role === 'dongChuTro';
  const isQuanLy = session?.user?.role === 'quanLy';
  const quanLyReadOnly = isQuanLy && !Object.values(canManageZaloPerms).some(v => v === true);
  const canEdit = isAdmin || isChuNha || isDongChuTro || (isQuanLy && !quanLyReadOnly);

  // ─── Inline Create ─────────────────────────────────────

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: isAdmin ? 'chuNha' : 'nhanVien',
      chucVu: isAdmin ? '' : 'nhanVienKiemToanBo',
      toaNhaIds: [],
    });
  };

  const handleCreateUser = async () => {
    if (!createForm.name.trim()) {
      toast.error('Vui lòng nhập tên người dùng');
      return;
    }
    if (!createForm.email.trim()) {
      toast.error('Vui lòng nhập email');
      return;
    }
    if (!createForm.password) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }
    try {
      setCreating(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          password: createForm.password,
          phone: createForm.phone,
          role: createForm.role,
          chucVu: createForm.chucVu,
          toaNhaIds: createForm.toaNhaIds,
        }),
      });
      if (response.ok) {
        cache.clearCache();
        toast.success('Tạo tài khoản thành công');
        setShowCreateForm(false);
        resetCreateForm();
        fetchUsers(true);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Tạo tài khoản thất bại');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Có lỗi xảy ra khi tạo tài khoản');
    } finally {
      setCreating(false);
    }
  };

  // ─── Inline Edit ───────────────────────────────────────

  const handleEditUser = useCallback((item: InlineEditUser) => {
    const user = users.find(u => (u.id ?? u._id) === item.id);
    if (!user) return;
    const role = getUserRole(user);
    setEditForm({
      id: item.id,
      name: getUserName(user),
      phone: getUserPhone(user),
      role,
      chucVu: getSafeChucVuForRole(role, user.chucVu),
      toaNhaIds: user.toaNhaIds || [],
    });
    setExpandedId(item.id);
  }, [users]);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!editForm.name.trim()) {
      toast.error('Vui lòng nhập tên người dùng');
      return;
    }
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/users/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          role: editForm.role,
          chucVu: editForm.chucVu,
          toaNhaIds: editForm.toaNhaIds,
        }),
      });
      if (response.ok) {
        cache.clearCache();
        toast.success('Cập nhật tài khoản thành công');
        setExpandedId(null);
        setEditForm(null);
        fetchUsers(true);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Cập nhật tài khoản thất bại');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Có lỗi xảy ra khi cập nhật tài khoản');
    } finally {
      setSaving(false);
    }
  };

  // ─── Data transformation for InlineEditTable ───────────

  const buildingMap = useMemo(() => {
    const map: Record<string, string> = {};
    buildings.forEach(b => { map[b.id] = b.tenToaNha; });
    return map;
  }, [buildings]);

  const tableData = useMemo((): InlineEditUser[] => {
    return filteredUsers.map(user => {
      const id = user.id ?? user._id;
      const role = getUserRole(user);
      const chucVu = getSafeChucVuForRole(role, user.chucVu);
      const chucVuLabel = getChucVuLabel(chucVu);
      const buildingNames = (user.toaNhaIds || [])
        .map(bid => buildingMap[bid])
        .filter(Boolean)
        .join(', ');
      return {
        id,
        name: getUserName(user),
        email: user.email || '',
        phone: getUserPhone(user),
        role,
        chucVu: chucVuLabel,
        avatar: getUserAvatar(user),
        isActive: getUserIsActive(user),
        createdAt: user.createdAt || user.ngayTao || '',
        toaNhaIds: user.toaNhaIds || [],
        buildingNames,
      };
    });
  }, [filteredUsers]);

  const columns: ColumnDef<InlineEditUser>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Tên',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-indigo-100">
            <AvatarImage src={item.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs">
              {getInitials(item.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-gray-900 truncate max-w-[160px]">{item.name}</span>
              {item.chucVu && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 text-indigo-600 border-indigo-200 bg-indigo-50 whitespace-nowrap">
                  {item.chucVu}
                </Badge>
              )}
              <Badge
                className={`text-[10px] h-4 px-1 ${
                  item.isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white border-0'
                    : 'border-indigo-200 text-indigo-400 bg-indigo-50'
                }`}
              >
                {item.isActive ? 'Hoạt động' : 'Ngừng'}
              </Badge>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-gray-600 truncate block max-w-[200px]">{item.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'SĐT',
      sortable: true,
      render: (item) => (
        item.phone ? (
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <Phone className="h-3 w-3 text-indigo-400" />
            {item.phone}
          </span>
        ) : (
          <span className="text-sm text-gray-400">&mdash;</span>
        )
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      sortable: true,
      render: (item) => (
        <Badge variant="secondary" className="text-xs font-medium">
          {ROLE_LABELS[item.role] || item.role}
        </Badge>
      ),
    },
    {
      key: 'buildingNames',
      header: 'Tòa nhà',
      render: (item) => (
        <span className="text-sm text-gray-600 truncate block max-w-[180px]">
          {item.buildingNames || <span className="text-gray-400">Chưa gán</span>}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      sortable: true,
      render: (item) => {
        const d = new Date(item.createdAt);
        return (
          <span className="text-sm text-gray-500">
            {!isNaN(d.getTime()) ? d.toLocaleDateString('vi-VN') : '—'}
          </span>
        );
      },
    },
  ], []);

  // ─── Render expanded edit form ─────────────────────────

  const renderExpanded = useCallback((item: InlineEditUser) => {
    if (!editForm || editForm.id !== item.id) return null;

    const chucVuOptions = getChucVuOptionsForRole(editForm.role);
    const isCurrentUser = session?.user?.id === item.id;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-name-${item.id}`}>Tên người dùng</Label>
            <Input
              id={`edit-name-${item.id}`}
              value={editForm.name}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, name: e.target.value } : null)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-phone-${item.id}`}>Số điện thoại</Label>
            <Input
              id={`edit-phone-${item.id}`}
              value={editForm.phone}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, phone: e.target.value } : null)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-role-${item.id}`}>Vai trò</Label>
            <Select
              value={editForm.role}
              onValueChange={(value) => {
                setEditForm(prev => prev ? {
                  ...prev,
                  role: value,
                  chucVu: getDefaultChucVuForRole(value) ?? '',
                } : null);
              }}
              disabled={saving || isCurrentUser}
            >
              <SelectTrigger id={`edit-role-${item.id}`}>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                {getRoleOptions(isAdmin).map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {chucVuOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor={`edit-chucvu-${item.id}`}>Chức vụ</Label>
              <Select
                value={editForm.chucVu}
                onValueChange={(value) => setEditForm(prev => prev ? { ...prev, chucVu: value } : null)}
                disabled={saving}
              >
                <SelectTrigger id={`edit-chucvu-${item.id}`}>
                  <SelectValue placeholder="Chọn chức vụ" />
                </SelectTrigger>
                <SelectContent>
                  {chucVuOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Building assignment */}
        <div className="space-y-2">
          <Label>Gán tòa nhà</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3">
            {buildings.map(b => (
              <label
                key={b.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer hover:bg-indigo-50 transition-colors"
              >
                <Checkbox
                  checked={editForm.toaNhaIds.includes(b.id)}
                  onCheckedChange={(checked) => {
                    setEditForm(prev => {
                      if (!prev) return prev;
                      const newIds = checked
                        ? [...prev.toaNhaIds, b.id]
                        : prev.toaNhaIds.filter(id => id !== b.id);
                      return { ...prev, toaNhaIds: newIds };
                    });
                  }}
                  disabled={saving}
                />
                <span className="text-sm text-gray-700">{b.tenToaNha}</span>
              </label>
            ))}
            {buildings.length === 0 && (
              <p className="text-sm text-gray-400 col-span-full text-center py-2">Không có tòa nhà nào</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setExpandedId(null); setEditForm(null); }}
            disabled={saving}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Hủy
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSaveEdit}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>
    );
  }, [editForm, saving, buildings, session]);

  // ─── Render ────────────────────────────────────────────

  if (!isAdmin && !isChuNha && !isDongChuTro && !isQuanLy) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8">
          <Shield className="h-12 w-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-indigo-900 mb-2">Không có quyền truy cập</h2>
          <p className="text-indigo-600/70">Chỉ quản trị viên, chủ trọ, đồng chủ trọ hoặc quản lý mới truy cập được trang này.</p>
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
            : isAdmin
              ? 'Quản lý chủ trọ và quản trị viên. Các tài khoản khác do chủ trọ quản lý'
              : isChuNha || isDongChuTro
                ? 'Quản lý tài khoản đồng chủ trọ, quản lý và nhân viên'
                : isQuanLy
                  ? 'Quản lý tài khoản nhân viên'
                  : 'Quản lý người dùng, chức vụ và gán tòa nhà'
        }
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => setShowCreateForm(prev => !prev) : undefined}
        addLabel={showCreateForm ? 'Đóng' : 'Tạo tài khoản'}
      />

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Tạo tài khoản mới"
          description="Điền thông tin để tạo tài khoản người dùng mới"
          onSave={handleCreateUser}
          onCancel={() => { setShowCreateForm(false); resetCreateForm(); }}
          saving={creating}
          saveLabel="Tạo tài khoản"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Tên người dùng *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nhập tên"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Mật khẩu *</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Nhập mật khẩu"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Số điện thoại</Label>
              <Input
                id="create-phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Nhập số điện thoại"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Vai trò</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => {
                  setCreateForm(prev => ({
                    ...prev,
                    role: value,
                    chucVu: getDefaultChucVuForRole(value) ?? '',
                  }));
                }}
                disabled={creating}
              >
                <SelectTrigger id="create-role">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {getRoleOptions(isAdmin).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {getChucVuOptionsForRole(createForm.role).length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="create-chucvu">Chức vụ</Label>
                <Select
                  value={createForm.chucVu}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, chucVu: value }))}
                  disabled={creating}
                >
                  <SelectTrigger id="create-chucvu">
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {getChucVuOptionsForRole(createForm.role).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Building assignment */}
          <div className="space-y-2">
            <Label>Gán tòa nhà</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3">
              {buildings.map(b => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer hover:bg-indigo-50 transition-colors"
                >
                  <Checkbox
                    checked={createForm.toaNhaIds.includes(b.id)}
                    onCheckedChange={(checked) => {
                      setCreateForm(prev => ({
                        ...prev,
                        toaNhaIds: checked
                          ? [...prev.toaNhaIds, b.id]
                          : prev.toaNhaIds.filter(id => id !== b.id),
                      }));
                    }}
                    disabled={creating}
                  />
                  <span className="text-sm text-gray-700">{b.tenToaNha}</span>
                </label>
              ))}
              {buildings.length === 0 && (
                <p className="text-sm text-gray-400 col-span-full text-center py-2">Không có tòa nhà nào</p>
              )}
            </div>
          </div>
        </InlineForm>
      )}

      {/* Search */}
      <SearchInput
        placeholder="Tìm kiếm tên, email, SĐT, chức vụ..."
        value={searchTerm}
        onChange={setSearchTerm}
      />

      {/* User table */}
      <InlineEditTable
        data={tableData}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchTerm={searchTerm}
        loading={loading}
        emptyMessage="Không tìm thấy tài khoản nào"
        expandedId={expandedId}
        onToggleExpand={(id) => {
          if (id === expandedId) {
            setExpandedId(null);
            setEditForm(null);
          } else {
            const item = tableData.find(u => u.id === id);
            if (item) handleEditUser(item);
          }
        }}
        renderExpanded={renderExpanded}
        onEdit={canEdit ? (item) => handleEditUser(item) : undefined}
        onDelete={canEdit ? (item) => handleDeleteUser(item.id) : undefined}
      />
    </div>
  );
}
