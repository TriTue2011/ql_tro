'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  User, Phone, Mail, CreditCard, MapPin, Briefcase,
  MessageCircle, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface KhachThue {
  id: string;
  hoTen: string;
  soDienThoai: string;
  email?: string;
  cccd: string;
  ngaySinh: string;
  gioiTinh: string;
  queQuan: string;
  ngheNghiep?: string;
  trangThai: string;
  zaloChatId?: string | null;
  pendingZaloChatId?: string | null;
  nhanThongBaoZalo: boolean;
}

function getAuthHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('khachThueToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ThongTinPage() {
  const [khachThue, setKhachThue] = useState<KhachThue | null>(null);
  const [loading, setLoading] = useState(true);
  const [zaloInput, setZaloInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    document.title = 'Thông tin cá nhân';
    fetchInfo();
  }, []);

  const fetchInfo = async () => {
    try {
      const res = await fetch('/api/auth/khach-thue/me', { headers: getAuthHeader() });
      const result = await res.json();
      if (result.success) {
        setKhachThue(result.data.khachThue);
        setZaloInput(result.data.khachThue.zaloChatId || '');
      } else {
        toast.error('Không thể tải thông tin');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZalo = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/khach-thue/zalo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ zaloChatId: zaloInput }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Đã cập nhật Zalo Chat ID');
        setKhachThue(prev => prev ? { ...prev, zaloChatId: result.zaloChatId } : prev);
      } else {
        toast.error(result.message || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  const handleZaloPending = async (action: 'confirm' | 'reject') => {
    setConfirmLoading(true);
    try {
      const res = await fetch('/api/auth/khach-thue/zalo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message);
        await fetchInfo();
      } else {
        toast.error(result.message || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!khachThue) {
    return <div className="text-center text-gray-600">Không có dữ liệu</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thông tin cá nhân</h1>
        <p className="text-gray-600 text-sm">Thông tin hồ sơ và liên kết Zalo của bạn</p>
      </div>

      {/* Thông tin cơ bản */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Thông tin cơ bản
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Họ và tên</p>
                <p className="font-medium text-sm">{khachThue.hoTen}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Số điện thoại</p>
                <p className="font-medium text-sm">{khachThue.soDienThoai}</p>
              </div>
            </div>
            {khachThue.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-sm">{khachThue.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">CCCD</p>
                <p className="font-medium text-sm font-mono">{khachThue.cccd}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Quê quán</p>
                <p className="font-medium text-sm">{khachThue.queQuan}</p>
              </div>
            </div>
            {khachThue.ngheNghiep && (
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Nghề nghiệp</p>
                  <p className="font-medium text-sm">{khachThue.ngheNghiep}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liên kết Zalo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            Liên kết Zalo
          </CardTitle>
          <CardDescription className="text-xs">
            Liên kết để nhận thông báo hóa đơn, hợp đồng qua Zalo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trạng thái hiện tại */}
          <div className="flex items-center justify-between p-3 rounded-md border bg-gray-50">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Zalo Chat ID hiện tại</p>
                {khachThue.zaloChatId ? (
                  <span className="text-sm font-mono flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {khachThue.zaloChatId}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Chưa liên kết</span>
                )}
              </div>
            </div>
            {khachThue.nhanThongBaoZalo ? (
              <Badge className="bg-green-100 text-green-700 text-xs">Đang nhận thông báo</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Tắt thông báo</Badge>
            )}
          </div>

          {/* Pending confirm */}
          {khachThue.pendingZaloChatId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-700 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Phát hiện Chat ID mới từ bot Zalo:{' '}
                <span className="font-mono font-semibold">{khachThue.pendingZaloChatId}</span>
              </p>
              <p className="text-[10px] text-amber-600">
                Xác nhận nếu đây là tài khoản Zalo của bạn, từ chối nếu không phải.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700"
                  disabled={confirmLoading}
                  onClick={() => handleZaloPending('confirm')}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Xác nhận
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-3 border-red-300 text-red-600 hover:bg-red-50"
                  disabled={confirmLoading}
                  onClick={() => handleZaloPending('reject')}
                >
                  <XCircle className="h-3 w-3 mr-1" /> Từ chối
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Nhập thủ công */}
          <div className="space-y-2">
            <Label htmlFor="zalo-input" className="text-sm">
              Nhập Zalo Chat ID thủ công
            </Label>
            <div className="flex gap-2">
              <Input
                id="zalo-input"
                value={zaloInput}
                onChange={(e) => setZaloInput(e.target.value)}
                placeholder="Nhập Chat ID từ bot Zalo..."
                className="text-sm font-mono flex-1"
                maxLength={64}
              />
              <Button size="sm" onClick={handleSaveZalo} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Chat ID lấy bằng cách nhắn tin cho bot Zalo — bot sẽ tự phát hiện và hiện Chat ID của bạn ở trên.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
