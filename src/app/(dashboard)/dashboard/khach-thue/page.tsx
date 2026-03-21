'use client';

import { useState, useEffect } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
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
} from 'lucide-react';
import { KhachThue } from '@/types';
import { KhachThueDataTable } from './table';
import { KhachThueForm } from '@/components/khach-thue-form';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';

export default function KhachThuePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canViewZalo = ['admin', 'chuNha'].includes(session?.user?.role ?? '');
  const cache = useCache<{ khachThueList: KhachThue[] }>({ key: 'khach-thue-data', duration: 300000 });
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrangThai, setSelectedTrangThai] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKhachThue, setEditingKhachThue] = useState<KhachThue | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
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
    khachThue.soDienThoai.includes(searchTerm) ||
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
    setEditingKhachThue(khachThue);
    setIsDialogOpen(true);
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
          toast.error('Không thể thu hồi quyền đăng nhập');
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
          toast.success(
            `Đã kích hoạt! Mật khẩu: ${data.matKhau} — SĐT đăng nhập: ${data.soDienThoai}`,
            { duration: 10000 }
          );
        } else {
          toast.error('Không thể kích hoạt tài khoản');
        }
      } catch { toast.error('Có lỗi xảy ra'); }
      finally { setActionLoading(null); }
    }
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Quản lý khách thuê</h1>
          <p className="text-xs md:text-sm text-gray-600">Danh sách tất cả khách thuê trong hệ thống</p>
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingKhachThue(null)} className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Thêm khách thuê</span>
                <span className="sm:hidden">Thêm</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingKhachThue ? 'Chỉnh sửa khách thuê' : 'Thêm khách thuê mới'}
              </DialogTitle>
              <DialogDescription>
                {editingKhachThue ? 'Cập nhật thông tin khách thuê' : 'Nhập thông tin khách thuê mới'}
              </DialogDescription>
            </DialogHeader>
            
            <KhachThueForm
              khachThue={editingKhachThue}
              canViewZalo={canViewZalo}
              onClose={() => setIsDialogOpen(false)}
              onSuccess={(newKhachThue) => {
                cache.clearCache();
                setIsDialogOpen(false);
                if (newKhachThue) {
                  if (editingKhachThue) {
                    // Cập nhật khách thuê hiện có
                    setKhachThueList(prev => prev.map(kt => 
                      kt.id === editingKhachThue.id ? newKhachThue : kt
                    ));
                  } else {
                    // Thêm khách thuê mới
                    setKhachThueList(prev => [newKhachThue, ...prev]);
                  }
                } else {
                  // Fallback: refresh data nếu không có dữ liệu trả về
                  fetchKhachThue();
                }
                toast.success(editingKhachThue ? 'Cập nhật khách thuê thành công!' : 'Thêm khách thuê thành công!');
              }}
              isSubmitting={isFormSubmitting}
              setIsSubmitting={setIsFormSubmitting}
            />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Tổng khách thuê</p>
              <p className="text-base md:text-2xl font-bold">{khachThueList.length}</p>
            </div>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Đang thuê</p>
              <p className="text-base md:text-2xl font-bold text-blue-600">
                {khachThueList.filter(k => k.trangThai === 'dangThue').length}
              </p>
            </div>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Đã trả phòng</p>
              <p className="text-base md:text-2xl font-bold text-gray-600">
                {khachThueList.filter(k => k.trangThai === 'daTraPhong').length}
              </p>
            </div>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-gray-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Chưa thuê</p>
              <p className="text-base md:text-2xl font-bold text-orange-600">
                {khachThueList.filter(k => k.trangThai === 'chuaThue').length}
              </p>
            </div>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Search + filter bar (both desktop + mobile) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Tìm theo tên, SĐT, CCCD..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} className="pl-10 text-sm" />
        </div>
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
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không có khách thuê nào</p>
          </div>
        ) : (
          <>
            {buildingGroups.groups.map(bg => {
              const isBuildingOpen = openBuildings.has(bg.toaNhaId);
              return (
                <div key={bg.toaNhaId} className="border rounded-lg overflow-hidden shadow-sm">
                  {/* Building header */}
                  <button type="button" onClick={() => toggleBuilding(bg.toaNhaId)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">{bg.tenToaNha}</span>
                        <p className="text-[10px] text-gray-500">
                          {bg.rooms.reduce((s, r) => s + r.tenants.length, 0)} khách • {bg.rooms.length} phòng
                        </p>
                      </div>
                    </div>
                    {isBuildingOpen
                      ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />}
                  </button>

                  {isBuildingOpen && (
                    <div className="p-3 space-y-2 bg-white">
                      {bg.rooms.map(pg => {
                        const isPhongOpen = openPhong.has(pg.phongId);
                        return (
                          <div key={pg.phongId} className="border rounded-md overflow-hidden">
                            {/* Room header */}
                            <button type="button" onClick={() => togglePhong(pg.phongId)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors text-left">
                              <div className="flex items-center gap-2">
                                <DoorOpen className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="font-medium text-sm text-blue-900">{pg.maPhong}</span>
                                <span className="text-[10px] text-blue-600">{pg.tenants.length} người</span>
                              </div>
                              {isPhongOpen
                                ? <ChevronDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
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
                                    actionLoading={actionLoading}
                                    searchTerm=""
                                    onSearchChange={() => {}}
                                    selectedTrangThai=""
                                    onTrangThaiChange={() => {}}
                                  />
                                </div>
                                {/* Mobile cards */}
                                <div className="md:hidden space-y-2">
                                  {pg.tenants.map(kt => (
                                    <Card key={kt.id} className="p-3">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <p className="font-medium text-sm">{kt.hoTen}</p>
                                          <p className="text-xs text-gray-500">{kt.gioiTinh}</p>
                                        </div>
                                        <TrangThaiBadge trangThai={kt.trangThai} />
                                      </div>
                                      <div className="space-y-1 text-xs text-gray-600">
                                        <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{kt.soDienThoai}</div>
                                        <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 font-mono" />{kt.cccd}</div>
                                      </div>
                                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(kt)} disabled={actionLoading === `edit-${kt.id}`}>
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleDelete(kt.id!)}
                                          disabled={actionLoading === `delete-${kt.id}`}
                                          className="text-red-600 hover:bg-red-50">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </Card>
                                  ))}
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
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <button type="button" onClick={() => toggleBuilding('__noRoom__')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-gray-700 text-sm">Chưa có phòng</span>
                      <p className="text-[10px] text-gray-500">{buildingGroups.noRoom.length} khách</p>
                    </div>
                  </div>
                  {openBuildings.has('__noRoom__')
                    ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                </button>
                {openBuildings.has('__noRoom__') && (
                  <div className="p-3 bg-white">
                    <div className="hidden md:block">
                      <KhachThueDataTable data={buildingGroups.noRoom} onEdit={handleEdit} onDelete={handleDelete}
                        onKichHoatTaiKhoan={handleKichHoatTaiKhoan}
                        actionLoading={actionLoading} searchTerm="" onSearchChange={() => {}} selectedTrangThai="" onTrangThaiChange={() => {}} />
                    </div>
                    <div className="md:hidden space-y-2">
                      {buildingGroups.noRoom.map(kt => (
                        <Card key={kt.id} className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{kt.hoTen}</p>
                              <p className="text-xs text-gray-500">{kt.soDienThoai}</p>
                            </div>
                            <TrangThaiBadge trangThai={kt.trangThai} />
                          </div>
                          <div className="flex justify-end gap-2 mt-2 pt-2 border-t">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(kt)}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(kt.id!)} className="text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </Card>
                      ))}
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm khách thuê..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
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
            <Card key={khachThue.id} className="p-4">
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
            </Card>
          ))}
        </div>

        {filteredKhachThue.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không có khách thuê nào</p>
          </div>
        )}
      </div>

      {/* Smart delete dialog: khách thuê đang đứng hợp đồng */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Khách thuê đang có hợp đồng
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.hoTen}</strong> đang đứng tên hợp đồng phòng{' '}
              <strong>{deleteTarget?.hopDongHienTai?.phong?.maPhong}</strong>
              {deleteTarget?.hopDongHienTai?.phong?.toaNha?.tenToaNha && (
                <> — {deleteTarget.hopDongHienTai.phong.toaNha.tenToaNha}</>
              )}
              . Bạn muốn làm gì?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <button
              className="w-full text-left px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                router.push(`/dashboard/hop-dong/${deleteTarget?.hopDongHienTai?.id}`);
              }}
            >
              <p className="font-medium text-blue-800 text-sm">Thay đổi người đứng tên hợp đồng</p>
              <p className="text-xs text-blue-600 mt-0.5">Mở hợp đồng để chọn người đứng tên mới</p>
            </button>
            <button
              className="w-full text-left px-4 py-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
              onClick={handleDeleteWithHopDong}
            >
              <p className="font-medium text-red-800 text-sm">Xóa hợp đồng và khách thuê</p>
              <p className="text-xs text-red-600 mt-0.5">Xóa hẳn cả hợp đồng lẫn khách thuê này</p>
            </button>
            <button
              className="w-full text-center px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors text-sm text-gray-600"
              onClick={() => { setIsDeleteDialogOpen(false); setDeleteTarget(null); }}
            >
              Hủy
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper badge component
function TrangThaiBadge({ trangThai }: { trangThai: string }) {
  switch (trangThai) {
    case 'dangThue':  return <Badge variant="default" className="text-xs">Đang thuê</Badge>;
    case 'daTraPhong': return <Badge variant="secondary" className="text-xs">Đã trả phòng</Badge>;
    case 'chuaThue':  return <Badge variant="outline" className="text-xs">Chưa thuê</Badge>;
    default:          return <Badge variant="outline" className="text-xs">{trangThai}</Badge>;
  }
}

