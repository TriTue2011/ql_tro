'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PillTabs from '@/components/dashboard/pill-tabs';
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
  ChevronDown,
  ChevronRight,
  Bot,
  Monitor,
  Type,
  TextSelect,
  ArrowUpDown,
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
  hoatDongCuoi?: string | Date | null;
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

  // ── Appearance state ──────────────────────────────────────────
  type SidebarStyle = 'default' | 'compact';
  type FontSize = 'small' | 'medium' | 'large';
  type FontFamily = string;
  type LineHeight = 'tight' | 'normal' | 'relaxed' | 'loose';
  const APPEARANCE_KEY = 'ql-tro-appearance';
  const FONT_SETTINGS_KEY = 'fontSettings';
  const defaultAppearance = {
    sidebarStyle: 'default' as SidebarStyle,
    fontSize: 'medium' as FontSize,
    fontFamily: 'Inter' as FontFamily,
    lineHeight: 'normal' as LineHeight,
  };
  const [appearance, setAppearance] = useState<{
    sidebarStyle: SidebarStyle;
    fontSize: FontSize;
    fontFamily: FontFamily;
    lineHeight: LineHeight;
  }>(defaultAppearance);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(APPEARANCE_KEY);
        if (raw) setAppearance({ ...defaultAppearance, ...JSON.parse(raw) });
      } catch { /* ignore */ }
    }
  }, []);

  const updateAppearance = (patch: { sidebarStyle?: SidebarStyle; fontSize?: FontSize; fontFamily?: FontFamily; lineHeight?: LineHeight }) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
    // Also save to fontSettings for layout.tsx to pick up
    localStorage.setItem(FONT_SETTINGS_KEY, JSON.stringify({
      fontSize: next.fontSize,
      fontFamily: next.fontFamily,
      lineHeight: next.lineHeight,
    }));
    toast.success('Đã lưu cài đặt giao diện');
  };

  // ── Tab state (MUST be before any early return) ───────────────
  const [activeTab, setActiveTab] = useState('profile');

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

  const profileTabs = [
    { value: 'profile', label: 'Thông tin', icon: User },
    { value: 'security', label: 'Bảo mật', icon: Key },
    { value: 'appearance', label: 'Giao diện', icon: Monitor },
  ];
  if (profile?.vaiTro !== 'admin') {
    profileTabs.push({ value: 'notifications', label: 'Thông báo', icon: Bell });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-indigo-900">Hồ sơ cá nhân</h1>
          <p className="text-xs md:text-sm text-indigo-500/70">Quản lý thông tin tài khoản của bạn</p>
        </div>
        {!isEditing && (
          <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={() => setIsEditing(true)}>
            <Edit3 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Chỉnh sửa</span>
          </Button>
        )}
      </div>

      <PillTabs tabs={profileTabs} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'profile' && (
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <User className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <div className="text-base md:text-lg font-semibold text-indigo-900">Thông tin cơ bản</div>
                <div className="text-xs text-indigo-500/70">Cập nhật thông tin cá nhân và ảnh đại diện</div>
              </div>
            </div>
            <div className="space-y-4 md:space-y-6 p-4 md:p-6">
              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
                <Avatar className="h-16 w-16 md:h-20 md:w-20 ring-2 ring-indigo-200">
                  <AvatarImage src={formData.avatar} alt={formData.name} />
                  <AvatarFallback className="text-base md:text-lg bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700">
                    {getInitials(formData.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2 text-center sm:text-left">
                  <h3 className="text-base md:text-lg font-semibold text-indigo-900">{formData.name}</h3>
                  {profile?.vaiTro && getRoleBadge(profile.vaiTro)}
                  {isEditing && (
                    <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                      <Camera className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      Thay đổi ảnh
                    </Button>
                  )}
                </div>
              </div>

              <Separator className="bg-indigo-100" />

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">Họ và tên</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nhập họ và tên"
                      className="text-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 md:p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                      <User className="h-3 w-3 md:h-4 md:w-4 text-indigo-400" />
                      <span className="text-sm text-indigo-800">{formData.name}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">Email</Label>
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                    <Mail className="h-3 w-3 md:h-4 md:w-4 text-indigo-400" />
                    <span className="text-sm text-indigo-800 truncate">{profile?.email}</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-indigo-400">Email không thể thay đổi</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">Số điện thoại</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Nhập số điện thoại"
                      className="text-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 md:p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                      <Phone className="h-3 w-3 md:h-4 md:w-4 text-indigo-400" />
                      <span className="text-sm text-indigo-800">{formData.phone || 'Chưa cập nhật'}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">Vai trò</Label>
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                    <Shield className="h-3 w-3 md:h-4 md:w-4 text-indigo-400" />
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
                  <Button size="sm" onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
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
                  <Button variant="outline" size="sm" onClick={handleCancel} className="w-full sm:w-auto border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                    <X className="h-4 w-4 mr-2" />
                    Hủy
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Account Information */}
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <div className="text-base md:text-lg font-semibold text-indigo-900">Thông tin tài khoản</div>
              </div>
            </div>
            <div className="space-y-3 md:space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4 text-indigo-400" />
                  <div>
                    <p className="text-xs md:text-sm font-semibold text-indigo-900">Ngày tạo tài khoản</p>
                    <p className="text-xs md:text-sm text-indigo-600/80">
                      {profile?.ngayTao ? new Date(profile.ngayTao).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4 text-indigo-400" />
                  <div>
                    <p className="text-xs md:text-sm font-semibold text-indigo-900">Lần đăng nhập cuối</p>
                    <p className="text-xs md:text-sm text-indigo-600/80">
                      {profile?.hoatDongCuoi ? new Date(profile.hoatDongCuoi).toLocaleString('vi-VN') : profile?.ngayCapNhat ? new Date(profile.ngayCapNhat).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bảo mật ── */}
      {activeTab === 'security' && (
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Lock className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <div className="text-base md:text-lg font-semibold text-indigo-900">Đổi mật khẩu</div>
                <div className="text-xs text-indigo-500/70">Sử dụng mật khẩu mạnh để bảo vệ tài khoản của bạn</div>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                {/* Current password */}
                <div className="space-y-2">
                  <Label htmlFor="matKhauHienTai" className="text-xs md:text-sm font-semibold text-indigo-900">Mật khẩu hiện tại</Label>
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

                <Separator className="bg-indigo-100" />

                {/* New password */}
                <div className="space-y-2">
                  <Label htmlFor="matKhauMoi" className="text-xs md:text-sm font-semibold text-indigo-900">Mật khẩu mới</Label>
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
                  <Label htmlFor="xacNhanMatKhau" className="text-xs md:text-sm font-semibold text-indigo-900">Xác nhận mật khẩu mới</Label>
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
                  className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
                >
                  {pwSaving ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Đang lưu...</>
                  ) : (
                    <><Key className="h-4 w-4 mr-2" />Cập nhật mật khẩu</>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Session info */}
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Shield className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <div className="text-base md:text-lg font-semibold text-indigo-900">Thông tin bảo mật</div>
              </div>
            </div>
            <div className="space-y-3 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                  <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-900">Ngày tạo tài khoản</p>
                    <p className="text-xs text-indigo-600/80">{profile?.ngayTao ? new Date(profile.ngayTao).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm">
                  <Key className="h-4 w-4 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-900">Đăng nhập cuối</p>
                    <p className="text-xs text-indigo-600/80">{profile?.hoatDongCuoi ? new Date(profile.hoatDongCuoi).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : profile?.ngayCapNhat ? new Date(profile.ngayCapNhat).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm text-xs text-indigo-700">
                <Shield className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                <span>Nên đổi mật khẩu định kỳ và không chia sẻ mật khẩu với người khác để bảo vệ tài khoản của bạn.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Thông báo (ẩn với admin) ── */}
      {activeTab === 'notifications' && profile?.vaiTro !== 'admin' && (
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Bell className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <div className="text-base md:text-lg font-semibold text-indigo-900">Tùy chọn thông báo</div>
                <div className="text-xs text-indigo-500/70">Chọn loại thông báo bạn muốn nhận trong ứng dụng</div>
              </div>
            </div>
            <div className="p-4 md:p-6 space-y-1">
              {NOTIF_TYPES.map((item, idx) => {
                const Icon = item.icon;
                const enabled = notifPrefs[item.key] ?? true;
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${enabled ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white' : 'bg-indigo-100 text-indigo-400'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-indigo-900">{item.label}</p>
                          <p className="text-xs text-indigo-500/70">{item.desc}</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={v => handleNotifToggle(item.key, v === true)}
                      />
                    </div>
                    {idx < NOTIF_TYPES.length - 1 && <Separator className="bg-indigo-100" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Bell className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <div className="text-base md:text-lg font-semibold text-indigo-900">Cấu hình thông báo toàn hệ thống</div>
                <div className="text-xs text-indigo-500/70">Cài đặt nâng cao như Zalo, số ngày cảnh báo... được quản lý trong trang Cài đặt</div>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/cai-dat')}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                <Shield className="h-4 w-4 mr-2" />
                Đi đến trang Cài đặt hệ thống
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Giao diện ── */}
      {activeTab === 'appearance' && (
        <div className="space-y-4 md:space-y-6">
          {/* Sidebar style */}
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-indigo-900">Kiểu sidebar</h3>
            </div>
            <div className="p-4 space-y-4">
              {([
                { value: 'default' as const, label: 'Mặc định', desc: 'Sidebar đầy đủ với tên menu' },
                { value: 'compact' as const, label: 'Thu gọn', desc: 'Sidebar nhỏ chỉ hiện icon' },
              ]).map((opt) => (
                <div key={opt.value} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">{opt.label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="sidebarStyle"
                      value={opt.value}
                      checked={appearance.sidebarStyle === opt.value}
                      onChange={() => updateAppearance({ sidebarStyle: opt.value })}
                      className="accent-indigo-600"
                    />
                    <span className="text-xs text-indigo-500/70">{opt.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <TextSelect className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-indigo-900">Phông chữ</h3>
            </div>
            <div className="p-4">
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                <Label className="text-xs md:text-sm font-semibold text-indigo-900">Chọn phông chữ</Label>
                <Select
                  value={appearance.fontFamily}
                  onValueChange={(val) => updateAppearance({ fontFamily: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn phông chữ" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'Inter', label: 'Inter (Mặc định)' },
                      { value: 'Arial', label: 'Arial' },
                      { value: 'Times New Roman', label: 'Times New Roman' },
                      { value: 'Roboto', label: 'Roboto' },
                      { value: 'Segoe UI', label: 'Segoe UI' },
                      { value: 'Tahoma', label: 'Tahoma' },
                      { value: 'Verdana', label: 'Verdana' },
                      { value: 'Georgia', label: 'Georgia' },
                      { value: 'Courier New', label: 'Courier New' },
                    ].map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Font size */}
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Type className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-indigo-900">Cỡ chữ</h3>
            </div>
            <div className="p-4 space-y-4">
              {([
                { value: 'small' as const, label: 'Nhỏ', desc: 'Phù hợp màn hình lớn, hiển thị nhiều dữ liệu' },
                { value: 'medium' as const, label: 'Vừa', desc: 'Kích thước mặc định' },
                { value: 'large' as const, label: 'Lớn', desc: 'Dễ đọc hơn trên thiết bị nhỏ' },
              ]).map((opt) => (
                <div key={opt.value} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">{opt.label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="fontSize"
                      value={opt.value}
                      checked={appearance.fontSize === opt.value}
                      onChange={() => updateAppearance({ fontSize: opt.value })}
                      className="accent-indigo-600"
                    />
                    <span className="text-xs text-indigo-500/70">{opt.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Line height */}
          <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
            <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <ArrowUpDown className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-indigo-900">Khoảng cách dòng</h3>
            </div>
            <div className="p-4 space-y-4">
              {([
                { value: 'tight' as const, label: 'Sít', desc: '1.2 — Phù hợp hiển thị nhiều nội dung' },
                { value: 'normal' as const, label: 'Bình thường', desc: '1.5 — Khoảng cách mặc định' },
                { value: 'relaxed' as const, label: 'Rộng', desc: '1.75 — Dễ đọc hơn' },
                { value: 'loose' as const, label: 'Rất rộng', desc: '2.0 — Thoải mái nhất' },
              ]).map((opt) => (
                <div key={opt.value} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                  <Label className="text-xs md:text-sm font-semibold text-indigo-900">{opt.label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="lineHeight"
                      value={opt.value}
                      checked={appearance.lineHeight === opt.value}
                      onChange={() => updateAppearance({ lineHeight: opt.value })}
                      className="accent-indigo-600"
                    />
                    <span className="text-xs text-indigo-500/70">{opt.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
        id: String(c.id || ''),
        ten: typeof c.ten === 'object' ? JSON.stringify(c.ten) : String(c.ten || ''),
        soDienThoai: typeof c.soDienThoai === 'object' ? JSON.stringify(c.soDienThoai) : String(c.soDienThoai || ''),
        threadId: typeof c.threadId === 'object' ? JSON.stringify(c.threadId) : String(c.threadId || ''),
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

  function resolveThreadId(person: any): string | null {
    if (currentBotAccountId && Array.isArray(person.zaloChatIds)) {
      const entry = person.zaloChatIds.find((e: any) => e.ten === currentBotAccountId);
      if (entry?.threadId) return typeof entry.threadId === 'string' ? entry.threadId : JSON.stringify(entry.threadId);
    }
    if (person.zaloChatId) return typeof person.zaloChatId === 'string' ? person.zaloChatId : JSON.stringify(person.zaloChatId);
    return null;
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

        const mapP = (p: any) => ({
          id: String(p.id || ''),
          ten: typeof p.ten === 'object' ? JSON.stringify(p.ten) : String(p.ten || ''),
          soDienThoai: typeof p.soDienThoai === 'object' ? JSON.stringify(p.soDienThoai) : String(p.soDienThoai || ''),
          zaloChatId: resolveThreadId(p)
        });
        const chuNha = unique.filter((p: any) => p.vaiTro === 'chuNha').map(mapP);
        const dongChuTro = unique.filter((p: any) => p.vaiTro === 'dongChuTro').map(mapP);
        const quanLy = unique.filter((p: any) => p.vaiTro === 'quanLy').map(mapP);
        const nhanVien = unique.filter((p: any) => p.vaiTro === 'nhanVien').map(mapP);

        let khachThue: ContactEntry[] = [];
        try {
          const botParam = currentBotAccountId ? `&botAccountId=${encodeURIComponent(currentBotAccountId)}` : '';
          const ktRes = await fetch(`/api/admin/zalo/khach-thue?toaNhaId=${b.id}${botParam}`);
          const ktData = await ktRes.json();
          if (ktData.ok) {
            khachThue = (ktData.khachThues || []).map((kt: any) => ({
              id: String(kt.id || ''),
              ten: typeof kt.hoTen === 'object' ? JSON.stringify(kt.hoTen) : String(kt.hoTen || ''),
              soDienThoai: typeof kt.soDienThoai === 'object' ? JSON.stringify(kt.soDienThoai) : String(kt.soDienThoai || ''),
              zaloChatId: typeof kt.zaloChatId === 'object' && kt.zaloChatId ? JSON.stringify(kt.zaloChatId) : (kt.zaloChatId ? String(kt.zaloChatId) : ''),
              phong: typeof kt.phong?.maPhong === 'object' ? JSON.stringify(kt.phong?.maPhong) : (kt.phong?.maPhong ? String(kt.phong?.maPhong) : undefined),
              tang: kt.phong?.tang,
            }));
          }
        } catch { /* ignore */ }

        result.push({
          id: b.id,
          tenToaNha: b.tenToaNha,
          chuNha,
          dongChuTro,
          quanLy,
          nhanVien,
          khachThue,
          zaloNhomChat: Array.isArray(b.zaloNhomChat)
            ? b.zaloNhomChat
            : (typeof b.zaloNhomChat === 'string' ? JSON.parse(b.zaloNhomChat || '[]') : [])
        });
      }
      setBuildings(result);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, currentBotAccountId]);

  useEffect(() => { if (!loaded) { load(); loadExternal(); } }, [loaded, load, loadExternal]);

  const handleUpdateChatId = async (id: string, type: 'nguoiDung' | 'khachThue' | 'nhomZalo', val: string) => {
    try {
      if (type === 'nhomZalo') {
        const payload = JSON.parse(val);
        const { index, newThreadId, groups } = payload;
        const newGroups = JSON.parse(JSON.stringify(groups));
        const botId = currentBotAccountId || 'default';
        if (!newGroups[index].threadIds) newGroups[index].threadIds = {};
        newGroups[index].threadIds[botId] = newThreadId;

        const res = await fetch(`/api/toa-nha/${id}/zalo-nhom-chat`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zaloNhomChat: newGroups }),
        });
        const data = await res.json();
        if (data.success) { toast.success('Đã cập nhật Thread ID nhóm'); load(); }
        else toast.error(data.message || 'Lỗi cập nhật');
        return;
      }

      const res = await fetch('/api/admin/zalo/khach-thue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, zaloChatId: val }),
      });
      const data = await res.json();
      if (data.ok) { toast.success('Đã cập nhật Thread ID'); load(); }
      else toast.error(data.error || 'Lỗi cập nhật');
    } catch { toast.error('Lỗi kết nối'); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs md:text-sm flex items-center gap-1.5 text-indigo-900">
          <Building2 className="h-3.5 w-3.5 text-indigo-500" />
          Danh bạ Zalo theo tòa nhà
        </Label>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 hover:bg-indigo-50" onClick={load} disabled={loading}>
          {loading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-400" /> : '↻ Tải lại'}
        </Button>
      </div>

      {loading && !loaded && (
        <div className="text-xs text-indigo-500/70 text-center py-3">Đang tải...</div>
      )}
      {loaded && buildings.length === 0 && (
        <div className="text-xs text-indigo-400 text-center py-2 border-2 border-dashed border-indigo-200 rounded-xl bg-white/40">
          Chưa có tòa nhà
        </div>
      )}

      <div className="space-y-1.5">
        {buildings.map(b => (
          <DirBuilding key={b.id} building={b} currentBotAccountId={currentBotAccountId} onUpdate={handleUpdateChatId} />
        ))}
      </div>

      {/* Danh bạ ngoài — thêm thủ công */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs md:text-sm flex items-center gap-1.5 text-indigo-900">
            <Plus className="h-3.5 w-3.5 text-green-500" />
            Liên hệ khác
          </Label>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={() => setShowAddForm(v => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Thêm
          </Button>
        </div>

        {showAddForm && (
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <Input value={newContact.ten} onChange={e => setNewContact(p => ({ ...p, ten: e.target.value }))}
                placeholder="Tên *" className="h-8 text-xs border-indigo-100" />
              <Input value={newContact.soDienThoai} onChange={e => setNewContact(p => ({ ...p, soDienThoai: e.target.value }))}
                placeholder="Số điện thoại" className="h-8 text-xs border-indigo-100" />
              <Input value={newContact.threadId} onChange={e => setNewContact(p => ({ ...p, threadId: e.target.value }))}
                placeholder="Thread ID" className="h-8 text-xs font-mono border-indigo-100" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 hover:bg-indigo-50"
                onClick={() => { setShowAddForm(false); setNewContact({ ten: '', soDienThoai: '', threadId: '' }); }}>
                Hủy
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={handleAddExternal} disabled={addingSaving}>
                {addingSaving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </div>
        )}

        {externalContacts.length > 0 && (
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-indigo-50 text-indigo-600">
                  <th className="text-left px-2 py-1.5 font-medium">Tên</th>
                  <th className="text-left px-2 py-1.5 font-medium">SĐT</th>
                  <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
                  <th className="w-7" />
                </tr></thead>
                <tbody className="divide-y divide-indigo-100">
                  {externalContacts.map(c => (
                    <tr key={c.id} className="hover:bg-indigo-50/50">
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
          <div className="text-xs text-indigo-400 text-center py-2 border-2 border-dashed border-indigo-200 rounded-xl bg-white/40">
            Chưa có liên hệ ngoài — nhấn "Thêm" để thêm mới
          </div>
        )}
      </div>
    </div>
  );
}

function DirBuilding({ building, currentBotAccountId, onUpdate }: { building: any; currentBotAccountId?: string | null; onUpdate: (id: string, type: 'nguoiDung' | 'khachThue' | 'nhomZalo', v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/80 hover:bg-indigo-50/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-semibold text-indigo-900 truncate">{building.tenToaNha}</span>
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-indigo-400" /> : <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
      </button>
      {open && (
        <div className="border-t border-indigo-100 bg-indigo-50/30 p-2 space-y-1.5">
          {building.chuNha?.length > 0 && (
            <DirRoleGroup label="Chủ nhà" people={building.chuNha}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.dongChuTro?.length > 0 && (
            <DirRoleGroup label="Đồng chủ trọ" people={building.dongChuTro}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.quanLy?.length > 0 && (
            <DirRoleGroup label="Quản lý" people={building.quanLy}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.nhanVien?.length > 0 && (
            <DirRoleGroup label="Nhân viên" people={building.nhanVien}
              onUpdate={(id, v) => onUpdate(id, 'nguoiDung', v)} />
          )}
          {building.khachThue?.length > 0 && (
            <DirTenantGroup tenants={building.khachThue} onUpdate={(id, v) => onUpdate(id, 'khachThue', v)} />
          )}
          {building.zaloNhomChat?.length > 0 && (
            <DirGroupGroup
              groups={building.zaloNhomChat}
              currentBotAccountId={currentBotAccountId}
              onUpdate={(index, val) => onUpdate(building.id, 'nhomZalo', JSON.stringify({ index, newThreadId: val, groups: building.zaloNhomChat }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DirRoleGroup({ label, people, onUpdate }: {
  label: string; people: ContactEntry[];
  onUpdate: (id: string, v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-indigo-50/50 transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-indigo-900">{label}</span>
          <span className="text-[10px] text-indigo-400">({people.length})</span>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-indigo-400" /> : <ChevronRight className="h-3 w-3 text-indigo-400" />}
      </button>
      {open && (
        <div className="border-t border-indigo-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-indigo-50 text-indigo-600">
              <th className="text-left px-2 py-1.5 font-medium">Tên</th>
              <th className="text-left px-2 py-1.5 font-medium">SĐT</th>
              <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
            </tr></thead>
            <tbody className="divide-y divide-indigo-100">
              {people.map(p => (
                <tr key={p.id} className="hover:bg-indigo-50/50">
                  <td className="px-2 py-1.5 font-medium text-indigo-900">{p.ten}</td>
                  <td className="px-2 py-1.5 text-indigo-500/70">{p.soDienThoai || '—'}</td>
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
    <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-indigo-50/50 transition-colors">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-green-500" />
          <span className="text-xs font-medium text-indigo-900">Khách thuê</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-indigo-200 text-indigo-600 bg-indigo-50">{tenants.length}</Badge>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-indigo-400" /> : <ChevronRight className="h-3 w-3 text-indigo-400" />}
      </button>
      {open && (
        <div className="border-t border-indigo-100 p-1.5 space-y-1">
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
    <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-indigo-50/50 transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-indigo-600">Tầng {tang}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-indigo-200 text-indigo-600 bg-indigo-50">{tenants.length}</Badge>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-indigo-400" /> : <ChevronRight className="h-3 w-3 text-indigo-400" />}
      </button>
      {open && (
        <div className="border-t border-indigo-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-indigo-50 text-indigo-600">
              <th className="text-left px-2 py-1.5 font-medium">Phòng</th>
              <th className="text-left px-2 py-1.5 font-medium">Tên</th>
              <th className="text-left px-2 py-1.5 font-medium">SĐT</th>
              <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
            </tr></thead>
            <tbody className="divide-y divide-indigo-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-indigo-50/50">
                  <td className="px-2 py-1.5 font-medium text-indigo-900">{t.phong || '—'}</td>
                  <td className="px-2 py-1.5 text-indigo-700">{t.ten}</td>
                  <td className="px-2 py-1.5 text-indigo-500/70">{t.soDienThoai || '—'}</td>
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

function DirGroupGroup({ groups, currentBotAccountId, onUpdate }: { groups: any[], currentBotAccountId?: string | null, onUpdate?: (index: number, val: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-indigo-50/50 transition-colors">
        <div className="flex items-center gap-1.5 text-indigo-600">
          <Bot className="h-3 w-3" />
          <span className="text-xs font-medium text-indigo-900">Nhóm Zalo tòa nhà</span>
          <span className="text-[10px] text-indigo-400">({groups.length})</span>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-indigo-400" /> : <ChevronRight className="h-3 w-3 text-indigo-400" />}
      </button>
      {open && (
        <div className="border-t border-indigo-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-indigo-50 text-indigo-600">
              <th className="text-left px-2 py-1.5 font-medium">Tên nhóm</th>
              <th className="text-left px-2 py-1.5 font-medium">Tầng</th>
              <th className="text-left px-2 py-1.5 font-medium">Nhãn</th>
              <th className="text-left px-2 py-1.5 font-medium">Thread ID</th>
            </tr></thead>
            <tbody className="divide-y divide-indigo-100">
              {(Array.isArray(groups) ? groups : []).map((g, idx) => {
                let threadId = currentBotAccountId && g?.threadIds && g.threadIds[currentBotAccountId] ? g.threadIds[currentBotAccountId] : g?.threadId;
                if (threadId && typeof threadId !== 'string') threadId = JSON.stringify(threadId);
                return (
                  <tr key={idx} className="hover:bg-indigo-50/50">
                    <td className="px-2 py-1.5 font-medium text-indigo-900">{typeof g?.name === 'object' && g?.name ? JSON.stringify(g.name) : String(g?.name || '—')}</td>
                    <td className="px-2 py-1.5 text-indigo-500/70">{g?.tang != null ? `Tầng ${g.tang}` : '—'}</td>
                    <td className="px-2 py-1.5 text-indigo-500/70">{typeof g?.label === 'object' && g?.label ? JSON.stringify(g.label) : String(g?.label || '—')}</td>
                    <td className="px-2 py-1.5">
                      {onUpdate ? (
                        <DirEditableCell value={threadId || ''} placeholder="Chưa có" onSave={v => onUpdate(idx, v)} />
                      ) : (
                        <span className="font-mono text-indigo-400">{threadId || '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
        className="h-6 text-xs px-1 font-mono border-indigo-200" placeholder={placeholder} />
    );
  }
  return (
    <span onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-indigo-50 rounded px-1 py-0.5 text-xs font-mono text-indigo-700 ${!value ? 'text-indigo-300 italic' : ''}`}
      title="Nhấn để sửa">
      {value || placeholder || '—'}
    </span>
  );
}
