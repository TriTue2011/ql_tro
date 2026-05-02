'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Separator } from '@/components/ui/separator';
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
  Edit,
  Home,
  Users,
  Image,
  Building2,
  ChevronDown,
  ChevronRight,
  X,
  Phone,
  MapPin,
  Ruler,
  DollarSign,
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
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';
import { useCanEdit } from '@/hooks/use-can-edit';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';

export default function PhongPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const cache = useCache<{
    phongList: Phong[];
    toaNhaList: ToaNha[];
  }>({ key: 'phong-data', duration: 300000 });

  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToaNha, setSelectedToaNha] = useState('');
  const [selectedTrangThai, setSelectedTrangThai] = useState('');
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [viewingPhongName, setViewingPhongName] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewingTenants, setViewingTenants] = useState<any[]>([]);
  const [viewingTenantsPhongName, setViewingTenantsPhongName] = useState('');
  const [showTenantsViewer, setShowTenantsViewer] = useState(false);
  const [openBuildings, setOpenBuildings] = useState<Set<string>>(new Set());
  const [selectedPhongId, setSelectedPhongId] = useState<string | null>(null);

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

  useRealtimeEvents(['phong', 'hop-dong'], (_type, _action) => {
    cache.clearCache();
    fetchPhong(true);
  });

  const fetchPhong = async (forceRefresh = false) => {
    try {
      setLoading(true);
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
      const response = await fetch(`/api/phong?${params.toString()}&limit=100`);
      let phongData: Phong[] = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          phongData = result.data;
          setPhongList(phongData);
        }
      }
      const toaNhaResponse = await fetch('/api/toa-nha');
      let toaNhaData: ToaNha[] = [];
      if (toaNhaResponse.ok) {
        const toaNhaResult = await toaNhaResponse.json();
        if (toaNhaResult.success) {
          toaNhaData = toaNhaResult.data;
          setToaNhaList(toaNhaData);
        }
      }
      if (phongData.length > 0 || toaNhaData.length > 0) {
        cache.setCache({ phongList: phongData, toaNhaList: toaNhaData });
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
        if (result.success) setToaNhaList(result.data);
      }
    } catch (error) {
      console.error('Error fetching toa nha:', error);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchPhong(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  useEffect(() => {
    if (selectedToaNha || selectedTrangThai) fetchPhong(true);
  }, [selectedToaNha, selectedTrangThai]);

  const filteredPhong = phongList.filter(phong =>
    phong.maPhong.toLowerCase().includes(searchTerm.toLowerCase()) ||
    phong.moTa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPhongToaNhaId = (phong: Phong): string => {
    const p = phong as any;
    if (p.toaNhaId) return p.toaNhaId;
    if (typeof p.toaNha === 'object' && p.toaNha?.id) return p.toaNha.id;
    if (typeof p.toaNha === 'string') return p.toaNha;
    return '';
  };

  const groupedPhong = toaNhaList
    .map(toa => ({ toa, phongs: filteredPhong.filter(p => getPhongToaNhaId(p) === toa.id) }))
    .filter(g => g.phongs.length > 0);

  const handleOpenCreate = () => router.push('/dashboard/phong/them-moi');

  const handleEdit = (phong: Phong) => router.push(`/dashboard/phong/${phong.id}`);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/phong/${id}`, { method: 'DELETE' });
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
      setShowImageViewer(true);
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
      setShowTenantsViewer(true);
    } else {
      toast.info('Phòng này chưa có người thuê');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-indigo-200 rounded w-48 animate-pulse" />
          <div className="h-10 bg-indigo-200 rounded w-32 animate-pulse" />
        </div>
        <div className="h-96 bg-indigo-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Quản lý phòng"
        description="Danh sách tất cả phòng trong hệ thống"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? handleOpenCreate : undefined}
        addLabel="Thêm phòng"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng số phòng</p>
              <p className="text-lg md:text-xl font-bold text-indigo-900">{phongList.length}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Home className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Phòng trống</p>
              <p className="text-lg md:text-xl font-bold text-green-600">{phongList.filter(p => p.trangThai === 'trong').length}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Đang thuê</p>
              <p className="text-lg md:text-xl font-bold text-blue-600">{phongList.filter(p => p.trangThai === 'dangThue').length}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Bảo trì</p>
              <p className="text-lg md:text-xl font-bold text-red-600">{phongList.filter(p => p.trangThai === 'baoTri').length}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {groupedPhong.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center">
            <Home className="h-10 w-10 mx-auto text-indigo-400 mb-3" />
            <h3 className="text-base font-medium text-indigo-900 mb-1">Không tìm thấy phòng nào</h3>
            <p className="text-sm text-indigo-600">Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
          </div>
        ) : (
          groupedPhong.map(({ toa, phongs }) => {
            const isOpen = openBuildings.has(toa.id!);
            const soTrong = phongs.filter(p => p.trangThai === 'trong').length;
            const soDangThue = phongs.filter(p => p.trangThai === 'dangThue').length;
            const soBaoTri = phongs.filter(p => p.trangThai === 'baoTri').length;
            return (
              <div key={toa.id} className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleBuilding(toa.id!)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-5 w-5 text-white shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold text-white text-sm md:text-base">{toa.tenToaNha}</span>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-indigo-100">{phongs.length} phòng</span>
                        {soTrong > 0 && <span className="text-[10px] text-green-200">{soTrong} trống</span>}
                        {soDangThue > 0 && <span className="text-[10px] text-blue-200">{soDangThue} đang thuê</span>}
                        {soBaoTri > 0 && <span className="text-[10px] text-red-200">{soBaoTri} bảo trì</span>}
                      </div>
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-white/80 shrink-0" /> : <ChevronRight className="h-4 w-4 text-white/80 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-3 bg-white">
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
                    <div className="md:hidden grid grid-cols-1 gap-3">
                      {phongs.map((phong) => {
                        const hopDong = (phong as any).hopDongHienTai;
                        const isSelected = selectedPhongId === phong.id;
                        return (
                          <div key={phong.id}>
                            <div className={`rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-indigo-400' : ''}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-start gap-2 flex-1">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(v) => setSelectedPhongId(v === true ? phong.id! : null)}
                                    className="mt-1 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                  />
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-base text-indigo-900">{phong.maPhong}</h3>
                                    <p className="text-xs text-indigo-600">Tầng {phong.tang} • {phong.dienTich}m²</p>
                                  </div>
                                </div>
                                <Badge className={`text-xs border-indigo-200 ${{ trong: 'bg-green-50 text-green-700', daDat: 'bg-yellow-50 text-yellow-700', dangThue: 'bg-indigo-600 text-white', baoTri: 'bg-red-50 text-red-700' }[phong.trangThai] ?? 'bg-indigo-50 text-indigo-700'}`}>
                                  {{ trong: 'Trống', daDat: 'Đã đặt', dangThue: 'Đang thuê', baoTri: 'Bảo trì' }[phong.trangThai] ?? phong.trangThai}
                                </Badge>
                              </div>
                              <div className="space-y-1 mb-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-indigo-600">Giá thuê:</span>
                                  <span className="font-semibold text-green-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(phong.giaThue)}</span>
                                </div>
                              </div>
                              {hopDong?.khachThue?.length > 0 && (
                                <div className="mb-3 p-2 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                                    <span className="text-xs font-medium text-indigo-900">Người thuê</span>
                                  </div>
                                  <p className="text-sm font-medium text-indigo-800">{hopDong.nguoiDaiDien?.hoTen || 'N/A'}</p>
                                  {hopDong.khachThue.length > 1 && (
                                    <Button variant="link" size="sm" className="text-xs text-indigo-600 h-auto p-0 mt-0.5" onClick={() => handleViewTenants(phong)}>
                                      +{hopDong.khachThue.length - 1} người khác
                                    </Button>
                                  )}
                                </div>
                              )}
                              {canEdit && (
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => handleEdit(phong)} className="flex-1 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                    <Edit className="h-3.5 w-3.5 mr-1" />Sửa
                                  </Button>
                                  <DeleteConfirmPopover
                                    onConfirm={() => handleDelete(phong.id!)}
                                    title="Xóa phòng"
                                    description="Bạn có chắc chắn muốn xóa phòng này?"
                                    className="text-indigo-700 hover:text-red-700 hover:bg-red-50"
                                  />
                                </div>
                              )}
                            </div>
                            
                            {/* Detail panel - shown when checkbox is checked */}
                            {isSelected && (
                              <div className="mt-2 rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center gap-2 text-indigo-800 font-medium text-sm border-b border-indigo-200 pb-2">
                                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                                      <Home className="h-3 w-3 text-white" />
                                    </div>
                                    Chi tiết phòng {phong.maPhong}
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <span className="text-indigo-500">Mã phòng:</span>
                                      <p className="font-medium text-indigo-900">{phong.maPhong}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Tầng:</span>
                                      <p className="font-medium text-indigo-900">{phong.tang}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Diện tích:</span>
                                      <p className="font-medium text-indigo-900">{phong.dienTich}m²</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Số người tối đa:</span>
                                      <p className="font-medium text-indigo-900">{phong.soNguoiToiDa}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Giá thuê:</span>
                                      <p className="font-semibold text-green-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(phong.giaThue)}</p>
                                    </div>
                                    <div>
                                      <span className="text-indigo-500">Tiền cọc:</span>
                                      <p className="font-semibold text-indigo-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(phong.tienCoc)}</p>
                                    </div>
                                  </div>
                                  
                                  {phong.moTa && (
                                    <div className="text-sm">
                                      <span className="text-indigo-500">Mô tả:</span>
                                      <p className="mt-0.5 text-indigo-800">{phong.moTa}</p>
                                    </div>
                                  )}
                                  
                                  {phong.tienNghi && phong.tienNghi.length > 0 && (
                                    <div className="text-sm">
                                      <span className="text-indigo-500">Tiện nghi:</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {phong.tienNghi.map((tn) => (
                                          <Badge key={tn} variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">{tn}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {hopDong && (
                                    <div className="text-sm border-t border-indigo-200 pt-2">
                                      <span className="text-indigo-500">Hợp đồng hiện tại:</span>
                                      <div className="mt-1 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-2 space-y-1">
                                        <p className="font-medium text-indigo-900">{hopDong.nguoiDaiDien?.hoTen || 'N/A'}</p>
                                        {hopDong.khachThue?.map((kt: any) => (
                                          <p key={kt.id} className="text-xs text-indigo-600 flex items-center gap-1">
                                            <Users className="h-3 w-3" />{kt.hoTen} - {kt.soDienThoai}
                                          </p>
                                        ))}
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
          })
        )}
      </div>

      <div className="md:hidden space-y-2">
        <SearchInput placeholder="Tìm kiếm phòng..." value={searchTerm} onChange={setSearchTerm} />
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

      {showImageViewer && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                <Image className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-indigo-900">Ảnh phòng {viewingPhongName}</h3>
              <span className="text-xs text-indigo-500">({viewingImages.length} ảnh)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowImageViewer(false)} className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {viewingImages.length > 0 && (
              <Carousel className="w-full max-w-2xl mx-auto">
                <CarouselContent>
                  {viewingImages.map((image, index) => (
                    <CarouselItem key={index}>
                      <div className="flex items-center justify-center p-1 md:p-2">
                        <img src={image} alt={`Ảnh ${index + 1} của phòng ${viewingPhongName}`} className="max-h-[50vh] md:max-h-[60vh] w-auto object-contain rounded-lg" />
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
        </div>
      )}

      {showTenantsViewer && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                <Users className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-indigo-900">Danh sách người thuê - Phòng {viewingTenantsPhongName}</h3>
              <span className="text-xs text-indigo-500">(Tổng cộng {viewingTenants.length} người)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowTenantsViewer(false)} className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {viewingTenants.map((tenant, index) => (
              <div key={tenant.id || index} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="p-3 md:p-4">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                        <Users className="h-5 w-5 md:h-6 md:w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <h3 className="text-base md:text-lg font-semibold text-indigo-900">{tenant.hoTen}</h3>
                        <Badge variant="outline" className="ml-2 text-xs border-indigo-200 text-indigo-600 bg-indigo-50">#{index + 1}</Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-indigo-600">SĐT:</span>
                          <span className="text-indigo-900">{tenant.soDienThoai}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
