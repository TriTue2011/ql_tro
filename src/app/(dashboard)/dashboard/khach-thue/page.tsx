'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Info,
  CreditCard,
  RefreshCw,
  Copy,
  MessageCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Building2,
  DoorOpen,
} from 'lucide-react';
import { KhachThue } from '@/types';
import { KhachThueDataTable } from './table';
import { CCCDUpload } from '@/components/ui/cccd-upload';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function KhachThuePage() {
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

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa khách thuê này?')) {
      setActionLoading(`delete-${id}`);
      try {
        const response = await fetch(`/api/khach-thue/${id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            cache.clearCache();
            setKhachThueList(prev => prev.filter(khachThue => khachThue.id !== id));
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

// Form component for adding/editing khach thue
function KhachThueForm({
  khachThue,
  canViewZalo,
  onClose,
  onSuccess,
  isSubmitting,
  setIsSubmitting
}: {
  khachThue: KhachThue | null;
  canViewZalo: boolean;
  onClose: () => void;
  onSuccess: (newKhachThue?: KhachThue) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    hoTen: khachThue?.hoTen || '',
    soDienThoai: khachThue?.soDienThoai || '',
    email: khachThue?.email || '',
    cccd: khachThue?.cccd || '',
    ngaySinh: khachThue?.ngaySinh ? new Date(khachThue.ngaySinh).toISOString().split('T')[0] : '',
    gioiTinh: khachThue?.gioiTinh || 'nam',
    queQuan: khachThue?.queQuan || '',
    anhCCCD: {
      matTruoc: khachThue?.anhCCCD.matTruoc || '',
      matSau: khachThue?.anhCCCD.matSau || '',
    },
    ngheNghiep: khachThue?.ngheNghiep || '',
    matKhau: '',
    zaloChatId: khachThue?.zaloChatId || '',
    nhanThongBaoZalo: khachThue?.nhanThongBaoZalo ?? false,
  });

  // Phòng đang thuê
  const currentPhongId = (khachThue as any)?.hopDongHienTai?.phong?.id || '';
  const currentPhongName = (khachThue as any)?.hopDongHienTai?.phong
    ? `${(khachThue as any).hopDongHienTai.phong.maPhong}${(khachThue as any).hopDongHienTai.phong.toaNha?.tenToaNha ? ' — ' + (khachThue as any).hopDongHienTai.phong.toaNha.tenToaNha : ''}`
    : '';
  const [availablePhong, setAvailablePhong] = useState<{ id: string; maPhong: string; tenToaNha: string }[]>([]);
  const [selectedPhongId, setSelectedPhongId] = useState('');
  const [assigningPhong, setAssigningPhong] = useState(false);

  useEffect(() => {
    fetch('/api/phong?trangThai=trong')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAvailablePhong(d.data.map((p: any) => ({
            id: p.id,
            maPhong: p.maPhong,
            tenToaNha: typeof p.toaNha === 'object' ? p.toaNha?.tenToaNha || '' : '',
          })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleAssignPhong() {
    if (!selectedPhongId || !khachThue) return;
    setAssigningPhong(true);
    try {
      const res = await fetch(`/api/phong/${selectedPhongId}/thue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ khachThueId: khachThue.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã gán phòng thành công! Hợp đồng tối giản đã được tạo.');
        onSuccess();
      } else {
        toast.error(data.message || 'Không thể gán phòng');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setAssigningPhong(false);
    }
  }

  async function handleUnassignPhong() {
    if (!currentPhongId) return;
    setAssigningPhong(true);
    try {
      const res = await fetch(`/api/phong/${currentPhongId}/thue`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã hủy gán phòng');
        onSuccess();
      } else {
        toast.error(data.message || 'Không thể hủy gán');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setAssigningPhong(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Ngăn submit nhiều lần
    
    setIsSubmitting(true);
    
    try {
      const url = khachThue ? `/api/khach-thue/${khachThue.id}` : '/api/khach-thue';
      const method = khachThue ? 'PUT' : 'POST';

      // Chỉ gửi matKhau khi nó được nhập
      const submitData = { ...formData };
      if (!submitData.matKhau || submitData.matKhau.trim() === '') {
        delete (submitData as any).matKhau;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onSuccess(result.data);
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      <Tabs defaultValue="thong-tin" className="w-full">
        <TabsList className={`grid w-full ${khachThue && canViewZalo ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="thong-tin" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Info className="h-3 w-3 md:h-4 md:w-4" />
            <span>Thông tin</span>
          </TabsTrigger>
          <TabsTrigger value="anh-cccd" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
            <span>Ảnh CCCD</span>
          </TabsTrigger>
          {khachThue && canViewZalo && (
            <TabsTrigger value="zalo" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <MessageCircle className="h-3 w-3 md:h-4 md:w-4" />
              <span>Zalo</span>
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="thong-tin" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="hoTen" className="text-xs md:text-sm">Họ tên</Label>
              <Input
                id="hoTen"
                value={formData.hoTen}
                onChange={(e) => setFormData(prev => ({ ...prev, hoTen: e.target.value }))}
                required
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="soDienThoai" className="text-xs md:text-sm">Số điện thoại</Label>
              <Input
                id="soDienThoai"
                value={formData.soDienThoai}
                onChange={(e) => setFormData(prev => ({ ...prev, soDienThoai: e.target.value }))}
                required
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs md:text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cccd" className="text-xs md:text-sm">CCCD</Label>
              <Input
                id="cccd"
                value={formData.cccd}
                onChange={(e) => setFormData(prev => ({ ...prev, cccd: e.target.value }))}
                required
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="ngaySinh" className="text-xs md:text-sm">Ngày sinh</Label>
              <Input
                id="ngaySinh"
                type="date"
                value={formData.ngaySinh}
                onChange={(e) => setFormData(prev => ({ ...prev, ngaySinh: e.target.value }))}
                required
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gioiTinh" className="text-xs md:text-sm">Giới tính</Label>
              <Select value={formData.gioiTinh} onValueChange={(value) => setFormData(prev => ({ ...prev, gioiTinh: value as 'nam' | 'nu' }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nam" className="text-sm">Nam</SelectItem>
                  <SelectItem value="nu" className="text-sm">Nữ</SelectItem>
                  <SelectItem value="khac" className="text-sm">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queQuan" className="text-xs md:text-sm">Quê quán</Label>
            <Input
              id="queQuan"
              value={formData.queQuan}
              onChange={(e) => setFormData(prev => ({ ...prev, queQuan: e.target.value }))}
              required
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ngheNghiep" className="text-xs md:text-sm">Nghề nghiệp</Label>
            <Input
              id="ngheNghiep"
              value={formData.ngheNghiep}
              onChange={(e) => setFormData(prev => ({ ...prev, ngheNghiep: e.target.value }))}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="matKhau" className="text-xs md:text-sm">Mật khẩu đăng nhập</Label>
            <Input
              id="matKhau"
              type="password"
              value={formData.matKhau}
              onChange={(e) => setFormData(prev => ({ ...prev, matKhau: e.target.value }))}
              placeholder={khachThue && (khachThue as any).hasMatKhau ? "Để trống nếu không muốn thay đổi" : "Nhập mật khẩu (tối thiểu 6 ký tự)"}
              className="text-sm"
            />
            {/* Password strength indicator */}
            {(() => {
              const pw = formData.matKhau;
              const hasAccount = khachThue && (khachThue as any).hasMatKhau;
              if (!pw) {
                if (hasAccount) {
                  return <p className="text-[10px] md:text-xs text-muted-foreground">Khách thuê đã có tài khoản đăng nhập. Để trống nếu không muốn thay đổi mật khẩu.</p>;
                }
                return (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">Chưa tạo</span>
                    <span className="text-[10px] text-muted-foreground">Tạo mật khẩu để khách thuê có thể đăng nhập.</span>
                  </div>
                );
              }
              const hasLower = /[a-z]/.test(pw);
              const hasUpper = /[A-Z]/.test(pw);
              const hasDigit = /[0-9]/.test(pw);
              const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
              const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
              let level: 'weak' | 'medium' | 'strong';
              if (pw.length < 8 || variety < 2) level = 'weak';
              else if (pw.length < 12 || variety < 3) level = 'medium';
              else level = 'strong';
              const cfg = {
                weak:   { label: 'Yếu',       bg: 'bg-red-100',    text: 'text-red-600',    bar: 'bg-red-500',    w: 'w-1/3' },
                medium: { label: 'Trung bình', bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500', w: 'w-2/3' },
                strong: { label: 'Mạnh',       bg: 'bg-green-100',  text: 'text-green-700',  bar: 'bg-green-500',  w: 'w-full' },
              }[level];
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground">{pw.length} ký tự</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-gray-100">
                    <div className={`h-1 rounded-full transition-all ${cfg.bar} ${cfg.w}`} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Gán phòng ── */}
          {khachThue && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs md:text-sm font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Phòng đang thuê
              </Label>
              {currentPhongId ? (
                <div className="flex items-center justify-between rounded-md border bg-green-50 px-3 py-2">
                  <span className="text-sm font-medium text-green-800">{currentPhongName}</span>
                  <Button type="button" size="sm" variant="outline"
                    className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                    disabled={assigningPhong} onClick={handleUnassignPhong}>
                    {assigningPhong ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Hủy gán'}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedPhongId} onValueChange={setSelectedPhongId}>
                    <SelectTrigger className="text-sm flex-1">
                      <SelectValue placeholder="Chọn phòng trống..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePhong.length === 0 ? (
                        <SelectItem value="_none" disabled>Không có phòng trống</SelectItem>
                      ) : availablePhong.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.maPhong}{p.tenToaNha ? ` — ${p.tenToaNha}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" disabled={!selectedPhongId || assigningPhong} onClick={handleAssignPhong}>
                    {assigningPhong ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Gán phòng'}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Gán phòng sẽ tạo hợp đồng tối giản. Có thể chỉnh sửa trong mục Hợp đồng.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="anh-cccd" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          <CCCDUpload
            anhCCCD={formData.anhCCCD}
            onCCCDChange={(anhCCCD) => setFormData(prev => ({ ...prev, anhCCCD }))}
            className="w-full"
          />
        </TabsContent>

        {khachThue && canViewZalo && (
          <TabsContent value="zalo" className="space-y-4 mt-4">
            {/* Trạng thái hiện tại */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Trạng thái liên kết Zalo</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                  <span className="text-gray-600">SĐT:</span>
                  <span className="font-mono font-medium">{khachThue.soDienThoai}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                  <span className="text-gray-600">Zalo Chat ID:</span>
                  {khachThue.zaloChatId ? (
                    <span className="flex items-center gap-1 text-green-600 font-mono text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {khachThue.zaloChatId}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Chưa liên kết</span>
                  )}
                </div>
                {khachThue.pendingZaloChatId && (
                  <div className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-200">
                    <span className="text-amber-700 text-xs">Chờ xác nhận:</span>
                    <span className="flex items-center gap-1 text-amber-700 font-mono text-xs">
                      <Clock className="h-3.5 w-3.5" />
                      {khachThue.pendingZaloChatId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Nhập thủ công */}
            <div className="space-y-2">
              <Label htmlFor="zaloChatId" className="text-xs md:text-sm">
                Zalo Chat ID
                <span className="ml-1 text-gray-400 font-normal">(nhập để liên kết thủ công)</span>
              </Label>
              <Input
                id="zaloChatId"
                value={formData.zaloChatId}
                onChange={(e) => setFormData(prev => ({ ...prev, zaloChatId: e.target.value }))}
                placeholder="Nhập Zalo Chat ID..."
                className="text-sm font-mono"
                maxLength={64}
              />
              <p className="text-[10px] text-muted-foreground">
                Chat ID lấy từ bot Zalo khi khách thuê nhắn tin cho bot. Khớp với số điện thoại: <strong>{khachThue.soDienThoai}</strong>
              </p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div className="space-y-0.5">
                <Label className="text-xs md:text-sm">Gửi thông báo Zalo</Label>
                <p className="text-[10px] text-muted-foreground">Bật để hệ thống gửi tin nhắn Zalo cho khách thuê này</p>
              </div>
              <Switch
                checked={formData.nhanThongBaoZalo}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, nhanThongBaoZalo: v }))}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              <span className="hidden sm:inline">{khachThue ? 'Đang cập nhật...' : 'Đang thêm...'}</span>
              <span className="sm:hidden">{khachThue ? 'Đang cập nhật...' : 'Đang thêm...'}</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">{khachThue ? 'Cập nhật' : 'Thêm mới'}</span>
              <span className="sm:hidden">{khachThue ? 'Cập nhật' : 'Thêm mới'}</span>
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}