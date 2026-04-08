'use client';

import { useState, useEffect } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
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
  Home,
  MapPin,
  Users,
  Eye,
  ExternalLink,
  Copy,
  Info,
  Image,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Building2,
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Phong, ToaNha } from '@/types';
import { PhongDataTable } from './table';
import { PhongImageUpload } from '@/components/ui/phong-image-upload';
import { buildUploadFolder } from '@/lib/upload-path';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useCanEdit } from '@/hooks/use-can-edit';

export default function PhongPage() {
  const canEdit = useCanEdit();
  const cache = useCache<{
    phongList: Phong[];
    toaNhaList: ToaNha[];
  }>({ key: 'phong-data', duration: 300000 }); // 5 phút
  
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToaNha, setSelectedToaNha] = useState('');
  const [selectedTrangThai, setSelectedTrangThai] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPhong, setEditingPhong] = useState<Phong | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [viewingPhongName, setViewingPhongName] = useState('');
  const [isTenantsViewerOpen, setIsTenantsViewerOpen] = useState(false);
  const [viewingTenants, setViewingTenants] = useState<any[]>([]);
  const [viewingTenantsPhongName, setViewingTenantsPhongName] = useState('');
  // Accordion: set of toaNhaId đang mở (mặc định tất cả ẩn)
  const [openBuildings, setOpenBuildings] = useState<Set<string>>(new Set());
  const toggleBuilding = (id: string) =>
    setOpenBuildings(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    document.title = 'Quản lý Phòng';
  }, []);

  useEffect(() => {
    fetchPhong();
    fetchToaNha();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['phong', 'hop-dong'], (_type, _action) => {
    cache.clearCache();
    fetchPhong(true);
  });

  const fetchPhong = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Thử load từ cache trước (nếu không force refresh)
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setPhongList(cachedData.phongList || []);
          setToaNhaList(cachedData.toaNhaList || []);
          setLoading(false);
          return;
        }
      }
      
      const params = new URLSearchParams();
      if (selectedToaNha && selectedToaNha !== 'all') params.append('toaNha', selectedToaNha);
      if (selectedTrangThai && selectedTrangThai !== 'all') params.append('trangThai', selectedTrangThai);
      
      // Fetch phong
      const response = await fetch(`/api/phong?${params.toString()}&limit=100`);
      let phongData: Phong[] = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          phongData = result.data;
          setPhongList(phongData);
        }
      }
      
      // Fetch toa nha
      const toaNhaResponse = await fetch('/api/toa-nha');
      let toaNhaData: ToaNha[] = [];
      if (toaNhaResponse.ok) {
        const toaNhaResult = await toaNhaResponse.json();
        if (toaNhaResult.success) {
          toaNhaData = toaNhaResult.data;
          setToaNhaList(toaNhaData);
        }
      }
      
      // Lưu cache với data mới
      if (phongData.length > 0 || toaNhaData.length > 0) {
        cache.setCache({
          phongList: phongData,
          toaNhaList: toaNhaData,
        });
      }
    } catch (error) {
      console.error('Error fetching phong:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchToaNha = async () => {
    try {
      const response = await fetch('/api/toa-nha');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setToaNhaList(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching toa nha:', error);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchPhong(true); // Force refresh
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  useEffect(() => {
    // Khi filter thay đổi, cần force refresh để lấy data mới theo filter
    if (selectedToaNha || selectedTrangThai) {
      fetchPhong(true);
    }
  }, [selectedToaNha, selectedTrangThai]);

  const filteredPhong = phongList.filter(phong =>
    phong.maPhong.toLowerCase().includes(searchTerm.toLowerCase()) ||
    phong.moTa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper lấy toaNhaId từ phong (có thể là string hoặc object)
  const getPhongToaNhaId = (phong: Phong): string => {
    const p = phong as any;
    if (p.toaNhaId) return p.toaNhaId;
    if (typeof p.toaNha === 'object' && p.toaNha?.id) return p.toaNha.id;
    if (typeof p.toaNha === 'string') return p.toaNha;
    return '';
  };

  // Nhóm phòng theo tòa nhà (chỉ tòa có phòng thoả filter)
  const groupedPhong = toaNhaList
    .map(toa => ({
      toa,
      phongs: filteredPhong.filter(p => getPhongToaNhaId(p) === toa.id),
    }))
    .filter(g => g.phongs.length > 0);

  const handleEdit = (phong: Phong) => {
    setEditingPhong(phong);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/phong/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          cache.clearCache();
          setPhongList(prev => prev.filter(phong => phong.id !== id));
          toast.success('Xóa phòng thành công!');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra khi xóa phòng');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra khi xóa phòng');
      }
    } catch (error) {
      console.error('Error deleting phong:', error);
      toast.error('Có lỗi xảy ra khi xóa phòng');
    }
  };

  const handleViewImages = (phong: Phong) => {
    if (phong.anhPhong && phong.anhPhong.length > 0) {
      setViewingImages(phong.anhPhong);
      setViewingPhongName(phong.maPhong);
      setIsImageViewerOpen(true);
    } else {
      toast.info('Phòng này chưa có ảnh nào');
    }
  };

  const handleViewTenants = (phong: Phong) => {
    const phongData = phong as any;
    const hopDong = phongData.hopDongHienTai;
    
    if (hopDong && hopDong.khachThue && hopDong.khachThue.length > 0) {
      setViewingTenants(hopDong.khachThue);
      setViewingTenantsPhongName(phong.maPhong);
      setIsTenantsViewerOpen(true);
    } else {
      toast.info('Phòng này chưa có người thuê');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Quản lý phòng</h1>
          <p className="text-xs md:text-sm text-gray-600">Danh sách tất cả phòng trong hệ thống</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={cache.isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${cache.isRefreshing ? 'animate-spin' : ''}`} />
            {cache.isRefreshing ? 'Đang tải...' : 'Tải mới'}
          </Button>
     
          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditingPhong(null)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm phòng
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
                <DialogHeader>
                  <DialogTitle className="text-base md:text-lg">
                    {editingPhong ? 'Chỉnh sửa phòng' : 'Thêm phòng mới'}
                  </DialogTitle>
                  <DialogDescription className="text-xs md:text-sm">
                    {editingPhong ? 'Cập nhật thông tin phòng' : 'Nhập thông tin phòng mới'}
                  </DialogDescription>
                </DialogHeader>

                <PhongForm
                  phong={editingPhong}
                  toaNhaList={toaNhaList}
                  onClose={() => setIsDialogOpen(false)}
                  onSuccess={() => {
                    cache.clearCache();
                    setIsDialogOpen(false);
                    fetchPhong(true);
                    toast.success(editingPhong ? 'Cập nhật phòng thành công!' : 'Thêm phòng thành công!');
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <Card className="p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Tổng số phòng</p>
              <p className="text-lg md:text-xl font-bold">{phongList.length}</p>
            </div>
            <Home className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Phòng trống</p>
              <p className="text-lg md:text-xl font-bold text-green-600">
                {phongList.filter(p => p.trangThai === 'trong').length}
              </p>
            </div>
            <Users className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Đang thuê</p>
              <p className="text-lg md:text-xl font-bold text-blue-600">
                {phongList.filter(p => p.trangThai === 'dangThue').length}
              </p>
            </div>
            <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Bảo trì</p>
              <p className="text-lg md:text-xl font-bold text-red-600">
                {phongList.filter(p => p.trangThai === 'baoTri').length}
              </p>
            </div>
            <Users className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Grouped by building — Desktop + Mobile */}
      <div className="space-y-3">
        {groupedPhong.length === 0 ? (
          <Card className="p-6 text-center">
            <Home className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">Không tìm thấy phòng nào</h3>
            <p className="text-sm text-gray-600">Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
          </Card>
        ) : (
          groupedPhong.map(({ toa, phongs }) => {
            const isOpen = openBuildings.has(toa.id!);
            const soTrong   = phongs.filter(p => p.trangThai === 'trong').length;
            const soDangThue = phongs.filter(p => p.trangThai === 'dangThue').length;
            const soBaoTri  = phongs.filter(p => p.trangThai === 'baoTri').length;
            return (
              <div key={toa.id} className="border rounded-lg overflow-hidden shadow-sm">
                {/* Building header — toggle */}
                <button
                  type="button"
                  onClick={() => toggleBuilding(toa.id!)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900 text-sm md:text-base">{toa.tenToaNha}</span>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-500">{phongs.length} phòng</span>
                        {soTrong > 0    && <span className="text-[10px] text-green-600">{soTrong} trống</span>}
                        {soDangThue > 0 && <span className="text-[10px] text-blue-600">{soDangThue} đang thuê</span>}
                        {soBaoTri > 0   && <span className="text-[10px] text-red-500">{soBaoTri} bảo trì</span>}
                      </div>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                  }
                </button>

                {/* Building rooms — collapsible */}
                {isOpen && (
                  <div className="p-3 bg-white">
                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <PhongDataTable
                        data={phongs}
                        toaNhaList={toaNhaList}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onViewImages={handleViewImages}
                        onViewTenants={handleViewTenants}
                        searchTerm=""
                        onSearchChange={() => {}}
                        selectedToaNha={toa.id || ''}
                        onToaNhaChange={() => {}}
                        selectedTrangThai={selectedTrangThai}
                        onTrangThaiChange={setSelectedTrangThai}
                        allToaNhaList={toaNhaList}
                        canEdit={canEdit}
                      />
                    </div>
                    {/* Mobile cards */}
                    <div className="md:hidden grid grid-cols-1 gap-3">
                      {phongs.map((phong) => {
                        const hopDong = (phong as any).hopDongHienTai;
                        return (
                          <Card key={phong.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-base">{phong.maPhong}</h3>
                                  <p className="text-xs text-gray-600">Tầng {phong.tang} • {phong.dienTich}m²</p>
                                </div>
                                <Badge className={`text-xs ${{
                                  trong: 'bg-green-100 text-green-800',
                                  daDat: 'bg-yellow-100 text-yellow-800',
                                  dangThue: 'bg-green-600 text-white',
                                  baoTri: 'bg-red-100 text-red-800',
                                }[phong.trangThai] ?? 'bg-gray-100 text-gray-800'}`}>
                                  {{ trong:'Trống', daDat:'Đã đặt', dangThue:'Đang thuê', baoTri:'Bảo trì' }[phong.trangThai] ?? phong.trangThai}
                                </Badge>
                              </div>
                              <div className="space-y-1 mb-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Giá thuê:</span>
                                  <span className="font-semibold text-green-600">
                                    {new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(phong.giaThue)}
                                  </span>
                                </div>
                              </div>
                              {hopDong?.khachThue?.length > 0 && (
                                <div className="mb-3 p-2 bg-blue-50 rounded-md border border-blue-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Users className="h-3.5 w-3.5 text-blue-600" />
                                    <span className="text-xs font-medium text-blue-900">Người thuê</span>
                                  </div>
                                  <p className="text-sm font-medium">{hopDong.nguoiDaiDien?.hoTen || 'N/A'}</p>
                                  {hopDong.khachThue.length > 1 && (
                                    <Button variant="link" size="sm" className="text-xs text-blue-600 h-auto p-0 mt-0.5"
                                      onClick={() => handleViewTenants(phong)}>
                                      +{hopDong.khachThue.length - 1} người khác
                                    </Button>
                                  )}
                                </div>
                              )}
                              {canEdit && (
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => handleEdit(phong)} className="flex-1 text-xs">
                                    <Edit className="h-3.5 w-3.5 mr-1" />Sửa
                                  </Button>
                                  <DeleteConfirmPopover
                                    onConfirm={() => handleDelete(phong.id!)}
                                    title="Xóa phòng"
                                    description="Bạn có chắc chắn muốn xóa phòng này?"
                                    className="text-black hover:text-red-700 hover:bg-red-50"
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* (Mobile filter bar — still useful for search/status filter) */}
      <div className="md:hidden space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm kiếm phòng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedToaNha} onValueChange={setSelectedToaNha}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Tòa nhà" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Tất cả tòa nhà</SelectItem>
              {toaNhaList.map(toa => (
                <SelectItem key={toa.id} value={toa.id!} className="text-sm">{toa.tenToaNha}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTrangThai} onValueChange={setSelectedTrangThai}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
              <SelectItem value="trong" className="text-sm">Trống</SelectItem>
              <SelectItem value="daDat" className="text-sm">Đã đặt</SelectItem>
              <SelectItem value="dangThue" className="text-sm">Đang thuê</SelectItem>
              <SelectItem value="baoTri" className="text-sm">Bảo trì</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legacy mobile card list — now hidden (handled by grouped view above) */}
      <div className="hidden">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Danh sách phòng</h2>
          <span className="text-xs text-gray-600">{filteredPhong.length} phòng</span>
        </div>
        
        {filteredPhong.length === 0 ? (
          <Card className="p-6 text-center">
            <Home className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">Không tìm thấy phòng nào</h3>
            <p className="text-sm text-gray-600">Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredPhong.map((phong) => {
              const getTrangThaiColor = (trangThai: string) => {
                switch (trangThai) {
                  case 'trong': return 'bg-green-100 text-green-800';
                  case 'daDat': return 'bg-yellow-100 text-yellow-800';
                  case 'dangThue': return 'bg-blue-100 text-blue-800';
                  case 'baoTri': return 'bg-red-100 text-red-800';
                  default: return 'bg-gray-100 text-gray-800';
                }
              };

              const getTrangThaiText = (trangThai: string) => {
                switch (trangThai) {
                  case 'trong': return 'Trống';
                  case 'daDat': return 'Đã đặt';
                  case 'dangThue': return 'Đang thuê';
                  case 'baoTri': return 'Bảo trì';
                  default: return trangThai;
                }
              };

              return (
                <Card key={phong.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">{phong.maPhong}</h3>
                        <p className="text-xs text-gray-600">Tầng {phong.tang} • {phong.dienTich}m²</p>
                      </div>
                      <Badge className={`${getTrangThaiColor(phong.trangThai)} text-xs`}>
                        {getTrangThaiText(phong.trangThai)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Giá thuê:</span>
                        <span className="font-semibold text-green-600">
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND'
                          }).format(phong.giaThue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tiền cọc:</span>
                        <span className="font-medium text-orange-600">
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND'
                          }).format(phong.tienCoc)}
                        </span>
                      </div>
                    </div>

                    {/* Thông tin người thuê */}
                    {(() => {
                      const phongData = phong as any;
                      const hopDong = phongData.hopDongHienTai;
                      
                      if (hopDong && hopDong.khachThue && hopDong.khachThue.length > 0) {
                        const nguoiDaiDien = hopDong.nguoiDaiDien;
                        const soLuongKhachThue = hopDong.khachThue.length;
                        
                        return (
                          <div className="mb-3 p-2 bg-blue-50 rounded-md border border-blue-200">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Users className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-xs font-medium text-blue-900">Người thuê</span>
                            </div>
                            <div className="text-sm text-gray-900 font-medium">
                              {nguoiDaiDien?.hoTen || 'N/A'}
                            </div>
                            {nguoiDaiDien?.soDienThoai && (
                              <div className="text-xs text-gray-600">
                                {nguoiDaiDien.soDienThoai}
                              </div>
                            )}
                            {soLuongKhachThue > 1 && (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-xs text-blue-600 hover:text-blue-700 h-auto p-0 mt-0.5"
                                onClick={() => handleViewTenants(phong)}
                              >
                                +{soLuongKhachThue - 1} người khác
                              </Button>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {phong.anhPhong && phong.anhPhong.length > 0 && (
                      <div className="mb-3">
                        <img 
                          src={phong.anhPhong[0]} 
                          alt={phong.maPhong}
                          className="w-full h-32 object-cover rounded-md"
                          onClick={() => handleViewImages(phong)}
                        />
                        {phong.anhPhong.length > 1 && (
                          <div className="text-xs text-gray-600 mt-1">
                            +{phong.anhPhong.length - 1} ảnh khác
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {phong.anhPhong && phong.anhPhong.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewImages(phong)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Xem ảnh phòng"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const publicUrl = `${window.location.origin}/xem-phong`;
                            navigator.clipboard.writeText(publicUrl);
                            toast.success('Đã sao chép link trang xem phòng');
                          }}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Copy link trang xem phòng"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(phong)}
                          className="flex-1 text-xs"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Sửa
                        </Button>
                        <DeleteConfirmPopover
                          onConfirm={() => handleDelete(phong.id!)}
                          title="Xóa phòng"
                          description="Bạn có chắc chắn muốn xóa phòng này?"
                          className="text-black hover:text-red-700 hover:bg-red-50"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              <Image className="h-4 w-4 md:h-5 md:w-5" />
              Ảnh phòng {viewingPhongName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {viewingImages.length > 0 && (
              <Carousel className="w-full">
                <CarouselContent>
                  {viewingImages.map((image, index) => (
                    <CarouselItem key={index}>
                      <div className="flex items-center justify-center p-1 md:p-2">
                        <img
                          src={image}
                          alt={`Ảnh ${index + 1} của phòng ${viewingPhongName}`}
                          className="max-h-[50vh] md:max-h-[60vh] w-auto object-contain rounded-lg"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {viewingImages.length > 1 && (
                  <>
                    <CarouselPrevious className="hidden md:flex" />
                    <CarouselNext className="hidden md:flex" />
                  </>
                )}
              </Carousel>
            )}
          </div>
          
          <DialogFooter>
            <div className="text-xs md:text-sm text-gray-600">
              {viewingImages.length} ảnh {viewingImages.length > 1 && '- Vuốt để xem thêm'}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenants Viewer Dialog */}
      <Dialog open={isTenantsViewerOpen} onOpenChange={setIsTenantsViewerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              <Users className="h-4 w-4 md:h-5 md:w-5" />
              Danh sách người thuê - Phòng {viewingTenantsPhongName}
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Tổng cộng {viewingTenants.length} người đang thuê phòng này
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 md:space-y-4 py-2 md:py-4">
            {viewingTenants.map((tenant, index) => (
              <Card key={tenant.id || index} className="overflow-hidden">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <h3 className="text-base md:text-lg font-semibold text-gray-900">
                          {tenant.hoTen}
                        </h3>
                        <Badge variant="outline" className="ml-2 text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-600">SĐT:</span>
                          <span className="text-gray-900">{tenant.soDienThoai}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTenantsViewerOpen(false)} className="text-sm">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for adding/editing phong
function PhongForm({ 
  phong, 
  toaNhaList,
  onClose, 
  onSuccess 
}: { 
  phong: Phong | null;
  toaNhaList: ToaNha[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Helper function để lấy toaNha ID
  const getToaNhaId = (toaNha: string | { id: string }) => {
    if (typeof toaNha === 'object' && toaNha !== null) {
      return toaNha.id || '';
    } else if (typeof toaNha === 'string') {
      return toaNha;
    }
    return '';
  };

  const [formData, setFormData] = useState({
    maPhong: phong?.maPhong || '',
    toaNha: phong?.toaNha ? getToaNhaId(phong.toaNha) : '',
    tang: phong?.tang || 1,
    dienTich: phong?.dienTich || 0,
    giaThue: phong?.giaThue || 0,
    tienCoc: phong?.tienCoc || 0,
    moTa: phong?.moTa || '',
    anhPhong: phong?.anhPhong || [],
    tienNghi: phong?.tienNghi || [],
    soNguoiToiDa: phong?.soNguoiToiDa || 1,
    ngayTinhTien: phong?.ngayTinhTien ?? 1,
    trangThai: phong?.trangThai || 'trong',
  });

  // Khách thuê hiện tại
  const currentHopDong = (phong as any)?.hopDong?.find((h: any) => h.trangThai === 'hoatDong');
  const currentKhachThueName = currentHopDong?.khachThue?.map((k: any) => k.hoTen).join(', ') || '';
  const [availableKhachThue, setAvailableKhachThue] = useState<{ id: string; hoTen: string; soDienThoai: string }[]>([]);
  const [selectedKhachThueId, setSelectedKhachThueId] = useState('');
  const [assigningKhachThue, setAssigningKhachThue] = useState(false);

  useEffect(() => {
    fetch('/api/khach-thue?limit=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAvailableKhachThue(d.data
            .filter((k: any) => k.trangThai === 'chuaThue')
            .map((k: any) => ({ id: k.id, hoTen: k.hoTen, soDienThoai: k.soDienThoai })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleAssignKhachThue() {
    if (!selectedKhachThueId || !phong) return;
    setAssigningKhachThue(true);
    try {
      const res = await fetch(`/api/phong/${phong.id}/thue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ khachThueId: selectedKhachThueId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã gán khách thuê vào phòng! Hợp đồng tối giản đã được tạo.');
        onSuccess();
      } else {
        toast.error(data.message || 'Không thể gán');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setAssigningKhachThue(false);
    }
  }

  async function handleUnassignKhachThue() {
    if (!phong) return;
    setAssigningKhachThue(true);
    try {
      const res = await fetch(`/api/phong/${phong.id}/thue`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã hủy gán khách thuê');
        onSuccess();
      } else {
        toast.error(data.message || 'Không thể hủy gán');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setAssigningKhachThue(false);
    }
  }

  // Cập nhật formData khi phong thay đổi
  useEffect(() => {
    if (phong) {
      const toaNhaId = getToaNhaId(phong.toaNha);
      
      console.log('Editing phong:', phong);
      console.log('toaNha object:', phong.toaNha);
      console.log('toaNha ID:', toaNhaId);
      
      setFormData({
        maPhong: phong.maPhong || '',
        toaNha: toaNhaId,
        tang: phong.tang || 1,
        dienTich: phong.dienTich || 0,
        giaThue: phong.giaThue || 0,
        tienCoc: phong.tienCoc || 0,
        moTa: phong.moTa || '',
        anhPhong: phong.anhPhong || [],
        tienNghi: phong.tienNghi || [],
        soNguoiToiDa: phong.soNguoiToiDa || 1,
        ngayTinhTien: phong.ngayTinhTien ?? 1,
        trangThai: phong.trangThai || 'trong',
      });
    } else {
      setFormData({
        maPhong: '',
        toaNha: '',
        tang: 1,
        dienTich: 0,
        giaThue: 0,
        tienCoc: 0,
        moTa: '',
        anhPhong: [],
        tienNghi: [],
        soNguoiToiDa: 1,
        ngayTinhTien: 1,
        trangThai: 'trong',
      });
    }
  }, [phong]);

  // Function format tiền
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const tienNghiOptions = [
    { value: 'dieuhoa', label: 'Điều hòa' },
    { value: 'nonglanh', label: 'Nóng lạnh' },
    { value: 'tulanh', label: 'Tủ lạnh' },
    { value: 'giuong', label: 'Giường' },
    { value: 'tuquanao', label: 'Tủ quần áo' },
    { value: 'banlamviec', label: 'Bàn làm việc' },
    { value: 'ghe', label: 'Ghế' },
    { value: 'tivi', label: 'TV' },
    { value: 'wifi', label: 'WiFi' },
    { value: 'maygiat', label: 'Máy giặt' },
    { value: 'bep', label: 'Bếp' },
    { value: 'noi', label: 'Nồi' },
    { value: 'chen', label: 'Chén' },
    { value: 'bat', label: 'Bát' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = phong ? `/api/phong/${phong.id}` : '/api/phong';
      const method = phong ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onSuccess();
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
    }
  };

  const handleTienNghiChange = (tienNghi: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tienNghi: checked 
        ? [...prev.tienNghi, tienNghi]
        : prev.tienNghi.filter(t => t !== tienNghi)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      <Tabs defaultValue="thong-tin" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="thong-tin" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Info className="h-3 w-3 md:h-4 md:w-4" />
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="anh-phong" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Image className="h-3 w-3 md:h-4 md:w-4" />
            Ảnh phòng
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="thong-tin" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          {/* Thông tin cơ bản */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="maPhong" className="text-sm">Mã phòng</Label>
              <Input
                id="maPhong"
                value={formData.maPhong}
                onChange={(e) => setFormData(prev => ({ ...prev, maPhong: e.target.value.toUpperCase() }))}
                required
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="toaNha" className="text-sm">Tòa nhà</Label>
              <Select value={formData.toaNha} onValueChange={(value) => setFormData(prev => ({ ...prev, toaNha: value }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn tòa nhà" />
                </SelectTrigger>
                <SelectContent>
                  {toaNhaList.map((toaNha) => (
                    <SelectItem key={toaNha.id} value={toaNha.id!} className="text-sm">
                      {toaNha.tenToaNha}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trangThai" className="text-sm">Trạng thái</Label>
              <Select value={formData.trangThai} onValueChange={(value) => setFormData(prev => ({ ...prev, trangThai: value as 'trong' | 'daDat' | 'dangThue' | 'baoTri' }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trong" className="text-sm">Trống</SelectItem>
                  <SelectItem value="daDat" className="text-sm">Đã đặt</SelectItem>
                  <SelectItem value="dangThue" className="text-sm">Đang thuê</SelectItem>
                  <SelectItem value="baoTri" className="text-sm">Bảo trì</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Thông tin phòng */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="tang" className="text-sm">Tầng</Label>
              <Input
                id="tang"
                type="number"
                min="0"
                value={formData.tang}
                onChange={(e) => setFormData(prev => ({ ...prev, tang: parseInt(e.target.value) || 0 }))}
                required
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dienTich" className="text-sm">Diện tích (m²)</Label>
              <Input
                id="dienTich"
                type="number"
                min="1"
                value={formData.dienTich}
                onChange={(e) => setFormData(prev => ({ ...prev, dienTich: parseInt(e.target.value) || 0 }))}
                required
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="soNguoiToiDa" className="text-sm">Số người tối đa</Label>
              <Input
                id="soNguoiToiDa"
                type="number"
                min="1"
                max="10"
                value={formData.soNguoiToiDa}
                onChange={(e) => setFormData(prev => ({ ...prev, soNguoiToiDa: parseInt(e.target.value) || 1 }))}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ngayTinhTien" className="text-sm">Ngày thu tiền hàng tháng</Label>
              <Input
                id="ngayTinhTien"
                type="number"
                min="1"
                max="28"
                value={formData.ngayTinhTien}
                onChange={(e) => setFormData(prev => ({ ...prev, ngayTinhTien: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) }))}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Ngày 1-28, dùng làm mặc định khi tạo hợp đồng</p>
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label className="text-sm">Preview</Label>
              <div className="h-10 bg-gray-50 border rounded-md flex items-center justify-center text-xs md:text-sm text-gray-500">
                Phòng {formData.maPhong || 'XXX'} - Tầng {formData.tang}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="giaThue" className="text-sm">Giá thuê (VNĐ)</Label>
              <Input
                id="giaThue"
                type="number"
                min="0"
                value={formData.giaThue}
                onChange={(e) => setFormData(prev => ({ ...prev, giaThue: parseInt(e.target.value) || 0 }))}
                required
                className="text-sm"
              />
              <span className="text-xs md:text-sm text-gray-500 font-medium">
                {formatCurrency(formData.giaThue)}
              </span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tienCoc" className="text-sm">Tiền cọc (VNĐ)</Label>
              <Input
                id="tienCoc"
                type="number"
                min="0"
                value={formData.tienCoc}
                onChange={(e) => setFormData(prev => ({ ...prev, tienCoc: parseInt(e.target.value) || 0 }))}
                required
                className="text-sm"
              />
              <span className="text-xs md:text-sm text-gray-500 font-medium">
                {formatCurrency(formData.tienCoc)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="moTa" className="text-sm">Mô tả</Label>
            <Textarea
              id="moTa"
              value={formData.moTa}
              onChange={(e) => setFormData(prev => ({ ...prev, moTa: e.target.value }))}
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Tiện nghi</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              {tienNghiOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={option.value}
                    checked={formData.tienNghi.includes(option.value)}
                    onChange={(e) => handleTienNghiChange(option.value, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={option.value} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="anh-phong" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          <div className="space-y-3 md:space-y-4">
            <div>
              <h3 className="text-base md:text-lg font-medium mb-1 md:mb-2">Quản lý ảnh phòng</h3>
              <p className="text-xs md:text-sm text-gray-600">
                Tải lên tối đa 10 ảnh để khách hàng có thể xem chi tiết phòng
              </p>
            </div>
            
            <PhongImageUpload
              images={formData.anhPhong}
              onImagesChange={(images: string[]) => setFormData(prev => ({ ...prev, anhPhong: images }))}
              maxImages={10}
              className="w-full"
              folder={buildUploadFolder(
                toaNhaList.find(t => t.id === formData.toaNha)?.tenToaNha || formData.toaNha,
                formData.maPhong,
              )}
            />
          </div>

          {/* ── Gán khách thuê ── */}
          {phong && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs md:text-sm font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Khách thuê hiện tại
              </Label>
              {currentKhachThueName ? (
                <div className="flex items-center justify-between rounded-md border bg-green-50 px-3 py-2">
                  <span className="text-sm font-medium text-green-800">{currentKhachThueName}</span>
                  <Button type="button" size="sm" variant="outline"
                    className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                    disabled={assigningKhachThue} onClick={handleUnassignKhachThue}>
                    {assigningKhachThue ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Hủy gán'}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedKhachThueId} onValueChange={setSelectedKhachThueId}>
                    <SelectTrigger className="text-sm flex-1">
                      <SelectValue placeholder="Chọn khách thuê..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKhachThue.length === 0 ? (
                        <SelectItem value="_none" disabled>Không có khách thuê chưa thuê</SelectItem>
                      ) : availableKhachThue.map(k => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.hoTen} — {k.soDienThoai}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" disabled={!selectedKhachThueId || assigningKhachThue} onClick={handleAssignKhachThue}>
                    {assigningKhachThue ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Gán'}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Gán sẽ tạo hợp đồng tối giản. Có thể chỉnh sửa trong mục Hợp đồng.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="text-sm">
          Hủy
        </Button>
        <Button type="submit" className="text-sm">
          {phong ? 'Cập nhật' : 'Thêm mới'}
        </Button>
      </DialogFooter>
    </form>
  );
}
