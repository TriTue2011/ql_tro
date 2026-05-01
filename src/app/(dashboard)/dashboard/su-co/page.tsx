'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  Home,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { SuCo, Phong, KhachThue } from '@/types';
import { useCanEdit } from '@/hooks/use-can-edit';
import { SuCoDataTable } from './table';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';

export default function SuCoPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const cache = useCache<{
    suCoList: SuCo[];
    phongList: Phong[];
    khachThueList: KhachThue[];
  }>({ key: 'su-co-data', duration: 300000 });
  
  const [suCoList, setSuCoList] = useState<SuCo[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    document.title = 'Quản lý Sự cố';
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['su-co'], (_type, _action) => {
    cache.clearCache();
    fetchData(true);
  });

  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setSuCoList(cachedData.suCoList || []);
          setPhongList(cachedData.phongList || []);
          setKhachThueList(cachedData.khachThueList || []);
          setLoading(false);
          return;
        }
      }
      
      // Fetch sự cố từ API
      const suCoResponse = await fetch('/api/su-co');
      const suCoData = await suCoResponse.json();
      const suCos = suCoData.success ? suCoData.data : [];
      setSuCoList(suCos);

      // Fetch phòng từ API
      const phongResponse = await fetch('/api/phong');
      const phongData = await phongResponse.json();
      const phongs = phongData.success ? phongData.data : [];
      setPhongList(phongs);

      // Fetch khách thuê từ API
      const khachThueResponse = await fetch('/api/khach-thue');
      const khachThueData = await khachThueResponse.json();
      const khachThues = khachThueData.success ? khachThueData.data : [];
      setKhachThueList(khachThues);
      
      cache.setCache({
        suCoList: suCos,
        phongList: phongs,
        khachThueList: khachThues,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      setSuCoList([]);
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

  const filteredSuCo = suCoList.filter(suCo => {
    const matchesSearch = suCo.tieuDe.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         suCo.moTa.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || suCo.trangThai === statusFilter;
    const matchesType = typeFilter === 'all' || suCo.loaiSuCo === typeFilter;
    const matchesPriority = priorityFilter === 'all' || suCo.mucDoUuTien === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'moi':
        return <Badge variant="destructive">Mới</Badge>;
      case 'dangXuLy':
        return <Badge variant="secondary">Đang xử lý</Badge>;
      case 'daXong':
        return <Badge variant="default">Đã xong</Badge>;
      case 'daHuy':
        return <Badge variant="outline">Đã hủy</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'dienNuoc':
        return <Badge variant="secondary">Điện nước</Badge>;
      case 'noiThat':
        return <Badge variant="outline">Nội thất</Badge>;
      case 'vesinh':
        return <Badge variant="outline">Vệ sinh</Badge>;
      case 'anNinh':
        return <Badge variant="outline">An ninh</Badge>;
      case 'khac':
        return <Badge variant="outline">Khác</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'thap':
        return <Badge variant="outline">Thấp</Badge>;
      case 'trungBinh':
        return <Badge variant="secondary">Trung bình</Badge>;
      case 'cao':
        return <Badge variant="destructive">Cao</Badge>;
      case 'khancap':
        return <Badge variant="destructive">Khẩn cấp</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getPhongName = (phong: string | { maPhong: string }) => {
    if (typeof phong === 'string') {
      const phongObj = phongList.find(p => p.id === phong);
      return phongObj?.maPhong || 'Không xác định';
    }
    return phong?.maPhong || 'Không xác định';
  };

  const getKhachThueName = (khachThue: string | { hoTen: string }) => {
    if (typeof khachThue === 'string') {
      const khachThueObj = khachThueList.find(k => k.id === khachThue);
      return khachThueObj?.hoTen || 'Không xác định';
    }
    return khachThue?.hoTen || 'Không xác định';
  };

  const handleEdit = (suCo: SuCo) => {
    router.push(`/dashboard/su-co/${suCo.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/su-co/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        cache.clearCache();
        setSuCoList(prev => prev.filter(suCo => suCo.id !== id));
        toast.success('Xóa sự cố thành công');
      } else {
        console.error('Error deleting su co:', result.message);
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error deleting su co:', error);
      toast.error('Có lỗi xảy ra khi xóa sự cố');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    let ghiChuXuLy = undefined;

    if (newStatus === 'daHuy') {
      const reason = window.prompt('Nhập lý do hủy sự cố (có thể để trống):');
      // Nếu người dùng bấm "Hủy" trên hộp thoại prompt
      if (reason === null) {
        return;
      }
      ghiChuXuLy = reason;
    }

    try {
      const response = await fetch(`/api/su-co/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trangThai: newStatus,
          ...(ghiChuXuLy !== undefined && { ghiChuXuLy }),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuCoList(prev => prev.map(suCo => {
          if (suCo.id === id) {
            return result.data;
          }
          return suCo;
        }));
        toast.success('Cập nhật trạng thái thành công');
      } else {
        console.error('Error updating status:', result.message);
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái');
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
      <PageHeader
        title="Quản lý sự cố"
        description="Theo dõi và xử lý các sự cố từ khách thuê"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => router.push('/dashboard/su-co/them-moi') : undefined}
        addLabel="Báo cáo sự cố"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Tổng sự cố</p>
              <p className="text-base md:text-2xl font-bold">{suCoList.length}</p>
            </div>
            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Mới</p>
              <p className="text-base md:text-2xl font-bold text-red-600">
                {suCoList.filter(s => s.trangThai === 'moi').length}
              </p>
            </div>
            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Đang xử lý</p>
              <p className="text-base md:text-2xl font-bold text-orange-600">
                {suCoList.filter(s => s.trangThai === 'dangXuLy').length}
              </p>
            </div>
            <Clock className="h-3 w-3 md:h-4 md:w-4 text-orange-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Đã xong</p>
              <p className="text-base md:text-2xl font-bold text-green-600">
                {suCoList.filter(s => s.trangThai === 'daXong').length}
              </p>
            </div>
            <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Danh sách sự cố</CardTitle>
          <CardDescription>
            {filteredSuCo.length} sự cố được tìm thấy
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <SuCoDataTable
            data={filteredSuCo}
            phongList={phongList}
            khachThueList={khachThueList}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            canEdit={canEdit}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
          />
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Danh sách sự cố</h2>
          <span className="text-sm text-gray-500">{filteredSuCo.length} sự cố</span>
        </div>
        
        {/* Mobile Filters */}
        <div className="space-y-2 mb-4">
          <SearchInput
            placeholder="Tìm kiếm sự cố..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <div className="grid grid-cols-3 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                <SelectItem value="moi" className="text-sm">Mới</SelectItem>
                <SelectItem value="dangXuLy" className="text-sm">Đang xử lý</SelectItem>
                <SelectItem value="daXong" className="text-sm">Đã xong</SelectItem>
                <SelectItem value="daHuy" className="text-sm">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                <SelectItem value="dienNuoc" className="text-sm">Điện nước</SelectItem>
                <SelectItem value="noiThat" className="text-sm">Nội thất</SelectItem>
                <SelectItem value="vesinh" className="text-sm">Vệ sinh</SelectItem>
                <SelectItem value="anNinh" className="text-sm">An ninh</SelectItem>
                <SelectItem value="khac" className="text-sm">Khác</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                <SelectItem value="thap" className="text-sm">Thấp</SelectItem>
                <SelectItem value="trungBinh" className="text-sm">Trung bình</SelectItem>
                <SelectItem value="cao" className="text-sm">Cao</SelectItem>
                <SelectItem value="khancap" className="text-sm">Khẩn cấp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile Card List */}
        <div className="space-y-3">
          {filteredSuCo.map((suCo) => {
            const phongInfo = typeof suCo.phong === 'object' ? suCo.phong : phongList.find(p => p.id === suCo.phong);
            const khachThueInfo = typeof suCo.nguoiBaoCao === 'object' ? suCo.nguoiBaoCao : khachThueList.find(k => k.id === suCo.nguoiBaoCao);
            
            return (
              <Card key={suCo.id} className="p-4">
                <div className="space-y-3">
                  {/* Header with title and status */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{suCo.tieuDe}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Home className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">
                          {phongInfo?.maPhong || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(suCo.trangThai)}
                      {getPriorityBadge(suCo.mucDoUuTien)}
                    </div>
                  </div>

                  {/* Reporter and type info */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600 truncate">
                        {khachThueInfo?.hoTen || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">{getTypeBadge(suCo.loaiSuCo)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>Báo cáo: {new Date(suCo.ngayBaoCao).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="border-t pt-2">
                    <p className="text-xs text-gray-600 line-clamp-2">{suCo.moTa}</p>
                  </div>

                  {/* Action buttons */}
                  {canEdit && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(suCo)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(suCo.id!)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredSuCo.length === 0 && (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không có sự cố nào</p>
          </div>
        )}
      </div>
    </div>
  );
}

