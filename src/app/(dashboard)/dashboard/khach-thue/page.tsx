'use client';

import { useState, useEffect } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { useSession } from 'next-auth/react';
import { useCanEdit } from '@/hooks/use-can-edit';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  EyeIcon,
  Users,
  Phone,
  Mail,
  Calendar,
  MapPin,
  CreditCard,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  Building2,
  DoorOpen,
  AlertTriangle,
  X as CloseIcon,
  Home,
  Globe,
} from 'lucide-react';
import { KhachThue } from '@/types';
import { KhachThueDataTable } from './table';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';

export default function KhachThuePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canEdit = useCanEdit();
  const canViewZalo = ['admin', 'chuNha'].includes(session?.user?.role ?? '');
  const cache = useCache<{ khachThueList: KhachThue[] }>({ key: 'khach-thue-data', duration: 300000 });
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrangThai, setSelectedTrangThai] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Smart delete: khi khách thuê đang đứng hợp đồng
  const [deleteTarget, setDeleteTarget] = useState<KhachThue | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Accordion states (mặc định tất cả ẩn)
  const [openBuildings, setOpenBuildings] = useState<Set<string>>(new Set());
  const [openPhong, setOpenPhong] = useState<Set<string>>(new Set());
  const toggleBuilding = (id: string) =>
    setOpenBuildings(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePhong = (id: string) =>
    setOpenPhong(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [selectedKhachThueId, setSelectedKhachThueId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Quản lý Khách thuê';
  }, []);

  useEffect(() => {
    fetchKhachThue();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['khach-thue'], (_type, _action) => {
    cache.clearCache();
    fetchKhachThue(true);
  });

  const fetchKhachThue = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Thử load từ cache trước
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setKhachThueList(cachedData.khachThueList || []);
          setLoading(false);
          return;
        }
      }
      
      const params = new URLSearchParams();
      if (selectedTrangThai && selectedTrangThai !== 'all') params.append('trangThai', selectedTrangThai);
      
      const response = await fetch(`/api/khach-thue?${params.toString()}&limit=100`);
      let khachThueData: KhachThue[] = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          khachThueData = result.data;
          setKhachThueList(khachThueData);
        }
      }
      
      // Lưu cache với data mới
      if (khachThueData.length > 0) {
        cache.setCache({ khachThueList: khachThueData });
      }
    } catch (error) {
      console.error('Error fetching khach thue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchKhachThue(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  useEffect(() => {
    // Khi filter thay đổi, cần force refresh để lấy data mới theo filter
    if (selectedTrangThai) {
      fetchKhachThue(true);
    }
  }, [selectedTrangThai]);

  const filteredKhachThue = khachThueList.filter(khachThue =>
    khachThue.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (khachThue.soDienThoai || '').includes(searchTerm) ||
    (khachThue.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    khachThue.cccd.includes(searchTerm) ||
    khachThue.queQuan.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(k =>
    !selectedTrangThai || selectedTrangThai === 'all' || k.trangThai === selectedTrangThai
  );

  // Nhóm khách thuê theo tòa nhà → phòng
  type PhongGroup = { phongId: string; maPhong: string; tenants: typeof filteredKhachThue };
  type BuildingGroup = { toaNhaId: string; tenToaNha: string; rooms: PhongGroup[]; noRoom: typeof filteredKhachThue };

  const buildingGroups = (() => {
    const map = new Map<string, BuildingGroup>();
    const noRoom: typeof filteredKhachThue = [];

    for (const kt of filteredKhachThue) {
      const hopDong = (kt as any).hopDongHienTai;
      const phong = hopDong?.phong;
      const toa = phong?.toaNha;

      if (!phong || !toa) {
        noRoom.push(kt);
        continue;
      }

      const toaNhaId = toa.id || toa;
      const tenToaNha = toa.tenToaNha || 'Tòa không tên';
      const phongId = phong.id || phong;
      const maPhong = phong.maPhong || phongId;

      if (!map.has(toaNhaId)) {
        map.set(toaNhaId, { toaNhaId, tenToaNha, rooms: [], noRoom: [] });
      }
      const bg = map.get(toaNhaId)!;
      let pg = bg.rooms.find(r => r.phongId === phongId);
      if (!pg) { pg = { phongId, maPhong, tenants: [] }; bg.rooms.push(pg); }
      pg.tenants.push(kt);
    }

    return { groups: Array.from(map.values()), noRoom };
  })();

  const handleEdit = (khachThue: KhachThue) => {
    router.push(`/dashboard/khach-thue/${khachThue.id}`);
  };

  // Kích hoạt / thu hồi tài khoản đăng nhập cho khách thuê
  const handleKichHoatTaiKhoan = async (id: string, hasAccount: boolean) => {
    if (hasAccount) {
      if (!confirm('Thu hồi quyền đăng nhập của khách thuê này?')) return;
      setActionLoading(`kich-hoat-${id}`);
      try {
        const res = await fetch(`/api/khach-thue/${id}/kich-hoat-tai-khoan`, { method: 'DELETE' });
        if (res.ok) {
          setKhachThueList(prev => prev.map(k => k.id === id ? { ...k, hasMatKhau: false } : k));
          cache.clearCache();
          toast.success('Đã thu hồi quyền đăng nhập');
        } else {
          const errData = await res.json().catch(() => null);
          toast.error(errData?.error || 'Không thể thu hồi quyền đăng nhập');
        }
      } catch { toast.error('Có lỗi xảy ra'); }
      finally { setActionLoading(null); }
    } else {
      setActionLoading(`kich-hoat-${id}`);
      try {
        const res = await fetch(`/api/khach-thue/${id}/kich-hoat-tai-khoan`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setKhachThueList(prev => prev.map(k => k.id === id ? { ...k, hasMatKhau: true } : k));
          cache.clearCache();
          const taiKhoan = data.soDienThoai || data.email || '';
          toast.success(
            `Đã kích hoạt! Mật khẩu: ${data.matKhau} — Đăng nhập bằng: ${taiKhoan}`,
            { duration: 10000 }
          );
        } else {
          const errData = await res.json().catch(() => null);
          toast.error(errData?.error || 'Không thể kích hoạt tài khoản');
        }
      } catch { toast.error('Có lỗi xảy ra'); }
      finally { setActionLoading(null); }
    }
  };

  // Bật/tắt đăng nhập web cho khách thuê cụ thể
  const handleToggleDangNhapWeb = async (id: string, currentValue: boolean) => {
    const newValue = !currentValue;
    setActionLoading(`toggle-web-${id}`);
    try {
      const res = await fetch(`/api/khach-thue/${id}/dang-nhap-web`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batDangNhapWeb: newValue }),
      });
      if (res.ok) {
        setKhachThueList(prev => prev.map(k => k.id === id ? { ...k, batDangNhapWeb: newValue } as any : k));
        cache.clearCache();
        toast.success(newValue ? 'Đã bật đăng nhập web cho khách thuê' : 'Đã tắt đăng nhập web cho khách thuê');
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Không thể thay đổi trạng thái đăng nhập web');
      }
    } catch { toast.error('Có lỗi xảy ra'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = (id: string) => {
    const kt = khachThueList.find(k => k.id === id);
    if (!kt) return;
    // Nếu đang đứng hợp đồng → hiện dialog lựa chọn
    if (kt.hopDongHienTai?.id) {
      setDeleteTarget(kt);
      setIsDeleteDialogOpen(true);
    } else {
      // Không có hợp đồng → xóa thẳng
      doDeleteKhachThue(id);
    }
  };

  const doDeleteKhachThue = async (id: string) => {
    setActionLoading(`delete-${id}`);
    try {
      const response = await fetch(`/api/khach-thue/${id}`, { method: 'DELETE' });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          cache.clearCache();
          setKhachThueList(prev => prev.filter(k => k.id !== id));
          toast.success('Xóa khách thuê thành công!');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error deleting khach thue:', error);
      toast.error('Có lỗi xảy ra khi xóa khách thuê');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteWithHopDong = async () => {
    if (!deleteTarget?.hopDongHienTai?.id || !deleteTarget.id) return;
    const hopDongId = deleteTarget.hopDongHienTai.id;
    const khachThueId = deleteTarget.id;
    setActionLoading(`delete-${khachThueId}`);
    setIsDeleteDialogOpen(false);
    try {
      // Xóa hợp đồng trước
      const r1 = await fetch(`/api/hop-dong/${hopDongId}`, { method: 'DELETE' });
      if (!r1.ok) {
        const err = await r1.json();
        toast.error(err.message || 'Không thể xóa hợp đồng');
        return;
      }
      // Rồi xóa khách thuê
      const r2 = await fetch(`/api/khach-thue/${khachThueId}`, { method: 'DELETE' });
      if (r2.ok) {
        const result = await r2.json();
        if (result.success) {
          cache.clearCache();
          setKhachThueList(prev => prev.filter(k => k.id !== khachThueId));
          toast.success('Đã xóa hợp đồng và khách thuê!');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setActionLoading(null);
      setDeleteTarget(null);
    }
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Quản lý khách thuê"
        description="Danh sách tất cả khách thuê trong hệ thống"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => router.push('/dashboard/khach-thue/them-moi') : undefined}
        addLabel="Thêm khách thuê"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng khách thuê</p>
              <p className="text-base md:text-2xl font-bold text-indigo-900">{khachThueList.length}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Đang thuê</p>
              <p className="text-base md:text-2xl font-bold text-blue-600">
                {khachThueList.filter(k => k.trangThai === 'dangThue').length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Đã trả phòng</p>
              <p className="text-base md:text-2xl font-bold text-gray-600">
                {khachThueList.filter(k => k.trangThai === 'daTraPhong').length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Chưa thuê</p>
              <p className="text-base md:text-2xl font-bold text-orange-600">
                {khachThueList.filter(k => k.trangThai === 'chuaThue').length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput
          placeholder="Tìm theo tên, SĐT, CCCD..."
          value={searchTerm}
          onChange={setSearchTerm}
          className="flex-1"
        />
        <Select value={selectedTrangThai} onValueChange={setSelectedTrangThai}>
          <SelectTrigger className="w-full sm:w-44 text-sm"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="dangThue">Đang thuê</SelectItem>
            <SelectItem value="daTraPhong">Đã trả phòng</SelectItem>
            <SelectItem value="chuaThue">Chưa thuê</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grouped by Building → Room */}
      <div className="space-y-3">
        {filteredKhachThue.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center">
            <Users className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
            <p className="text-indigo-400">Không có khách thuê nào</p>
          </div>
        ) : (
          <>
            {buildingGroups.groups.map(bg => {
              const isBuildingOpen = openBuildings.has(bg.toaNhaId);
              return (
                <div key={bg.toaNhaId} className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
                  {/* Building header */}
                  <button type="button" onClick={() => toggleBuilding(bg.toaNhaId)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-white shrink-0" />
                      <div>
                        <span className="font-semibold text-white text-sm">{bg.tenToaNha}</span>
                        <p className="text-[10px] text-indigo-100">
                          {bg.rooms.reduce((s, r) => s + r.tenants.length, 0)} khách • {bg.rooms.length} phòng
                        </p>
                      </div>
                    </div>
                    {isBuildingOpen
                      ? <ChevronDown className="h-4 w-4 text-white shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-white shrink-0" />}
                  </button>

                  {isBuildingOpen && (
                    <div className="p-3 space-y-2">
                      {bg.rooms.map(pg => {
                        const isPhongOpen = openPhong.has(pg.phongId);
                        return (
                          <div key={pg.phongId} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm shadow-sm overflow-hidden">
                            {/* Room header */}
                            <button type="button" onClick={() => togglePhong(pg.phongId)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left">
                              <div className="flex items-center gap-2">
                                <DoorOpen className="h-4 w-4 text-indigo-600 shrink-0" />
                                <span className="font-medium text-sm text-indigo-900">{pg.maPhong}</span>
                                <span className="text-[10px] text-indigo-600">{pg.tenants.length} người</span>
                              </div>
                              {isPhongOpen
                                ? <ChevronDown className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                            </button>

                            {isPhongOpen && (
                              <div className="p-2 space-y-2">
                                {/* Desktop table */}
                                <div className="hidden md:block">
                                  <KhachThueDataTable
                                    data={pg.tenants}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onKichHoatTaiKhoan={handleKichHoatTaiKhoan}
                        onToggleDangNhapWeb={handleToggleDangNhapWeb}
                                    actionLoading={actionLoading}
                                    canEdit={canEdit}
                                    searchTerm=""
                                    onSearchChange={() => {}}
                                    selectedTrangThai=""
                                    onTrangThaiChange={() => {}}
                                  />
                                </div>
                                {/* Mobile cards */}
                                <div className="md:hidden space-y-2">
                                  {pg.tenants.map(kt => {
                                    const isSelected = selectedKhachThueId === kt.id;
                                    return (
                                      <div key={kt.id}>
                                        <div className={`rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm ${isSelected ? 'ring-2 ring-indigo-400' : ''}`}>
                                          <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-start gap-2 flex-1">
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(v) => setSelectedKhachThueId(v === true ? kt.id! : null)}
                                                className="mt-0.5 text-indigo-600"
                                              />
                                              <div>
                                                <p className="font-medium text-sm text-indigo-900">{kt.hoTen}</p>
                                                <p className="text-xs text-indigo-500">{kt.gioiTinh}</p>
                                              </div>
                                            </div>
                                            <TrangThaiBadge trangThai={kt.trangThai} />
                                          </div>
                                          <div className="space-y-1 text-xs text-indigo-600">
                                            {kt.soDienThoai && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-indigo-400" />{kt.soDienThoai}</div>}
                                            {kt.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-indigo-400" />{kt.email}</div>}
                                            <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 text-indigo-400 font-mono" />{kt.cccd}</div>
                                          </div>
                                          {canEdit && (
                                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-indigo-100">
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(kt)} disabled={actionLoading === `edit-${kt.id}`} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                              <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleDelete(kt.id!)}
                                              disabled={actionLoading === `delete-${kt.id}`}
                                              className="text-red-600 hover:bg-red-50 border-indigo-200">
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                          )}
                                        </div>
                                        
                                        {/* Detail panel */}
                                        {isSelected && (
                                          <div className="mt-2 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
                                            <div className="p-4 space-y-3">
                                              <div className="flex items-center gap-2 text-indigo-900 font-medium text-sm border-b border-indigo-200 pb-2">
                                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                                                  <Users className="h-3.5 w-3.5 text-white" />
                                                </div>
                                                Chi tiết khách thuê
                                              </div>
                                              
                                              <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                  <span className="text-indigo-500">Họ tên:</span>
                                                  <p className="font-medium text-indigo-900">{kt.hoTen}</p>
                                                </div>
                                                <div>
                                                  <span className="text-indigo-500">Giới tính:</span>
                                                  <p className="font-medium text-indigo-900">{{ nam: 'Nam', nu: 'Nữ', khac: 'Khác' }[kt.gioiTinh] || kt.gioiTinh}</p>
                                                </div>
                                                <div>
                                                  <span className="text-indigo-500">SĐT:</span>
                                                  <p className="font-medium text-indigo-900">{kt.soDienThoai || 'N/A'}</p>
                                                </div>
                                                <div>
                                                  <span className="text-indigo-500">Email:</span>
                                                  <p className="font-medium text-indigo-900">{kt.email || 'N/A'}</p>
                                                </div>
                                                <div>
                                                  <span className="text-indigo-500">CCCD:</span>
                                                  <p className="font-medium text-indigo-900">{kt.cccd}</p>
                                                </div>
                                                <div>
                                                  <span className="text-indigo-500">Ngày sinh:</span>
                                                  <p className="font-medium text-indigo-900">{new Date(kt.ngaySinh).toLocaleDateString('vi-VN')}</p>
                                                </div>
                                                <div>
                                                  <span className="text-indigo-500">Quê quán:</span>
                                                  <p className="font-medium text-indigo-900">{kt.queQuan}</p>
                                                </div>
                                                {kt.ngheNghiep && (
                                                  <div>
                                                    <span className="text-indigo-500">Nghề nghiệp:</span>
                                                    <p className="font-medium text-indigo-900">{kt.ngheNghiep}</p>
                                                  </div>
                                                )}
                                              </div>
                                              
                                              {kt.hopDongHienTai && (
                                                <div className="text-sm border-t border-indigo-200 pt-2">
                                                  <span className="text-indigo-500">Phòng hiện tại:</span>
                                                  <div className="mt-1 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-2">
                                                    <p className="font-medium flex items-center gap-1 text-indigo-900">
                                                      <Home className="h-3.5 w-3.5 text-indigo-500" />
                                                      {kt.hopDongHienTai.phong.maPhong}
                                                    </p>
                                                    <p className="text-xs text-indigo-600 flex items-center gap-1 mt-0.5">
                                                      <Building2 className="h-3 w-3" />
                                                      {kt.hopDongHienTai.phong.toaNha.tenToaNha}
                                                    </p>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Tenants without room */}
            {buildingGroups.noRoom.length > 0 && (
              <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
                <button type="button" onClick={() => toggleBuilding('__noRoom__')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-white shrink-0" />
                    <div>
                      <span className="font-semibold text-white text-sm">Chưa có phòng</span>
                      <p className="text-[10px] text-indigo-100">{buildingGroups.noRoom.length} khách</p>
                    </div>
                  </div>
                  {openBuildings.has('__noRoom__')
                    ? <ChevronDown className="h-4 w-4 text-white shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-white shrink-0" />}
                </button>
                {openBuildings.has('__noRoom__') && (
                  <div className="p-3">
                    <div className="hidden md:block">
                      <KhachThueDataTable data={buildingGroups.noRoom} onEdit={handleEdit} onDelete={handleDelete}
                        onKichHoatTaiKhoan={handleKichHoatTaiKhoan}
                        onToggleDangNhapWeb={handleToggleDangNhapWeb}
                        actionLoading={actionLoading} canEdit={canEdit} searchTerm="" onSearchChange={() => {}} selectedTrangThai="" onTrangThaiChange={() => {}} />
                    </div>
                    <div className="md:hidden space-y-2">
                      {buildingGroups.noRoom.map(kt => {
                        const isSelected = selectedKhachThueId === kt.id;
                        return (
                          <div key={kt.id}>
                            <div className={`rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm ${isSelected ? 'ring-2 ring-indigo-400' : ''}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-start gap-2 flex-1">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(v) => setSelectedKhachThueId(v === true ? kt.id! : null)}
                                    className="mt-0.5 text-indigo-600"
                                  />
                                  <div>
                                    <p className="font-medium text-sm text-indigo-900">{kt.hoTen}</p>
                                    <p className="text-xs text-indigo-500">{kt.soDienThoai}</p>
                                  </div>
                                </div>
                                <TrangThaiBadge trangThai={kt.trangThai} />
                              </div>
                              {canEdit && (
                              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-indigo-100">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(kt)} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"><Edit className="h-3.5 w-3.5" /></Button>
                                <Button variant="outline" size="sm" onClick={() => handleDelete(kt.id!)} className="text-red-600 hover:bg-red-50 border-indigo-200"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                              )}
                            </div>
                            
                            {/* Detail panel */}
                            {isSelected && (
                              <div className="mt-2 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center gap-2 text-indigo-900 font-medium text-sm border-b border-indigo-200 pb-2">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                                      <Users className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    Chi tiết khách thuê
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <span className="text-indigo-500">Họ tên:</span>
                                      <p className="font-medium text-indigo-900">{kt.hoTen}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Giới tính:</span>
                                      <p className="font-medium text-indigo-900">{{ nam: 'Nam', nu: 'Nữ', khac: 'Khác' }[kt.gioiTinh] || kt.gioiTinh}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">SĐT:</span>
                                      <p className="font-medium text-indigo-900">{kt.soDienThoai || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Email:</span>
                                      <p className="font-medium text-indigo-900">{kt.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">CCCD:</span>
                                      <p className="font-medium text-indigo-900">{kt.cccd}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Ngày sinh:</span>
                                      <p className="font-medium text-indigo-900">{new Date(kt.ngaySinh).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Quê quán:</span>
                                      <p className="font-medium text-indigo-900">{kt.queQuan}</p>
                                    </div>
                                    {kt.ngheNghiep && (
                                      <div>
                                        <span className="text-indigo-500">Nghề nghiệp:</span>
                                        <p className="font-medium text-indigo-900">{kt.ngheNghiep}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Legacy mobile card section — replaced by grouped view above */}
      <div className="hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Danh sách khách thuê</h2>
          <span className="text-sm text-gray-500">{filteredKhachThue.length} khách thuê</span>
        </div>
        
        {/* Mobile Filters */}
        <div className="space-y-2 mb-4">
          <SearchInput
            placeholder="Tìm kiếm khách thuê..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <Select value={selectedTrangThai} onValueChange={setSelectedTrangThai}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
              <SelectItem value="dangThue" className="text-sm">Đang thuê</SelectItem>
              <SelectItem value="daTraPhong" className="text-sm">Đã trả phòng</SelectItem>
              <SelectItem value="chuaThue" className="text-sm">Chưa thuê</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card List */}
        <div className="space-y-3">
          {filteredKhachThue.map((khachThue) => (
            <div key={khachThue.id} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-4 shadow-sm">
              <div className="space-y-3">
                {/* Header with name and status */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{khachThue.hoTen}</h3>
                    <p className="text-sm text-gray-500 capitalize">{khachThue.gioiTinh}</p>
                  </div>
                  <div className="flex gap-2">
                    {(() => {
                      switch (khachThue.trangThai) {
                        case 'dangThue':
                          return <Badge variant="default" className="text-xs">Đang thuê</Badge>;
                        case 'daTraPhong':
                          return <Badge variant="secondary" className="text-xs">Đã trả phòng</Badge>;
                        case 'chuaThue':
                          return <Badge variant="outline" className="text-xs">Chưa thuê</Badge>;
                        default:
                          return <Badge variant="outline" className="text-xs">{khachThue.trangThai}</Badge>;
                      }
                    })()}
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <span>{khachThue.soDienThoai}</span>
                  </div>
                  {khachThue.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{khachThue.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <CreditCard className="h-3 w-3" />
                    <span className="font-mono">{khachThue.cccd}</span>
                  </div>
                </div>

                {/* Additional info */}
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>Ngày sinh: {new Date(khachThue.ngaySinh).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{khachThue.queQuan}</span>
                  </div>
                  {khachThue.ngheNghiep && (
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      <span>{khachThue.ngheNghiep}</span>
                    </div>
                  )}
                </div>

                {/* Người tạo */}
                {(khachThue as any).nguoiTaoTen && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users className="h-3 w-3" />
                    <span>Người tạo: {(khachThue as any).nguoiTaoTen}</span>
                  </div>
                )}

                {/* Room info if available */}
                {(khachThue as any).hopDongHienTai?.phong && (
                  <div className="border-t pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-3 w-3 text-green-600" />
                      <span className="font-medium">Phòng: {(khachThue as any).hopDongHienTai.phong.maPhong}</span>
                    </div>
                    {(khachThue as any).hopDongHienTai.phong.toaNha && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 ml-5">
                        <span>{(khachThue as any).hopDongHienTai.phong.toaNha.tenToaNha}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const publicUrl = `${window.location.origin}/khach-thue/dang-nhap`;
                        navigator.clipboard.writeText(publicUrl);
                        toast.success('Đã sao chép link đăng nhập khách thuê');
                      }}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Copy link đăng nhập khách thuê"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(khachThue)}
                      disabled={actionLoading === `edit-${khachThue.id}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(khachThue.id!)}
                    disabled={actionLoading === `delete-${khachThue.id}`}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredKhachThue.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không có khách thuê nào</p>
          </div>
        )}
      </div>

      {/* Smart delete: khách thuê đang đứng hợp đồng */}
      {isDeleteDialogOpen && deleteTarget && (
        <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/80 shadow-lg shadow-amber-100/50">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-200">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-base font-semibold text-amber-900">Khách thuê đang có hợp đồng</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-amber-600 hover:bg-amber-100" onClick={() => { setIsDeleteDialogOpen(false); setDeleteTarget(null); }}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-amber-800 mb-4">
              <strong>{deleteTarget.hoTen}</strong> đang đứng tên hợp đồng phòng{' '}
              <strong>{deleteTarget.hopDongHienTai?.phong?.maPhong}</strong>
              {deleteTarget.hopDongHienTai?.phong?.toaNha?.tenToaNha && (
                <> — {deleteTarget.hopDongHienTai.phong.toaNha.tenToaNha}</>
              )}
              . Bạn muốn làm gì?
            </p>
            <div className="flex flex-col gap-3">
              <button
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-indigo-200 bg-white/60 hover:bg-indigo-50 transition-colors backdrop-blur-sm"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  router.push(`/dashboard/hop-dong/${deleteTarget.hopDongHienTai?.id}`);
                }}
              >
                <p className="font-medium text-indigo-900 text-sm">Thay đổi người đứng tên hợp đồng</p>
                <p className="text-xs text-indigo-600 mt-0.5">Mở hợp đồng để chọn người đứng tên mới</p>
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-red-200 bg-white/60 hover:bg-red-50 transition-colors backdrop-blur-sm"
                onClick={handleDeleteWithHopDong}
              >
                <p className="font-medium text-red-800 text-sm">Xóa hợp đồng và khách thuê</p>
                <p className="text-xs text-red-600 mt-0.5">Xóa hẳn cả hợp đồng lẫn khách thuê này</p>
              </button>
              <button
                className="w-full text-center px-4 py-2 rounded-xl border-2 border-indigo-100 bg-white/60 hover:bg-indigo-50 transition-colors text-sm text-indigo-600 backdrop-blur-sm"
                onClick={() => { setIsDeleteDialogOpen(false); setDeleteTarget(null); }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper badge component
function TrangThaiBadge({ trangThai }: { trangThai: string }) {
  switch (trangThai) {
    case 'dangThue':  return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">Đang thuê</Badge>;
    case 'daTraPhong': return <Badge variant="secondary" className="text-xs">Đã trả phòng</Badge>;
    case 'chuaThue':  return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">Chưa thuê</Badge>;
    default:          return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">{trangThai}</Badge>;
  }
}

