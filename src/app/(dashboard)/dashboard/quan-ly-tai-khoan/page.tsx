'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Search,
  Edit,
  Trash2,
  Shield,
  Phone,
  Calendar,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

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
  quyenKichHoatTaiKhoan?: boolean;
  nguoiTaoTen?: string | null;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  toaNhaId: string;
  toaNhaIds: string[];
  quyenKichHoatTaiKhoan: boolean;
}

export default function AccountManagementPage() {
  const { data: session } = useSession();
  const cache = useCache<{ users: User[] }>({ key: 'tai-khoan-data', duration: 300000 });
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const hasFetchedRef = useRef(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'nhanVien',
    toaNhaId: '',
    toaNhaIds: [],
    quyenKichHoatTaiKhoan: false,
  });
  const [editUserData, setEditUserData] = useState({
    name: '',
    phone: '',
    role: '',
    isActive: true,
    zaloChatId: '',
    toaNhaId: '',
    toaNhaIds: [] as string[],
    quyenKichHoatTaiKhoan: false,
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = 'Quản lý Tài khoản';
  }, []);

  useEffect(() => {
    const role = session?.user?.role;
    const canAccess = role === 'admin' || role === 'chuNha' || role === 'dongChuTro';
    if (canAccess && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUsers(false);
      fetchBuildings();
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
    try {
      const payload: Record<string, unknown> = { ...createUserData };
      if (createUserData.role === 'admin') { delete payload.toaNhaId; delete payload.toaNhaIds; }
      else {
        delete payload.toaNhaId; // luôn dùng toaNhaIds cho mọi vai trò không phải admin
        if (!createUserData.toaNhaIds.length) delete payload.toaNhaIds;
      }
      delete payload.quyenKichHoatTaiKhoan; // cập nhật quyền sau khi tạo user xong
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json().catch(() => null);
      if (response.ok) {
        // Nếu là quanLy + có bật quyền → gọi API quyen cho từng tòa nhà
        if (createUserData.role === 'quanLy' && createUserData.quyenKichHoatTaiKhoan && createUserData.toaNhaIds.length > 0) {
          const newId = responseData?.id;
          if (newId) {
            await Promise.all(createUserData.toaNhaIds.map(tid =>
              fetch(`/api/admin/users/${newId}/quyen`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toaNhaId: tid, quyenKichHoatTaiKhoan: true }),
              })
            ));
          }
        }
        toast.success('Tạo tài khoản thành công');
        setIsCreateDialogOpen(false);
        setCreateUserData({ name: '', email: '', password: '', phone: '', role: 'nhanVien', toaNhaId: '', toaNhaIds: [], quyenKichHoatTaiKhoan: false });
        cache.clearCache();
        fetchUsers(true);
      } else {
        toast.error(responseData?.message || responseData?.error || 'Tạo tài khoản thất bại');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Có lỗi xảy ra khi tạo tài khoản');
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    try {
      const payload: Record<string, unknown> = { ...editUserData };
      if (editUserData.role === 'admin') { delete payload.toaNhaId; delete payload.toaNhaIds; }
      else { delete payload.toaNhaId; } // luôn dùng toaNhaIds cho mọi vai trò không phải admin
      delete payload.quyenKichHoatTaiKhoan; // quyền cập nhật riêng bên dưới
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

      // Cập nhật quyền kích hoạt tài khoản cho từng tòa nhà (chỉ khi là quanLy)
      if (editUserData.role === 'quanLy' && editUserData.toaNhaIds.length > 0) {
        const results = await Promise.all(editUserData.toaNhaIds.map(tid =>
          fetch(`/api/admin/users/${selectedUser.id}/quyen`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toaNhaId: tid, quyenKichHoatTaiKhoan: editUserData.quyenKichHoatTaiKhoan }),
          })
        ));
        const failed = results.find(r => !r.ok);
        if (failed) {
          const err = await failed.json();
          toast.error(err.error || 'Không thể cập nhật quyền');
          return;
        }
      }

      toast.success('Cập nhật tài khoản thành công');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      cache.clearCache();
      fetchUsers(true);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Có lỗi xảy ra khi cập nhật tài khoản');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
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

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditUserData({
      name: getUserName(user),
      phone: getUserPhone(user),
      role: getUserRole(user),
      isActive: getUserIsActive(user),
      zaloChatId: user.zaloChatId || '',
      toaNhaId: user.toaNhaId || '',
      toaNhaIds: user.toaNhaIds?.length ? user.toaNhaIds : (user.toaNhaId ? [user.toaNhaId] : []),
      quyenKichHoatTaiKhoan: user.quyenKichHoatTaiKhoan ?? false,
    });
    setIsEditDialogOpen(true);
  };

  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Quản trị viên</Badge>;
      case 'chuNha':
        return <Badge variant="default" className="bg-blue-600">Chủ trọ</Badge>;
      case 'dongChuTro':
        return <Badge variant="default" className="bg-teal-600">Đồng chủ trọ</Badge>;
      case 'quanLy':
        return <Badge variant="outline" className="border-violet-400 text-violet-600">Quản lý</Badge>;
      case 'nhanVien':
        return <Badge variant="secondary">Nhân viên</Badge>;
      default:
        return <Badge variant="outline">Người dùng</Badge>;
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

  const filteredUsers = users.filter(user =>
    (user.name || user.ten || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = session?.user?.role === 'admin';
  const isChuNha = session?.user?.role === 'chuNha';
  const isDongChuTro = session?.user?.role === 'dongChuTro';

  if (!isAdmin && !isChuNha && !isDongChuTro) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-600">Chỉ quản trị viên hoặc chủ trọ mới truy cập được trang này.</p>
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">
            Quản lý tài khoản
          </h1>
          <p className="text-xs md:text-sm text-gray-600">
            {isChuNha || isDongChuTro ? 'Quản lý tài khoản đồng chủ trọ, quản lý và nhân viên' : 'Quản lý người dùng và phân quyền hệ thống'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={cache.isRefreshing}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${cache.isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{cache.isRefreshing ? 'Đang tải...' : 'Tải mới'}</span>
          </Button>
          {(isAdmin || isChuNha || isDongChuTro) && (
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Tạo tài khoản</span>
              <span className="sm:hidden">Tạo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-[425px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Tạo tài khoản mới</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Tạo tài khoản người dùng mới cho hệ thống
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 grid gap-3 md:gap-4 py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs md:text-sm">Họ và tên</Label>
              <Input
                id="name"
                value={createUserData.name}
                onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                placeholder="Nhập họ và tên"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs md:text-sm">
                Số điện thoại <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                value={createUserData.phone}
                onChange={(e) => setCreateUserData({ ...createUserData, phone: e.target.value })}
                placeholder="Nhập số điện thoại (dùng để đăng nhập)"
                className="text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs md:text-sm">
                Email <span className="text-muted-foreground text-[10px]">(tùy chọn)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={createUserData.email}
                onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                placeholder="Nhập email (không bắt buộc)"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs md:text-sm">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={createUserData.password}
                onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                placeholder="Nhập mật khẩu"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs md:text-sm">Vai trò</Label>
              <Select
                value={createUserData.role}
                onValueChange={(value) => setCreateUserData({ ...createUserData, role: value, toaNhaId: '', toaNhaIds: [] })}
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
            {createUserData.role !== 'admin' && (
              <div className="space-y-2">
                <Label className="text-xs md:text-sm flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  Gán tòa nhà
                </Label>
                <div className="border rounded-md p-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {buildings.length === 0 && <p className="text-xs text-muted-foreground">Chưa có tòa nhà</p>}
                  {buildings.map(b => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <Checkbox
                        checked={createUserData.toaNhaIds.includes(b.id)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...createUserData.toaNhaIds, b.id]
                            : createUserData.toaNhaIds.filter(id => id !== b.id);
                          setCreateUserData({ ...createUserData, toaNhaIds: next });
                        }}
                      />
                      <span className="text-sm">{b.tenToaNha}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Quyền hạn — chỉ hiện khi tạo quanLy + gán ít nhất 1 tòa nhà */}
            {createUserData.role === 'quanLy' && createUserData.toaNhaIds.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quyền hạn</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs md:text-sm font-medium">Kích hoạt tài khoản khách thuê</p>
                    <p className="text-[10px] text-muted-foreground">Cho phép tạo/thu hồi mật khẩu đăng nhập của khách thuê</p>
                  </div>
                  <Switch
                    checked={createUserData.quyenKichHoatTaiKhoan}
                    onCheckedChange={(v) => setCreateUserData({ ...createUserData, quyenKichHoatTaiKhoan: v })}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto">
              Hủy
            </Button>
            <Button size="sm" onClick={handleCreateUser} className="w-full sm:w-auto">
              Tạo tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Tìm kiếm tên, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 text-sm"
        />
      </div>

      {/* Grouped by building */}
      <div className="space-y-4">
        {(() => {
          const renderUserRow = (user: User) => {
            const isCurrentUser = session?.user?.id === user.id;
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
                      {(() => { const d = new Date(user.createdAt || user.ngayTao || ''); return !isNaN(d.getTime()) ? d.toLocaleDateString('vi-VN') : '—'; })()}
                    </span>
                  </div>
                </div>
                {!isCurrentUser && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(user)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteUser(user.id ?? user._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          };

          const renderSection = (key: string, label: string, users: User[]) => {
            if (users.length === 0) return null;
            const isOpen = !!openSections[key];
            return (
              <div key={key} className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
                  onClick={() => toggleSection(key)}
                >
                  <span className="text-sm font-medium text-gray-700">
                    {label} <span className="text-gray-400 font-normal">({users.length})</span>
                  </span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                </button>
                {isOpen && (
                  <div className="divide-y divide-gray-100 px-1">
                    {users.map(renderUserRow)}
                  </div>
                )}
              </div>
            );
          };

          // Nhóm theo tòa nhà
          const buildingGroups = buildings.map(b => ({
            building: b,
            chuTro: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && ['chuNha', 'dongChuTro'].includes(getUserRole(u))),
            quanLy: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && getUserRole(u) === 'quanLy'),
            nhanVien: filteredUsers.filter(u => (u.toaNhaIds || []).includes(b.id) && getUserRole(u) === 'nhanVien'),
          })).filter(g => g.chuTro.length + g.quanLy.length + g.nhanVien.length > 0);

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
                    {renderSection(`${g.building.id}-chuTro`, 'Chủ trọ', g.chuTro)}
                    {renderSection(`${g.building.id}-quanLy`, 'Quản lý', g.quanLy)}
                    {renderSection(`${g.building.id}-nhanVien`, 'Nhân viên', g.nhanVien)}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-[425px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Chỉnh sửa tài khoản</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Cập nhật thông tin tài khoản người dùng
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 grid gap-3 md:gap-4 py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-xs md:text-sm">Họ và tên</Label>
              <Input
                id="edit-name"
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                placeholder="Nhập họ và tên"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone" className="text-xs md:text-sm">Số điện thoại</Label>
              <Input
                id="edit-phone"
                value={editUserData.phone}
                onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })}
                placeholder="Nhập số điện thoại"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-xs md:text-sm">Vai trò</Label>
              <Select
                value={editUserData.role}
                onValueChange={(value) => setEditUserData({ ...editUserData, role: value, toaNhaId: '', toaNhaIds: [] })}
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
            {editUserData.role !== 'admin' && (
              <div className="space-y-2">
                <Label className="text-xs md:text-sm flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  Gán tòa nhà
                </Label>
                <div className="border rounded-md p-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {buildings.length === 0 && <p className="text-xs text-muted-foreground">Chưa có tòa nhà</p>}
                  {buildings.map(b => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <Checkbox
                        checked={editUserData.toaNhaIds.includes(b.id)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...editUserData.toaNhaIds, b.id]
                            : editUserData.toaNhaIds.filter(id => id !== b.id);
                          setEditUserData({ ...editUserData, toaNhaIds: next });
                        }}
                      />
                      <span className="text-sm">{b.tenToaNha}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Quyền hạn — chỉ hiện khi đang sửa quanLy và đã gán ít nhất 1 tòa nhà */}
            {editUserData.role === 'quanLy' && editUserData.toaNhaIds.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quyền hạn trao cho quản lý</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs md:text-sm font-medium">Kích hoạt tài khoản khách thuê</p>
                    <p className="text-[10px] text-muted-foreground">Cho phép quản lý tạo/thu hồi mật khẩu đăng nhập của khách thuê</p>
                  </div>
                  <Switch
                    checked={editUserData.quyenKichHoatTaiKhoan}
                    onCheckedChange={(v) => setEditUserData({ ...editUserData, quyenKichHoatTaiKhoan: v })}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
              Hủy
            </Button>
            <Button size="sm" onClick={handleEditUser} className="w-full sm:w-auto">
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
