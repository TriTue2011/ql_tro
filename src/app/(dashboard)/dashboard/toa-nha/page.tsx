'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Plus,
  Edit,
  Building2,
  MapPin,
  Copy,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
  Trash2,
  UserCircle,
  X,
  Home,
} from 'lucide-react';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';
import { ToaNha, LienHePhuTrach } from '@/types';
import { toast } from 'sonner';
import { useCanEdit } from '@/hooks/use-can-edit';

interface InlineEditToaNha {
  id: string;
  tenToaNha: string;
  diaChi: {
    soNha: string;
    duong: string;
    phuong: string;
    thanhPho: string;
  };
  moTa?: string;
  anhToaNha: string[];
  chuSoHuu: string;
  tongSoPhong: number;
  tienNghiChung: string[];
  lienHePhuTrach: LienHePhuTrach[];
  phongTrong?: number;
  phongDangThue?: number;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const tienNghiOptions = [
  { value: 'wifi', label: 'WiFi' },
  { value: 'camera', label: 'Camera an ninh' },
  { value: 'baoVe', label: 'Bảo vệ 24/7' },
  { value: 'giuXe', label: 'Giữ xe' },
  { value: 'thangMay', label: 'Thang máy' },
  { value: 'sanPhoi', label: 'Sân phơi' },
  { value: 'nhaVeSinhChung', label: 'Nhà vệ sinh chung' },
  { value: 'khuBepChung', label: 'Khu bếp chung' },
];

export default function ToaNhaPage() {
  const canEdit = useCanEdit();
  const cache = useCache<{ toaNhaList: ToaNha[] }>({ key: 'toa-nha-data', duration: 300000 });
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Inline create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    tenToaNha: '',
    soNha: '',
    duong: '',
    phuong: '',
    thanhPho: '',
    moTa: '',
    tienNghiChung: [] as string[],
  });
  const [createLienHe, setCreateLienHe] = useState<LienHePhuTrach[]>([]);
  const [newContact, setNewContact] = useState<LienHePhuTrach>({ ten: '', soDienThoai: '', vaiTro: '' });

  // Inline edit form state
  const [editForm, setEditForm] = useState<InlineEditToaNha | null>(null);
  const [editLienHe, setEditLienHe] = useState<LienHePhuTrach[]>([]);
  const [editNewContact, setEditNewContact] = useState<LienHePhuTrach>({ ten: '', soDienThoai: '', vaiTro: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/toa-nha/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          cache.clearCache();
          setToaNhaList(prev => prev.filter(toaNha => toaNha.id !== id && toaNha._id !== id));
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

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/xem-phong`;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Đã sao chép link trang xem phòng');
  };

  // --- Create form handlers ---
  const resetCreateForm = () => {
    setCreateForm({
      tenToaNha: '',
      soNha: '',
      duong: '',
      phuong: '',
      thanhPho: '',
      moTa: '',
      tienNghiChung: [],
    });
    setCreateLienHe([]);
    setNewContact({ ten: '', soDienThoai: '', vaiTro: '' });
  };

  const handleAddContact = (isEdit: boolean) => {
    if (isEdit) {
      const ten = editNewContact.ten.trim();
      const soDienThoai = editNewContact.soDienThoai.trim();
      if (!ten || !soDienThoai) return;
      setEditLienHe(prev => [...prev, { ten, soDienThoai, vaiTro: editNewContact.vaiTro?.trim() || undefined }]);
      setEditNewContact({ ten: '', soDienThoai: '', vaiTro: '' });
    } else {
      const ten = newContact.ten.trim();
      const soDienThoai = newContact.soDienThoai.trim();
      if (!ten || !soDienThoai) return;
      setCreateLienHe(prev => [...prev, { ten, soDienThoai, vaiTro: newContact.vaiTro?.trim() || undefined }]);
      setNewContact({ ten: '', soDienThoai: '', vaiTro: '' });
    }
  };

  const handleRemoveContact = (index: number, isEdit: boolean) => {
    if (isEdit) {
      setEditLienHe(prev => prev.filter((_, i) => i !== index));
    } else {
      setCreateLienHe(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleCreateToaNha = async () => {
    if (!createForm.tenToaNha || !createForm.soNha || !createForm.duong || !createForm.phuong || !createForm.thanhPho) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setSaving(true);
    try {
      const submitData = {
        tenToaNha: createForm.tenToaNha,
        diaChi: {
          soNha: createForm.soNha,
          duong: createForm.duong,
          phuong: createForm.phuong,
          thanhPho: createForm.thanhPho,
        },
        moTa: createForm.moTa,
        tienNghiChung: createForm.tienNghiChung,
        lienHePhuTrach: createLienHe,
      };

      const response = await fetch('/api/toa-nha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Thêm tòa nhà thành công!');
          cache.clearCache();
          await fetchToaNha(true);
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
      console.error('Error creating toa nha:', error);
      toast.error('Có lỗi xảy ra khi tạo tòa nhà');
    } finally {
      setSaving(false);
    }
  };

  // --- Edit form handlers ---
  const handleEditToaNha = useCallback((item: InlineEditToaNha) => {
    setEditForm({ ...item });
    setEditLienHe(item.lienHePhuTrach ? [...item.lienHePhuTrach] : []);
    setEditNewContact({ ten: '', soDienThoai: '', vaiTro: '' });
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!editForm.tenToaNha || !editForm.diaChi.soNha || !editForm.diaChi.duong || !editForm.diaChi.phuong || !editForm.diaChi.thanhPho) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setSaving(true);
    try {
      const submitData = {
        tenToaNha: editForm.tenToaNha,
        diaChi: {
          soNha: editForm.diaChi.soNha,
          duong: editForm.diaChi.duong,
          phuong: editForm.diaChi.phuong,
          thanhPho: editForm.diaChi.thanhPho,
        },
        moTa: editForm.moTa,
        tienNghiChung: editForm.tienNghiChung,
        lienHePhuTrach: editLienHe,
      };

      const response = await fetch(`/api/toa-nha/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Cập nhật tòa nhà thành công!');
          cache.clearCache();
          await fetchToaNha(true);
          setEditForm(null);
          setExpandedId(null);
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating toa nha:', error);
      toast.error('Có lỗi xảy ra khi cập nhật tòa nhà');
    } finally {
      setSaving(false);
    }
  };

  // --- Table data ---
  const tableData = useMemo((): InlineEditToaNha[] => {
    return filteredToaNha.map(tn => ({
      id: tn.id || tn._id || '',
      tenToaNha: tn.tenToaNha,
      diaChi: tn.diaChi,
      moTa: tn.moTa,
      anhToaNha: tn.anhToaNha || [],
      chuSoHuu: tn.chuSoHuu,
      tongSoPhong: tn.tongSoPhong,
      tienNghiChung: tn.tienNghiChung || [],
      lienHePhuTrach: tn.lienHePhuTrach || [],
      phongTrong: (tn as any).phongTrong || 0,
      phongDangThue: (tn as any).phongDangThue || 0,
      ngayTao: tn.ngayTao,
      ngayCapNhat: tn.ngayCapNhat,
    }));
  }, [filteredToaNha]);

  // --- Columns ---
  const columns: ColumnDef<InlineEditToaNha>[] = useMemo(() => [
    {
      key: 'tenToaNha',
      header: 'Tên tòa nhà',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2 min-w-40">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-medium text-gray-900">{item.tenToaNha}</span>
        </div>
      ),
    },
    {
      key: 'diaChi',
      header: 'Địa chỉ',
      sortable: false,
      render: (item) => (
        <div className="flex items-center gap-2 min-w-48">
          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">{formatAddress(item.diaChi)}</span>
        </div>
      ),
    },
    {
      key: 'tongSoPhong',
      header: 'Tổng phòng',
      sortable: true,
      className: 'text-center',
      render: (item) => (
        <span className="font-semibold text-indigo-600">{item.tongSoPhong}</span>
      ),
    },
    {
      key: 'phongTrong',
      header: 'Phòng trống',
      sortable: true,
      className: 'text-center',
      render: (item) => {
        const phongTrong = item.phongTrong || 0;
        const total = item.tongSoPhong;
        const percentage = total > 0 ? Math.round((phongTrong / total) * 100) : 0;
        return (
          <div>
            <div className="font-medium text-green-600">{phongTrong}</div>
            <div className="text-xs text-gray-400">({percentage}%)</div>
          </div>
        );
      },
    },
    {
      key: 'tienNghiChung',
      header: 'Tiện nghi',
      sortable: false,
      render: (item) => (
        <div className="flex flex-wrap gap-1 max-w-48">
          {item.tienNghiChung.slice(0, 2).map((tn) => (
            <Badge key={tn} variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">
              {tn}
            </Badge>
          ))}
          {item.tienNghiChung.length > 2 && (
            <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">
              +{item.tienNghiChung.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
  ], []);

  // --- Render expanded (inline edit form) ---
  const renderExpanded = useCallback((item: InlineEditToaNha) => {
    const isEditing = editForm?.id === item.id;
    const form = isEditing ? editForm! : item;
    const lienHe = isEditing ? editLienHe : item.lienHePhuTrach;
    const newCtc = isEditing ? editNewContact : { ten: '', soDienThoai: '', vaiTro: '' };
    const setNewCtc = isEditing ? setEditNewContact : setNewContact;

    const handleTienNghiChange = (tienNghi: string, checked: boolean) => {
      if (isEditing) {
        setEditForm(prev => prev ? {
          ...prev,
          tienNghiChung: checked
            ? [...prev.tienNghiChung, tienNghi]
            : prev.tienNghiChung.filter(t => t !== tienNghi),
        } : prev);
      }
    };

    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">Tên tòa nhà</Label>
            <Input
              value={isEditing ? form.tenToaNha : ''}
              onChange={(e) => isEditing && setEditForm(prev => prev ? { ...prev, tenToaNha: e.target.value } : prev)}
              disabled={!isEditing}
              className="text-sm"
              placeholder="Nhập tên tòa nhà"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Số nhà</Label>
            <Input
              value={isEditing ? form.diaChi.soNha : ''}
              onChange={(e) => isEditing && setEditForm(prev => prev ? { ...prev, diaChi: { ...prev.diaChi, soNha: e.target.value } } : prev)}
              disabled={!isEditing}
              className="text-sm"
              placeholder="Số nhà"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Tên đường</Label>
            <Input
              value={isEditing ? form.diaChi.duong : ''}
              onChange={(e) => isEditing && setEditForm(prev => prev ? { ...prev, diaChi: { ...prev.diaChi, duong: e.target.value } } : prev)}
              disabled={!isEditing}
              className="text-sm"
              placeholder="Tên đường"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Phường/Xã</Label>
            <Input
              value={isEditing ? form.diaChi.phuong : ''}
              onChange={(e) => isEditing && setEditForm(prev => prev ? { ...prev, diaChi: { ...prev.diaChi, phuong: e.target.value } } : prev)}
              disabled={!isEditing}
              className="text-sm"
              placeholder="Phường/Xã"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Tỉnh/Thành phố</Label>
            <Input
              value={isEditing ? form.diaChi.thanhPho : ''}
              onChange={(e) => isEditing && setEditForm(prev => prev ? { ...prev, diaChi: { ...prev.diaChi, thanhPho: e.target.value } } : prev)}
              disabled={!isEditing}
              className="text-sm"
              placeholder="Tỉnh/Thành phố"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Mô tả</Label>
          <Textarea
            value={isEditing ? (form.moTa || '') : ''}
            onChange={(e) => isEditing && setEditForm(prev => prev ? { ...prev, moTa: e.target.value } : prev)}
            disabled={!isEditing}
            rows={2}
            className="text-sm"
            placeholder="Mô tả tòa nhà"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Tiện nghi chung</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {tienNghiOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`edit-${option.value}-${item.id}`}
                  checked={form.tienNghiChung.includes(option.value)}
                  onChange={(e) => handleTienNghiChange(option.value, e.target.checked)}
                  disabled={!isEditing}
                  className="rounded border-gray-300"
                />
                <Label htmlFor={`edit-${option.value}-${item.id}`} className="text-sm cursor-pointer">{option.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Liên hệ phụ trách */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Liên hệ phụ trách</Label>
          <p className="text-xs text-gray-500">Thêm các đầu mối liên hệ để khách thuê liên hệ khi cần hỗ trợ.</p>

          {lienHe.length > 0 && (
            <div className="space-y-2">
              {lienHe.map((lh, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                  <UserCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{lh.ten}</span>
                    {lh.vaiTro && <span className="text-xs text-gray-500 ml-1">({lh.vaiTro})</span>}
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Phone className="h-3 w-3" />
                      {lh.soDienThoai}
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveContact(index, true)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditing && (
            <div className="grid grid-cols-1 gap-2 p-2 border rounded-md border-dashed">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Tên liên hệ *"
                  value={newCtc.ten}
                  onChange={e => setNewCtc(prev => ({ ...prev, ten: e.target.value }))}
                  className="text-sm"
                />
                <Input
                  placeholder="Số điện thoại *"
                  value={newCtc.soDienThoai}
                  onChange={e => setNewCtc(prev => ({ ...prev, soDienThoai: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Vai trò (vd: Quản lý, Bảo vệ...)"
                  value={newCtc.vaiTro || ''}
                  onChange={e => setNewCtc(prev => ({ ...prev, vaiTro: e.target.value }))}
                  className="text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddContact(true)}
                  disabled={!newCtc.ten.trim() || !newCtc.soDienThoai.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm
                </Button>
              </div>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
            <Button size="sm" variant="outline" onClick={() => { setEditForm(null); setExpandedId(null); }} className="text-sm">
              Hủy
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="text-sm">
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        )}
      </div>
    );
  }, [editForm, editLienHe, editNewContact, saving]);

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
        title=""
        description="Quản lý tòa nhà — Danh sách tất cả tòa nhà trong hệ thống"
        descriptionClassName="text-lg rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-1.5"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Thêm tòa nhà"
      />

      {/* Stats + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            placeholder="Tìm kiếm tòa nhà..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Thêm tòa nhà mới"
          description="Nhập thông tin tòa nhà mới"
          onSave={handleCreateToaNha}
          onCancel={() => { setShowCreateForm(false); resetCreateForm(); }}
          saving={saving}
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Tên tòa nhà</Label>
              <Input
                value={createForm.tenToaNha}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tenToaNha: e.target.value }))}
                className="text-sm"
                placeholder="Nhập tên tòa nhà"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Số nhà</Label>
                <Input
                  value={createForm.soNha}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, soNha: e.target.value }))}
                  className="text-sm"
                  placeholder="Số nhà"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Tên đường</Label>
                <Input
                  value={createForm.duong}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, duong: e.target.value }))}
                  className="text-sm"
                  placeholder="Tên đường"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Phường/Xã</Label>
                <Input
                  value={createForm.phuong}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, phuong: e.target.value }))}
                  className="text-sm"
                  placeholder="Phường/Xã"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Tỉnh/Thành phố</Label>
                <Input
                  value={createForm.thanhPho}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, thanhPho: e.target.value }))}
                  className="text-sm"
                  placeholder="Tỉnh/Thành phố"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Mô tả</Label>
              <Textarea
                value={createForm.moTa}
                onChange={(e) => setCreateForm(prev => ({ ...prev, moTa: e.target.value }))}
                rows={2}
                className="text-sm"
                placeholder="Mô tả tòa nhà"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tiện nghi chung</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {tienNghiOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`create-${option.value}`}
                      checked={createForm.tienNghiChung.includes(option.value)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCreateForm(prev => ({
                          ...prev,
                          tienNghiChung: checked
                            ? [...prev.tienNghiChung, option.value]
                            : prev.tienNghiChung.filter(t => t !== option.value),
                        }));
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`create-${option.value}`} className="text-sm cursor-pointer">{option.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            {/* Liên hệ phụ trách */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Liên hệ phụ trách</Label>
              <p className="text-xs text-gray-500">Thêm các đầu mối liên hệ để khách thuê liên hệ khi cần hỗ trợ.</p>
              {createLienHe.length > 0 && (
                <div className="space-y-2">
                  {createLienHe.map((lh, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                      <UserCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{lh.ten}</span>
                        {lh.vaiTro && <span className="text-xs text-gray-500 ml-1">({lh.vaiTro})</span>}
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Phone className="h-3 w-3" />
                          {lh.soDienThoai}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveContact(index, false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 p-2 border rounded-md border-dashed">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Tên liên hệ *"
                    value={newContact.ten}
                    onChange={e => setNewContact(prev => ({ ...prev, ten: e.target.value }))}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Số điện thoại *"
                    value={newContact.soDienThoai}
                    onChange={e => setNewContact(prev => ({ ...prev, soDienThoai: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Vai trò (vd: Quản lý, Bảo vệ...)"
                    value={newContact.vaiTro || ''}
                    onChange={e => setNewContact(prev => ({ ...prev, vaiTro: e.target.value }))}
                    className="text-sm flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddContact(false)}
                    disabled={!newContact.ten.trim() || !newContact.soDienThoai.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm
                  </Button>
                </div>
              </div>
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
        emptyMessage="Không tìm thấy tòa nhà nào"
        expandedId={expandedId}
        onToggleExpand={(id) => {
          setExpandedId(prev => prev === id ? null : id);
          if (editForm && editForm.id !== id) {
            setEditForm(null);
          }
        }}
        renderExpanded={renderExpanded}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyLink()}
              className="h-8 w-8 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
              title="Copy link trang xem phòng"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditToaNha(item)}
                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  title="Chỉnh sửa"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn xóa tòa nhà này?')) {
                      handleDelete(item.id);
                    }
                  }}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Xóa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      />
    </div>
  );
}
