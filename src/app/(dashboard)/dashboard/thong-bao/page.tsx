'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Edit,
  Trash2,
  Bell,
  Calendar,
  Users,
  Building2,
  Home,
  Check,
  X as CloseIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
} from 'lucide-react';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import { ThongBao, ToaNha, Phong, KhachThue } from '@/types';
import { toast } from 'sonner';
import { useCache } from '@/hooks/use-cache';
import { useCanEdit } from '@/hooks/use-can-edit';

export default function ThongBaoPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const cache = useCache<{
    thongBaoList: ThongBao[];
    toaNhaList: ToaNha[];
    phongList: Phong[];
    khachThueList: KhachThue[];
  }>({ key: 'thong-bao-data', duration: 300000 });
  
  const [thongBaoList, setThongBaoList] = useState<ThongBao[]>([]);
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    document.title = 'Quản lý Thông báo';
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setThongBaoList(cachedData.thongBaoList || []);
          setToaNhaList(cachedData.toaNhaList || []);
          setPhongList(cachedData.phongList || []);
          setKhachThueList(cachedData.khachThueList || []);
          setLoading(false);
          return;
        }
      }
      
      // Fetch thông báo từ API
      const thongBaoResponse = await fetch('/api/thong-bao');
      const thongBaoData = thongBaoResponse.ok ? await thongBaoResponse.json() : { data: [] };
      const thongBaos = thongBaoData.success ? thongBaoData.data : [];
      setThongBaoList(thongBaos);

      // Fetch tòa nhà từ API
      const toaNhaResponse = await fetch('/api/toa-nha');
      const toaNhaData = toaNhaResponse.ok ? await toaNhaResponse.json() : { data: [] };
      const toaNhas = toaNhaData.success ? toaNhaData.data : [];
      setToaNhaList(toaNhas);

      // Fetch phòng từ API
      const phongResponse = await fetch('/api/phong');
      const phongData = phongResponse.ok ? await phongResponse.json() : { data: [] };
      const phongs = phongData.success ? phongData.data : [];
      setPhongList(phongs);

      // Fetch khách thuê từ API
      const khachThueResponse = await fetch('/api/khach-thue');
      const khachThueData = khachThueResponse.ok ? await khachThueResponse.json() : { data: [] };
      const khachThues = khachThueData.success ? khachThueData.data : [];
      setKhachThueList(khachThues);
      
      cache.setCache({
        thongBaoList: thongBaos,
        toaNhaList: toaNhas,
        phongList: phongs,
        khachThueList: khachThues,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      setThongBaoList([]);
      setToaNhaList([]);
      setPhongList([]);
      setKhachThueList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchData(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  const filteredThongBao = thongBaoList.filter(thongBao => {
    const matchesSearch = thongBao.tieuDe.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         thongBao.noiDung.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || thongBao.loai === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'chung':
        return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">Chung</Badge>;
      case 'hoaDon':
        return <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-600 bg-emerald-50">Hóa đơn</Badge>;
      case 'suCo':
        return <Badge variant="outline" className="text-xs border-red-200 text-red-600 bg-red-50">Sự cố</Badge>;
      case 'hopDong':
        return <Badge variant="outline" className="text-xs border-amber-200 text-amber-600 bg-amber-50">Hợp đồng</Badge>;
      case 'khac':
        return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">Khác</Badge>;
      default:
        return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">{type}</Badge>;
    }
  };

  const getToaNhaName = (toaNhaId?: string) => {
    if (!toaNhaId) return 'Tất cả tòa nhà';
    const toaNha = toaNhaList.find(tn => tn.id === toaNhaId);
    return toaNha?.tenToaNha || 'Không xác định';
  };

  const getPhongNames = (phongIds: string[]) => {
    if (!phongIds || phongIds.length === 0) return 'Tất cả phòng';
    if (phongIds.length === phongList.length && phongList.length > 0) return 'Tất cả phòng';
    const names = phongIds.map(id => phongList.find(p => p.id === id)?.maPhong || '—');
    if (names.length > 2) return `${names.slice(0, 2).join(', ')}... (+${names.length - 2} phòng)`;
    return names.join(', ');
  };

  const getKhachThueNames = (khachThueIds: string[]) => {
    if (!khachThueIds || khachThueIds.length === 0) return 'Tất cả khách thuê';
    if (khachThueIds.length === khachThueList.length && khachThueList.length > 0) return 'Tất cả khách thuê';
    const names = khachThueIds.map(id => khachThueList.find(k => k.id === id)?.hoTen || '—');
    if (names.length > 2) return `${names.slice(0, 2).join(', ')}... (+${names.length - 2} người)`;
    return names.join(', ');
  };

  // Lấy 2 nút hành động phù hợp theo loại thông báo
  const getActionButtons = (loai: string): { positive: { label: string; value: string }; negative: { label: string; value: string } } => {
    switch (loai) {
      case 'hoaDon':
        return {
          positive: { label: 'Đã thu', value: 'daXuLy' },
          negative: { label: 'Chưa thu', value: 'tamHoan' },
        };
      case 'suCo':
        return {
          positive: { label: 'Tiếp nhận', value: 'daXuLy' },
          negative: { label: 'Từ chối', value: 'tuChoi' },
        };
      case 'hopDong':
        return {
          positive: { label: 'Gia hạn', value: 'daXuLy' },
          negative: { label: 'Kết thúc', value: 'tuChoi' },
        };
      case 'chung':
        return {
          positive: { label: 'Đã xem', value: 'daXuLy' },
          negative: { label: 'Tạm hoãn', value: 'tamHoan' },
        };
      default: // khac
        return {
          positive: { label: 'Hoàn thành', value: 'daXuLy' },
          negative: { label: 'Tạm hoãn', value: 'tamHoan' },
        };
    }
  };

  const getTrangThaiXuLyBadge = (trangThai?: string) => {
    switch (trangThai) {
      case 'daXuLy':
        return <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" />Đã xử lý</Badge>;
      case 'tuChoi':
        return <Badge variant="outline" className="text-xs border-red-200 text-red-700 bg-red-50"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
      case 'tamHoan':
        return <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50"><Pause className="h-3 w-3 mr-1" />Tạm hoãn</Badge>;
      default:
        return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50"><Clock className="h-3 w-3 mr-1" />Chờ xử lý</Badge>;
    }
  };

  const handleUpdateTrangThai = async (id: string, trangThaiXuLy: string) => {
    try {
      const response = await fetch(`/api/thong-bao?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trangThaiXuLy }),
      });
      if (response.ok) {
        cache.clearCache();
        setThongBaoList(prev => prev.map(tb =>
          tb.id === id ? { ...tb, trangThaiXuLy: trangThaiXuLy as any } : tb
        ));
        toast.success('Cập nhật trạng thái thành công');
      } else {
        toast.error('Có lỗi xảy ra');
      }
    } catch {
      toast.error('Có lỗi xảy ra khi cập nhật');
    }
  };

  const handleEdit = (thongBao: ThongBao) => {
    router.push(`/dashboard/thong-bao/${thongBao.id}`);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
      try {
        const response = await fetch(`/api/thong-bao?id=${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          cache.clearCache();
          setThongBaoList(prev => prev.filter(thongBao => thongBao.id !== id));
          toast.success('Xóa thông báo thành công');
        } else {
          toast.error('Có lỗi xảy ra khi xóa thông báo');
        }
      } catch (error) {
        console.error('Error deleting thong bao:', error);
        toast.error('Có lỗi xảy ra khi xóa thông báo');
      }
    }
  };

  const handleSend = (thongBao: ThongBao) => {
    // Implement send logic
    console.log('Sending notification:', thongBao.id);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-indigo-100 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-indigo-100 rounded w-32 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Quản lý thông báo"
        description="Gửi và quản lý thông báo đến khách thuê"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => router.push('/dashboard/thong-bao/them-moi') : undefined}
        addLabel="Tạo thông báo"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng thông báo</p>
              <p className="text-base md:text-2xl font-bold text-indigo-900">{thongBaoList.length}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Bell className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Chung</p>
              <p className="text-base md:text-2xl font-bold text-blue-600">
                {thongBaoList.filter(t => t.loai === 'chung').length}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
              <Bell className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Hóa đơn</p>
              <p className="text-base md:text-2xl font-bold text-green-600">
                {thongBaoList.filter(t => t.loai === 'hoaDon').length}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-200">
              <Bell className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Sự cố</p>
              <p className="text-base md:text-2xl font-bold text-red-600">
                {thongBaoList.filter(t => t.loai === 'suCo').length}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shadow-red-200">
              <Bell className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="p-4 md:p-6 border-b border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900">Danh sách thông báo</h3>
              <p className="text-sm text-indigo-600">
                {filteredThongBao.length} thông báo được tìm thấy
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6">
          {/* Tìm kiếm và Bộ lọc */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
              <div className="flex-1 sm:max-w-md">
                <SearchInput
                  placeholder="Tìm kiếm theo tiêu đề, nội dung..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="chung">Chung</SelectItem>
                  <SelectItem value="hoaDon">Hóa đơn</SelectItem>
                  <SelectItem value="suCo">Sự cố</SelectItem>
                  <SelectItem value="hopDong">Hợp đồng</SelectItem>
                  <SelectItem value="khac">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Người nhận</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>Tòa nhà</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThongBao.map((thongBao) => (
                  <TableRow key={thongBao.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium text-indigo-900">{thongBao.tieuDe}</div>
                        <div className="text-sm text-indigo-500 truncate max-w-xs">
                          {thongBao.noiDung}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(thongBao.loai)}</TableCell>
                    <TableCell>
                      <div className="text-sm text-indigo-700">
                        {getKhachThueNames(thongBao.nguoiNhan)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-indigo-700">
                        {getPhongNames(thongBao.phong || (thongBao as any).phongIds || [])}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm text-indigo-700">
                          {getToaNhaName(thongBao.toaNha || (thongBao as any).toaNhaId)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm text-indigo-700">
                          {new Date(thongBao.ngayGui).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getTrangThaiXuLyBadge(thongBao.trangThaiXuLy)}
                    </TableCell>
                    {canEdit && (
                    <TableCell>
                      {(!thongBao.trangThaiXuLy || thongBao.trangThaiXuLy === 'chuaXuLy') ? (
                        <div className="flex gap-1">
                          {(() => {
                            const actions = getActionButtons(thongBao.loai);
                            return (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:bg-green-50 border-green-200 text-xs h-7 px-2"
                                  onClick={() => handleUpdateTrangThai(thongBao.id!, actions.positive.value)}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  {actions.positive.label}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 border-red-200 text-xs h-7 px-2"
                                  onClick={() => handleUpdateTrangThai(thongBao.id!, actions.negative.value)}
                                >
                                  <CloseIcon className="h-3 w-3 mr-1" />
                                  {actions.negative.label}
                                </Button>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-gray-500"
                          onClick={() => handleUpdateTrangThai(thongBao.id!, 'chuaXuLy')}
                        >
                          Hoàn tác
                        </Button>
                      )}
                    </TableCell>
                    )}
                    {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(thongBao)}
                          className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(thongBao.id!)}
                          className="text-red-600 hover:text-red-700 border-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <Bell className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-indigo-900">Danh sách thông báo</h2>
            <p className="text-xs text-indigo-600">{filteredThongBao.length} thông báo</p>
          </div>
        </div>
        
        {/* Mobile Filters */}
        <div className="space-y-2 mb-4">
          <SearchInput
            placeholder="Tìm kiếm thông báo..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Loại thông báo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
              <SelectItem value="chung" className="text-sm">Chung</SelectItem>
              <SelectItem value="hoaDon" className="text-sm">Hóa đơn</SelectItem>
              <SelectItem value="suCo" className="text-sm">Sự cố</SelectItem>
              <SelectItem value="hopDong" className="text-sm">Hợp đồng</SelectItem>
              <SelectItem value="khac" className="text-sm">Khác</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card List */}
        <div className="space-y-3">
          {filteredThongBao.map((thongBao) => {
            return (
              <div key={thongBao.id} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-4 shadow-sm">
                <div className="space-y-3">
                  {/* Header with title and type */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-indigo-900">{thongBao.tieuDe}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3 text-indigo-400" />
                        <span className="text-xs text-indigo-500">
                          {new Date(thongBao.ngayGui).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                    {getTypeBadge(thongBao.loai)}
                  </div>

                  {/* Content */}
                  <div className="border-t border-indigo-100 pt-2">
                    <p className="text-xs text-indigo-700 line-clamp-3">{thongBao.noiDung}</p>
                  </div>

                  {/* Recipients info */}
                  <div className="space-y-1 text-xs border-t border-indigo-100 pt-2">
                    {(thongBao.toaNha || (thongBao as any).toaNhaId) && (
                      <div className="flex items-center gap-2 text-indigo-500">
                        <Building2 className="h-3 w-3" />
                        <span>{getToaNhaName(thongBao.toaNha || (thongBao as any).toaNhaId)}</span>
                      </div>
                    )}
                    {(thongBao.phong || (thongBao as any).phongIds)?.length > 0 && (
                      <div className="flex items-center gap-2 text-indigo-500">
                        <Home className="h-3 w-3" />
                        <span className="truncate">{getPhongNames(thongBao.phong || (thongBao as any).phongIds)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-indigo-500">
                      <Users className="h-3 w-3" />
                      <span className="truncate">{getKhachThueNames(thongBao.nguoiNhan)}</span>
                    </div>
                  </div>

                  {/* Trạng thái xử lý */}
                  <div className="border-t border-indigo-100 pt-2 flex items-center gap-2">
                    {getTrangThaiXuLyBadge(thongBao.trangThaiXuLy)}
                  </div>

                  {/* Nút hành động theo loại thông báo */}
                  {canEdit && ((!thongBao.trangThaiXuLy || thongBao.trangThaiXuLy === 'chuaXuLy') ? (
                    <div className="flex gap-2 pt-2 border-t border-indigo-100">
                      {(() => {
                        const actions = getActionButtons(thongBao.loai);
                        return (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-green-600 hover:bg-green-50 border-green-200 text-xs"
                              onClick={() => handleUpdateTrangThai(thongBao.id!, actions.positive.value)}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              {actions.positive.label}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-red-600 hover:bg-red-50 border-red-200 text-xs"
                              onClick={() => handleUpdateTrangThai(thongBao.id!, actions.negative.value)}
                            >
                              <CloseIcon className="h-3.5 w-3.5 mr-1" />
                              {actions.negative.label}
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t border-indigo-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-indigo-500"
                        onClick={() => handleUpdateTrangThai(thongBao.id!, 'chuaXuLy')}
                      >
                        Hoàn tác trạng thái
                      </Button>
                    </div>
                  ))}

                  {/* Action buttons */}
                  {canEdit && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(thongBao)}
                      className="flex-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(thongBao.id!)}
                      className="flex-1 text-red-600 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Xóa
                    </Button>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredThongBao.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center">
            <Bell className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
            <p className="text-indigo-400">Không có thông báo nào</p>
          </div>
        )}
      </div>
    </div>
  );
}

