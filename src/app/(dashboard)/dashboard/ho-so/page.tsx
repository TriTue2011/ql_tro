'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Edit3,
  Save,
  X,
  Camera,
  Key,
  Bell,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  FileText,
  Lock,
  MessageCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  ten: string;
  email: string;
  soDienThoai?: string;
  anhDaiDien?: string;
  vaiTro: string;
  trangThai: string;
  ngayTao: string;
  ngayCapNhat?: string;
  zaloChatId?: string | null;
  pendingZaloChatId?: string | null;
}

// ─── Password strength helpers ────────────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Rất yếu', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Yếu', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Trung bình', color: 'bg-yellow-500' };
  if (score === 4) return { score, label: 'Mạnh', color: 'bg-blue-500' };
  return { score, label: 'Rất mạnh', color: 'bg-green-500' };
}

const PASSWORD_RULES = [
  { label: 'Ít nhất 8 ký tự', test: (p: string) => p.length >= 8 },
  { label: 'Ít nhất 1 chữ hoa (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Ít nhất 1 chữ số (0-9)', test: (p: string) => /[0-9]/.test(p) },
];

// ─── Notification preference helpers ──────────────────────────────────────────
const NOTIF_TYPES = [
  { key: 'pending_issue', label: 'Sự cố mới', desc: 'Khi có phòng báo cáo sự cố cần xử lý', icon: Wrench },
  { key: 'overdue_invoice', label: 'Hóa đơn quá hạn', desc: 'Khi hóa đơn chưa được thanh toán đúng hạn', icon: AlertTriangle },
  { key: 'expiring_contract', label: 'Hợp đồng sắp hết hạn', desc: 'Khi hợp đồng thuê sắp đến ngày kết thúc', icon: FileText },
  { key: 'system', label: 'Thông báo hệ thống', desc: 'Thông báo quan trọng từ hệ thống', icon: Bell },
];

function loadNotifPrefs(userId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`notif_prefs_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { pending_issue: true, overdue_invoice: true, expiring_contract: true, system: true };
}

function saveNotifPrefs(userId: string, prefs: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`notif_prefs_${userId}`, JSON.stringify(prefs));
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    avatar: '',
    zaloChatId: '',
  });

  // ── Zalo pending confirm state ────────────────────────────────
  const [zaloPendingLoading, setZaloPendingLoading] = useState(false);

  async function handleZaloPendingAction(action: 'confirm' | 'reject') {
    if (!profile?.id) return;
    setZaloPendingLoading(true);
    try {
      const res = await fetch('/api/zalo/link-chat-id-nguoi-dung', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nguoiDungId: profile.id, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        // Reload profile
        const r = await fetch('/api/user/profile');
        const d = await r.json();
        if (d.success) setProfile(d.data);
      } else {
        toast.error(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setZaloPendingLoading(false);
    }
  }

  // ── Security state ────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ matKhauHienTai: '', matKhauMoi: '', xacNhanMatKhau: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // ── Notification prefs state ──────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    pending_issue: true, overdue_invoice: true, expiring_contract: true, system: true,
  });

  useEffect(() => {
    document.title = 'Hồ sơ cá nhân';
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setFormData({
          name: data.ten || '',
          phone: data.soDienThoai || '',
          address: '',
          avatar: data.anhDaiDien || '',
          zaloChatId: data.zaloChatId || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ten: formData.name,
          soDienThoai: formData.phone,
          anhDaiDien: formData.avatar || undefined,
          zaloChatId: formData.zaloChatId || undefined,
        }),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setIsEditing(false);
        toast.success('Cập nhật hồ sơ thành công');
        
        // Update session
        await update({
          ...session,
          user: {
            ...session?.user,
            name: formData.name,
            avatar: formData.avatar
          }
        });
      } else {
        toast.error('Cập nhật hồ sơ thất bại');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: profile?.ten || '',
      phone: profile?.soDienThoai || '',
      address: '',
      avatar: profile?.anhDaiDien || '',
      zaloChatId: profile?.zaloChatId || '',
    });
    setIsEditing(false);
  };

  // Load notif prefs when profile loads
  useEffect(() => {
    if (profile?.id) {
      setNotifPrefs(loadNotifPrefs(profile.id));
    }
  }, [profile?.id]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pwForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Đổi mật khẩu thành công');
        setPwForm({ matKhauHienTai: '', matKhauMoi: '', xacNhanMatKhau: '' });
      } else {
        toast.error(data.error || 'Đổi mật khẩu thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setPwSaving(false);
    }
  };

  const handleNotifToggle = (key: string, value: boolean) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    if (profile?.id) saveNotifPrefs(profile.id, updated);
    toast.success(value ? 'Đã bật thông báo' : 'Đã tắt thông báo');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Quản trị viên</Badge>;
      case 'chuNha':
        return <Badge variant="default" className="bg-blue-600">Chủ trọ</Badge>;
      case 'quanLy':
        return <Badge variant="outline" className="border-violet-400 text-violet-600">Quản lý</Badge>;
      case 'nhanVien':
        return <Badge variant="secondary">Nhân viên</Badge>;
      default:
        return <Badge variant="outline">Người dùng</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
          <p className="text-xs md:text-sm text-gray-600">Quản lý thông tin tài khoản của bạn</p>
        </div>
        {!isEditing && (
          <Button size="sm" onClick={() => setIsEditing(true)}>
            <Edit3 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Chỉnh sửa</span>
          </Button>
        )}
      </div>

      <Tabs defaultValue="profile" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="text-xs md:text-sm">
            <User className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Thông tin</span>
            <span className="sm:hidden">TT</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs md:text-sm">
            <Key className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Bảo mật</span>
            <span className="sm:hidden">BM</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs md:text-sm">
            <Bell className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Thông báo</span>
            <span className="sm:hidden">TB</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <User className="h-4 w-4 md:h-5 md:w-5" />
                Thông tin cơ bản
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Cập nhật thông tin cá nhân và ảnh đại diện
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
                <Avatar className="h-16 w-16 md:h-20 md:w-20">
                  <AvatarImage src={formData.avatar} alt={formData.name} />
                  <AvatarFallback className="text-base md:text-lg">
                    {getInitials(formData.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2 text-center sm:text-left">
                  <h3 className="text-base md:text-lg font-medium">{formData.name}</h3>
                  {profile?.vaiTro && getRoleBadge(profile.vaiTro)}
                  {isEditing && (
                    <Button variant="outline" size="sm" className="text-xs md:text-sm">
                      <Camera className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      Thay đổi ảnh
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs md:text-sm">Họ và tên</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nhập họ và tên"
                      className="text-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 md:p-3 border rounded-md bg-gray-50">
                      <User className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                      <span className="text-sm">{formData.name}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs md:text-sm">Email</Label>
                  <div className="flex items-center gap-2 p-2 md:p-3 border rounded-md bg-gray-50">
                    <Mail className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                    <span className="text-sm truncate">{profile?.email}</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-500">Email không thể thay đổi</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs md:text-sm">Số điện thoại</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Nhập số điện thoại"
                      className="text-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 md:p-3 border rounded-md bg-gray-50">
                      <Phone className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                      <span className="text-sm">{formData.phone || 'Chưa cập nhật'}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-xs md:text-sm">Vai trò</Label>
                  <div className="flex items-center gap-2 p-2 md:p-3 border rounded-md bg-gray-50">
                    <Shield className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                    {profile?.vaiTro && getRoleBadge(profile.vaiTro)}
                  </div>
                </div>

                {/* Zalo Chat ID — tất cả người dùng */}
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="zaloChatId" className="text-xs md:text-sm flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                      Zalo Chat ID
                    </Label>
                    {isEditing ? (
                      <Input
                        id="zaloChatId"
                        value={formData.zaloChatId}
                        onChange={(e) => setFormData({ ...formData, zaloChatId: e.target.value })}
                        placeholder="Nhập Zalo Chat ID của bạn..."
                        className="text-sm font-mono"
                        maxLength={64}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 md:p-3 border rounded-md bg-gray-50">
                        <MessageCircle className="h-3 w-3 md:h-4 md:w-4 text-gray-500 shrink-0" />
                        {profile?.zaloChatId ? (
                          <span className="text-sm font-mono flex items-center gap-1.5 text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {profile.zaloChatId}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Chưa liên kết Zalo</span>
                        )}
                      </div>
                    )}
                    {profile?.pendingZaloChatId && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                        <p className="text-[10px] text-amber-700 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Phát hiện Chat ID mới: <span className="font-mono font-semibold">{profile.pendingZaloChatId}</span>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700"
                            disabled={zaloPendingLoading}
                            onClick={() => handleZaloPendingAction('confirm')}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Xác nhận
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-red-300 text-red-600 hover:bg-red-50"
                            disabled={zaloPendingLoading}
                            onClick={() => handleZaloPendingAction('reject')}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Từ chối
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Nhắn tin cho bot Zalo — hệ thống tự phát hiện và liên kết Chat ID của bạn
                    </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-xs md:text-sm">Địa chỉ</Label>
                {isEditing ? (
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Nhập địa chỉ"
                    rows={3}
                    className="text-sm"
                  />
                ) : (
                  <div className="flex items-start gap-2 p-2 md:p-3 border rounded-md bg-gray-50">
                    <MapPin className="h-3 w-3 md:h-4 md:w-4 text-gray-500 mt-0.5" />
                    <span className="text-sm">{formData.address || 'Chưa cập nhật'}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-4">
                  <Button size="sm" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Lưu thay đổi
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCancel} className="w-full sm:w-auto">
                    <X className="h-4 w-4 mr-2" />
                    Hủy
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Calendar className="h-4 w-4 md:h-5 md:w-5" />
                Thông tin tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                  <div>
                    <p className="text-xs md:text-sm font-medium">Ngày tạo tài khoản</p>
                    <p className="text-xs md:text-sm text-gray-600">
                      {profile?.ngayTao ? new Date(profile.ngayTao).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                  <div>
                    <p className="text-xs md:text-sm font-medium">Lần đăng nhập cuối</p>
                    <p className="text-xs md:text-sm text-gray-600">
                      {profile?.ngayCapNhat ? new Date(profile.ngayCapNhat).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bảo mật ── */}
        <TabsContent value="security" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Lock className="h-4 w-4 md:h-5 md:w-5" />
                Đổi mật khẩu
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Sử dụng mật khẩu mạnh để bảo vệ tài khoản của bạn
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                {/* Current password */}
                <div className="space-y-2">
                  <Label htmlFor="matKhauHienTai" className="text-sm">Mật khẩu hiện tại</Label>
                  <div className="relative">
                    <Input
                      id="matKhauHienTai"
                      type={showPw.current ? 'text' : 'password'}
                      value={pwForm.matKhauHienTai}
                      onChange={e => setPwForm(p => ({ ...p, matKhauHienTai: e.target.value }))}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="pr-10 text-sm"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}
                    >
                      {showPw.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Separator />

                {/* New password */}
                <div className="space-y-2">
                  <Label htmlFor="matKhauMoi" className="text-sm">Mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      id="matKhauMoi"
                      type={showPw.new ? 'text' : 'password'}
                      value={pwForm.matKhauMoi}
                      onChange={e => setPwForm(p => ({ ...p, matKhauMoi: e.target.value }))}
                      placeholder="Nhập mật khẩu mới"
                      className="pr-10 text-sm"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
                    >
                      {showPw.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {pwForm.matKhauMoi && (() => {
                    const s = getPasswordStrength(pwForm.matKhauMoi);
                    return (
                      <div className="space-y-1.5">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= s.score ? s.color : 'bg-gray-200'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">Độ mạnh: <span className="font-medium">{s.label}</span></p>
                      </div>
                    );
                  })()}

                  {/* Rules checklist */}
                  {pwForm.matKhauMoi && (
                    <ul className="space-y-1">
                      {PASSWORD_RULES.map(rule => {
                        const ok = rule.test(pwForm.matKhauMoi);
                        return (
                          <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                            {ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
                            {rule.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                  <Label htmlFor="xacNhanMatKhau" className="text-sm">Xác nhận mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      id="xacNhanMatKhau"
                      type={showPw.confirm ? 'text' : 'password'}
                      value={pwForm.xacNhanMatKhau}
                      onChange={e => setPwForm(p => ({ ...p, xacNhanMatKhau: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới"
                      className={`pr-10 text-sm ${pwForm.xacNhanMatKhau && pwForm.xacNhanMatKhau !== pwForm.matKhauMoi ? 'border-red-400' : ''}`}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
                    >
                      {showPw.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwForm.xacNhanMatKhau && pwForm.xacNhanMatKhau !== pwForm.matKhauMoi && (
                    <p className="text-xs text-red-500">Mật khẩu xác nhận không khớp</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={pwSaving || !pwForm.matKhauHienTai || !pwForm.matKhauMoi || pwForm.matKhauMoi !== pwForm.xacNhanMatKhau}
                  className="w-full sm:w-auto"
                >
                  {pwSaving ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Đang lưu...</>
                  ) : (
                    <><Key className="h-4 w-4 mr-2" />Cập nhật mật khẩu</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Session info */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Shield className="h-4 w-4 md:h-5 md:w-5" />
                Thông tin bảo mật
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
                  <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Ngày tạo tài khoản</p>
                    <p className="text-xs text-gray-500">{profile?.ngayTao ? new Date(profile.ngayTao).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
                  <Key className="h-4 w-4 text-gray-500 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Đăng nhập cuối</p>
                    <p className="text-xs text-gray-500">{profile?.ngayCapNhat ? new Date(profile.ngayCapNhat).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-100 bg-blue-50 text-xs text-blue-700">
                <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Nên đổi mật khẩu định kỳ và không chia sẻ mật khẩu với người khác để bảo vệ tài khoản của bạn.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Thông báo ── */}
        <TabsContent value="notifications" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                Tùy chọn thông báo
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Chọn loại thông báo bạn muốn nhận trong ứng dụng
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-1">
              {NOTIF_TYPES.map((item, idx) => {
                const Icon = item.icon;
                const enabled = notifPrefs[item.key] ?? true;
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={v => handleNotifToggle(item.key, v)}
                      />
                    </div>
                    {idx < NOTIF_TYPES.length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                Cấu hình thông báo toàn hệ thống
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Cài đặt nâng cao như Zalo, số ngày cảnh báo... được quản lý trong trang Cài đặt
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/cai-dat')}
              >
                <Shield className="h-4 w-4 mr-2" />
                Đi đến trang Cài đặt hệ thống
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
