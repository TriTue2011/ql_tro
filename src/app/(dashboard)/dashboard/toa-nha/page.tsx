'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Building2,
  MapPin,
  Copy,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import { ToaNha } from '@/types';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';
import { ToaNhaDataTable } from './table';
import { useCanEdit } from '@/hooks/use-can-edit';

export default function ToaNhaPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const cache = useCache<{ toaNhaList: ToaNha[] }>({ key: 'toa-nha-data', duration: 300000 });
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Quản lý Tòa nhà';
  }, []);

  useEffect(() => {
    fetchToaNha();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['toa-nha'], (_type, _action) => {
    cache.clearCache();
    fetchToaNha(true);
  });

  const fetchToaNha = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setToaNhaList(cachedData.toaNhaList || []);
          setLoading(false);
          return;
        }
      }
      
      const response = await fetch('/api/toa-nha');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const toaNhas = result.data;
          setToaNhaList(toaNhas);
          cache.setCache({ toaNhaList: toaNhas });
        }
      }
    } catch (error) {
      console.error('Error fetching toa nha:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchToaNha(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  const filteredToaNha = toaNhaList.filter(toaNha =>
    toaNha.tenToaNha.toLowerCase().includes(searchTerm.toLowerCase()) ||
    toaNha.diaChi.duong.toLowerCase().includes(searchTerm.toLowerCase()) ||
    toaNha.diaChi.phuong.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (toaNha: ToaNha) => {
    router.push(`/dashboard/toa-nha/${toaNha.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/toa-nha/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          cache.clearCache();
          setToaNhaList(prev => prev.filter(toaNha => toaNha.id !== id));
          toast.success('Xóa tòa nhà thành công!');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra khi xóa tòa nhà');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra khi xóa tòa nhà');
      }
    } catch (error) {
      console.error('Error deleting toa nha:', error);
      toast.error('Có lỗi xảy ra khi xóa tòa nhà');
    }
  };

  const formatAddress = (diaChi: ToaNha['diaChi']) => {
    return `${diaChi.soNha} ${diaChi.duong}, ${diaChi.phuong}, ${diaChi.thanhPho}`;
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
        title="Quản lý tòa nhà"
        description="Danh sách tất cả tòa nhà trong hệ thống"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => router.push('/dashboard/toa-nha/them-moi') : undefined}
        addLabel="Thêm tòa nhà"
      />

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Tổng tòa nhà quản lý: {toaNhaList.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ToaNhaDataTable
            data={filteredToaNha}
            onEdit={handleEdit}
            onDelete={handleDelete}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Tổng tòa nhà quản lý: {toaNhaList.length}</h2>
        </div>

        {/* Mobile Filters */}
        <div className="space-y-2">
          <SearchInput
            placeholder="Tìm kiếm tòa nhà..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        
        {filteredToaNha.length === 0 ? (
          <Card className="p-6 text-center">
            <Building2 className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">Không tìm thấy tòa nhà nào</h3>
            <p className="text-sm text-gray-600">Thử thay đổi tìm kiếm</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredToaNha.map((toaNha) => {
              const phongTrong = (toaNha as any).phongTrong || 0;
              const phongDangThue = (toaNha as any).phongDangThue || 0;
              const tongPhong = toaNha.tongSoPhong;
              const isSelected = selectedId === toaNha.id;
              
              return (
                <div key={toaNha.id}>
                  <Card className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-400' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-2 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => setSelectedId(v === true ? toaNha.id! : null)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="h-4 w-4 text-blue-600" />
                              <h3 className="font-semibold text-base">{toaNha.tenToaNha}</h3>
                            </div>
                            <div className="flex items-start gap-1.5 text-xs text-gray-600">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{formatAddress(toaNha.diaChi)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-gray-50 rounded-md">
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Tổng</div>
                          <div className="text-sm font-semibold">{tongPhong}</div>
                        </div>
                        <div className="text-center border-x border-gray-200">
                          <div className="text-xs text-gray-600">Trống</div>
                          <div className="text-sm font-semibold text-green-600">{phongTrong}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Thuê</div>
                          <div className="text-sm font-semibold text-blue-600">{phongDangThue}</div>
                        </div>
                      </div>

                      {toaNha.tienNghiChung && toaNha.tienNghiChung.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-600 mb-1">Tiện nghi:</div>
                          <div className="flex flex-wrap gap-1">
                            {toaNha.tienNghiChung.slice(0, 3).map((tienNghi) => (
                              <Badge key={tienNghi} variant="secondary" className="text-xs">
                                {tienNghi}
                              </Badge>
                            ))}
                            {toaNha.tienNghiChung.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{toaNha.tienNghiChung.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex gap-2">
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
                          {canEdit && (
                          <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(toaNha)}
                            className="flex-1 text-xs"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Sửa
                          </Button>
                          <DeleteConfirmPopover
                            onConfirm={() => handleDelete(toaNha.id!)}
                            title="Xóa tòa nhà"
                            description="Bạn có chắc chắn muốn xóa tòa nhà này?"
                            className="text-black hover:text-red-700 hover:bg-red-50"
                          />
                          </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Detail panel - shown when checkbox is checked */}
                  {isSelected && (
                    <Card className="mt-2 border-blue-200 bg-blue-50/30 rounded-xl overflow-hidden">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-blue-800 font-medium text-sm border-b border-blue-200 pb-2">
                          <Building2 className="h-4 w-4" />
                          Chi tiết tòa nhà
                        </div>
                        
                        {/* Full address */}
                        <div className="text-sm">
                          <span className="text-gray-500">Địa chỉ:</span>
                          <p className="font-medium mt-0.5">{formatAddress(toaNha.diaChi)}</p>
                        </div>
                        
                        {/* Description */}
                        {toaNha.moTa && (
                          <div className="text-sm">
                            <span className="text-gray-500">Mô tả:</span>
                            <p className="mt-0.5">{toaNha.moTa}</p>
                          </div>
                        )}
                        
                        {/* All amenities */}
                        {toaNha.tienNghiChung && toaNha.tienNghiChung.length > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-500">Tiện nghi:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {toaNha.tienNghiChung.map((tienNghi) => (
                                <Badge key={tienNghi} variant="secondary" className="text-xs">
                                  {tienNghi}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Contact persons */}
                        {toaNha.lienHePhuTrach && toaNha.lienHePhuTrach.length > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-500">Liên hệ phụ trách:</span>
                            <div className="space-y-1.5 mt-1">
                              {toaNha.lienHePhuTrach.map((contact, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs bg-white/60 rounded-md p-2">
                                  <User className="h-3.5 w-3.5 text-blue-500" />
                                  <span className="font-medium">{contact.ten}</span>
                                  {contact.soDienThoai && (
                                    <span className="flex items-center gap-1 text-gray-600">
                                      <Phone className="h-3 w-3" />{contact.soDienThoai}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center text-sm bg-white/60 rounded-md p-2">
                          <div>
                            <div className="text-gray-500 text-xs">Tổng phòng</div>
                            <div className="font-semibold">{tongPhong}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">Phòng trống</div>
                            <div className="font-semibold text-green-600">{phongTrong}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">Đang thuê</div>
                            <div className="font-semibold text-blue-600">{phongDangThue}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
