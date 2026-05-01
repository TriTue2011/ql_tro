'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  getChucVuLabel,
  getChucVuOptionsForRole,
  getDefaultChucVuForRole,
  isChucVuAllowedForRole,
} from '@/lib/chuc-vu';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
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

export default function AccountManagementPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const cache = useCache<{ users: User[] }>({ key: 'tai-khoan-data', duration: 300000 });
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const hasFetchedRef = useRef(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [canManageZaloPerms, setCanManageZaloPerms] = useState<Record<string, boolean>>({});

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
        onAdd={canEdit ? () => router.push('/dashboard/quan-ly-tai-khoan/them-moi') : undefined}
        addLabel="Tạo tài khoản"
      />

      {/* Search */}
      <SearchInput
        placeholder="Tìm kiếm tên, email..."
        value={searchTerm}
        onChange={setSearchTerm}
      />

      {/* User list grouped by building */}
      <div className="space-y-4">
        {(() => {
          const renderUserRow = (user: User, buildingId?: string, roleKey?: string) => {
            const isCurrentUser = session?.user?.id === user.id;
            const chucVuLabel = getChucVuLabel(user.chucVu);
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
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/dashboard/quan-ly-tai-khoan/${user.id}`)}>
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
              <div key={key} className="border rounded-xl overflow-hidden">
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

          // Users without any building assignment
          const unassignedUsers = filteredUsers.filter(u => {
            const role = getUserRole(u);
            if (role === 'admin') return false; // admin handled separately
            return !(u.toaNhaIds || []).some(id => buildings.some(b => b.id === id));
          });

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

              {unassignedUsers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-500 shrink-0" />
                    <h3 className="font-semibold text-gray-800">Chưa phân công</h3>
                  </div>
                  <div className="ml-6">
                    {renderSection('unassigned', 'Người dùng chưa gán tòa nhà', unassignedUsers)}
                  </div>
                </div>
              )}

              {buildingGroups.length === 0 && adminUsers.length === 0 && unassignedUsers.length === 0 && (
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
