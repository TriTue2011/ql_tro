'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Mail,
  Phone,
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
  Plus,
  Trash2,
  Building2,
  Crown,
  Users,
  ChevronDown,
  ChevronRight,
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
  zaloChatIds?: { ten: string; userId: string; threadId: string }[] | null;
  zaloAccountId?: string | null;
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
    avatar: '',
    zaloChatId: '',
  });

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
      avatar: profile?.anhDaiDien || '',
      zaloChatId: profile?.zaloChatId || '',
    });
    setIsEditing(false);
  };

  // Load notif prefs when profile loads (admin không cần)
  useEffect(() => {
    if (profile?.id && profile?.vaiTro !== 'admin') {
      setNotifPrefs(loadNotifPrefs(profile.id));
    }
  }, [profile?.id, profile?.vaiTro]);

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
        <TabsList className={`grid w-full ${profile?.vaiTro === 'admin' ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
          {profile?.vaiTro !== 'admin' && (
            <TabsTrigger value="notifications" className="text-xs md:text-sm">
              <Bell className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Thông báo</span>
              <span className="sm:hidden">TB</span>
            </TabsTrigger>
          )}
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

                {/* Danh bạ Zalo — chỉ hiện cho chuNha, dongChuTro, quanLy */}
                {profile?.vaiTro && ['chuNha', 'dongChuTro', 'quanLy'].includes(profile.vaiTro) && (
                <div className="md:col-span-2">
                  <ZaloContactDirectory currentUserId={profile?.id} currentBotAccountId={profile?.zaloAccountId} />
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
                      {profile?.hoatDongCuoi ? new Date(profile.hoatDongCuoi).toLocaleString('vi-VN') : profile?.ngayCapNhat ? new Date(profile.ngayCapNhat).toLocaleDateString('vi-VN') : 'N/A'}
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
                    <p className="text-xs text-gray-500">{profile?.hoatDongCuoi ? new Date(profile.hoatDongCuoi).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : profile?.ngayCapNhat ? new Date(profile.ngayCapNhat).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
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

        {/* ── Thông báo (ẩn với admin) ── */}
        {profile?.vaiTro !== 'admin' && <TabsContent value="notifications" className="space-y-4 md:space-y-6">
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
        </TabsContent>}
      </Tabs>
    </div>
  );
}

// ─── Danh bạ Zalo: Tòa nhà → Role → Bảng liên hệ ───────────────────────────

interface ContactEntry {
  id: string;
  ten: string;
  soDienThoai: string | null;
  zaloChatId: string | null;
  phong?: string;
  tang?: number;
}

function ZaloContactDirectory({ currentUserId, currentBotAccountId }: {
  currentUserId?: string;
  currentBotAccountId?: string | null;
}) {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // ── Danh bạ ngoài ──
  const [externalContacts, setExternalContacts] = useState<{ id: string; ten: string; soDienThoai: string; threadId: string }[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ ten: '', soDienThoai: '', threadId: '' });
  const [addingSaving, setAddingSaving] = useState(false);

  const loadExternal = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/zalo/danh-ba-ngoai');
      const data = await res.json();
      if (data.ok) setExternalContacts(data.contacts.map((c: any) => ({
        id: c.id, ten: c.ten, soDienThoai: c.soDienThoai || '', threadId: c.threadId || '',
      })));
    } catch { /* ignore */ }
  }, []);

  const handleAddExternal = async () => {
    if (!newContact.ten.trim()) { toast.error('Vui lòng nhập tên'); return; }
    setAddingSaving(true);
    try {
      const res = await fetch('/api/admin/zalo/danh-ba-ngoai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Đã thêm liên hệ');
        setNewContact({ ten: '', soDienThoai: '', threadId: '' });
        setShowAddForm(false);
        loadExternal();
      } else toast.error(data.error || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
    finally { setAddingSaving(false); }
  };

  const handleUpdateExternal = async (id: string, field: string, value: string) => {
    try {
      const res = await fetch('/api/admin/zalo/danh-ba-ngoai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      });
      const data = await res.json();
      if (data.ok) { toast.success('Đã cập nhật'); loadExternal(); }
      else toast.error(data.error || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
  };

  const handleDeleteExternal = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/zalo/danh-ba-ngoai?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) { toast.success('Đã xóa'); loadExternal(); }
      else toast.error(data.error || 'Lỗi');
    } catch { toast.error('Lỗi kết nối'); }
  };

  // Resolve threadId: tìm trong zaloChatIds entry khớp với bot account của user đang đăng nhập
  function resolveThreadId(person: any): string | null {
    if (currentBotAccountId && Array.isArray(person.zaloChatIds)) {
      const entry = person.zaloChatIds.find((e: any) => e.ten === currentBotAccountId);
      if (entry?.threadId) return entry.threadId;
    }
    return person.zaloChatId || null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/zalo');
      const data = await res.json();
      if (!data.ok) return;

      const result: any[] = [];
      for (const b of data.buildings || []) {
        const allPeople = [b.chuTro, ...(b.quanLys || [])];
        const seen = new Set<string>();
        const unique = allPeople.filter((p: any) => {
          if (!p || seen.has(p.id)) return false;
          seen.add(p.id);
          // Bỏ admin và bỏ tài khoản đang đăng nhập
          return p.vaiTro !== 'admin' && p.id !== currentUserId;
        });

        const chuNha = unique.filter((p: any) => p.vaiTro === 'chuNha')
          .map((p: any) => ({ id: p.id, ten: p.ten, soDienThoai: p.soDienThoai, zaloChatId: resolveThreadId(p) }));
        const dongChuTro = unique.filter((p: any) => p.vaiTro === 'dongChuTro')
          .map((p: any) => ({ id: p.id, ten: p.ten, soDienThoai: p.soDienThoai, zaloChatId: resolveThreadId(p) }));
        const quanLy = unique.filter((p: any) => p.vaiTro === 'quanLy')
          .map((p: any) => ({ id: p.id, ten: p.ten, soDienThoai: p.soDienThoai, zaloChatId: resolveThreadId(p) }));
        const nhanVien = unique.filter((p: any) => p.vaiTro === 'nhanVien')
          .map((p: any) => ({ id: p.id, ten: p.ten, soDienThoai: p.soDienThoai, zaloChatId: resolveThreadId(p) }));

        let khachThue: ContactEntry[] = [];
        try {
          const botParam = currentBotAccountId ? `&botAccountId=${encodeURIComponent(currentBotAccountId)}` : '';
          const ktRes = await fetch(`/api/admin/zalo/khach-thue?toaNhaId=${b.id}${botParam}`);
          const ktData = await ktRes.json();
          if (ktData.ok) {
            khachThue = (ktData.khachThues || []).map((kt: any) => ({
              id: kt.id, ten: kt.hoTen, soDienThoai: kt.soDienThoai, zaloChatId: kt.zaloChatId,
              phong: kt.phong?.maPhong, tang: kt.phong?.tang,
            }));
          }
        } catch { /* ignore */ }

        result.push({ id: b.id, tenToaNha: b.tenToaNha, chuNha, dongChuTro, quanLy, nhanVien, khachThue });
      }
      setBuildings(result);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, currentBotAccountId]);

  useEffect(() => { if (!loaded) { load(); loadExternal(); } }, [loaded, load, loadExternal]);

  const handleUpdateChatId = async (id: string, type: 'nguoiDung' | 'khachThue', zaloChatId: string) => {
    try {
      const res = await fetch('/api/admin/zalo/khach-thue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, zaloChatId }),
      });
      const data = await res.json();
      if (data.ok) { toast.success('Đã cập nhật Thread ID'); load(); }
      else toast.error(data.error || 'Lỗi cập nhật');
    } catch { toast.error('Lỗi kết nối'); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs md:text-sm flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-blue-500" />
          Danh bạ Zalo theo tòa nhà
        </Label>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={load} disabled={loading}>
          {loading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" /> : '↻ Tải lại'}
        </Button>
      </div>

      {loading && !loaded && (
        <div className="text-xs text-muted-foreground text-center py-3">Đang tải...</div>
      )}
      {loaded && buildings.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-md">
          Chưa có tòa nhà
        </div>
      )}

      <div className="space-y-1.5">
        {buildings.map(b => (
          <DirBuilding key={b.id} building={b} onUpdate={handleUpdateChatId} />
        ))}
      </div>

      {/* Danh bạ ngoài — thêm thủ công */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-green-500" />
            Liên hệ khác
          </Label>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={() => setShowAddForm(v => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Thêm
          </Button>
        </div>

        {showAddForm && (
          <div className="border rounded-md p-2 bg-gray-50 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <Input value={newContact.ten} onChange={e => setNewContact(p => ({ ...p, ten: e.target.value }))}
                placeholder="Tên *" className="h-8 text-xs" />
              <Input value={newContact.soDienThoai} onChange={e => setNewContact(p => ({ ...p, soDienThoai: e.target.value }))}
                placeholder="Số điện thoại" className="h-8 text-xs" />
              <Input value={newContact.threadId} onChange={e => setNewContact(p => ({ ...p, threadId: e.target.value }))}
                placeholder="Thread ID" className="h-8 text-xs font-mono" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => { setShowAddForm(false); setNewContact({ ten: '', soDienThoai: '', threadId: '' }); }}>
                Hủy
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" onClick={handleAddExternal} disabled={addingSaving}>
                {addingSaving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </div>
        )}

        {externalContacts.length > 0 && (
          <div className="border rounded-md overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-100 text-gray-600">
                  <th className="text-left px-2 py-1.5 font-medium">Tên</th>
                  <th className="text-left px-2 py-1.5 font-medium">SĐT</th>
                  <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
                  <th className="w-7" />
                </tr></thead>
                <tbody className="divide-y">
                  {externalContacts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <DirEditableCell value={c.ten} placeholder="Tên" onSave={v => handleUpdateExternal(c.id, 'ten', v)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <DirEditableCell value={c.soDienThoai} placeholder="SĐT" onSave={v => handleUpdateExternal(c.id, 'soDienThoai', v)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <DirEditableCell value={c.threadId} placeholder="Chưa có" onSave={v => handleUpdateExternal(c.id, 'threadId', v)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button type="button" size="icon" variant="ghost"
                          className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteExternal(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {externalContacts.length === 0 && !showAddForm && (
          <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-md">
            Chưa có liên hệ ngoài — nhấn "Thêm" để thêm mới
          </div>
        )}
      </div>
    </div>
  );
}

function DirBuilding({ building, onUpdate }: { building: any; onUpdate: (id: string, type: 'nguoiDung' | 'khachThue', v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-semibold text-gray-800 truncate">{building.tenToaNha}</span>
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t bg-gray-50 p-2 space-y-1.5">
          {building.chuNha?.length > 0 && (
            <DirRoleGroup label="Chủ nhà" icon={<Crown className="h-3 w-3 text-amber-500" />}
              badgeClass="bg-amber-100 text-amber-700" people={building.chuNha}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.dongChuTro?.length > 0 && (
            <DirRoleGroup label="Đồng chủ trọ" icon={<Crown className="h-3 w-3 text-orange-400" />}
              badgeClass="bg-orange-100 text-orange-700" people={building.dongChuTro}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.quanLy?.length > 0 && (
            <DirRoleGroup label="Quản lý" icon={<Users className="h-3 w-3 text-blue-400" />}
              badgeClass="bg-blue-100 text-blue-700" people={building.quanLy}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.nhanVien?.length > 0 && (
            <DirRoleGroup label="Nhân viên" icon={<Users className="h-3 w-3 text-purple-400" />}
              badgeClass="bg-purple-100 text-purple-700" people={building.nhanVien}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.khachThue?.length > 0 && (
            <DirTenantGroup tenants={building.khachThue} onUpdate={(id, v) => onUpdate(id, 'khachThue', v)} />
          )}
        </div>
      )}
    </div>
  );
}

function DirRoleGroup({ label, icon, badgeClass, people, onUpdate }: {
  label: string; icon: any; badgeClass: string; people: ContactEntry[];
  onUpdate: (id: string, v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md overflow-hidden bg-white">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium">{label}</span>
          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${badgeClass}`}>{people.length}</Badge>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-100 text-gray-600">
              <th className="text-left px-2 py-1.5 font-medium">Tên</th>
              <th className="text-left px-2 py-1.5 font-medium">SĐT</th>
              <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
            </tr></thead>
            <tbody className="divide-y">
              {people.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-medium text-gray-800">{p.ten}</td>
                  <td className="px-2 py-1.5 text-gray-600">{p.soDienThoai || '—'}</td>
                  <td className="px-2 py-1.5">
                    <DirEditableCell value={p.zaloChatId || ''} placeholder="Chưa có" onSave={v => onUpdate(p.id, v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DirTenantGroup({ tenants, onUpdate }: { tenants: ContactEntry[]; onUpdate: (id: string, v: string) => void }) {
  const [open, setOpen] = useState(false);
  const floors = tenants.reduce<Record<number, ContactEntry[]>>((acc, t) => {
    const f = t.tang ?? 0;
    (acc[f] ||= []).push(t);
    return acc;
  }, {});
  const sortedFloors = Object.keys(floors).map(Number).sort((a, b) => a - b);

  return (
    <div className="border rounded-md overflow-hidden bg-white">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-green-500" />
          <span className="text-xs font-medium">Khách thuê</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-green-100 text-green-700">{tenants.length}</Badge>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t p-1.5 space-y-1">
          {sortedFloors.map(f => (
            <DirFloorGroup key={f} tang={f} tenants={floors[f]} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

function DirFloorGroup({ tang, tenants, onUpdate }: { tang: number; tenants: ContactEntry[]; onUpdate: (id: string, v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-600">Tầng {tang}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-gray-50">{tenants.length}</Badge>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-100 text-gray-600">
              <th className="text-left px-2 py-1.5 font-medium">Phòng</th>
              <th className="text-left px-2 py-1.5 font-medium">Tên</th>
              <th className="text-left px-2 py-1.5 font-medium">SĐT</th>
              <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
            </tr></thead>
            <tbody className="divide-y">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-medium text-gray-800">{t.phong || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{t.ten}</td>
                  <td className="px-2 py-1.5 text-gray-600">{t.soDienThoai || '—'}</td>
                  <td className="px-2 py-1.5">
                    <DirEditableCell value={t.zaloChatId || ''} placeholder="Chưa có" onSave={v => onUpdate(t.id, v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DirEditableCell({ value, placeholder, onSave }: { value: string; placeholder?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };

  if (editing) {
    return (
      <Input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className="h-6 text-xs px-1 font-mono" placeholder={placeholder} />
    );
  }
  return (
    <span onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 text-xs font-mono ${!value ? 'text-gray-300 italic' : ''}`}
      title="Nhấn để sửa">
      {value || placeholder || '—'}
    </span>
  );
}
