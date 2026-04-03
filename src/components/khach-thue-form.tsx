'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { CCCDUpload } from '@/components/ui/cccd-upload';
import { KhachThue, ZaloChatEntry } from '@/types';
import { toast } from 'sonner';
import {
  Info,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  Clock,
  Users,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';

export function KhachThueForm({
  khachThue,
  canViewZalo,
  onClose,
  onSuccess,
  isSubmitting,
  setIsSubmitting,
}: {
  khachThue: KhachThue | null;
  canViewZalo: boolean;
  onClose: () => void;
  onSuccess: (newKhachThue?: KhachThue) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    hoTen: khachThue?.hoTen || '',
    soDienThoai: khachThue?.soDienThoai || '',
    email: khachThue?.email || '',
    cccd: khachThue?.cccd || '',
    ngaySinh: khachThue?.ngaySinh ? new Date(khachThue.ngaySinh).toISOString().split('T')[0] : '',
    gioiTinh: khachThue?.gioiTinh || 'nam',
    queQuan: khachThue?.queQuan || '',
    anhCCCD: {
      matTruoc: khachThue?.anhCCCD.matTruoc || '',
      matSau: khachThue?.anhCCCD.matSau || '',
    },
    ngheNghiep: khachThue?.ngheNghiep || '',
    matKhau: '',
    zaloChatId: khachThue?.zaloChatId || '',
    nhanThongBaoZalo: khachThue?.nhanThongBaoZalo ?? false,
  });

  // Bảng liên kết Zalo theo từng tài khoản bot
  const [zaloChatIds, setZaloChatIds] = useState<ZaloChatEntry[]>(
    Array.isArray((khachThue as any)?.zaloChatIds) ? (khachThue as any).zaloChatIds : []
  );

  // Phòng đang thuê
  const currentPhongId = (khachThue as any)?.hopDongHienTai?.phong?.id || '';
  const currentPhongName = (khachThue as any)?.hopDongHienTai?.phong
    ? `${(khachThue as any).hopDongHienTai.phong.maPhong}${(khachThue as any).hopDongHienTai.phong.toaNha?.tenToaNha ? ' — ' + (khachThue as any).hopDongHienTai.phong.toaNha.tenToaNha : ''}`
    : '';
  const [availablePhong, setAvailablePhong] = useState<{ id: string; maPhong: string; tenToaNha: string }[]>([]);
  const [selectedPhongId, setSelectedPhongId] = useState('');
  const [assigningPhong, setAssigningPhong] = useState(false);

  useEffect(() => {
    fetch('/api/phong?trangThai=trong')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAvailablePhong(d.data.map((p: any) => ({
            id: p.id,
            maPhong: p.maPhong,
            tenToaNha: typeof p.toaNha === 'object' ? p.toaNha?.tenToaNha || '' : '',
          })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleAssignPhong() {
    if (!selectedPhongId || !khachThue) return;
    setAssigningPhong(true);
    try {
      const res = await fetch(`/api/phong/${selectedPhongId}/thue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ khachThueId: khachThue.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã gán phòng thành công! Hợp đồng tối giản đã được tạo.');
        onSuccess();
      } else {
        toast.error(data.message || 'Không thể gán phòng');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setAssigningPhong(false);
    }
  }

  async function handleUnassignPhong() {
    if (!currentPhongId) return;
    setAssigningPhong(true);
    try {
      const res = await fetch(`/api/phong/${currentPhongId}/thue`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã hủy gán phòng');
        onSuccess();
      } else {
        toast.error(data.message || 'Không thể hủy gán');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setAssigningPhong(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validate: cần ít nhất SĐT hoặc email
    if (!formData.soDienThoai.trim() && !formData.email.trim()) {
      toast.error('Cần nhập ít nhất số điện thoại hoặc email');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = khachThue ? `/api/khach-thue/${khachThue.id}` : '/api/khach-thue';
      const method = khachThue ? 'PUT' : 'POST';

      // Chỉ gửi matKhau khi nó được nhập
      const submitData = { ...formData };
      if (!submitData.matKhau || submitData.matKhau.trim() === '') {
        delete (submitData as any).matKhau;
      }

      // Đồng bộ zaloChatId từ entry đầu tiên trong bảng (nếu có)
      const validEntries = zaloChatIds.filter(e => e.threadId || e.userId);
      if (validEntries.length > 0) {
        submitData.zaloChatId = validEntries[0].threadId || validEntries[0].userId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...submitData, zaloChatIds: validEntries }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onSuccess(result.data);
        } else {
          toast.error(result.message || 'Có lỗi xảy ra');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      <Tabs defaultValue="thong-tin" className="w-full">
        <TabsList className={`grid w-full ${khachThue && canViewZalo ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="thong-tin" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Info className="h-3 w-3 md:h-4 md:w-4" />
            <span>Thông tin</span>
          </TabsTrigger>
          <TabsTrigger value="anh-cccd" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
            <span>Ảnh CCCD</span>
          </TabsTrigger>
          {khachThue && canViewZalo && (
            <TabsTrigger value="zalo" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <MessageCircle className="h-3 w-3 md:h-4 md:w-4" />
              <span>Zalo</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="thong-tin" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="hoTen" className="text-xs md:text-sm">Họ tên</Label>
              <Input
                id="hoTen"
                value={formData.hoTen}
                onChange={(e) => setFormData(prev => ({ ...prev, hoTen: e.target.value }))}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="soDienThoai" className="text-xs md:text-sm">
                Số điện thoại
                <span className="text-muted-foreground font-normal ml-1">(cần ít nhất SĐT hoặc email)</span>
              </Label>
              <Input
                id="soDienThoai"
                value={formData.soDienThoai}
                onChange={(e) => setFormData(prev => ({ ...prev, soDienThoai: e.target.value }))}
                className="text-sm"
                placeholder="Tùy chọn nếu đã có email"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs md:text-sm">
                Email
                <span className="text-muted-foreground font-normal ml-1">(cần ít nhất SĐT hoặc email)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="text-sm"
                placeholder="Tùy chọn nếu đã có SĐT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cccd" className="text-xs md:text-sm">CCCD</Label>
              <Input
                id="cccd"
                value={formData.cccd}
                onChange={(e) => setFormData(prev => ({ ...prev, cccd: e.target.value }))}
                required
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="ngaySinh" className="text-xs md:text-sm">Ngày sinh</Label>
              <Input
                id="ngaySinh"
                type="date"
                value={formData.ngaySinh}
                onChange={(e) => setFormData(prev => ({ ...prev, ngaySinh: e.target.value }))}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gioiTinh" className="text-xs md:text-sm">Giới tính</Label>
              <Select value={formData.gioiTinh} onValueChange={(value) => setFormData(prev => ({ ...prev, gioiTinh: value as 'nam' | 'nu' }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nam" className="text-sm">Nam</SelectItem>
                  <SelectItem value="nu" className="text-sm">Nữ</SelectItem>
                  <SelectItem value="khac" className="text-sm">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queQuan" className="text-xs md:text-sm">Quê quán</Label>
            <Input
              id="queQuan"
              value={formData.queQuan}
              onChange={(e) => setFormData(prev => ({ ...prev, queQuan: e.target.value }))}
              required
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ngheNghiep" className="text-xs md:text-sm">Nghề nghiệp</Label>
            <Input
              id="ngheNghiep"
              value={formData.ngheNghiep}
              onChange={(e) => setFormData(prev => ({ ...prev, ngheNghiep: e.target.value }))}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="matKhau" className="text-xs md:text-sm">
              Mật khẩu đăng nhập web
              {!khachThue && <span className="text-muted-foreground font-normal ml-1">(bỏ trống = không cho đăng nhập)</span>}
            </Label>
            <Input
              id="matKhau"
              type="password"
              value={formData.matKhau}
              onChange={(e) => setFormData(prev => ({ ...prev, matKhau: e.target.value }))}
              placeholder={khachThue && (khachThue as any).hasMatKhau ? "Để trống nếu không muốn thay đổi" : "Bỏ trống = không cho đăng nhập web"}
              className="text-sm"
            />
            {/* Password strength indicator */}
            {(() => {
              const pw = formData.matKhau;
              const hasAccount = khachThue && (khachThue as any).hasMatKhau;
              if (!pw) {
                if (hasAccount) {
                  return <p className="text-[10px] md:text-xs text-muted-foreground">Khách thuê đã có tài khoản đăng nhập. Để trống nếu không muốn thay đổi mật khẩu.</p>;
                }
                return (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">Chưa tạo</span>
                    <span className="text-[10px] text-muted-foreground">Bỏ trống = khách thuê không thể đăng nhập web.</span>
                  </div>
                );
              }
              const hasLower = /[a-z]/.test(pw);
              const hasUpper = /[A-Z]/.test(pw);
              const hasDigit = /[0-9]/.test(pw);
              const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
              const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
              let level: 'weak' | 'medium' | 'strong';
              if (pw.length < 8 || variety < 2) level = 'weak';
              else if (pw.length < 12 || variety < 3) level = 'medium';
              else level = 'strong';
              const cfg = {
                weak:   { label: 'Yếu',       bg: 'bg-red-100',    text: 'text-red-600',    bar: 'bg-red-500',    w: 'w-1/3' },
                medium: { label: 'Trung bình', bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500', w: 'w-2/3' },
                strong: { label: 'Mạnh',       bg: 'bg-green-100',  text: 'text-green-700',  bar: 'bg-green-500',  w: 'w-full' },
              }[level];
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground">{pw.length} ký tự</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-gray-100">
                    <div className={`h-1 rounded-full transition-all ${cfg.bar} ${cfg.w}`} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Gán phòng ── */}
          {khachThue && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs md:text-sm font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Phòng đang thuê
              </Label>
              {currentPhongId ? (
                <div className="flex items-center justify-between rounded-md border bg-green-50 px-3 py-2">
                  <span className="text-sm font-medium text-green-800">{currentPhongName}</span>
                  <Button type="button" size="sm" variant="outline"
                    className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                    disabled={assigningPhong} onClick={handleUnassignPhong}>
                    {assigningPhong ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Hủy gán'}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedPhongId} onValueChange={setSelectedPhongId}>
                    <SelectTrigger className="text-sm flex-1">
                      <SelectValue placeholder="Chọn phòng trống..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePhong.length === 0 ? (
                        <SelectItem value="_none" disabled>Không có phòng trống</SelectItem>
                      ) : availablePhong.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.maPhong}{p.tenToaNha ? ` — ${p.tenToaNha}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" disabled={!selectedPhongId || assigningPhong} onClick={handleAssignPhong}>
                    {assigningPhong ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Gán phòng'}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Gán phòng sẽ tạo hợp đồng tối giản. Có thể chỉnh sửa trong mục Hợp đồng.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="anh-cccd" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          <CCCDUpload
            anhCCCD={formData.anhCCCD}
            onCCCDChange={(anhCCCD) => setFormData(prev => ({ ...prev, anhCCCD }))}
            className="w-full"
          />
        </TabsContent>

        {khachThue && canViewZalo && (
          <TabsContent value="zalo" className="space-y-4 mt-4">
            {/* Pending confirmation */}
            {khachThue.pendingZaloChatId && (
              <div className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-200">
                <span className="text-amber-700 text-xs flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Chờ xác nhận: <span className="font-mono font-semibold ml-1">{khachThue.pendingZaloChatId}</span>
                </span>
              </div>
            )}

            {/* Bảng liên kết theo từng tài khoản bot */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs md:text-sm flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                  Liên kết Zalo theo tài khoản bot
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setZaloChatIds(prev => [...prev, { ten: '', userId: '', threadId: '' }])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm dòng
                </Button>
              </div>

              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 px-1">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tên bot</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">User ID</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Thread ID</span>
                <span className="w-7" />
              </div>

              {zaloChatIds.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">
                  Chưa có liên kết — nhấn <strong>Thêm dòng</strong> hoặc hệ thống tự điền khi bot tìm thấy SĐT
                </div>
              )}

              {zaloChatIds.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                  <Input
                    value={entry.ten}
                    onChange={e => setZaloChatIds(prev => prev.map((r, i) => i === idx ? { ...r, ten: e.target.value } : r))}
                    placeholder="Bot chính..."
                    className="h-8 text-xs font-mono"
                  />
                  <Input
                    value={entry.userId}
                    onChange={e => setZaloChatIds(prev => prev.map((r, i) => i === idx ? { ...r, userId: e.target.value } : r))}
                    placeholder="User ID..."
                    className="h-8 text-xs font-mono"
                  />
                  <Input
                    value={entry.threadId}
                    onChange={e => setZaloChatIds(prev => prev.map((r, i) => i === idx ? { ...r, threadId: e.target.value } : r))}
                    placeholder="Thread ID..."
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setZaloChatIds(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <p className="text-[10px] text-muted-foreground">
                Mỗi dòng là 1 tài khoản bot. Hệ thống tự điền khi bot tìm thấy SĐT <strong>{khachThue.soDienThoai}</strong>.
                Dòng đầu tiên được dùng làm Chat ID chính.
              </p>
            </div>

            {/* Gửi thông báo */}
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div className="space-y-0.5">
                <Label className="text-xs md:text-sm">Gửi thông báo Zalo</Label>
                <p className="text-[10px] text-muted-foreground">Bật để hệ thống gửi tin nhắn Zalo cho khách thuê này</p>
              </div>
              <Switch
                checked={formData.nhanThongBaoZalo}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, nhanThongBaoZalo: v }))}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              <span>{khachThue ? 'Đang cập nhật...' : 'Đang thêm...'}</span>
            </>
          ) : (
            <span>{khachThue ? 'Cập nhật' : 'Thêm mới'}</span>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
