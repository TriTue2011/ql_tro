'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { useSession } from 'next-auth/react';
import { useCanEdit } from '@/hooks/use-can-edit';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Users,
  Phone,
  Mail,
  Calendar,
  MapPin,
  CreditCard,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  Building2,
  DoorOpen,
  AlertTriangle,
  X as CloseIcon,
  Home,
  Globe,
} from 'lucide-react';
import { KhachThue } from '@/types';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';

interface InlineEditKhachThue {
  id: string;
  hoTen: string;
  soDienThoai: string;
  email: string;
  cccd: string;
  ngaySinh: Date;
  gioiTinh: string;
  queQuan: string;
  ngheNghiep: string;
  trangThai: string;
  hasMatKhau: boolean;
  batDangNhapWeb: boolean;
  nhanThongBaoZalo: boolean;
  hopDongHienTai?: {
    id: string;
    phong: {
      id: string;
      maPhong: string;
      toaNha: {
        id: string;
        tenToaNha: string;
      };
    };
  };
  nguoiTaoTen?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export default function KhachThuePage() {
  const { data: session } = useSession();
  const canEdit = useCanEdit();
  const canViewZalo = ['admin', 'chuNha'].includes(session?.user?.role ?? '');
  const cache = useCache<{ khachThueList: KhachThue[] }>({ key: 'khach-thue-data', duration: 300000 });
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrangThai, setSelectedTrangThai] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Smart delete: khi khách thuê đang đứng hợp đồng
  const [deleteTarget, setDeleteTarget] = useState<KhachThue | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Accordion states (mặc định tất cả ẩn)
  const [openBuildings, setOpenBuildings] = useState<Set<string>>(new Set());
  const [openPhong, setOpenPhong] = useState<Set<string>>(new Set());
  const toggleBuilding = (id: string) =>
    setOpenBuildings(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePhong = (id: string) =>
    setOpenPhong(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [selectedKhachThueId, setSelectedKhachThueId] = useState<string | null>(null);

  // Inline create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    hoTen: '',
    soDienThoai: '',
    email: '',
    cccd: '',
    ngaySinh: '',
    gioiTinh: 'nam',
    queQuan: '',
    ngheNghiep: '',
  });

  // Inline edit form state
  const [editForm, setEditForm] = useState<InlineEditKhachThue | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Quản lý Khách thuê';
  }, []);

  useEffect(() => {
    fetchKhachThue();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['khach-thue'], (_type, _action) => {
    cache.clearCache();
    fetchKhachThue(true);
  });

  const fetchKhachThue = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Thử load từ cache trước
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setKhachThueList(cachedData.khachThueList || []);
          setLoading(false);
          return;
        }
      }
      
      const params = new URLSearchParams();
      if (selectedTrangThai && selectedTrangThai !== 'all') params.append('trangThai', selectedTrangThai);
      
      const response = await fetch(`/api/khach-thue?${params.toString()}&limit=100`);
      let khachThueData: KhachThue[] = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          khachThueData = result.data;
          setKhachThueList(khachThueData);
        }
      }
      
      // Lưu cache với data mới
      if (khachThueData.length > 0) {
        cache.setCache({ khachThueList: khachThueData });
      }
    } catch (error) {
      console.error('Error fetching khach thue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchKhachThue(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  useEffect(() => {
    // Khi filter thay đổi, cần force refresh để lấy data mới theo filter
    if (selectedTrangThai) {
      fetchKhachThue(true);
    }
  }, [selectedTrangThai]);

  const filteredKhachThue = khachThueList.filter(khachThue =>
    khachThue.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (khachThue.soDienThoai || '').includes(searchTerm) ||
    (khachThue.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    khachThue.cccd.includes(searchTerm) ||
    khachThue.queQuan.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(k =>
    !selectedTrangThai || selectedTrangThai === 'all' || k.trangThai === selectedTrangThai
  );

  // Nhóm khách thuê theo tòa nhà → phòng
  type PhongGroup = { phongId: string; maPhong: string; tenants: typeof filteredKhachThue };
  type BuildingGroup = { toaNhaId: string; tenToaNha: string; rooms: PhongGroup[]; noRoom: typeof filteredKhachThue };

  const buildingGroups = (() => {
    const map = new Map<string, BuildingGroup>();
    const noRoom: typeof filteredKhachThue = [];

    for (const kt of filteredKhachThue) {
      const hopDong = (kt as any).hopDongHienTai;
      const phong = hopDong?.phong;
      const toa = phong?.toaNha;

      if (!phong || !toa) {
        noRoom.push(kt);
        continue;
      }

      const toaNhaId = toa.id || toa;
      const tenToaNha = toa.tenToaNha || 'Tòa không tên';
      const phongId = phong.id || phong;
      const maPhong = phong.maPhong || phongId;

      if (!map.has(toaNhaId)) {
        map.set(toaNhaId, { toaNhaId, tenToaNha, rooms: [], noRoom: [] });
      }
      const bg = map.get(toaNhaId)!;
      let pg = bg.rooms.find(r => r.phongId === phongId);
      if (!pg) { pg = { phongId, maPhong, tenants: [] }; bg.rooms.push(pg); }
      pg.tenants.push(kt);
    }

    return { groups: Array.from(map.values()), noRoom };
  })();

  // Kích hoạt / thu hồi tài khoản đăng nhập cho khách thuê
  const handleKichHoatTaiKhoan = async (id: string, hasAccount: boolean) => {
    if (hasAccount) {
      if (!confirm('Thu hồi quyền đăng nhập của khách thuê này?')) return;
      setActionLoading(`kich-hoat-${id}`);
      try {
        const res = await fetch(`/api/khach-thue/${id}/kich-hoat-tai-khoan`, { method: 'DELETE' });
        if (res.ok) {
          setKhachThueList(prev => prev.map(k => k.id === id ? { ...k, hasMatKhau: false } : k));
          cache.clearCache();
          toast.success('Đã thu hồi quyền đăng nhập');
        } else {
          const errData = await res.json().catch(() => null);
          toast.error(errData?.error || 'Không thể thu hồi quyền đăng nhập');
        }
      } catch { toast.error('Có lỗi xảy ra'); }
      finally { setActionLoading(null); }
    } else {
      setActionLoading(`kich-hoat-${id}`);
      try {
        const res = await fetch(`/api/khach-thue/${id}/kich-hoat-tai-khoan`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setKhachThueList(prev => prev.map(k => k.id === id ? { ...k, hasMatKhau: true } : k));
          cache.clearCache();
          const taiKhoan = data.soDienThoai || data.email || '';
          toast.success(
            `Đã kích hoạt! Mật khẩu: ${data.matKhau} — Đăng nhập bằng: ${taiKhoan}`,
            { duration: 10000 }
          );
        } else {
          const errData = await res.json().catch(() => null);
          toast.error(errData?.error || 'Không thể kích hoạt tài khoản');
        }
      } catch { toast.error('Có lỗi xảy ra'); }
      finally { setActionLoading(null); }
    }
  };

  // Bật/tắt đăng nhập web cho khách thuê cụ thể
  const handleToggleDangNhapWeb = async (id: string, currentValue: boolean) => {
    const newValue = !currentValue;
    setActionLoading(`toggle-web-${id}`);
    try {
      const res = await fetch(`/api/khach-thue/${id}/dang-nhap-web`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batDangNhapWeb: newValue }),
      });
      if (res.ok) {
        setKhachThueList(prev => prev.map(k => k.id === id ? { ...k, batDangNhapWeb: newValue } as any : k));
        cache.clearCache();
        toast.success(newValue ? 'Đã bật đăng nhập web cho khách thuê' : 'Đã tắt đăng nhập web cho khách thuê');
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Không thể thay đổi trạng thái đăng nhập web');
      }
    } catch { toast.error('Có lỗi xảy ra'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = (id: string) => {
    const kt = khachThueList.find(k => k.id === id);
    if (!kt) return;
    // Nếu đang đứng hợp đồng → hiện dialog lựa chọn
    if (kt.hopDongHienTai?.id) {
      setDeleteTarget(kt);
      setIsDeleteDialogOpen(true);
    } else {
      // Không có hợp đồng → xóa thẳng
      doDeleteKhachThue(id);
    }
  };

  const doDeleteKhachThue = async (id: string) => {
    setActionLoading(`delete-${id}`);
    try {
      const response = await fetch(`/api/khach-thue/${id}`, { method: 'DELETE' });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          cache.clearCache();
          setKhachThueList(prev => prev.filter(k => k.id !== id));
          toast.success('Xóa khách thuê thành công!');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error deleting khach thue:', error);
      toast.error('Có lỗi xảy ra khi xóa khách thuê');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteWithHopDong = async () => {
    if (!deleteTarget?.hopDongHienTai?.id || !deleteTarget.id) return;
    const hopDongId = deleteTarget.hopDongHienTai.id;
    const khachThueId = deleteTarget.id;
    setActionLoading(`delete-${khachThueId}`);
    setIsDeleteDialogOpen(false);
    try {
      // Xóa hợp đồng trước
      const r1 = await fetch(`/api/hop-dong/${hopDongId}`, { method: 'DELETE' });
      if (!r1.ok) {
        const err = await r1.json();
        toast.error(err.message || 'Không thể xóa hợp đồng');
        return;
      }
      // Rồi xóa khách thuê
      const r2 = await fetch(`/api/khach-thue/${khachThueId}`, { method: 'DELETE' });
      if (r2.ok) {
        const result = await r2.json();
        if (result.success) {
          cache.clearCache();
          setKhachThueList(prev => prev.filter(k => k.id !== khachThueId));
          toast.success('Đã xóa hợp đồng và khách thuê!');
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setActionLoading(null);
      setDeleteTarget(null);
    }
  };

  // Inline create handlers
  const resetCreateForm = () => {
    setCreateForm({
      hoTen: '',
      soDienThoai: '',
      email: '',
      cccd: '',
      ngaySinh: '',
      gioiTinh: 'nam',
      queQuan: '',
      ngheNghiep: '',
    });
  };

  const handleCreateKhachThue = async () => {
    if (!createForm.hoTen.trim()) {
      toast.error('Vui lòng nhập họ tên khách thuê');
      return;
    }
    if (!createForm.cccd.trim()) {
      toast.error('Vui lòng nhập CCCD');
      return;
    }
    if (!createForm.ngaySinh) {
      toast.error('Vui lòng chọn ngày sinh');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/khach-thue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          ngaySinh: new Date(createForm.ngaySinh).toISOString(),
        }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Thêm khách thuê thành công!');
          cache.clearCache();
          fetchKhachThue(true);
          setShowCreateForm(false);
          resetCreateForm();
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating khach thue:', error);
      toast.error('Có lỗi xảy ra khi thêm khách thuê');
    } finally {
      setSaving(false);
    }
  };

  // Inline edit handlers
  const handleEditKhachThue = useCallback((item: InlineEditKhachThue) => {
    setEditForm(item);
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!editForm.hoTen.trim()) {
      toast.error('Vui lòng nhập họ tên khách thuê');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/khach-thue/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoTen: editForm.hoTen,
          soDienThoai: editForm.soDienThoai,
          email: editForm.email,
          cccd: editForm.cccd,
          ngaySinh: editForm.ngaySinh,
          gioiTinh: editForm.gioiTinh,
          queQuan: editForm.queQuan,
          ngheNghiep: editForm.ngheNghiep,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Cập nhật khách thuê thành công!');
          cache.clearCache();
          fetchKhachThue(true);
          setExpandedId(null);
          setEditForm(null);
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating khach thue:', error);
      toast.error('Có lỗi xảy ra khi cập nhật khách thuê');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInline = async (item: InlineEditKhachThue) => {
    handleDelete(item.id);
  };

  // Table data
  const tableData = useMemo((): InlineEditKhachThue[] => {
    return filteredKhachThue.map(kt => ({
      id: kt.id || kt._id || '',
      hoTen: kt.hoTen,
      soDienThoai: kt.soDienThoai || '',
      email: kt.email || '',
      cccd: kt.cccd,
      ngaySinh: kt.ngaySinh,
      gioiTinh: kt.gioiTinh,
      queQuan: kt.queQuan,
      ngheNghiep: kt.ngheNghiep || '',
      trangThai: kt.trangThai,
      hasMatKhau: (kt as any).hasMatKhau || false,
      batDangNhapWeb: (kt as any).batDangNhapWeb || false,
      nhanThongBaoZalo: (kt as any).nhanThongBaoZalo || false,
      hopDongHienTai: kt.hopDongHienTai,
      nguoiTaoTen: (kt as any).nguoiTaoTen,
      ngayTao: kt.ngayTao,
      ngayCapNhat: kt.ngayCapNhat,
    }));
  }, [filteredKhachThue]);

  // Columns
  const columns: ColumnDef<InlineEditKhachThue>[] = useMemo(() => [
    {
      key: 'hoTen',
      header: 'Họ tên',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-medium text-sm text-indigo-900">{item.hoTen}</p>
            <p className="text-xs text-indigo-500 capitalize">{item.gioiTinh}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => <TrangThaiBadge trangThai={item.trangThai} />,
    },
    {
      key: 'soDienThoai',
      header: 'Liên hệ',
      render: (item) => (
        <div className="space-y-0.5">
          {item.soDienThoai && (
            <div className="flex items-center gap-1 text-xs text-indigo-700">
              <Phone className="h-3 w-3 text-indigo-400" />
              {item.soDienThoai}
            </div>
          )}
          {item.email && (
            <div className="flex items-center gap-1 text-xs text-indigo-700">
              <Mail className="h-3 w-3 text-indigo-400" />
              <span className="truncate max-w-[150px]">{item.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'cccd',
      header: 'CCCD',
      render: (item) => (
        <div className="flex items-center gap-1 text-xs text-indigo-700">
          <CreditCard className="h-3 w-3 text-indigo-400" />
          <span className="font-mono">{item.cccd}</span>
        </div>
      ),
    },
    {
      key: 'queQuan',
      header: 'Quê quán',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1 text-xs text-indigo-700">
          <MapPin className="h-3 w-3 text-indigo-400" />
          {item.queQuan}
        </div>
      ),
    },
  ], []);

  // Render expanded (inline edit form)
  const renderExpanded = useCallback((item: InlineEditKhachThue) => {
    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Họ tên</Label>
            <Input
              value={editForm?.id === item.id ? editForm.hoTen : item.hoTen}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, hoTen: e.target.value } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Giới tính</Label>
            <Select
              value={editForm?.id === item.id ? editForm.gioiTinh : item.gioiTinh}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, gioiTinh: value } : null)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nam">Nam</SelectItem>
                <SelectItem value="nu">Nữ</SelectItem>
                <SelectItem value="khac">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Số điện thoại</Label>
            <Input
              value={editForm?.id === item.id ? editForm.soDienThoai : item.soDienThoai}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, soDienThoai: e.target.value } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Email</Label>
            <Input
              value={editForm?.id === item.id ? editForm.email : item.email}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, email: e.target.value } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">CCCD</Label>
            <Input
              value={editForm?.id === item.id ? editForm.cccd : item.cccd}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, cccd: e.target.value } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Ngày sinh</Label>
            <Input
              type="date"
              value={(() => {
                const d: any = editForm?.id === item.id ? editForm.ngaySinh : item.ngaySinh;
                if (typeof d === 'string') return d.split('T')[0];
                return new Date(d).toISOString().split('T')[0];
              })()}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngaySinh: new Date(e.target.value) } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Quê quán</Label>
            <Input
              value={editForm?.id === item.id ? editForm.queQuan : item.queQuan}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, queQuan: e.target.value } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Nghề nghiệp</Label>
            <Input
              value={editForm?.id === item.id ? editForm.ngheNghiep : item.ngheNghiep}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngheNghiep: e.target.value } : null)}
              className="text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => { setExpandedId(null); setEditForm(null); }} className="text-sm">
            Hủy
          </Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="text-sm">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>
    );
  }, [editForm, saving, handleSaveEdit]);

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
        title="Quản lý khách thuê"
        description="Danh sách tất cả khách thuê trong hệ thống"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Thêm khách thuê"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng khách thuê</p>
              <p className="text-base md:text-2xl font-bold text-indigo-900">{khachThueList.length}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Đang thuê</p>
              <p className="text-base md:text-2xl font-bold text-blue-600">
                {khachThueList.filter(k => k.trangThai === 'dangThue').length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Đã trả phòng</p>
              <p className="text-base md:text-2xl font-bold text-gray-600">
                {khachThueList.filter(k => k.trangThai === 'daTraPhong').length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Chưa thuê</p>
              <p className="text-base md:text-2xl font-bold text-orange-600">
                {khachThueList.filter(k => k.trangThai === 'chuaThue').length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput
          placeholder="Tìm theo tên, SĐT, CCCD..."
          value={searchTerm}
          onChange={setSearchTerm}
          className="flex-1"
        />
        <Select value={selectedTrangThai} onValueChange={setSelectedTrangThai}>
          <SelectTrigger className="w-full sm:w-44 text-sm"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="dangThue">Đang thuê</SelectItem>
            <SelectItem value="daTraPhong">Đã trả phòng</SelectItem>
            <SelectItem value="chuaThue">Chưa thuê</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Thêm khách thuê mới"
          description="Nhập thông tin khách thuê"
          onSave={handleCreateKhachThue}
          onCancel={() => { setShowCreateForm(false); resetCreateForm(); }}
          saving={saving}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Họ tên *</Label>
              <Input
                value={createForm.hoTen}
                onChange={(e) => setCreateForm(prev => ({ ...prev, hoTen: e.target.value }))}
                placeholder="Nhập họ tên"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Giới tính</Label>
              <Select value={createForm.gioiTinh} onValueChange={(value) => setCreateForm(prev => ({ ...prev, gioiTinh: value }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nam">Nam</SelectItem>
                  <SelectItem value="nu">Nữ</SelectItem>
                  <SelectItem value="khac">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Số điện thoại</Label>
              <Input
                value={createForm.soDienThoai}
                onChange={(e) => setCreateForm(prev => ({ ...prev, soDienThoai: e.target.value }))}
                placeholder="Nhập số điện thoại"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Email</Label>
              <Input
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Nhập email"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">CCCD *</Label>
              <Input
                value={createForm.cccd}
                onChange={(e) => setCreateForm(prev => ({ ...prev, cccd: e.target.value }))}
                placeholder="Nhập CCCD"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Ngày sinh *</Label>
              <Input
                type="date"
                value={createForm.ngaySinh}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ngaySinh: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Quê quán</Label>
              <Input
                value={createForm.queQuan}
                onChange={(e) => setCreateForm(prev => ({ ...prev, queQuan: e.target.value }))}
                placeholder="Nhập quê quán"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Nghề nghiệp</Label>
              <Input
                value={createForm.ngheNghiep}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ngheNghiep: e.target.value }))}
                placeholder="Nhập nghề nghiệp"
                className="text-sm"
              />
            </div>
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
        emptyMessage="Không có khách thuê nào"
        expandedId={expandedId}
        onToggleExpand={(id) => {
          if (expandedId === id) {
            setExpandedId(null);
            setEditForm(null);
          } else {
            const item = tableData.find(t => t.id === id);
            if (item) {
              setEditForm(item);
              setExpandedId(id);
            }
          }
        }}
        renderExpanded={renderExpanded}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditKhachThue(item)}
              className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50"
              title="Chỉnh sửa"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const publicUrl = `${window.location.origin}/khach-thue/dang-nhap`;
                navigator.clipboard.writeText(publicUrl);
                toast.success('Đã sao chép link đăng nhập khách thuê');
              }}
              className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
              title="Copy link đăng nhập khách thuê"
            >
              <Copy className="h-4 w-4" />
            </Button>
            {item.hasMatKhau && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleKichHoatTaiKhoan(item.id, true)}
                disabled={actionLoading === `kich-hoat-${item.id}`}
                className="h-8 w-8 p-0 text-orange-600 hover:bg-orange-50"
                title="Thu hồi quyền đăng nhập"
              >
                <Globe className="h-4 w-4" />
              </Button>
            )}
            {!item.hasMatKhau && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleKichHoatTaiKhoan(item.id, false)}
                disabled={actionLoading === `kich-hoat-${item.id}`}
                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                title="Kích hoạt tài khoản đăng nhập"
              >
                <Globe className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteInline(item)}
              disabled={actionLoading === `delete-${item.id}`}
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
              title="Xóa"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      {/* Smart delete: khách thuê đang đứng hợp đồng */}
      {isDeleteDialogOpen && deleteTarget && (
        <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/80 shadow-lg shadow-amber-100/50">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-200">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-base font-semibold text-amber-900">Khách thuê đang có hợp đồng</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-amber-600 hover:bg-amber-100" onClick={() => { setIsDeleteDialogOpen(false); setDeleteTarget(null); }}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-amber-800 mb-4">
              <strong>{deleteTarget.hoTen}</strong> đang đứng tên hợp đồng phòng{' '}
              <strong>{deleteTarget.hopDongHienTai?.phong?.maPhong}</strong>
              {deleteTarget.hopDongHienTai?.phong?.toaNha?.tenToaNha && (
                <> — {deleteTarget.hopDongHienTai.phong.toaNha.tenToaNha}</>
              )}
              . Bạn muốn làm gì?
            </p>
            <div className="flex flex-col gap-3">
              <button
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-indigo-200 bg-white/60 hover:bg-indigo-50 transition-colors backdrop-blur-sm"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  window.location.href = `/dashboard/hop-dong/${deleteTarget.hopDongHienTai?.id}`;
                }}
              >
                <p className="font-medium text-indigo-900 text-sm">Thay đổi người đứng tên hợp đồng</p>
                <p className="text-xs text-indigo-600 mt-0.5">Mở hợp đồng để chọn người đứng tên mới</p>
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-red-200 bg-white/60 hover:bg-red-50 transition-colors backdrop-blur-sm"
                onClick={handleDeleteWithHopDong}
              >
                <p className="font-medium text-red-800 text-sm">Xóa hợp đồng và khách thuê</p>
                <p className="text-xs text-red-600 mt-0.5">Xóa hẳn cả hợp đồng lẫn khách thuê này</p>
              </button>
              <button
                className="w-full text-center px-4 py-2 rounded-xl border-2 border-indigo-100 bg-white/60 hover:bg-indigo-50 transition-colors text-sm text-indigo-600 backdrop-blur-sm"
                onClick={() => { setIsDeleteDialogOpen(false); setDeleteTarget(null); }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper badge component
function TrangThaiBadge({ trangThai }: { trangThai: string }) {
  switch (trangThai) {
    case 'dangThue':  return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">Đang thuê</Badge>;
    case 'daTraPhong': return <Badge variant="secondary" className="text-xs">Đã trả phòng</Badge>;
    case 'chuaThue':  return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">Chưa thuê</Badge>;
    default:          return <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">{trangThai}</Badge>;
  }
}
