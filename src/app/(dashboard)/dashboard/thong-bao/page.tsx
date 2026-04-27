'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Bell,
  Calendar,
  Users,
  Eye,
  Filter,
  Send,
  Building2,
  Home,
  RefreshCw,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
} from 'lucide-react';
import { ThongBao, ToaNha, Phong, KhachThue } from '@/types';
import { toast } from 'sonner';
import { useCache } from '@/hooks/use-cache';
import { useCanEdit } from '@/hooks/use-can-edit';

export default function ThongBaoPage() {
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingThongBao, setEditingThongBao] = useState<ThongBao | null>(null);

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
        return <Badge variant="default">Chung</Badge>;
      case 'hoaDon':
        return <Badge variant="secondary">Hóa đơn</Badge>;
      case 'suCo':
        return <Badge variant="destructive">Sự cố</Badge>;
      case 'hopDong':
        return <Badge variant="outline">Hợp đồng</Badge>;
      case 'khac':
        return <Badge variant="outline">Khác</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getToaNhaName = (toaNhaId?: string) => {
    if (!toaNhaId) return 'Tất cả tòa nhà';
    const toaNha = toaNhaList.find(tn => tn.id === toaNhaId);
    return toaNha?.tenToaNha || 'Không xác định';
  };

  const getPhongNames = (phongIds: string[]) => {
    if (phongIds.length === 0) return 'Tất cả phòng';
    const names = phongIds.map(id => phongList.find(p => p.id === id)?.maPhong || '—');
    if (names.length > 2) return `${names.slice(0, 2).join(', ')}... +${names.length - 2}`;
    return names.join(', ');
  };

  const getKhachThueNames = (khachThueIds: string[]) => {
    if (khachThueIds.length === 0) return 'Tất cả khách thuê';
    const names = khachThueIds.map(id => khachThueList.find(k => k.id === id)?.hoTen || '—');
    if (names.length > 2) return `${names.slice(0, 2).join(', ')}... +${names.length - 2}`;
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
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Đã xử lý</Badge>;
      case 'tuChoi':
        return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
      case 'tamHoan':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs"><Pause className="h-3 w-3 mr-1" />Tạm hoãn</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs"><Clock className="h-3 w-3 mr-1" />Chờ xử lý</Badge>;
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
    setEditingThongBao(thongBao);
    setIsDialogOpen(true);
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
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Quản lý thông báo</h1>
          <p className="text-xs md:text-sm text-gray-600">Gửi và quản lý thông báo đến khách thuê</p>
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
          {canEdit && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingThongBao(null)} className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tạo thông báo</span>
                <span className="sm:hidden">Tạo</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingThongBao ? 'Chỉnh sửa thông báo' : 'Tạo thông báo mới'}
              </DialogTitle>
              <DialogDescription>
                {editingThongBao ? 'Cập nhật thông tin thông báo' : 'Nhập thông tin thông báo mới'}
              </DialogDescription>
            </DialogHeader>

            <ThongBaoForm
              thongBao={editingThongBao}
              toaNhaList={toaNhaList}
              phongList={phongList}
              khachThueList={khachThueList}
              onClose={() => setIsDialogOpen(false)}
              onSuccess={() => {
                cache.clearCache();
                setIsDialogOpen(false);
                fetchData(true);
              }}
            />
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Tổng thông báo</p>
              <p className="text-base md:text-2xl font-bold">{thongBaoList.length}</p>
            </div>
            <Bell className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Chung</p>
              <p className="text-base md:text-2xl font-bold text-blue-600">
                {thongBaoList.filter(t => t.loai === 'chung').length}
              </p>
            </div>
            <Bell className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Hóa đơn</p>
              <p className="text-base md:text-2xl font-bold text-green-600">
                {thongBaoList.filter(t => t.loai === 'hoaDon').length}
              </p>
            </div>
            <Bell className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Sự cố</p>
              <p className="text-base md:text-2xl font-bold text-red-600">
                {thongBaoList.filter(t => t.loai === 'suCo').length}
              </p>
            </div>
            <Bell className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Danh sách thông báo</CardTitle>
          <CardDescription>
            {filteredThongBao.length} thông báo được tìm thấy
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {/* Tìm kiếm và Bộ lọc */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
              <div className="flex-1 sm:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm theo tiêu đề, nội dung..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
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
                        <div className="font-medium">{thongBao.tieuDe}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {thongBao.noiDung}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(thongBao.loai)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {getKhachThueNames(thongBao.nguoiNhan)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {getPhongNames(thongBao.phong || [])}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {getToaNhaName(thongBao.toaNha)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
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
                                  <X className="h-3 w-3 mr-1" />
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(thongBao.id!)}
                          className="text-red-600 hover:text-red-700"
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
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Danh sách thông báo</h2>
          <span className="text-sm text-gray-500">{filteredThongBao.length} thông báo</span>
        </div>
        
        {/* Mobile Filters */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm thông báo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
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
              <Card key={thongBao.id} className="p-4">
                <div className="space-y-3">
                  {/* Header with title and type */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{thongBao.tieuDe}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {new Date(thongBao.ngayGui).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                    {getTypeBadge(thongBao.loai)}
                  </div>

                  {/* Content */}
                  <div className="border-t pt-2">
                    <p className="text-xs text-gray-600 line-clamp-3">{thongBao.noiDung}</p>
                  </div>

                  {/* Recipients info */}
                  <div className="space-y-1 text-xs border-t pt-2">
                    {thongBao.toaNha && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Building2 className="h-3 w-3" />
                        <span>{getToaNhaName(thongBao.toaNha)}</span>
                      </div>
                    )}
                    {thongBao.phong && thongBao.phong.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Home className="h-3 w-3" />
                        <span className="truncate">{getPhongNames(thongBao.phong)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-500">
                      <Users className="h-3 w-3" />
                      <span className="truncate">{getKhachThueNames(thongBao.nguoiNhan)}</span>
                    </div>
                  </div>

                  {/* Trạng thái xử lý */}
                  <div className="border-t pt-2 flex items-center gap-2">
                    {getTrangThaiXuLyBadge(thongBao.trangThaiXuLy)}
                  </div>

                  {/* Nút hành động theo loại thông báo */}
                  {canEdit && ((!thongBao.trangThaiXuLy || thongBao.trangThaiXuLy === 'chuaXuLy') ? (
                    <div className="flex gap-2 pt-2 border-t">
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
                              <X className="h-3.5 w-3.5 mr-1" />
                              {actions.negative.label}
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-500"
                        onClick={() => handleUpdateTrangThai(thongBao.id!, 'chuaXuLy')}
                      >
                        Hoàn tác trạng thái
                      </Button>
                    </div>
                  ))}

                  {/* Action buttons */}
                  {canEdit && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(thongBao)}
                      className="flex-1"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(thongBao.id!)}
                      className="flex-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Xóa
                    </Button>
                  </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredThongBao.length === 0 && (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không có thông báo nào</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ZaloNhomChatItem { name: string; threadIds: Record<string, string>; tang?: number | null; label?: string }

// Form component for adding/editing thong bao
function ThongBaoForm({
  thongBao,
  toaNhaList,
  phongList,
  khachThueList,
  onClose,
  onSuccess
}: {
  thongBao: ThongBao | null;
  toaNhaList: ToaNha[];
  phongList: Phong[];
  khachThueList: KhachThue[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    tieuDe: thongBao?.tieuDe || '',
    noiDung: thongBao?.noiDung || '',
    loai: thongBao?.loai || 'chung',
    nguoiNhan: thongBao?.nguoiNhan || [],
    phong: thongBao?.phong || [],
    toaNha: thongBao?.toaNha || '',
    nhomChatIds: (thongBao as any)?.nhomChatIds || [],
    fileDinhKem: (thongBao as any)?.fileDinhKem || [],
  });
  const [nhomChatList, setNhomChatList] = useState<ZaloNhomChatItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Khi đổi tòa nhà → load danh sách nhóm Zalo của tòa đó
  useEffect(() => {
    let aborted = false;
    async function load() {
      const id = formData.toaNha;
      if (!id || id === 'all') { setNhomChatList([]); return; }
      try {
        const r = await fetch(`/api/toa-nha/${id}`);
        const j = await r.json();
        const groups: ZaloNhomChatItem[] = (j?.data?.zaloNhomChat ?? []) as ZaloNhomChatItem[];
        if (!aborted) setNhomChatList(Array.isArray(groups) ? groups : []);
      } catch { if (!aborted) setNhomChatList([]); }
    }
    load();
    return () => { aborted = true; };
  }, [formData.toaNha]);

  // Lọc phòng/khách thuê theo tòa nhà đang chọn (nếu có)
  const filteredPhong = formData.toaNha && formData.toaNha !== 'all'
    ? phongList.filter(p => (typeof p.toaNha === 'string' ? p.toaNha : (p.toaNha as any)?.id) === formData.toaNha)
    : phongList;
  const filteredPhongIds = new Set(filteredPhong.map(p => p.id));
  // Khách thuê lấy phòng qua hopDongHienTai (API /api/khach-thue trả trường này).
  // Nếu thiếu (vd khách chưa ký hợp đồng), chấp nhận fallback `phong` nếu repo có join sẵn.
  const filteredKhachThue = formData.toaNha && formData.toaNha !== 'all'
    ? khachThueList.filter((k: any) => {
        const toaNhaIdOfKT = k.hopDongHienTai?.phong?.toaNha?.id
          ?? (typeof k.hopDongHienTai?.phong?.toaNha === 'string' ? k.hopDongHienTai.phong.toaNha : undefined);
        if (toaNhaIdOfKT) return toaNhaIdOfKT === formData.toaNha;
        const pid = k.hopDongHienTai?.phong?.id
          ?? (typeof k.phong === 'string' ? k.phong : k.phong?.id);
        return pid && filteredPhongIds.has(pid);
      })
    : khachThueList;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nguoiNhan.length === 0 && formData.nhomChatIds.length === 0) {
      toast.error('Phải chọn ít nhất 1 người nhận hoặc 1 nhóm Zalo');
      return;
    }
    setIsSubmitting(true);
    try {
      const url = thongBao ? `/api/thong-bao?id=${thongBao.id}` : '/api/thong-bao';
      const method = thongBao ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        nguoiNhan: formData.nguoiNhan.length > 0 ? formData.nguoiNhan : ['__broadcast__'],
      };
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(thongBao ? 'Cập nhật thông báo thành công' : 'Tạo và gửi thông báo thành công');
        onSuccess();
      } else {
        toast.error(result.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAll = (field: 'phong' | 'nguoiNhan' | 'nhomChatIds', ids: string[]) => {
    setFormData(prev => {
      const current = prev[field] as string[];
      const allSelected = ids.length > 0 && ids.every(id => current.includes(id));
      const nextIds = allSelected ? current.filter(id => !ids.includes(id)) : Array.from(new Set([...current, ...ids]));

      if (field === 'phong') {
        // Tự động tích/bỏ tích khách thuê trong các phòng này
        const tenantsInRooms = filteredKhachThue.filter((kt: any) => {
          const pid = kt.hopDongHienTai?.phong?.id ?? (typeof kt.phong === 'string' ? kt.phong : kt.phong?.id);
          return ids.includes(pid);
        }).map((kt: any) => kt.id!);

        let nextNguoiNhan = prev.nguoiNhan;
        if (!allSelected) {
          // Add all tenants from these rooms
          nextNguoiNhan = Array.from(new Set([...prev.nguoiNhan, ...tenantsInRooms]));
        } else {
          // Remove all tenants from these rooms
          nextNguoiNhan = prev.nguoiNhan.filter(id => !tenantsInRooms.includes(id));
        }
        return { ...prev, phong: nextIds, nguoiNhan: nextNguoiNhan };
      }

      return { ...prev, [field]: nextIds };
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('type', f.type.startsWith('image/') ? 'image' : 'file');
        fd.append('folder', 'thong-bao');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.success && j.data?.secure_url) urls.push(j.data.secure_url);
        else toast.error(j.message || 'Upload thất bại');
      }
      if (urls.length > 0) setFormData(prev => ({ ...prev, fileDinhKem: [...prev.fileDinhKem, ...urls] }));
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (url: string) => {
    setFormData(prev => ({ ...prev, fileDinhKem: prev.fileDinhKem.filter((u: string) => u !== url) }));
  };

  const fileName = (url: string) => {
    try { return decodeURIComponent(url.split('/').pop() || url); } catch { return url; }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tieuDe" className="text-xs md:text-sm">Tiêu đề</Label>
        <Input
          id="tieuDe"
          value={formData.tieuDe}
          onChange={(e) => setFormData(prev => ({ ...prev, tieuDe: e.target.value }))}
          placeholder="Nhập tiêu đề thông báo"
          required
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="noiDung" className="text-xs md:text-sm">Nội dung</Label>
        <Textarea
          id="noiDung"
          value={formData.noiDung}
          onChange={(e) => setFormData(prev => ({ ...prev, noiDung: e.target.value }))}
          rows={6}
          placeholder="Nhập nội dung thông báo..."
          required
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="loai" className="text-xs md:text-sm">Loại thông báo</Label>
          <Select value={formData.loai} onValueChange={(value) => setFormData(prev => ({ ...prev, loai: value as any }))}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Chọn loại thông báo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chung" className="text-sm">Chung</SelectItem>
              <SelectItem value="hoaDon" className="text-sm">Hóa đơn</SelectItem>
              <SelectItem value="suCo" className="text-sm">Sự cố</SelectItem>
              <SelectItem value="hopDong" className="text-sm">Hợp đồng</SelectItem>
              <SelectItem value="khac" className="text-sm">Khác</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="toaNha" className="text-xs md:text-sm">Tòa nhà</Label>
          <Select value={formData.toaNha || undefined} onValueChange={(value) => setFormData(prev => ({ ...prev, toaNha: value, phong: [], nguoiNhan: [], nhomChatIds: [] }))}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Chọn tòa nhà (tùy chọn)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Tất cả tòa nhà</SelectItem>
              {toaNhaList.map((toaNha) => (
                <SelectItem key={toaNha.id} value={toaNha.id!} className="text-sm">
                  {toaNha.tenToaNha}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Phòng */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm">Phòng ({formData.phong.length}/{filteredPhong.length})</Label>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
              onClick={() => toggleAll('phong', filteredPhong.map(p => p.id!).filter(Boolean))}>
              Chọn tất cả / Bỏ chọn
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
          {filteredPhong.length === 0 && <div className="text-xs text-gray-400 col-span-full">Không có phòng</div>}
          {filteredPhong.map((phong) => (
            <label key={phong.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.phong.includes(phong.id!)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData(prev => {
                    let nextPhong = checked ? [...prev.phong, phong.id!] : prev.phong.filter(id => id !== phong.id);
                    
                    // Tự động tích/bỏ tích khách thuê trong phòng này
                    const tenantsInRoom = filteredKhachThue.filter(kt => {
                      const pid = kt.hopDongHienTai?.phong?.id ?? (typeof kt.phong === 'string' ? kt.phong : kt.phong?.id);
                      return pid === phong.id;
                    }).map(kt => kt.id!);

                    let nextNguoiNhan = prev.nguoiNhan;
                    if (checked) {
                      nextNguoiNhan = Array.from(new Set([...prev.nguoiNhan, ...tenantsInRoom]));
                    } else {
                      nextNguoiNhan = prev.nguoiNhan.filter(id => !tenantsInRoom.includes(id));
                    }

                    return { ...prev, phong: nextPhong, nguoiNhan: nextNguoiNhan };
                  });
                }}
                className="rounded border-gray-300"
              />
              <span className="text-xs truncate">{phong.maPhong}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Người nhận */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm">Người nhận ({formData.nguoiNhan.length}/{filteredKhachThue.length})</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
            onClick={() => toggleAll('nguoiNhan', filteredKhachThue.map(k => k.id!).filter(Boolean))}>
            Chọn tất cả / Bỏ chọn
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
          {filteredKhachThue.length === 0 && <div className="text-xs text-gray-400 col-span-full">Không có khách thuê</div>}
          {filteredKhachThue.map((khachThue) => (
            <label key={khachThue.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.nguoiNhan.includes(khachThue.id!)}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  nguoiNhan: e.target.checked
                    ? [...prev.nguoiNhan, khachThue.id!]
                    : prev.nguoiNhan.filter(id => id !== khachThue.id),
                }))}
                className="rounded border-gray-300"
              />
              <span className="text-xs truncate">{khachThue.hoTen}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Nhóm Zalo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm">Nhóm Zalo ({formData.nhomChatIds.length}/{nhomChatList.length})</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
            onClick={() => toggleAll('nhomChatIds', nhomChatList.map(g => g.name || Object.values(g.threadIds || {})[0]))}>
            Chọn tất cả / Bỏ chọn
          </Button>
        </div>
        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
          {nhomChatList.length === 0 && (
            <div className="text-xs text-gray-400">
              {formData.toaNha && formData.toaNha !== 'all' ? 'Tòa nhà chưa khai báo nhóm Zalo' : 'Chọn một tòa nhà để xem nhóm Zalo'}
            </div>
          )}
          {nhomChatList.map((g) => {
            const label = g.label ?? (g.name || (g.tang != null ? `Tầng ${g.tang}` : 'Toàn tòa'));
            const key = g.name || (Object.values(g.threadIds || {})[0] as string);
            return (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.nhomChatIds.includes(key)}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    nhomChatIds: e.target.checked
                      ? [...prev.nhomChatIds, key]
                      : prev.nhomChatIds.filter((t: string) => t !== key),
                  }))}
                  className="rounded border-gray-300"
                />
                <span className="text-xs">{label}</span>
                <Users className="h-3 w-3 text-purple-400" />
              </label>
            );
          })}
        </div>
      </div>

      {/* File đính kèm */}
      <div className="space-y-2">
        <Label className="text-xs md:text-sm">File đính kèm ({formData.fileDinhKem.length})</Label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={(e) => handleFileUpload(e.target.files)}
            disabled={uploading}
            className="text-xs"
          />
          {uploading && <span className="text-xs text-gray-500">Đang tải...</span>}
        </div>
        {formData.fileDinhKem.length > 0 && (
          <div className="border rounded-md p-2 space-y-1">
            {formData.fileDinhKem.map((url: string) => (
              <div key={url} className="flex items-center justify-between gap-2 text-xs">
                <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline">
                  {fileName(url)}
                </a>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-red-600"
                  onClick={() => removeFile(url)}>
                  Xóa
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting || uploading} className="w-full sm:w-auto">
          {isSubmitting ? 'Đang gửi...' : (thongBao ? 'Cập nhật' : 'Tạo & gửi thông báo')}
        </Button>
      </DialogFooter>
    </form>
  );
}
