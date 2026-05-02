'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { useSession } from 'next-auth/react';
import { useCanEdit } from '@/hooks/use-can-edit';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import {
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Calendar,
  Users,
  Download,
  Receipt,
  RefreshCw,
  FileText,
  Copy,
} from 'lucide-react';
import { ThanhToan, HoaDon } from '@/types';
import { toast } from 'sonner';
import { ThanhToanDataTable } from './table';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';

// Type cho ThanhToan đã được populate
type ThanhToanPopulated = Omit<ThanhToan, 'hoaDon'> & {
  hoaDon: string | HoaDon;
};

export default function ThanhToanPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canEdit = useCanEdit();
  const role = session?.user?.role ?? '';
  const canDelete = canEdit && ['admin', 'chuNha'].includes(role);

  const cache = useCache<{
    thanhToanList: ThanhToanPopulated[];
    hoaDonList: HoaDon[];
  }>({ key: 'thanh-toan-data', duration: 300000 });
  
  const [thanhToanList, setThanhToanList] = useState<ThanhToanPopulated[]>([]);
  const [hoaDonList, setHoaDonList] = useState<HoaDon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    document.title = 'Quản lý Thanh toán';
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['thanh-toan', 'hoa-don'], (_type, _action) => {
    cache.clearCache();
    fetchData(true);
  });

  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setThanhToanList(cachedData.thanhToanList || []);
          setHoaDonList(cachedData.hoaDonList || []);
          setLoading(false);
          return;
        }
      }
      
      // Fetch thanh toan từ API
      const thanhToanResponse = await fetch('/api/thanh-toan');
      const thanhToanData = thanhToanResponse.ok ? await thanhToanResponse.json() : { data: [] };
      const thanhToans = thanhToanData.data || [];
      setThanhToanList(thanhToans);

      // Fetch hoa don từ API để hiển thị thông tin
      const hoaDonResponse = await fetch('/api/hoa-don');
      const hoaDonData = hoaDonResponse.ok ? await hoaDonResponse.json() : { data: [] };
      const hoaDons = hoaDonData.data || [];
      setHoaDonList(hoaDons);
      
      cache.setCache({
        thanhToanList: thanhToans,
        hoaDonList: hoaDons,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
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

  const testPaymentAPI = async () => {
    try {
      const response = await fetch('/api/test-payment');
      if (response.ok) {
        const data = await response.json();
        console.log('Test API response:', data);
        alert('Check console for test data');
      }
    } catch (error) {
      console.error('Test API error:', error);
    }
  };

  const filteredThanhToan = thanhToanList.filter(thanhToan => {
    const matchesSearch = thanhToan.ghiChu?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         thanhToan.thongTinChuyenKhoan?.soGiaoDich?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = methodFilter === 'all' || thanhToan.phuongThuc === methodFilter;
    const matchesDate = dateFilter === 'all' || 
                       (dateFilter === 'today' && isToday(thanhToan.ngayThanhToan)) ||
                       (dateFilter === 'week' && isThisWeek(thanhToan.ngayThanhToan)) ||
                       (dateFilter === 'month' && isThisMonth(thanhToan.ngayThanhToan));
    
    return matchesSearch && matchesMethod && matchesDate;
  });

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'tienMat':
        return <Badge variant="default">Tiền mặt</Badge>;
      case 'chuyenKhoan':
        return <Badge variant="secondary">Chuyển khoản</Badge>;
      case 'viDienTu':
        return <Badge variant="outline">Ví điện tử</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const getHoaDonInfo = (hoaDon: string | any) => {
    console.log('getHoaDonInfo called with:', hoaDon, 'type:', typeof hoaDon);
    
    // Nếu hoaDon là object (đã được populate), lấy maHoaDon trực tiếp
    if (typeof hoaDon === 'object' && hoaDon?.maHoaDon) {
      console.log('Returning populated maHoaDon:', hoaDon.maHoaDon);
      return hoaDon.maHoaDon;
    }
    
    // Nếu hoaDon là string (ID), tìm trong hoaDonList
    if (typeof hoaDon === 'string') {
      const hoaDonItem = hoaDonList.find(h => h.id === hoaDon);
      console.log('Found hoaDon in list:', hoaDonItem?.maHoaDon);
      return hoaDonItem?.maHoaDon || 'Không xác định';
    }
    
    console.log('Returning default: Không xác định');
    return 'Không xác định';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isThisWeek = (date: Date) => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo && date <= today;
  };

  const isThisMonth = (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const handleEdit = (thanhToan: ThanhToanPopulated) => {
    router.push('/dashboard/thanh-toan/' + thanhToan.id);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/thanh-toan/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        cache.clearAllCaches(); // sync cả hoa-don và thanh-toan
        setThanhToanList(prev => prev.filter(thanhToan => thanhToan.id !== id));
        toast.success('Xóa thanh toán thành công');
      } else {
        const errorData = await response.json();
        toast.error('Có lỗi xảy ra: ' + (errorData.message || 'Không thể xóa thanh toán'));
      }
    } catch (error) {
      console.error('Error deleting thanh toan:', error);
      toast.error('Có lỗi xảy ra khi xóa thanh toán');
    }
  };

  const handleDownload = (thanhToan: ThanhToanPopulated) => {
    // Implement download logic
    console.log('Downloading receipt:', thanhToan.id);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-indigo-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-indigo-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="h-96 bg-indigo-100/50 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Quản lý thanh toán"
        description="Danh sách tất cả giao dịch thanh toán"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => router.push('/dashboard/thanh-toan/them-moi') : undefined}
        addLabel="Thêm thanh toán"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng giao dịch</p>
              <p className="text-base md:text-2xl font-bold text-indigo-900">{thanhToanList.length}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tiền mặt</p>
              <p className="text-base md:text-2xl font-bold text-green-600">
                {thanhToanList.filter(t => t.phuongThuc === 'tienMat').length}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md shadow-green-200">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Chuyển khoản</p>
              <p className="text-base md:text-2xl font-bold text-blue-600">
                {thanhToanList.filter(t => t.phuongThuc === 'chuyenKhoan').length}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-200">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng tiền</p>
              <p className="text-xs md:text-2xl font-bold text-green-600 truncate">
                {formatCurrency(thanhToanList.reduce((sum, t) => sum + t.soTien, 0))}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md shadow-green-200 flex-shrink-0">
              <Receipt className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <CreditCard className="h-3.5 w-3.5 text-white" />
            </div>
            <h3 className="font-semibold text-indigo-900">Danh sách thanh toán</h3>
          </div>
          <p className="text-xs text-indigo-500/70 mt-0.5 ml-9">
            {filteredThanhToan.length} giao dịch được tìm thấy
          </p>
        </div>
        <div className="p-6">
          <ThanhToanDataTable
            data={filteredThanhToan}
            hoaDonList={hoaDonList}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDownload={handleDownload}
            canDelete={canDelete}
            canEdit={canEdit}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            methodFilter={methodFilter}
            onMethodChange={setMethodFilter}
            dateFilter={dateFilter}
            onDateChange={setDateFilter}
          />
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <CreditCard className="h-3 w-3 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-indigo-900">Danh sách thanh toán</h2>
          <span className="text-xs text-indigo-500/70 ml-auto">{filteredThanhToan.length} giao dịch</span>
        </div>
        
        {/* Mobile Filters */}
        <div className="space-y-2 mb-4">
          <SearchInput
            placeholder="Tìm kiếm thanh toán..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Phương thức" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                <SelectItem value="tienMat" className="text-sm">Tiền mặt</SelectItem>
                <SelectItem value="chuyenKhoan" className="text-sm">Chuyển khoản</SelectItem>
                <SelectItem value="viDienTu" className="text-sm">Ví điện tử</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Thời gian" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                <SelectItem value="today" className="text-sm">Hôm nay</SelectItem>
                <SelectItem value="week" className="text-sm">Tuần này</SelectItem>
                <SelectItem value="month" className="text-sm">Tháng này</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile Card List */}
        <div className="space-y-3">
          {filteredThanhToan.map((thanhToan) => {
            const hoaDonInfo = typeof thanhToan.hoaDon === 'object' ? (thanhToan.hoaDon as HoaDon) : null;
            const phongInfo = hoaDonInfo && typeof hoaDonInfo.phong === 'object' ? (hoaDonInfo.phong as any) : null;
            const khachThueInfo = hoaDonInfo && typeof hoaDonInfo.khachThue === 'object' ? (hoaDonInfo.khachThue as any) : null;
            
            return (
              <div key={thanhToan.id} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-4 shadow-sm">
                <div className="space-y-3">
                  {/* Header with invoice code and method */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-indigo-900">
                        {hoaDonInfo?.maHoaDon || getHoaDonInfo(thanhToan.hoaDon)}
                      </h3>
                      <p className="text-sm text-indigo-500/70">
                        {new Date(thanhToan.ngayThanhToan).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    {getMethodBadge(thanhToan.phuongThuc)}
                  </div>

                  {/* Room and Tenant info */}
                  {hoaDonInfo && (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-3 w-3 text-indigo-400" />
                        <span className="text-indigo-600/70">
                          Phòng: {phongInfo?.maPhong || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-indigo-400" />
                        <span className="text-indigo-600/70">
                          {khachThueInfo?.hoTen || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-indigo-400" />
                        <span className="text-indigo-600/70">
                          Tháng {hoaDonInfo.thang}/{hoaDonInfo.nam}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="border-t border-indigo-100 pt-2">
                    <span className="text-indigo-500/70 text-sm">Số tiền:</span>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(thanhToan.soTien)}</p>
                  </div>

                  {/* Transfer info if available */}
                  {thanhToan.phuongThuc === 'chuyenKhoan' && thanhToan.thongTinChuyenKhoan && (
                    <div className="text-xs text-indigo-500/70 space-y-1">
                      {thanhToan.thongTinChuyenKhoan.nganHang && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3 w-3 text-indigo-400" />
                          <span>{thanhToan.thongTinChuyenKhoan.nganHang}</span>
                        </div>
                      )}
                      {thanhToan.thongTinChuyenKhoan.soGiaoDich && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-indigo-400" />
                          <span className="font-mono">{thanhToan.thongTinChuyenKhoan.soGiaoDich}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note if available */}
                  {thanhToan.ghiChu && (
                    <div className="text-xs text-indigo-500/70 border-t border-indigo-100 pt-2">
                      <span className="font-medium text-indigo-600">Ghi chú: </span>
                      <span>{thanhToan.ghiChu}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  {canEdit && (
                  <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(thanhToan)}
                      className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(thanhToan.id!)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredThanhToan.length === 0 && (
          <div className="text-center py-8 rounded-xl border-2 border-dashed border-indigo-200 bg-white/40">
            <CreditCard className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
            <p className="text-indigo-400">Không có giao dịch nào</p>
          </div>
        )}
      </div>
    </div>
  );
}

