'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ToaNha, Phong, KhachThue, ThongBao } from '@/types';
import { toast } from 'sonner';
import { ArrowLeft, Users } from 'lucide-react';

interface ZaloNhomChatItem { name: string; threadIds: Record<string, string>; tang?: number | null; label?: string }

export default function SuaThongBaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    tieuDe: '',
    noiDung: '',
    loai: 'chung' as string,
    nguoiNhan: [] as string[],
    phong: [] as string[],
    toaNha: '',
    nhomChatIds: [] as string[],
    fileDinhKem: [] as string[],
  });
  const [nhomChatList, setNhomChatList] = useState<ZaloNhomChatItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Chỉnh sửa thông báo';
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [thongBaoRes, toaNhaRes, phongRes, khachThueRes] = await Promise.all([
        fetch(`/api/thong-bao?id=${id}`),
        fetch('/api/toa-nha'),
        fetch('/api/phong'),
        fetch('/api/khach-thue'),
      ]);
      const thongBaoData = thongBaoRes.ok ? await thongBaoRes.json() : { data: null };
      const toaNhaData = toaNhaRes.ok ? await toaNhaRes.json() : { data: [] };
      const phongData = phongRes.ok ? await phongRes.json() : { data: [] };
      const khachThueData = khachThueRes.ok ? await khachThueRes.json() : { data: [] };

      const toaNhas = toaNhaData.success ? toaNhaData.data : [];
      const phongs = phongData.success ? phongData.data : [];
      const khachThues = khachThueData.success ? khachThueData.data : [];

      setToaNhaList(toaNhas);
      setPhongList(phongs);
      setKhachThueList(khachThues);

      // Load thong bao data
      const thongBao: ThongBao | null = thongBaoData.success ? thongBaoData.data : null;
      if (thongBao) {
        setFormData({
          tieuDe: thongBao.tieuDe || '',
          noiDung: thongBao.noiDung || '',
          loai: thongBao.loai || 'chung',
          nguoiNhan: thongBao.nguoiNhan || [],
          phong: thongBao.phong || (thongBao as any)?.phongIds || [],
          toaNha: thongBao.toaNha || (thongBao as any)?.toaNhaId || '',
          nhomChatIds: (thongBao as any)?.nhomChatIds || [],
          fileDinhKem: (thongBao as any)?.fileDinhKem || [],
        });
      } else {
        toast.error('Không tìm thấy thông báo');
        router.push('/dashboard/thong-bao');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Khi đổi tòa nhà → load danh sách nhóm Zalo của tòa đó
  useEffect(() => {
    let aborted = false;
    async function load() {
      const id = formData.toaNha;
      if (!id || id === 'all') { setNhomChatList([]); return; }
      try {
        const r = await fetch(`/api/toa-nha/${id}`);
        const j = await r.json();
        const groups: ZaloNhomChatItem[] = (j?.data?.zaloNhomChat ?? []) as ZaloNhomChatItem[];
        if (!aborted) setNhomChatList(Array.isArray(groups) ? groups : []);
      } catch { if (!aborted) setNhomChatList([]); }
    }
    load();
    return () => { aborted = true; };
  }, [formData.toaNha]);

  // Lọc phòng/khách thuê theo tòa nhà đang chọn (nếu có)
  const filteredPhong = formData.toaNha && formData.toaNha !== 'all'
    ? phongList.filter(p => (typeof p.toaNha === 'string' ? p.toaNha : (p.toaNha as any)?.id) === formData.toaNha)
    : phongList;
  const filteredPhongIds = new Set(filteredPhong.map(p => p.id));
  const filteredKhachThue = formData.toaNha && formData.toaNha !== 'all'
    ? khachThueList.filter((k: any) => {
        const toaNhaIdOfKT = k.hopDongHienTai?.phong?.toaNha?.id
          ?? (typeof k.hopDongHienTai?.phong?.toaNha === 'string' ? k.hopDongHienTai.phong.toaNha : undefined);
        if (toaNhaIdOfKT) return toaNhaIdOfKT === formData.toaNha;
        const pid = k.hopDongHienTai?.phong?.id
          ?? (typeof (k as any).phong === 'string' ? (k as any).phong : (k as any).phong?.id);
        return pid && filteredPhongIds.has(pid);
      })
    : khachThueList;

  const toggleAll = (field: 'phong' | 'nguoiNhan' | 'nhomChatIds', ids: string[]) => {
    setFormData(prev => {
      const current = prev[field] as string[];
      const allSelected = ids.length > 0 && ids.every(id => current.includes(id));
      const nextIds = allSelected ? current.filter(id => !ids.includes(id)) : Array.from(new Set([...current, ...ids]));

      if (field === 'phong') {
        let nextNguoiNhan = prev.nguoiNhan;
        ids.forEach(phongId => {
          const tenantsInRoom = filteredKhachThue.filter((kt: any) => {
            const pid = (kt as any).hopDongHienTai?.phong?.id ?? (typeof (kt as any).phong === 'string' ? (kt as any).phong : (kt as any).phong?.id);
            return pid === phongId;
          }).map((kt: any) => kt.id!);

          if (!allSelected) {
            nextNguoiNhan = Array.from(new Set([...nextNguoiNhan, ...tenantsInRoom]));
          } else {
            nextNguoiNhan = nextNguoiNhan.filter(id => !tenantsInRoom.includes(id));
          }
        });
        return { ...prev, phong: nextIds, nguoiNhan: nextNguoiNhan };
      }
      return { ...prev, [field]: nextIds };
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('type', f.type.startsWith('image/') ? 'image' : 'file');
        fd.append('folder', 'thong-bao');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.success && j.data?.secure_url) urls.push(j.data.secure_url);
        else toast.error(j.message || 'Upload thất bại');
      }
      if (urls.length > 0) setFormData(prev => ({ ...prev, fileDinhKem: [...prev.fileDinhKem, ...urls] }));
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (url: string) => {
    setFormData(prev => ({ ...prev, fileDinhKem: prev.fileDinhKem.filter((u: string) => u !== url) }));
  };

  const fileName = (url: string) => {
    try { return decodeURIComponent(url.split('/').pop() || url); } catch { return url; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nguoiNhan.length === 0 && formData.nhomChatIds.length === 0) {
      toast.error('Phải chọn ít nhất 1 người nhận hoặc 1 nhóm Zalo');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        nguoiNhan: formData.nguoiNhan.length > 0 ? formData.nguoiNhan : ['__broadcast__'],
      };
      const response = await fetch(`/api/thong-bao?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Cập nhật thông báo thành công');
        router.push('/dashboard/thong-bao');
      } else {
        toast.error(result.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Chỉnh sửa thông báo</h1>
          <p className="text-sm text-gray-500">Cập nhật thông tin thông báo</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin thông báo</CardTitle>
          <CardDescription>Chỉnh sửa thông tin chi tiết cho thông báo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tieuDe" className="text-xs md:text-sm">Tiêu đề</Label>
              <Input
                id="tieuDe"
                value={formData.tieuDe}
                onChange={(e) => setFormData(prev => ({ ...prev, tieuDe: e.target.value }))}
                placeholder="Nhập tiêu đề thông báo"
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="noiDung" className="text-xs md:text-sm">Nội dung</Label>
              <Textarea
                id="noiDung"
                value={formData.noiDung}
                onChange={(e) => setFormData(prev => ({ ...prev, noiDung: e.target.value }))}
                rows={6}
                placeholder="Nhập nội dung thông báo..."
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loai" className="text-xs md:text-sm">Loại thông báo</Label>
                <Select value={formData.loai} onValueChange={(value) => setFormData(prev => ({ ...prev, loai: value as any }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn loại thông báo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chung" className="text-sm">Chung</SelectItem>
                    <SelectItem value="hoaDon" className="text-sm">Hóa đơn</SelectItem>
                    <SelectItem value="suCo" className="text-sm">Sự cố</SelectItem>
                    <SelectItem value="hopDong" className="text-sm">Hợp đồng</SelectItem>
                    <SelectItem value="khac" className="text-sm">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toaNha" className="text-xs md:text-sm">Tòa nhà</Label>
                <Select value={formData.toaNha || undefined} onValueChange={(value) => setFormData(prev => ({ ...prev, toaNha: value, phong: [], nguoiNhan: [], nhomChatIds: [] }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Chọn tòa nhà (tùy chọn)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm">Tất cả tòa nhà</SelectItem>
                    {toaNhaList.map((toaNha) => (
                      <SelectItem key={toaNha.id} value={toaNha.id!} className="text-sm">
                        {toaNha.tenToaNha}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Phòng */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs md:text-sm">Phòng ({formData.phong.length}/{filteredPhong.length})</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
                    onClick={() => toggleAll('phong', filteredPhong.map(p => p.id!).filter(Boolean))}>
                    Chọn tất cả / Bỏ chọn
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {filteredPhong.length === 0 && <div className="text-xs text-gray-400 col-span-full">Không có phòng</div>}
                {filteredPhong.map((phong) => (
                  <label key={phong.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.phong.includes(phong.id!)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => {
                          let nextPhong = checked ? [...prev.phong, phong.id!] : prev.phong.filter(id => id !== phong.id);
                          const tenantsInRoom = filteredKhachThue.filter(kt => {
                            const pid = (kt as any).hopDongHienTai?.phong?.id ?? (typeof (kt as any).phong === 'string' ? (kt as any).phong : (kt as any).phong?.id);
                            return pid === phong.id;
                          }).map(kt => kt.id!);
                          let nextNguoiNhan = prev.nguoiNhan;
                          if (checked) {
                            nextNguoiNhan = Array.from(new Set([...prev.nguoiNhan, ...tenantsInRoom]));
                          } else {
                            nextNguoiNhan = prev.nguoiNhan.filter(id => !tenantsInRoom.includes(id));
                          }
                          return { ...prev, phong: nextPhong, nguoiNhan: nextNguoiNhan };
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs truncate">{phong.maPhong}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Người nhận */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs md:text-sm">Người nhận ({formData.nguoiNhan.length}/{filteredKhachThue.length})</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => toggleAll('nguoiNhan', filteredKhachThue.map(k => k.id!).filter(Boolean))}>
                  Chọn tất cả / Bỏ chọn
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {filteredKhachThue.length === 0 && <div className="text-xs text-gray-400 col-span-full">Không có khách thuê</div>}
                {filteredKhachThue.map((khachThue) => (
                  <label key={khachThue.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.nguoiNhan.includes(khachThue.id!)}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        nguoiNhan: e.target.checked
                          ? [...prev.nguoiNhan, khachThue.id!]
                          : prev.nguoiNhan.filter(id => id !== khachThue.id),
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs truncate">{khachThue.hoTen}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nhóm Zalo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs md:text-sm">Nhóm Zalo ({formData.nhomChatIds.length}/{nhomChatList.length})</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => toggleAll('nhomChatIds', nhomChatList.map(g => g.name || Object.values(g.threadIds || {})[0]))}>
                  Chọn tất cả / Bỏ chọn
                </Button>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {nhomChatList.length === 0 && (
                  <div className="text-xs text-gray-400">
                    {formData.toaNha && formData.toaNha !== 'all' ? 'Tòa nhà chưa khai báo nhóm Zalo' : 'Chọn một tòa nhà để xem nhóm Zalo'}
                  </div>
                )}
                {nhomChatList.map((g) => {
                  const label = g.label ?? (g.name || (g.tang != null ? `Tầng ${g.tang}` : 'Toàn tòa'));
                  const key = g.name || (Object.values(g.threadIds || {})[0] as string);
                  return (
                    <label key={key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.nhomChatIds.includes(key)}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          nhomChatIds: e.target.checked
                            ? [...prev.nhomChatIds, key]
                            : prev.nhomChatIds.filter((t: string) => t !== key),
                        }))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs">{label}</span>
                      <Users className="h-3 w-3 text-purple-400" />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* File đính kèm */}
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">File đính kèm ({formData.fileDinhKem.length})</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={uploading}
                  className="text-xs"
                />
                {uploading && <span className="text-xs text-gray-500">Đang tải...</span>}
              </div>
              {formData.fileDinhKem.length > 0 && (
                <div className="border rounded-md p-2 space-y-1">
                  {formData.fileDinhKem.map((url: string) => (
                    <div key={url} className="flex items-center justify-between gap-2 text-xs">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline">
                        {fileName(url)}
                      </a>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-red-600"
                        onClick={() => removeFile(url)}>
                        Xóa
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4 md:pt-6 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => router.back()} className="w-full sm:w-auto">
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || uploading} className="w-full sm:w-auto">
                {isSubmitting ? 'Đang gửi...' : 'Cập nhật thông báo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
