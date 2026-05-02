'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface InlineEditThongBao {
  id: string;
  tieuDe: string;
  noiDung: string;
  loai: string;
  nguoiGui: string;
  nguoiNhan: string[];
  phong?: string[];
  toaNha?: string;
  daDoc: string[];
  trangThaiXuLy?: string;
  ngayGui: Date;
  ngayTao: Date;
}

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

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    tieuDe: '',
    noiDung: '',
    loai: 'chung' as string,
    nguoiNhan: [] as string[],
    phong: [] as string[],
    toaNha: '',
  });

  // Inline edit state
  const [editForm, setEditForm] = useState<InlineEditThongBao | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // --- Inline Create ---
  const resetCreateForm = () => {
    setCreateForm({
      tieuDe: '',
      noiDung: '',
      loai: 'chung',
      nguoiNhan: [],
      phong: [],
      toaNha: '',
    });
  };

  const handleCreateThongBao = async () => {
    if (!createForm.tieuDe.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!createForm.noiDung.trim()) {
      toast.error('Vui lòng nhập nội dung');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/thong-bao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Tạo thông báo thành công');
        cache.clearCache();
        await fetchData(true);
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error creating thong bao:', error);
      toast.error('Có lỗi xảy ra khi tạo thông báo');
    } finally {
      setSaving(false);
    }
  };

  // --- Inline Edit ---
  const handleEditThongBao = useCallback((item: InlineEditThongBao) => {
    setEditForm({ ...item });
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!editForm.tieuDe.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/thong-bao?id=${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tieuDe: editForm.tieuDe,
          noiDung: editForm.noiDung,
          loai: editForm.loai,
        }),
      });
      if (response.ok) {
        toast.success('Cập nhật thông báo thành công');
        cache.clearCache();
        await fetchData(true);
        setExpandedId(null);
        setEditForm(null);
      } else {
        toast.error('Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating thong bao:', error);
      toast.error('Có lỗi xảy ra khi cập nhật thông báo');
    } finally {
      setSaving(false);
    }
  };

  // --- Table Data ---
  const tableData = useMemo((): InlineEditThongBao[] => {
    return filteredThongBao.map(tb => ({
      id: tb.id || '',
      tieuDe: tb.tieuDe,
      noiDung: tb.noiDung,
      loai: tb.loai,
      nguoiGui: tb.nguoiGui,
      nguoiNhan: tb.nguoiNhan,
      phong: tb.phong,
      toaNha: tb.toaNha,
      daDoc: tb.daDoc,
      trangThaiXuLy: tb.trangThaiXuLy,
      ngayGui: tb.ngayGui,
      ngayTao: tb.ngayTao,
    }));
  }, [filteredThongBao]);

  // --- Columns ---
  const columns: ColumnDef<InlineEditThongBao>[] = useMemo(() => [
    {
      key: 'tieuDe',
      header: 'Tiêu đề',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-0.5 max-w-[250px]">
          <span className="font-medium text-indigo-900 truncate">{item.tieuDe}</span>
          <span className="text-xs text-indigo-500/70 truncate">{item.noiDung}</span>
        </div>
      ),
    },
    {
      key: 'loai',
      header: 'Loại',
      sortable: true,
      render: (item) => getTypeBadge(item.loai),
    },
    {
      key: 'nguoiNhan',
      header: 'Người nhận',
      sortable: false,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-sm text-indigo-700 truncate max-w-[150px]">
            {getKhachThueNames(item.nguoiNhan)}
          </span>
        </div>
      ),
    },
    {
      key: 'toaNha',
      header: 'Tòa nhà / Phòng',
      sortable: false,
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-sm text-indigo-700">{getToaNhaName(item.toaNha)}</span>
          </div>
          {item.phong && item.phong.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Home className="h-3 w-3 text-indigo-400" />
              <span className="text-xs text-indigo-500/70 truncate max-w-[120px]">
                {getPhongNames(item.phong)}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'ngayGui',
      header: 'Ngày gửi',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-sm text-indigo-600/70">
            {new Date(item.ngayGui).toLocaleDateString('vi-VN')}
          </span>
        </div>
      ),
    },
    {
      key: 'trangThaiXuLy',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => getTrangThaiXuLyBadge(item.trangThaiXuLy),
    },
  ], []);

  // --- Render Expanded (Inline Edit Form) ---
  const renderExpanded = useCallback((item: InlineEditThongBao) => {
    const isEditing = editForm?.id === item.id;
    if (!isEditing) return null;

    return (
      <div className="p-4 md:p-6 space-y-4 bg-gradient-to-br from-indigo-50/50 to-blue-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-indigo-700">Tiêu đề</Label>
            <Input
              value={editForm?.tieuDe || ''}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tieuDe: e.target.value } : null)}
              className="border-indigo-200 focus:border-indigo-400"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Loại</Label>
            <Select
              value={editForm?.loai || 'chung'}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, loai: value } : null)}
            >
              <SelectTrigger className="border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chung">Chung</SelectItem>
                <SelectItem value="hoaDon">Hóa đơn</SelectItem>
                <SelectItem value="suCo">Sự cố</SelectItem>
                <SelectItem value="hopDong">Hợp đồng</SelectItem>
                <SelectItem value="khac">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-indigo-700">Nội dung</Label>
          <Textarea
            value={editForm?.noiDung || ''}
            onChange={(e) => setEditForm(prev => prev ? { ...prev, noiDung: e.target.value } : null)}
            rows={3}
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
      label: 'Tổng thông báo',
      value: thongBaoList.length,
      color: 'text-indigo-900',
      icon: Bell,
      iconBg: 'from-indigo-500 to-blue-600',
    },
    {
      label: 'Chung',
      value: thongBaoList.filter(t => t.loai === 'chung').length,
      color: 'text-blue-600',
      icon: Bell,
      iconBg: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Hóa đơn',
      value: thongBaoList.filter(t => t.loai === 'hoaDon').length,
      color: 'text-green-600',
      icon: Bell,
      iconBg: 'from-green-500 to-emerald-600',
    },
    {
      label: 'Sự cố',
      value: thongBaoList.filter(t => t.loai === 'suCo').length,
      color: 'text-red-600',
      icon: Bell,
      iconBg: 'from-red-500 to-rose-600',
    },
  ], [thongBaoList]);

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
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Tạo thông báo"
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
                <div>
                  <p className="text-[10px] md:text-xs font-medium text-indigo-600">{stat.label}</p>
                  <p className={`text-base md:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${stat.iconBg} flex items-center justify-center shadow-md shadow-indigo-200`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 sm:max-w-md">
          <SearchInput
            placeholder="Tìm kiếm theo tiêu đề, nội dung..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px] border-indigo-200">
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

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Tạo thông báo mới"
          description="Gửi thông báo đến khách thuê"
          onSave={handleCreateThongBao}
          onCancel={() => {
            setShowCreateForm(false);
            resetCreateForm();
          }}
          saving={saving}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-indigo-700">Tiêu đề</Label>
              <Input
                value={createForm.tieuDe}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tieuDe: e.target.value }))}
                placeholder="Nhập tiêu đề thông báo"
                className="border-indigo-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Loại</Label>
              <Select
                value={createForm.loai}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, loai: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chung">Chung</SelectItem>
                  <SelectItem value="hoaDon">Hóa đơn</SelectItem>
                  <SelectItem value="suCo">Sự cố</SelectItem>
                  <SelectItem value="hopDong">Hợp đồng</SelectItem>
                  <SelectItem value="khac">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Tòa nhà</Label>
              <Select
                value={createForm.toaNha}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, toaNha: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue placeholder="Chọn tòa nhà" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả tòa nhà</SelectItem>
                  {toaNhaList.map(tn => (
                    <SelectItem key={tn.id} value={tn.id || ''}>{tn.tenToaNha}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Phòng</Label>
              <Select
                value={createForm.phong[0] || ''}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, phong: value ? [value] : [] }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue placeholder="Chọn phòng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả phòng</SelectItem>
                  {phongList.map(p => (
                    <SelectItem key={p.id} value={p.id || ''}>{p.maPhong}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Nội dung</Label>
            <Textarea
              value={createForm.noiDung}
              onChange={(e) => setCreateForm(prev => ({ ...prev, noiDung: e.target.value }))}
              placeholder="Nhập nội dung thông báo..."
              rows={3}
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
        emptyMessage="Không có thông báo nào"
        expandedId={expandedId}
        onToggleExpand={(id) => {
          if (expandedId === id) {
            setExpandedId(null);
            setEditForm(null);
          } else {
            const item = tableData.find(i => i.id === id);
            if (item) {
              handleEditThongBao(item);
            }
          }
        }}
        renderExpanded={renderExpanded}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditThongBao(item)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {(!item.trangThaiXuLy || item.trangThaiXuLy === 'chuaXuLy') && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateTrangThai(item.id, getActionButtons(item.loai).positive.value)}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  title={getActionButtons(item.loai).positive.label}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateTrangThai(item.id, getActionButtons(item.loai).negative.value)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title={getActionButtons(item.loai).negative.label}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {item.trangThaiXuLy && item.trangThaiXuLy !== 'chuaXuLy' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUpdateTrangThai(item.id, 'chuaXuLy')}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                title="Hoàn tác"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(item.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      />
    </div>
  );
}
