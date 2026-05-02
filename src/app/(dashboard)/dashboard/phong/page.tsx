'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Home,
  Users,
  Image,
  Building2,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Phong, ToaNha } from '@/types';
import { toast } from 'sonner';
import { useCanEdit } from '@/hooks/use-can-edit';
import {
  PageHeader,
  SearchInput,
  InlineForm,
  InlineEditTable,
} from '@/components/dashboard';
import type { ColumnDef } from '@/components/dashboard';

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

const TRANG_THAI_LABELS: Record<string, string> = {
  trong: 'Trống',
  daDat: 'Đã đặt',
  dangThue: 'Đang thuê',
  baoTri: 'Bảo trì',
};

const TRANG_THAI_COLORS: Record<string, string> = {
  trong: 'bg-green-50 text-green-700 border-green-200',
  daDat: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  dangThue: 'bg-indigo-600 text-white border-indigo-600',
  baoTri: 'bg-red-50 text-red-700 border-red-200',
};

interface InlineEditPhong {
  id: string;
  maPhong: string;
  toaNhaId: string;
  toaNhaTen: string;
  tang: number;
  dienTich: number;
  giaThue: number;
  tienCoc: number;
  trangThai: string;
  moTa?: string;
  tienNghi: string[];
  anhPhong: string[];
  soNguoiToiDa: number;
  ngayTinhTien: number;
  tenNguoiThue?: string;
  soLuongKhachThue: number;
}

function getPhongToaNhaId(phong: Phong): string {
  const p = phong as any;
  if (p.toaNhaId) return p.toaNhaId;
  if (typeof p.toaNha === 'object' && p.toaNha?.id) return p.toaNha.id;
  if (typeof p.toaNha === 'string') return p.toaNha;
  return '';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export default function PhongPage() {
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

  // Image viewer
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [viewingPhongName, setViewingPhongName] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);

  // Tenant viewer
  const [viewingTenants, setViewingTenants] = useState<any[]>([]);
  const [viewingTenantsPhongName, setViewingTenantsPhongName] = useState('');
  const [showTenantsViewer, setShowTenantsViewer] = useState(false);

  // Inline create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    maPhong: '',
    toaNha: '',
    tang: 1,
    dienTich: 0,
    giaThue: 0,
    tienCoc: 0,
    moTa: '',
    anhPhong: [] as string[],
    tienNghi: [] as string[],
    soNguoiToiDa: 1,
    ngayTinhTien: 1,
    trangThai: 'trong' as 'trong' | 'daDat' | 'dangThue' | 'baoTri',
  });

  // Inline edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    maPhong: string;
    toaNha: string;
    tang: number;
    dienTich: number;
    giaThue: number;
    tienCoc: number;
    moTa: string;
    tienNghi: string[];
    soNguoiToiDa: number;
    ngayTinhTien: number;
    trangThai: string;
  } | null>(null);

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

  // ---- Inline Create ----
  const resetCreateForm = () => {
    setCreateForm({
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
  };

  const handleCreatePhong = async () => {
    if (!createForm.maPhong || !createForm.toaNha) {
      toast.error('Vui lòng nhập mã phòng và chọn tòa nhà');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/phong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Thêm phòng thành công!');
        setShowCreateForm(false);
        resetCreateForm();
        cache.clearCache();
        await fetchPhong(true);
      } else {
        toast.error(result.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating phong:', error);
      toast.error('Có lỗi xảy ra khi tạo phòng');
    } finally {
      setCreating(false);
    }
  };

  // ---- Inline Edit ----
  const handleEditPhong = useCallback((item: InlineEditPhong) => {
    setEditForm({
      maPhong: item.maPhong,
      toaNha: item.toaNhaId,
      tang: item.tang,
      dienTich: item.dienTich,
      giaThue: item.giaThue,
      tienCoc: item.tienCoc,
      moTa: item.moTa || '',
      tienNghi: item.tienNghi || [],
      soNguoiToiDa: item.soNguoiToiDa,
      ngayTinhTien: item.ngayTinhTien,
      trangThai: item.trangThai,
    });
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm || !expandedId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/phong/${expandedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Cập nhật phòng thành công!');
        setExpandedId(null);
        setEditForm(null);
        cache.clearCache();
        await fetchPhong(true);
      } else {
        toast.error(result.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating phong:', error);
      toast.error('Có lỗi xảy ra khi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  // ---- Table data ----
  const buildingMap = useMemo(() => {
    const map = new Map<string, string>();
    toaNhaList.forEach(t => {
      if (t.id) map.set(t.id, t.tenToaNha);
    });
    return map;
  }, [toaNhaList]);

  const tableData = useMemo((): InlineEditPhong[] => {
    return filteredPhong.map(phong => {
      const toaNhaId = getPhongToaNhaId(phong);
      const hopDong = (phong as any).hopDongHienTai;
      const khachThue = hopDong?.khachThue || [];
      return {
        id: phong.id || '',
        maPhong: phong.maPhong,
        toaNhaId,
        toaNhaTen: buildingMap.get(toaNhaId) || 'Chưa xác định',
        tang: phong.tang || 0,
        dienTich: phong.dienTich || 0,
        giaThue: phong.giaThue || 0,
        tienCoc: phong.tienCoc || 0,
        trangThai: phong.trangThai || 'trong',
        moTa: phong.moTa,
        tienNghi: phong.tienNghi || [],
        anhPhong: phong.anhPhong || [],
        soNguoiToiDa: phong.soNguoiToiDa || 1,
        ngayTinhTien: phong.ngayTinhTien ?? 1,
        tenNguoiThue: khachThue.length > 0 ? khachThue[0]?.hoTen : undefined,
        soLuongKhachThue: khachThue.length,
      };
    });
  }, [filteredPhong, buildingMap]);

  // Sort by building name then room code
  const sortedTableData = useMemo(() => {
    return [...tableData].sort((a, b) => {
      const buildingCmp = a.toaNhaTen.localeCompare(b.toaNhaTen);
      if (buildingCmp !== 0) return buildingCmp;
      return a.maPhong.localeCompare(b.maPhong);
    });
  }, [tableData]);

  const columns: ColumnDef<InlineEditPhong>[] = useMemo(() => [
    {
      key: 'maPhong',
      header: 'Phòng',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <Home className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-medium text-gray-900">{item.maPhong}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3 w-3 text-indigo-400" />
              <span className="text-xs text-indigo-500">{item.toaNhaTen}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => (
        <Badge className={`text-xs border ${TRANG_THAI_COLORS[item.trangThai] || 'bg-gray-50 text-gray-700'}`}>
          {TRANG_THAI_LABELS[item.trangThai] || item.trangThai}
        </Badge>
      ),
    },
    {
      key: 'tang',
      header: 'Tầng',
      sortable: true,
      render: (item) => (
        <span className="text-gray-700">Tầng {item.tang}</span>
      ),
    },
    {
      key: 'dienTich',
      header: 'Diện tích',
      sortable: true,
      render: (item) => (
        <span className="text-gray-700">{item.dienTich}m²</span>
      ),
    },
    {
      key: 'giaThue',
      header: 'Giá thuê',
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-green-600">{formatCurrency(item.giaThue)}</span>
      ),
    },
    {
      key: 'tenNguoiThue',
      header: 'Người thuê',
      render: (item) => {
        if (!item.tenNguoiThue) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-gray-700 truncate max-w-[120px]">{item.tenNguoiThue}</span>
            {item.soLuongKhachThue > 1 && (
              <span className="text-xs text-indigo-400">+{item.soLuongKhachThue - 1}</span>
            )}
          </div>
        );
      },
    },
  ], []);

  // ---- Expanded render (edit form) ----
  const renderExpanded = useCallback((item: InlineEditPhong) => {
    if (!editForm) return null;
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">Mã phòng</Label>
            <Input
              value={editForm.maPhong}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, maPhong: e.target.value.toUpperCase() } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Tòa nhà</Label>
            <Select value={editForm.toaNha} onValueChange={(value) => setEditForm(prev => prev ? { ...prev, toaNha: value } : null)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Chọn tòa nhà" />
              </SelectTrigger>
              <SelectContent>
                {toaNhaList.map((toa) => (
                  <SelectItem key={toa.id} value={toa.id!} className="text-sm">{toa.tenToaNha}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Trạng thái</Label>
            <Select value={editForm.trangThai} onValueChange={(value) => setEditForm(prev => prev ? { ...prev, trangThai: value } : null)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">Tầng</Label>
            <Input
              type="number"
              min="0"
              value={editForm.tang}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tang: parseInt(e.target.value) || 0 } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Diện tích (m²)</Label>
            <Input
              type="number"
              min="1"
              value={editForm.dienTich}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, dienTich: parseInt(e.target.value) || 0 } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Số người tối đa</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={editForm.soNguoiToiDa}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, soNguoiToiDa: parseInt(e.target.value) || 1 } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Ngày thu tiền</Label>
            <Input
              type="number"
              min="1"
              max="28"
              value={editForm.ngayTinhTien}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngayTinhTien: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) } : null)}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">Giá thuê (VNĐ)</Label>
            <Input
              type="number"
              min="0"
              value={editForm.giaThue}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, giaThue: parseInt(e.target.value) || 0 } : null)}
              className="text-sm"
            />
            <span className="text-xs text-gray-500">{formatCurrency(editForm.giaThue)}</span>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Tiền cọc (VNĐ)</Label>
            <Input
              type="number"
              min="0"
              value={editForm.tienCoc}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tienCoc: parseInt(e.target.value) || 0 } : null)}
              className="text-sm"
            />
            <span className="text-xs text-gray-500">{formatCurrency(editForm.tienCoc)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Mô tả</Label>
          <Textarea
            value={editForm.moTa}
            onChange={(e) => setEditForm(prev => prev ? { ...prev, moTa: e.target.value } : null)}
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Tiện nghi</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {tienNghiOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`edit-${option.value}`}
                  checked={editForm.tienNghi.includes(option.value)}
                  onChange={(e) => {
                    setEditForm(prev => {
                      if (!prev) return null;
                      const checked = e.target.checked;
                      return {
                        ...prev,
                        tienNghi: checked
                          ? [...prev.tienNghi, option.value]
                          : prev.tienNghi.filter(t => t !== option.value),
                      };
                    });
                  }}
                  className="rounded border-gray-300"
                />
                <Label htmlFor={`edit-${option.value}`} className="text-sm">{option.label}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => { setExpandedId(null); setEditForm(null); }} className="text-sm">
            <X className="h-4 w-4 mr-1" />Hủy
          </Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Lưu thay đổi
          </Button>
        </div>
      </div>
    );
  }, [editForm, toaNhaList, saving, handleSaveEdit]);

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
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Thêm phòng"
      />

      {/* Stats cards */}
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SearchInput placeholder="Tìm kiếm phòng..." value={searchTerm} onChange={setSearchTerm} />
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

      {/* Inline create form */}
      {showCreateForm && (
        <InlineForm
          title="Thêm phòng mới"
          description="Nhập thông tin phòng mới"
          onSave={handleCreatePhong}
          onCancel={() => { setShowCreateForm(false); resetCreateForm(); }}
          saving={creating}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Mã phòng</Label>
                <Input
                  value={createForm.maPhong}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, maPhong: e.target.value.toUpperCase() }))}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Tòa nhà</Label>
                <Select value={createForm.toaNha} onValueChange={(value) => setCreateForm(prev => ({ ...prev, toaNha: value }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn tòa nhà" />
                  </SelectTrigger>
                  <SelectContent>
                    {toaNhaList.map((toa) => (
                      <SelectItem key={toa.id} value={toa.id!} className="text-sm">{toa.tenToaNha}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Trạng thái</Label>
                <Select value={createForm.trangThai} onValueChange={(value) => setCreateForm(prev => ({ ...prev, trangThai: value as any }))}>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Tầng</Label>
                <Input
                  type="number"
                  min="0"
                  value={createForm.tang}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, tang: parseInt(e.target.value) || 0 }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Diện tích (m²)</Label>
                <Input
                  type="number"
                  min="1"
                  value={createForm.dienTich}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, dienTich: parseInt(e.target.value) || 0 }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Số người tối đa</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={createForm.soNguoiToiDa}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, soNguoiToiDa: parseInt(e.target.value) || 1 }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Ngày thu tiền</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={createForm.ngayTinhTien}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, ngayTinhTien: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) }))}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Giá thuê (VNĐ)</Label>
                <Input
                  type="number"
                  min="0"
                  value={createForm.giaThue}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, giaThue: parseInt(e.target.value) || 0 }))}
                  className="text-sm"
                />
                <span className="text-xs text-gray-500">{formatCurrency(createForm.giaThue)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Tiền cọc (VNĐ)</Label>
                <Input
                  type="number"
                  min="0"
                  value={createForm.tienCoc}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, tienCoc: parseInt(e.target.value) || 0 }))}
                  className="text-sm"
                />
                <span className="text-xs text-gray-500">{formatCurrency(createForm.tienCoc)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Mô tả</Label>
              <Textarea
                value={createForm.moTa}
                onChange={(e) => setCreateForm(prev => ({ ...prev, moTa: e.target.value }))}
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tiện nghi</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {tienNghiOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`create-${option.value}`}
                      checked={createForm.tienNghi.includes(option.value)}
                      onChange={(e) => {
                        setCreateForm(prev => ({
                          ...prev,
                          tienNghi: e.target.checked
                            ? [...prev.tienNghi, option.value]
                            : prev.tienNghi.filter(t => t !== option.value),
                        }));
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`create-${option.value}`} className="text-sm">{option.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </InlineForm>
      )}

      {/* Main table */}
      <InlineEditTable
        data={sortedTableData}
        columns={columns}
        keyExtractor={(item) => item.id}
        onEdit={canEdit ? handleEditPhong : undefined}
        onDelete={canEdit ? (item) => {
          const phong = phongList.find(p => p.id === item.id);
          if (phong) handleDelete(phong.id!);
        } : undefined}
        renderExpanded={canEdit ? renderExpanded : undefined}
        expandedId={expandedId}
        onToggleExpand={(id) => {
          setExpandedId(id);
          if (id) {
            const item = tableData.find(i => i.id === id);
            if (item) handleEditPhong(item);
          } else {
            setEditForm(null);
          }
        }}
        searchTerm={searchTerm}
        emptyMessage="Không tìm thấy phòng nào"
        expandOnClick={true}
      />

      {/* Image viewer */}
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

      {/* Tenant viewer */}
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
