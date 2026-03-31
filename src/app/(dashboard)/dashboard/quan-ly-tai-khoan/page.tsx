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
  Settings,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface Building {
  id: string;
  tenToaNha: string;
}

// Nhãn vai trò
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
  quyenHopDong?: boolean;
  quyenHoaDon?: boolean;
  quyenThanhToan?: boolean;
  quyenSuCo?: boolean;
  nguoiTaoTen?: string | null;
  zaloViTri?: Record<string, number> | null; // { buildingId: slotNumber }
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  toaNhaId: string;
  toaNhaIds: string[];
  zaloViTri: Record<string, number>; // { buildingId: slotNumber }
  quyenKichHoatTaiKhoan: boolean;
  quyenHopDong: boolean;
  quyenHoaDon: boolean;
  quyenThanhToan: boolean;
  quyenSuCo: boolean;
}

const ZALO_FEATURES = [
  { key: 'botServer', label: 'Bot Server' },
  { key: 'trucTiep', label: 'Trực tiếp' },
  { key: 'proxy', label: 'Proxy' },
  { key: 'webhook', label: 'Webhook' },
  { key: 'tinTuDong', label: 'Tin tự động' },
  { key: 'testGui', label: 'Test gửi' },
  { key: 'ketBan', label: 'Kết bạn' },
  { key: 'theoDoiTin', label: 'Theo dõi tin' },
  { key: 'zaloMonitor', label: 'Zalo Monitor' },
  { key: 'quanLyQuyen', label: 'Quản lý quyền' },
];

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
    zaloViTri: {},
    quyenKichHoatTaiKhoan: false,
    quyenHopDong: false,
    quyenHoaDon: false,
    quyenThanhToan: false,
    quyenSuCo: false,
  });
  const [editUserData, setEditUserData] = useState({
    name: '',
    phone: '',
    role: '',
    isActive: true,
    zaloChatId: '',
    toaNhaId: '',
    toaNhaIds: [] as string[],
    zaloViTri: {} as Record<string, number>,
    quyenKichHoatTaiKhoan: false,
    quyenHopDong: false,
    quyenHoaDon: false,
    quyenThanhToan: false,
    quyenSuCo: false,
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  // Giới hạn dialog
  const [isLimitsDialogOpen, setIsLimitsDialogOpen] = useState(false);
  const [editGlobalLimits, setEditGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [editBuildingLimits, setEditBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [limitsSaving, setLimitsSaving] = useState(false);
  // Zalo permissions per building — { buildingId: { admin: {...}, chuNha: {...} } }
  const [zaloPerms, setZaloPerms] = useState<Record<string, { admin: Record<string, Record<string, boolean>>; chuNha: Record<string, Record<string, boolean>>; quanLy: Record<string, Record<string, boolean>> }>>({});
  const [zaloPermsSaving, setZaloPermsSaving] = useState<string | null>(null); // buildingId being saved
  // Per-building flag: can current user manage Zalo perms for subordinates?
  const [canManageZaloPerms, setCanManageZaloPerms] = useState<Record<string, boolean>>({});
  // Đếm số lượng vai trò đang có trên mỗi tòa nhà
  const getRoleCountPerBuilding = (buildingId: string, role: string, excludeUserId?: string) => {
    return users.filter(u => {
      if (excludeUserId && (u.id === excludeUserId || u._id === excludeUserId)) return false;
      return getUserRole(u) === role && (u.toaNhaIds || []).includes(buildingId);
    }).length;
  };

  // Lấy giới hạn role cho một tòa nhà cụ thể (ưu tiên per-building, fallback global)
  const getRoleLimitForBuilding = (toaNhaId: string, role: string): number => {
    const buildingLimits = perBuildingLimits[toaNhaId];
    if (buildingLimits && buildingLimits[role] != null) return buildingLimits[role];
    return globalLimits[role] ?? 0;
  };

  // Kiểm tra xem có vượt giới hạn vai trò trên tòa nhà nào không
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
    const canAccess = role === 'admin' || role === 'chuNha' || role === 'dongChuTro';
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

  const handleSaveLimits = async () => {
    if (!isAdmin) return;
    setLimitsSaving(true);
    try {
      const globalRes = await fetch('/api/admin/role-limits', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGlobalLimits),
      });
      if (!globalRes.ok) { const err = await globalRes.json(); toast.error(err.error || 'Lưu thất bại'); return; }
      for (const building of buildings) {
        const edited = editBuildingLimits[building.id];
        if (!edited) continue;
        await fetch('/api/admin/role-limits', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toaNhaId: building.id, ...edited }),
        });
      }
      await fetchRoleLimits();
      setIsLimitsDialogOpen(false);
      toast.success('Đã lưu giới hạn vai trò');
    } catch { toast.error('Không thể kết nối máy chủ'); }
    finally { setLimitsSaving(false); }
  };

  // Zalo permissions — 3 levels: admin, chuNha, quanLy
  const getMyLevel = (): 'admin' | 'chuNha' | 'quanLy' => {
    if (isAdmin) return 'admin';
    if (isChuNha) return 'chuNha';
    return 'quanLy';
  };

  const loadZaloPerms = async (toaNhaId: string) => {
    try {
      const res = await fetch(`/api/admin/zalo-quyen?toaNhaId=${toaNhaId}`);
      const data = await res.json();
      if (data.ok) {
        setZaloPerms(prev => ({ ...prev, [toaNhaId]: { admin: data.admin || {}, chuNha: data.chuNha || {}, quanLy: data.quanLy || {} } }));
      }
    } catch {}
  };

  const saveZaloPerms = async (toaNhaId: string) => {
    setZaloPermsSaving(toaNhaId);
    try {
      const level = getMyLevel();
      const perms = zaloPerms[toaNhaId]?.[level] || {};
      const res = await fetch('/api/admin/zalo-quyen', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId, level, permissions: perms }),
      });
      const data = await res.json();
      if (data.ok) toast.success('Đã lưu quyền Zalo');
      else toast.error(data.error || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
    finally { setZaloPermsSaving(null); }
  };

  const toggleZaloPerm = (toaNhaId: string, slotKey: string, featureKey: string, value: boolean) => {
    const level = getMyLevel();
    setZaloPerms(prev => {
      const bPerms = prev[toaNhaId] || { admin: {}, chuNha: {}, quanLy: {} };
      const defaults = Object.fromEntries(ZALO_FEATURES.map(f => [f.key, true]));
      return {
        ...prev,
        [toaNhaId]: {
          ...bPerms,
          [level]: {
            ...bPerms[level],
            [slotKey]: { ...defaults, ...(bPerms[level]?.[slotKey] || {}), [featureKey]: value },
          },
        },
      };
    });
  };

  // Get slot key for a role in a building
  const getSlotKey = (role: string, buildingId: string): string => {
    const limit = getRoleLimitForBuilding(buildingId, role);
    return limit <= 1 ? role : role; // for single, just use role name
  };

  // Get taken slots for a role in a building
  const getTakenSlots = (buildingId: string, role: string, excludeUserId?: string): Map<number, User> => {
    const map = new Map<number, User>();
    users.forEach(u => {
      if (excludeUserId && (u.id === excludeUserId || u._id === excludeUserId)) return;
      if (getUserRole(u) !== role) return;
      if (!(u.toaNhaIds || []).includes(buildingId)) return;
      const slot = (u.zaloViTri as any)?.[buildingId];
      if (typeof slot === 'number') map.set(slot, u);
    });
    return map;
  };

  // Check if current (non-admin) user has quanLyQuyen per building
  useEffect(() => {
    const role = session?.user?.role;
    if (role === 'admin' || !role) return;
    if (buildings.length === 0 || users.length === 0) return;
    const currentUser = users.find(u => u.id === session?.user?.id);
    if (!currentUser) return;
    (async () => {
      const result: Record<string, boolean> = {};
      for (const b of buildings) {
        try {
          const res = await fetch(`/api/admin/zalo-quyen?toaNhaId=${b.id}`);
          const data = await res.json();
          if (data.ok && data.effective) {
            // Tìm slot key chính xác của user, hoặc check tất cả slot keys cho role
            const slotNum = (currentUser.zaloViTri as any)?.[b.id];
            let perms: Record<string, boolean> | undefined;
            if (slotNum) {
              perms = data.effective[`${role}_${slotNum}`] || data.effective[role];
            } else {
              // Không có slot cụ thể → check tất cả matching keys, lấy restrictive nhất
              const matchingKeys = Object.keys(data.effective).filter(k => k === role || k.startsWith(`${role}_`));
              if (matchingKeys.length > 0) {
                // Nếu bất kỳ slot nào tắt quanLyQuyen → tắt (vì không biết user thuộc slot nào)
                const allPerms = matchingKeys.map(k => data.effective[k]);
                perms = { quanLyQuyen: allPerms.every(p => p?.quanLyQuyen !== false) };
              }
            }
            result[b.id] = perms?.quanLyQuyen !== false;
          } else {
            result[b.id] = true;
          }
        } catch { result[b.id] = true; }
      }
      setCanManageZaloPerms(result);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role, session?.user?.id, buildings.length, users.length]);

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
    // Kiểm tra giới hạn vai trò trên mỗi tòa nhà
    if (createUserData.role !== 'admin' && createUserData.toaNhaIds.length > 0) {
      const limitError = checkRoleLimitExceeded(createUserData.toaNhaIds, createUserData.role);
      if (limitError) {
        toast.error(limitError);
        return;
      }
    }
    try {
      const payload: Record<string, unknown> = { ...createUserData };
      if (createUserData.role === 'admin') { delete payload.toaNhaId; delete payload.toaNhaIds; }
      else {
        delete payload.toaNhaId; // luôn dùng toaNhaIds cho mọi vai trò không phải admin
        if (!createUserData.toaNhaIds.length) delete payload.toaNhaIds;
      }
      // Quyền cập nhật riêng sau khi tạo user
      delete payload.quyenKichHoatTaiKhoan;
      delete payload.quyenHopDong;
      delete payload.quyenHoaDon;
      delete payload.quyenThanhToan;
      delete payload.quyenSuCo;
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json().catch(() => null);
      if (response.ok) {
        // Nếu là quanLy + có bật quyền → gọi API quyen cho từng tòa nhà
        if (createUserData.role === 'quanLy' && createUserData.toaNhaIds.length > 0) {
          const newId = responseData?.id;
          if (newId) {
            const quyenPayload = {
              quyenKichHoatTaiKhoan: createUserData.quyenKichHoatTaiKhoan,
              quyenHopDong: createUserData.quyenHopDong,
              quyenHoaDon: createUserData.quyenHoaDon,
              quyenThanhToan: createUserData.quyenThanhToan,
              quyenSuCo: createUserData.quyenSuCo,
            };
            // Chỉ gọi nếu có ít nhất 1 quyền được bật
            if (Object.values(quyenPayload).some(v => v)) {
              await Promise.all(createUserData.toaNhaIds.map(tid =>
                fetch(`/api/admin/users/${newId}/quyen`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toaNhaId: tid, ...quyenPayload }),
                })
              ));
            }
          }
        }
        toast.success('Tạo tài khoản thành công');
        setIsCreateDialogOpen(false);
        setCreateUserData({ name: '', email: '', password: '', phone: '', role: 'nhanVien', toaNhaId: '', toaNhaIds: [], zaloViTri: {}, quyenKichHoatTaiKhoan: false, quyenHopDong: false, quyenHoaDon: false, quyenThanhToan: false, quyenSuCo: false });
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
    // Kiểm tra giới hạn vai trò trên mỗi tòa nhà (bỏ qua user đang sửa)
    if (editUserData.role !== 'admin' && editUserData.toaNhaIds.length > 0) {
      const limitError = checkRoleLimitExceeded(editUserData.toaNhaIds, editUserData.role, selectedUser.id ?? selectedUser._id);
      if (limitError) {
        toast.error(limitError);
        return;
      }
    }
    try {
      const payload: Record<string, unknown> = { ...editUserData };
      if (editUserData.role === 'admin') { delete payload.toaNhaId; delete payload.toaNhaIds; }
      else { delete payload.toaNhaId; } // luôn dùng toaNhaIds cho mọi vai trò không phải admin
      // Quyền cập nhật riêng bên dưới
      delete payload.quyenKichHoatTaiKhoan;
      delete payload.quyenHopDong;
      delete payload.quyenHoaDon;
      delete payload.quyenThanhToan;
      delete payload.quyenSuCo;
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

      // Cập nhật quyền cho từng tòa nhà (chỉ khi là quanLy)
      if (editUserData.role === 'quanLy' && editUserData.toaNhaIds.length > 0) {
        const quyenPayload = {
          quyenKichHoatTaiKhoan: editUserData.quyenKichHoatTaiKhoan,
          quyenHopDong: editUserData.quyenHopDong,
          quyenHoaDon: editUserData.quyenHoaDon,
          quyenThanhToan: editUserData.quyenThanhToan,
          quyenSuCo: editUserData.quyenSuCo,
        };
        const results = await Promise.all(editUserData.toaNhaIds.map(tid =>
          fetch(`/api/admin/users/${selectedUser.id}/quyen`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toaNhaId: tid, ...quyenPayload }),
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
      zaloViTri: (() => {
      const raw = (user.zaloViTri as Record<string, number>) || {};
      const result: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) { if (v) result[k] = Number(v); }
      return result;
    })(),
      quyenKichHoatTaiKhoan: user.quyenKichHoatTaiKhoan ?? false,
      quyenHopDong: user.quyenHopDong ?? false,
      quyenHoaDon: user.quyenHoaDon ?? false,
      quyenThanhToan: user.quyenThanhToan ?? false,
      quyenSuCo: user.quyenSuCo ?? false,
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
          {(isAdmin || isChuNha) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditGlobalLimits({ ...globalLimits }); setEditBuildingLimits({ ...perBuildingLimits }); setIsLimitsDialogOpen(true); }}
              className="flex-1 sm:flex-none"
            >
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Giới hạn</span>
            </Button>
          )}
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
              <Label htmlFor="password" className="text-xs md:text-sm">
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
            {/* Vị trí Zalo (slot) — hiện khi limit > 1 */}
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
            {/* Quyền hạn — chỉ hiện khi tạo quanLy + gán ít nhất 1 tòa nhà */}
            {createUserData.role === 'quanLy' && createUserData.toaNhaIds.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quyền hạn</p>
                {[
                  { key: 'quyenHopDong' as const, label: 'Hợp đồng', desc: 'Thêm, sửa, xóa hợp đồng' },
                  { key: 'quyenHoaDon' as const, label: 'Hóa đơn', desc: 'Thêm, sửa, xóa hóa đơn' },
                  { key: 'quyenThanhToan' as const, label: 'Thanh toán', desc: 'Thêm, sửa, xóa thanh toán' },
                  { key: 'quyenSuCo' as const, label: 'Sự cố', desc: 'Thêm, sửa, xóa sự cố' },
                  { key: 'quyenKichHoatTaiKhoan' as const, label: 'Kích hoạt tài khoản', desc: 'Tạo/thu hồi mật khẩu đăng nhập khách thuê' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs md:text-sm font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={createUserData[key]}
                      onCheckedChange={(v) => setCreateUserData({ ...createUserData, [key]: v })}
                    />
                  </div>
                ))}
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
          const renderUserRow = (user: User, buildingId?: string, roleKey?: string) => {
            const isCurrentUser = session?.user?.id === user.id;
            const slotNum = buildingId && user.zaloViTri ? (user.zaloViTri as Record<string, number>)[buildingId] : null;
            const limit = buildingId && roleKey ? getRoleLimitForBuilding(buildingId, roleKey) : 0;
            const slotLabel = slotNum && roleKey && limit > 1 ? `${ROLE_LABELS[roleKey] || roleKey} ${slotNum}` : null;
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

          const renderSection = (key: string, label: string, sectionUsers: User[], roleKey?: string, buildingId?: string) => {
            if (sectionUsers.length === 0 && !(isAdmin || isChuNha)) return null;
            const isOpen = !!openSections[key];
            const limit = roleKey && buildingId ? getRoleLimitForBuilding(buildingId, roleKey) : null;
            const zaloKey = `${key}-zalo`;
            const isZaloOpen = !!openSections[zaloKey];
            // Admin/chuNha/quanLy can manage Zalo permissions only for subordinate roles
            const ROLE_HIERARCHY: Record<string, string[]> = {
              admin: ['chuNha', 'dongChuTro', 'quanLy', 'nhanVien'],
              chuNha: ['dongChuTro', 'quanLy', 'nhanVien'],
              quanLy: ['nhanVien'],
            };
            // "Quản lý quyền" chỉ hiện cho cấp dưới trực tiếp có thể quản lý tiếp
            // admin → chuNha, chuNha → quanLy (dongChuTro/nhanVien không quản lý ai)
            const DIRECT_MANAGE_TARGETS: Record<string, string[]> = {
              admin: ['chuNha'],
              chuNha: ['quanLy'],
            };
            const myRole = session?.user?.role || '';
            const canEditZalo = roleKey && buildingId && (ROLE_HIERARCHY[myRole] || []).includes(roleKey)
              && (isAdmin || canManageZaloPerms[buildingId] !== false);
            const bPerms = buildingId ? zaloPerms[buildingId] : null;
            const level = getMyLevel();
            const slotCount = (limit && limit > 1) ? limit : 0; // 0 = single toggle set

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
                    {/* Inline Zalo Permissions */}
                    {canEditZalo && (
                      <div className="border-t">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
                          onClick={() => {
                            if (!isZaloOpen && buildingId && !bPerms) loadZaloPerms(buildingId);
                            toggleSection(zaloKey);
                          }}
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span>Quyền Zalo</span>
                          {isZaloOpen ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
                        </button>
                        {isZaloOpen && buildingId && roleKey && (
                          <div className="px-3 pb-3 space-y-2">
                            {slotCount > 0 ? (
                              // Multiple slots
                              Array.from({ length: slotCount }, (_, i) => {
                                const slotNum = i + 1;
                                const slotKey = `${roleKey}_${slotNum}`;
                                const currentPerms = bPerms?.[level]?.[slotKey] || {};
                                return (
                                  <div key={slotKey}>
                                    <p className="text-[10px] font-medium text-gray-500 mb-1">{label} {slotNum}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {ZALO_FEATURES.filter(f => f.key !== 'quanLyQuyen' || (DIRECT_MANAGE_TARGETS[myRole] || []).includes(roleKey!)).map(feat => {
                                        const aOff = bPerms?.admin?.[slotKey]?.[feat.key] === false;
                                        const cOff = bPerms?.chuNha?.[slotKey]?.[feat.key] === false;
                                        const higherOff = (level === 'chuNha' && aOff) || (level === 'quanLy' && (aOff || cOff));
                                        if (higherOff) return null;
                                        const checked = currentPerms[feat.key] ?? true;
                                        return (
                                          <label key={feat.key} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${checked ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                            <Switch
                                              checked={checked}
                                              onCheckedChange={(v) => toggleZaloPerm(buildingId, slotKey, feat.key, v)}
                                              className="scale-50"
                                            />
                                            {feat.label}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              // Single slot
                              <div className="flex flex-wrap gap-1.5">
                                {ZALO_FEATURES.filter(f => f.key !== 'quanLyQuyen' || (DIRECT_MANAGE_TARGETS[myRole] || []).includes(roleKey!)).map(feat => {
                                  const aOff = bPerms?.admin?.[roleKey!]?.[feat.key] === false;
                                  const cOff = bPerms?.chuNha?.[roleKey!]?.[feat.key] === false;
                                  const higherOff = (level === 'chuNha' && aOff) || (level === 'quanLy' && (aOff || cOff));
                                  if (higherOff) return null;
                                  const currentPerms = bPerms?.[level]?.[roleKey!] || {};
                                  const checked = currentPerms[feat.key] ?? true;
                                  return (
                                    <label key={feat.key} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${checked ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                      <Switch
                                        checked={checked}
                                        onCheckedChange={(v) => toggleZaloPerm(buildingId, roleKey!, feat.key, v)}
                                        className="scale-50"
                                      />
                                      {feat.label}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex justify-end pt-1">
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => saveZaloPerms(buildingId)} disabled={zaloPermsSaving === buildingId}>
                                {zaloPermsSaving === buildingId ? 'Lưu...' : 'Lưu quyền Zalo'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          // Nhóm theo tòa nhà
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
            {/* Vị trí Zalo (slot) — hiện khi limit > 1 */}
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
            {/* Quyền hạn — chỉ hiện khi đang sửa quanLy và đã gán ít nhất 1 tòa nhà */}
            {editUserData.role === 'quanLy' && editUserData.toaNhaIds.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quyền hạn trao cho quản lý</p>
                {[
                  { key: 'quyenHopDong' as const, label: 'Hợp đồng', desc: 'Thêm, sửa, xóa hợp đồng' },
                  { key: 'quyenHoaDon' as const, label: 'Hóa đơn', desc: 'Thêm, sửa, xóa hóa đơn' },
                  { key: 'quyenThanhToan' as const, label: 'Thanh toán', desc: 'Thêm, sửa, xóa thanh toán' },
                  { key: 'quyenSuCo' as const, label: 'Sự cố', desc: 'Thêm, sửa, xóa sự cố' },
                  { key: 'quyenKichHoatTaiKhoan' as const, label: 'Kích hoạt tài khoản', desc: 'Tạo/thu hồi mật khẩu đăng nhập khách thuê' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs md:text-sm font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={editUserData[key]}
                      onCheckedChange={(v) => setEditUserData({ ...editUserData, [key]: v })}
                    />
                  </div>
                ))}
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

      {/* Role Limits Dialog */}
      <Dialog open={isLimitsDialogOpen} onOpenChange={setIsLimitsDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-[520px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Giới hạn vai trò</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              {isAdmin
                ? 'Cài đặt số lượng tối đa mỗi vai trò trên mỗi tòa nhà.'
                : 'Giới hạn số lượng mỗi vai trò do quản trị viên cài đặt.'}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 py-2 pr-1">
            {isAdmin && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giới hạn chung (mặc định)</p>
                <div className="grid gap-2">
                  {Object.entries(ROLE_LABELS)
                    .filter(([key]) => isAdmin || key !== 'chuNha')
                    .map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <Label className="text-sm">{label}</Label>
                      <Input
                        type="number" min={0} max={100}
                        value={editGlobalLimits[key] ?? 0}
                        onChange={(e) => setEditGlobalLimits({ ...editGlobalLimits, [key]: parseInt(e.target.value) || 0 })}
                        className="w-20 text-sm text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {buildings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giới hạn theo tòa nhà</p>
                {isAdmin && <p className="text-[10px] text-muted-foreground">Để trống (0) = dùng giới hạn chung</p>}
                <div className="space-y-3">
                  {buildings.map(b => {
                    const bLimits = editBuildingLimits[b.id] || {};
                    const visibleRoles = Object.keys(ROLE_LABELS).filter(k => isAdmin || k !== 'chuNha');
                    const displayLimits = isChuNha
                      ? Object.fromEntries(visibleRoles.map(k => [k, bLimits[k] || globalLimits[k] || 0]))
                      : bLimits;
                    return (
                      <div key={b.id} className="border rounded-md p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-sm font-medium">{b.tenToaNha}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(ROLE_LABELS)
                            .filter(([key]) => isAdmin || key !== 'chuNha')
                            .map(([key, label]) => (
                            <div key={key} className="space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">{label}</Label>
                              {isAdmin ? (
                                <Input
                                  type="number" min={0} max={100}
                                  placeholder={String(editGlobalLimits[key] ?? 0)}
                                  value={bLimits[key] || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setEditBuildingLimits({ ...editBuildingLimits, [b.id]: { ...bLimits, [key]: val } });
                                  }}
                                  className="h-8 text-xs text-center"
                                />
                              ) : (
                                <div className="h-8 flex items-center justify-center text-sm font-medium bg-muted rounded-md">
                                  {displayLimits[key] ?? 0}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsLimitsDialogOpen(false)} className="w-full sm:w-auto">
              {isAdmin ? 'Hủy' : 'Đóng'}
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={handleSaveLimits} disabled={limitsSaving} className="w-full sm:w-auto">
                {limitsSaving ? 'Đang lưu...' : 'Lưu giới hạn'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
