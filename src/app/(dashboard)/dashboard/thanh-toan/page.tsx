'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Type cho ThanhToan đã được populate
type ThanhToanPopulated = Omit<ThanhToan, 'hoaDon'> & {
  hoaDon: string | HoaDon;
};

interface InlineEditThanhToan {
  id: string;
  hoaDon: string | { id?: string; maHoaDon?: string; phong?: string | { maPhong: string }; khachThue?: string | { hoTen: string }; thang?: number; nam?: number };
  soTien: number;
  phuongThuc: string;
  thongTinChuyenKhoan?: { nganHang?: string; soTaiKhoan?: string; soGiaoDich?: string; noiDungChuyenKhoan?: string };
  ngayThanhToan: Date;
  nguoiNhan: string;
  ghiChu?: string;
  anhBienLai?: string;
  ngayTao: Date;
}

export default function ThanhToanPage() {
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

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    hoaDon: '',
    soTien: 0,
    phuongThuc: 'tienMat' as string,
    ngayThanhToan: new Date().toISOString().split('T')[0],
    ghiChu: '',
  });

  // Inline edit state
  const [editForm, setEditForm] = useState<InlineEditThanhToan | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    // Nếu hoaDon là object (đã được populate), lấy maHoaDon trực tiếp
    if (typeof hoaDon === 'object' && hoaDon?.maHoaDon) {
      return hoaDon.maHoaDon;
    }
    
    // Nếu hoaDon là string (ID), tìm trong hoaDonList
    if (typeof hoaDon === 'string') {
      const hoaDonItem = hoaDonList.find(h => h.id === hoaDon);
      return hoaDonItem?.maHoaDon || 'Không xác định';
    }
    
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

  const handleDownload = (thanhToan: InlineEditThanhToan) => {
    console.log('Downloading receipt:', thanhToan.id);
  };

  // --- Inline Create ---
  const resetCreateForm = () => {
    setCreateForm({
      hoaDon: '',
      soTien: 0,
      phuongThuc: 'tienMat',
      ngayThanhToan: new Date().toISOString().split('T')[0],
      ghiChu: '',
    });
  };

  const handleCreateThanhToan = async () => {
    if (!createForm.hoaDon) {
      toast.error('Vui lòng chọn hóa đơn');
      return;
    }
    if (createForm.soTien <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/thanh-toan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          ngayThanhToan: new Date(createForm.ngayThanhToan).toISOString(),
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Tạo thanh toán thành công');
        cache.clearAllCaches();
        await fetchData(true);
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error creating thanh toan:', error);
      toast.error('Có lỗi xảy ra khi tạo thanh toán');
    } finally {
      setSaving(false);
    }
  };

  // --- Inline Edit ---
  const handleEditThanhToan = useCallback((item: InlineEditThanhToan) => {
    setEditForm({ ...item });
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/thanh-toan/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soTien: editForm.soTien,
          phuongThuc: editForm.phuongThuc,
          ghiChu: editForm.ghiChu,
          ngayThanhToan: editForm.ngayThanhToan,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Cập nhật thanh toán thành công');
        cache.clearAllCaches();
        await fetchData(true);
        setExpandedId(null);
        setEditForm(null);
      } else {
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error updating thanh toan:', error);
      toast.error('Có lỗi xảy ra khi cập nhật thanh toán');
    } finally {
      setSaving(false);
    }
  };

  // --- Table Data ---
  const tableData = useMemo((): InlineEditThanhToan[] => {
    return filteredThanhToan.map(tt => ({
      id: tt.id || tt._id || '',
      hoaDon: tt.hoaDon,
      soTien: tt.soTien,
      phuongThuc: tt.phuongThuc,
      thongTinChuyenKhoan: tt.thongTinChuyenKhoan,
      ngayThanhToan: tt.ngayThanhToan,
      nguoiNhan: tt.nguoiNhan,
      ghiChu: tt.ghiChu,
      anhBienLai: tt.anhBienLai,
      ngayTao: tt.ngayTao,
    }));
  }, [filteredThanhToan]);

  // --- Columns ---
  const columns: ColumnDef<InlineEditThanhToan>[] = useMemo(() => [
    {
      key: 'hoaDon',
      header: 'Hóa đơn',
      sortable: true,
      render: (item) => {
        const hoaDonObj = typeof item.hoaDon === 'object' ? item.hoaDon : null;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-indigo-900">
              {hoaDonObj?.maHoaDon || getHoaDonInfo(item.hoaDon)}
            </span>
            {hoaDonObj && hoaDonObj.thang && hoaDonObj.nam && (
              <span className="text-xs text-indigo-500/70">
                Tháng {hoaDonObj.thang}/{hoaDonObj.nam}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'phuongThuc',
      header: 'Phương thức',
      sortable: true,
      render: (item) => getMethodBadge(item.phuongThuc),
    },
    {
      key: 'soTien',
      header: 'Số tiền',
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-green-600">{formatCurrency(item.soTien)}</span>
      ),
    },
    {
      key: 'ngayThanhToan',
      header: 'Ngày thanh toán',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-sm text-indigo-600/70">
            {new Date(item.ngayThanhToan).toLocaleDateString('vi-VN')}
          </span>
        </div>
      ),
    },
    {
      key: 'ghiChu',
      header: 'Ghi chú',
      sortable: false,
      render: (item) => (
        <span className="text-sm text-indigo-500/70 truncate max-w-[150px]">
          {item.ghiChu || '-'}
        </span>
      ),
    },
  ], []);

  // --- Render Expanded (Inline Edit Form) ---
  const renderExpanded = useCallback((item: InlineEditThanhToan) => {
    const isEditing = editForm?.id === item.id;
    if (!isEditing) return null;

    return (
      <div className="p-4 md:p-6 space-y-4 bg-gradient-to-br from-indigo-50/50 to-blue-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-indigo-700">Hóa đơn</Label>
            <Input
              value={getHoaDonInfo(editForm?.hoaDon || '')}
              disabled
              className="border-indigo-200 bg-indigo-50/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Phương thức</Label>
            <Select
              value={editForm?.phuongThuc || 'tienMat'}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, phuongThuc: value } : null)}
            >
              <SelectTrigger className="border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tienMat">Tiền mặt</SelectItem>
                <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
                <SelectItem value="viDienTu">Ví điện tử</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Số tiền</Label>
            <Input
              type="number"
              value={editForm?.soTien || 0}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, soTien: Number(e.target.value) } : null)}
              className="border-indigo-200 focus:border-indigo-400"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Ngày thanh toán</Label>
            <Input
              type="date"
              value={editForm?.ngayThanhToan ? new Date(editForm.ngayThanhToan).toISOString().split('T')[0] : ''}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngayThanhToan: new Date(e.target.value) } : null)}
              className="border-indigo-200 focus:border-indigo-400"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-indigo-700">Ghi chú</Label>
          <Textarea
            value={editForm?.ghiChu || ''}
            onChange={(e) => setEditForm(prev => prev ? { ...prev, ghiChu: e.target.value } : null)}
            rows={2}
            className="border-indigo-200 focus:border-indigo-400"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setExpandedId(null);
              setEditForm(null);
            }}
            className="border-indigo-200 text-indigo-600"
          >
            Hủy
          </Button>
          <Button
            size="sm"
            onClick={handleSaveEdit}
            disabled={saving}
            className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </div>
    );
  }, [editForm, saving, handleSaveEdit]);

  // --- Stats Cards ---
  const statsCards = useMemo(() => [
    {
      label: 'Tổng giao dịch',
      value: thanhToanList.length,
      color: 'text-indigo-900',
      icon: CreditCard,
      iconBg: 'from-indigo-500 to-blue-600',
    },
    {
      label: 'Tiền mặt',
      value: thanhToanList.filter(t => t.phuongThuc === 'tienMat').length,
      color: 'text-green-600',
      icon: CreditCard,
      iconBg: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Chuyển khoản',
      value: thanhToanList.filter(t => t.phuongThuc === 'chuyenKhoan').length,
      color: 'text-blue-600',
      icon: CreditCard,
      iconBg: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Tổng tiền',
      value: formatCurrency(thanhToanList.reduce((sum, t) => sum + t.soTien, 0)),
      color: 'text-green-600',
      icon: Receipt,
      iconBg: 'from-green-500 to-emerald-500',
    },
  ], [thanhToanList]);

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
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Thêm thanh toán"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4"
            >
              <div className="flex items-center justify-between">
                <div className={index === 3 ? 'min-w-0' : ''}>
                  <p className="text-[10px] md:text-xs font-medium text-indigo-600">{stat.label}</p>
                  <p className={`text-base md:text-2xl font-bold ${stat.color} ${index === 3 ? 'truncate text-xs md:text-2xl' : ''}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${stat.iconBg} flex items-center justify-center shadow-md shadow-indigo-200 ${index === 3 ? 'flex-shrink-0' : ''}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            placeholder="Tìm kiếm thanh toán..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-auto">
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="text-sm border-indigo-200">
              <SelectValue placeholder="Phương thức" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="tienMat">Tiền mặt</SelectItem>
              <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
              <SelectItem value="viDienTu">Ví điện tử</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="text-sm border-indigo-200">
              <SelectValue placeholder="Thời gian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="today">Hôm nay</SelectItem>
              <SelectItem value="week">Tuần này</SelectItem>
              <SelectItem value="month">Tháng này</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Thêm thanh toán mới"
          description="Ghi nhận giao dịch thanh toán từ khách thuê"
          onSave={handleCreateThanhToan}
          onCancel={() => {
            setShowCreateForm(false);
            resetCreateForm();
          }}
          saving={saving}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-indigo-700">Hóa đơn</Label>
              <Select
                value={createForm.hoaDon}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, hoaDon: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue placeholder="Chọn hóa đơn" />
                </SelectTrigger>
                <SelectContent>
                  {hoaDonList.map(hd => (
                    <SelectItem key={hd.id} value={hd.id || ''}>
                      {hd.maHoaDon} - {formatCurrency(hd.tongTien)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Phương thức</Label>
              <Select
                value={createForm.phuongThuc}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, phuongThuc: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tienMat">Tiền mặt</SelectItem>
                  <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
                  <SelectItem value="viDienTu">Ví điện tử</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Số tiền</Label>
              <Input
                type="number"
                value={createForm.soTien || ''}
                onChange={(e) => setCreateForm(prev => ({ ...prev, soTien: Number(e.target.value) }))}
                placeholder="Nhập số tiền"
                className="border-indigo-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Ngày thanh toán</Label>
              <Input
                type="date"
                value={createForm.ngayThanhToan}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ngayThanhToan: e.target.value }))}
                className="border-indigo-200"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Ghi chú</Label>
            <Textarea
              value={createForm.ghiChu}
              onChange={(e) => setCreateForm(prev => ({ ...prev, ghiChu: e.target.value }))}
              placeholder="Ghi chú (nếu có)..."
              rows={2}
              className="border-indigo-200"
            />
          </div>
        </InlineForm>
      )}

      {/* InlineEditTable */}
      <InlineEditTable
        data={tableData}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchTerm={searchTerm}
        loading={loading}
        emptyMessage="Không có giao dịch nào"
        expandedId={expandedId}
        onToggleExpand={(id) => {
          if (expandedId === id) {
            setExpandedId(null);
            setEditForm(null);
          } else {
            const item = tableData.find(i => i.id === id);
            if (item) {
              handleEditThanhToan(item);
            }
          }
        }}
        renderExpanded={renderExpanded}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditThanhToan(item)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(item)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              title="Tải biên lai"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      />
    </div>
  );
}
