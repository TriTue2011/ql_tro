'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
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
  Edit,
  Trash2,
  AlertTriangle,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  Home,
  Wrench,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { SuCo, Phong, KhachThue } from '@/types';
import { useCanEdit } from '@/hooks/use-can-edit';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface InlineEditSuCo {
  id: string;
  tieuDe: string;
  moTa: string;
  loaiSuCo: string;
  mucDoUuTien: string;
  trangThai: string;
  phong: string | { id?: string; maPhong: string; toaNha?: { id: string; tenToaNha: string } };
  nguoiBaoCao?: string | { id?: string; hoTen?: string; soDienThoai?: string; [key: string]: unknown };
  anhSuCo: string[];
  ghiChuXuLy?: string;
  ngayBaoCao: Date;
  ngayXuLy?: Date;
  ngayHoanThanh?: Date;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export default function SuCoPage() {
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

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    phong: '',
    tieuDe: '',
    moTa: '',
    loaiSuCo: 'khac' as string,
    mucDoUuTien: 'trungBinh' as string,
  });

  // Inline edit state
  const [editForm, setEditForm] = useState<InlineEditSuCo | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Quản lý Sự cố';
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['su-co'], (_type, _action) => {
    fetchData(true);
  });

  const fetchData = async (forceRefresh = false) => {
    try {
      const cached = cache.getCache();
      if (cached && !forceRefresh) {
        setSuCoList(cached.suCoList);
        setPhongList(cached.phongList);
        setKhachThueList(cached.khachThueList);
        setLoading(false);
        return;
      }

      const [suCoRes, phongRes, khachThueRes] = await Promise.all([
        fetch('/api/su-co'),
        fetch('/api/phong'),
        fetch('/api/khach-thue'),
      ]);

      const suCos = await suCoRes.json();
      const phongs = await phongRes.json();
      const khachThues = await khachThueRes.json();

      const suCoData = suCos.data || suCos;
      const phongData = phongs.data || phongs;
      const khachThueData = khachThues.data || khachThues;

      setSuCoList(suCoData);
      setPhongList(phongData);
      setKhachThueList(khachThueData);
      cache.setCache({
        suCoList: suCoData,
        phongList: phongData,
        khachThueList: khachThueData,
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

  // --- Inline Create ---
  const resetCreateForm = () => {
    setCreateForm({
      phong: '',
      tieuDe: '',
      moTa: '',
      loaiSuCo: 'khac',
      mucDoUuTien: 'trungBinh',
    });
  };

  const handleCreateSuCo = async () => {
    if (!createForm.phong) {
      toast.error('Vui lòng chọn phòng');
      return;
    }
    if (!createForm.tieuDe.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!createForm.moTa.trim()) {
      toast.error('Vui lòng nhập mô tả');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/su-co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Tạo sự cố thành công');
        cache.clearCache();
        await fetchData(true);
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error creating su co:', error);
      toast.error('Có lỗi xảy ra khi tạo sự cố');
    } finally {
      setSaving(false);
    }
  };

  // --- Inline Edit ---
  const handleEditSuCo = useCallback((item: InlineEditSuCo) => {
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
      const response = await fetch(`/api/su-co/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tieuDe: editForm.tieuDe,
          moTa: editForm.moTa,
          loaiSuCo: editForm.loaiSuCo,
          mucDoUuTien: editForm.mucDoUuTien,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Cập nhật sự cố thành công');
        cache.clearCache();
        await fetchData(true);
        setExpandedId(null);
        setEditForm(null);
      } else {
        toast.error('Có lỗi xảy ra: ' + result.message);
      }
    } catch (error) {
      console.error('Error updating su co:', error);
      toast.error('Có lỗi xảy ra khi cập nhật sự cố');
    } finally {
      setSaving(false);
    }
  };

  // --- Table Data ---
  const tableData = useMemo((): InlineEditSuCo[] => {
    return filteredSuCo.map(suCo => ({
      id: suCo.id || suCo._id || '',
      tieuDe: suCo.tieuDe,
      moTa: suCo.moTa,
      loaiSuCo: suCo.loaiSuCo,
      mucDoUuTien: suCo.mucDoUuTien,
      trangThai: suCo.trangThai,
      phong: suCo.phong,
      nguoiBaoCao: suCo.nguoiBaoCao,
      anhSuCo: suCo.anhSuCo || [],
      ghiChuXuLy: suCo.ghiChuXuLy,
      ngayBaoCao: suCo.ngayBaoCao,
      ngayXuLy: suCo.ngayXuLy,
      ngayHoanThanh: suCo.ngayHoanThanh,
      ngayTao: suCo.ngayTao,
      ngayCapNhat: suCo.ngayCapNhat,
    }));
  }, [filteredSuCo]);

  // --- Columns ---
  const columns: ColumnDef<InlineEditSuCo>[] = useMemo(() => [
    {
      key: 'tieuDe',
      header: 'Tiêu đề',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-indigo-900 truncate max-w-[200px]">
            {item.tieuDe}
          </span>
          <span className="text-xs text-indigo-500/70 truncate max-w-[200px]">
            {item.moTa}
          </span>
        </div>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1">
          {getStatusBadge(item.trangThai)}
          {getPriorityBadge(item.mucDoUuTien)}
        </div>
      ),
    },
    {
      key: 'loaiSuCo',
      header: 'Loại',
      sortable: true,
      render: (item) => getTypeBadge(item.loaiSuCo),
    },
    {
      key: 'phong',
      header: 'Phòng',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Home className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-sm text-indigo-700">{getPhongName(item.phong)}</span>
        </div>
      ),
    },
    {
      key: 'ngayBaoCao',
      header: 'Ngày báo cáo',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-sm text-indigo-600/70">
            {new Date(item.ngayBaoCao).toLocaleDateString('vi-VN')}
          </span>
        </div>
      ),
    },
  ], []);

  // --- Render Expanded (Inline Edit Form) ---
  const renderExpanded = useCallback((item: InlineEditSuCo) => {
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
            <Label className="text-indigo-700">Loại sự cố</Label>
            <Select
              value={editForm?.loaiSuCo || 'khac'}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, loaiSuCo: value } : null)}
            >
              <SelectTrigger className="border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dienNuoc">Điện nước</SelectItem>
                <SelectItem value="noiThat">Nội thất</SelectItem>
                <SelectItem value="vesinh">Vệ sinh</SelectItem>
                <SelectItem value="anNinh">An ninh</SelectItem>
                <SelectItem value="khac">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Mức độ ưu tiên</Label>
            <Select
              value={editForm?.mucDoUuTien || 'trungBinh'}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, mucDoUuTien: value } : null)}
            >
              <SelectTrigger className="border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thap">Thấp</SelectItem>
                <SelectItem value="trungBinh">Trung bình</SelectItem>
                <SelectItem value="cao">Cao</SelectItem>
                <SelectItem value="khancap">Khẩn cấp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Trạng thái</Label>
            <Select
              value={editForm?.trangThai || 'moi'}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, trangThai: value } : null)}
            >
              <SelectTrigger className="border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moi">Mới</SelectItem>
                <SelectItem value="dangXuLy">Đang xử lý</SelectItem>
                <SelectItem value="daXong">Đã xong</SelectItem>
                <SelectItem value="daHuy">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-indigo-700">Mô tả</Label>
          <Textarea
            value={editForm?.moTa || ''}
            onChange={(e) => setEditForm(prev => prev ? { ...prev, moTa: e.target.value } : null)}
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
      label: 'Tổng sự cố',
      value: suCoList.length,
      color: 'text-indigo-900',
      icon: AlertTriangle,
      iconBg: 'from-indigo-500 to-blue-600',
    },
    {
      label: 'Mới',
      value: suCoList.filter(s => s.trangThai === 'moi').length,
      color: 'text-red-600',
      icon: AlertTriangle,
      iconBg: 'from-red-500 to-orange-500',
    },
    {
      label: 'Đang xử lý',
      value: suCoList.filter(s => s.trangThai === 'dangXuLy').length,
      color: 'text-orange-600',
      icon: Clock,
      iconBg: 'from-orange-500 to-amber-500',
    },
    {
      label: 'Đã xong',
      value: suCoList.filter(s => s.trangThai === 'daXong').length,
      color: 'text-green-600',
      icon: CheckCircle,
      iconBg: 'from-green-500 to-emerald-500',
    },
  ], [suCoList]);

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
        title="Quản lý sự cố"
        description="Theo dõi và xử lý các sự cố từ khách thuê"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Báo cáo sự cố"
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
        <div className="flex-1">
          <SearchInput
            placeholder="Tìm kiếm sự cố..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-sm border-indigo-200">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="moi">Mới</SelectItem>
              <SelectItem value="dangXuLy">Đang xử lý</SelectItem>
              <SelectItem value="daXong">Đã xong</SelectItem>
              <SelectItem value="daHuy">Đã hủy</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="text-sm border-indigo-200">
              <SelectValue placeholder="Loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="dienNuoc">Điện nước</SelectItem>
              <SelectItem value="noiThat">Nội thất</SelectItem>
              <SelectItem value="vesinh">Vệ sinh</SelectItem>
              <SelectItem value="anNinh">An ninh</SelectItem>
              <SelectItem value="khac">Khác</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="text-sm border-indigo-200">
              <SelectValue placeholder="Ưu tiên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="thap">Thấp</SelectItem>
              <SelectItem value="trungBinh">Trung bình</SelectItem>
              <SelectItem value="cao">Cao</SelectItem>
              <SelectItem value="khancap">Khẩn cấp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Báo cáo sự cố mới"
          description="Thêm sự cố mới từ khách thuê"
          onSave={handleCreateSuCo}
          onCancel={() => {
            setShowCreateForm(false);
            resetCreateForm();
          }}
          saving={saving}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-indigo-700">Phòng</Label>
              <Select
                value={createForm.phong}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, phong: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue placeholder="Chọn phòng" />
                </SelectTrigger>
                <SelectContent>
                  {phongList.map(phong => (
                    <SelectItem key={phong.id} value={phong.id || ''}>
                      {phong.maPhong}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Loại sự cố</Label>
              <Select
                value={createForm.loaiSuCo}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, loaiSuCo: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dienNuoc">Điện nước</SelectItem>
                  <SelectItem value="noiThat">Nội thất</SelectItem>
                  <SelectItem value="vesinh">Vệ sinh</SelectItem>
                  <SelectItem value="anNinh">An ninh</SelectItem>
                  <SelectItem value="khac">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Mức độ ưu tiên</Label>
              <Select
                value={createForm.mucDoUuTien}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, mucDoUuTien: value }))}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thap">Thấp</SelectItem>
                  <SelectItem value="trungBinh">Trung bình</SelectItem>
                  <SelectItem value="cao">Cao</SelectItem>
                  <SelectItem value="khancap">Khẩn cấp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700">Tiêu đề</Label>
              <Input
                value={createForm.tieuDe}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tieuDe: e.target.value }))}
                placeholder="Nhập tiêu đề sự cố"
                className="border-indigo-200"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-indigo-700">Mô tả</Label>
            <Textarea
              value={createForm.moTa}
              onChange={(e) => setCreateForm(prev => ({ ...prev, moTa: e.target.value }))}
              placeholder="Mô tả chi tiết sự cố..."
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
        emptyMessage="Không có sự cố nào"
        expandedId={expandedId}
        onToggleExpand={(id) => {
          if (expandedId === id) {
            setExpandedId(null);
            setEditForm(null);
          } else {
            const item = tableData.find(i => i.id === id);
            if (item) {
              handleEditSuCo(item);
            }
          }
        }}
        renderExpanded={renderExpanded}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditSuCo(item)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {item.trangThai === 'moi' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChange(item.id, 'dangXuLy')}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                title="Chuyển sang đang xử lý"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            )}
            {item.trangThai === 'dangXuLy' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChange(item.id, 'daXong')}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Đánh dấu đã xong"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {(item.trangThai === 'moi' || item.trangThai === 'dangXuLy') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChange(item.id, 'daHuy')}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Hủy sự cố"
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
