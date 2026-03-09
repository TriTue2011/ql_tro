'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Type,
  Save,
  Monitor,
  Shield,
  HardDrive,
  Bell,
  Building2,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaiDatItem {
  id: string;
  khoa: string;
  giaTri: string | null;
  moTa: string | null;
  nhom: string;
  laBiMat: boolean;
}

// ─── Nhóm cài đặt ─────────────────────────────────────────────────────────────

const NHOM_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  luuTru: { label: 'Lưu trữ ảnh', icon: <HardDrive className="h-4 w-4" /> },
  thongBao: { label: 'Thông báo', icon: <Bell className="h-4 w-4" /> },
  heThong: { label: 'Hệ thống', icon: <Building2 className="h-4 w-4" /> },
  baoMat: { label: 'Bảo mật', icon: <Lock className="h-4 w-4" /> },
};

// ─── Component: Ô nhập cài đặt ────────────────────────────────────────────────

function SettingInput({
  item,
  value,
  onChange,
}: {
  item: CaiDatItem;
  value: string;
  onChange: (val: string) => void;
}) {
  const [show, setShow] = useState(false);

  if (item.khoa === 'storage_provider') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Chọn nhà cung cấp" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="local">Local (lưu trên server)</SelectItem>
          <SelectItem value="minio">MinIO (tự host)</SelectItem>
          <SelectItem value="cloudinary">Cloudinary (online)</SelectItem>
          <SelectItem value="both">Both (MinIO + Cloudinary)</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (item.khoa === 'cloudflare_tunnel') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="false">Không dùng Cloudflare Tunnel</SelectItem>
          <SelectItem value="true">Bật — dùng Cloudflare Tunnel</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (item.laBiMat) {
    return (
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Nhập ${item.moTa}`}
          className="text-sm pr-10"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Nhập ${item.moTa}`}
      className="text-sm"
    />
  );
}

// ─── Component: Card nhóm cài đặt ─────────────────────────────────────────────

function SettingGroupCard({
  nhom,
  items,
  values,
  onChange,
  onSave,
  saving,
}: {
  nhom: string;
  items: CaiDatItem[];
  values: Record<string, string>;
  onChange: (khoa: string, val: string) => void;
  onSave: (nhom: string) => void;
  saving: boolean;
}) {
  const meta = NHOM_LABELS[nhom] ?? { label: nhom, icon: <Settings className="h-4 w-4" /> };

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          {meta.icon}
          {meta.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {items.map((item) => (
          <div key={item.khoa} className="space-y-1">
            <Label className="text-xs md:text-sm font-medium">
              {item.moTa}
              {item.laBiMat && (
                <Badge variant="outline" className="ml-2 text-xs py-0">
                  <Lock className="h-2.5 w-2.5 mr-1" />
                  bí mật
                </Badge>
              )}
            </Label>
            <SettingInput
              item={item}
              value={values[item.khoa] ?? ''}
              onChange={(val) => onChange(item.khoa, val)}
            />
          </div>
        ))}
        <Button
          size="sm"
          className="w-full mt-2"
          onClick={() => onSave(nhom)}
          disabled={saving}
        >
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Lưu {meta.label}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CaiDatPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  // --- Cài đặt giao diện (cho tất cả users) ---
  const [fontSettings, setFontSettings] = useState({
    fontFamily: 'Inter',
    fontSize: 'medium',
    lineHeight: 'normal',
    fontWeight: 'normal',
  });
  const [uiSettings, setUiSettings] = useState({ theme: 'light', density: 'comfortable' });

  useEffect(() => {
    document.title = 'Cài đặt';
    const savedFont = localStorage.getItem('fontSettings');
    if (savedFont) setFontSettings(JSON.parse(savedFont));
    const savedUi = localStorage.getItem('uiSettings');
    if (savedUi) {
      const ui = JSON.parse(savedUi);
      setUiSettings(ui);
      applyTheme(ui.theme);
      applyDensity(ui.density);
    }
  }, []);

  useEffect(() => { applyFontSettings(); }, [fontSettings]);

  function applyFontSettings() {
    const fontSizeMap: Record<string, string> = { small: '14px', medium: '16px', large: '18px', 'extra-large': '20px' };
    const lineHeightMap: Record<string, string> = { tight: '1.2', normal: '1.5', relaxed: '1.75', loose: '2' };
    document.body.style.fontFamily = fontSettings.fontFamily;
    document.body.style.fontSize = fontSizeMap[fontSettings.fontSize];
    document.body.style.lineHeight = lineHeightMap[fontSettings.lineHeight];
  }

  function applyTheme(theme: string) {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'light') document.documentElement.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }

  function applyDensity(density: string) {
    document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    document.body.classList.add(`density-${density}`);
  }

  function handleSaveFontSettings() {
    localStorage.setItem('fontSettings', JSON.stringify(fontSettings));
    toast.success('Đã lưu cài đặt font chữ');
  }

  function handleThemeChange(theme: string) {
    const newUi = { ...uiSettings, theme };
    setUiSettings(newUi);
    applyTheme(theme);
    localStorage.setItem('uiSettings', JSON.stringify(newUi));
    toast.success('Đã lưu giao diện');
  }

  function handleDensityChange(density: string) {
    const newUi = { ...uiSettings, density };
    setUiSettings(newUi);
    applyDensity(density);
    localStorage.setItem('uiSettings', JSON.stringify(newUi));
    toast.success('Đã lưu mật độ hiển thị');
  }

  // --- Cài đặt hệ thống (chỉ admin) ---
  const [systemSettings, setSystemSettings] = useState<CaiDatItem[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) fetchSystemSettings();
  }, [isAdmin]);

  async function fetchSystemSettings() {
    setLoadingSystem(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        setSystemSettings(data.data);
        const vals: Record<string, string> = {};
        for (const s of data.data) vals[s.khoa] = s.giaTri ?? '';
        setSettingValues(vals);
      } else {
        toast.error('Không thể tải cài đặt hệ thống');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoadingSystem(false);
    }
  }

  function handleSettingChange(khoa: string, val: string) {
    setSettingValues((prev) => ({ ...prev, [khoa]: val }));
  }

  async function handleSaveGroup(nhom: string) {
    setSavingGroup(nhom);
    try {
      const groupItems = systemSettings.filter((s) => s.nhom === nhom);
      const payload = groupItems.map((s) => ({
        khoa: s.khoa,
        giaTri: settingValues[s.khoa] ?? '',
      }));

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        // Reload để cập nhật mask cho bí mật
        await fetchSystemSettings();
      } else {
        toast.error(data.message || 'Lưu thất bại');
      }
    } catch {
      toast.error('Lỗi khi lưu cài đặt');
    } finally {
      setSavingGroup(null);
    }
  }

  // Nhóm các cài đặt
  const settingsByGroup = systemSettings.reduce<Record<string, CaiDatItem[]>>((acc, s) => {
    if (!acc[s.nhom]) acc[s.nhom] = [];
    acc[s.nhom].push(s);
    return acc;
  }, {});

  const groupOrder = ['luuTru', 'thongBao', 'heThong', 'baoMat'];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-xs md:text-sm text-gray-600">
          Tùy chỉnh giao diện{isAdmin ? ' và cài đặt hệ thống' : ''}
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? 'system' : 'display'}>
        <TabsList className="w-full md:w-auto">
          {isAdmin && (
            <TabsTrigger value="system" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Shield className="h-3.5 w-3.5" />
              Hệ thống
            </TabsTrigger>
          )}
          <TabsTrigger value="display" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Monitor className="h-3.5 w-3.5" />
            Giao diện
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Hệ thống (admin only) ─────────────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="system" className="space-y-4 mt-4">
            {loadingSystem ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Đang tải cài đặt hệ thống...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groupOrder.map((nhom) =>
                  settingsByGroup[nhom]?.length ? (
                    <SettingGroupCard
                      key={nhom}
                      nhom={nhom}
                      items={settingsByGroup[nhom]}
                      values={settingValues}
                      onChange={handleSettingChange}
                      onSave={handleSaveGroup}
                      saving={savingGroup === nhom}
                    />
                  ) : null
                )}
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Tab Giao diện (tất cả users) ──────────────────────────────────── */}
        <TabsContent value="display" className="space-y-4 mt-4">
          {/* Font Settings */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Type className="h-4 w-4 md:h-5 md:w-5" />
                Cài đặt Font chữ
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Tùy chỉnh font chữ và kích thước hiển thị
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Font chữ</Label>
                  <Select
                    value={fontSettings.fontFamily}
                    onValueChange={(v) => setFontSettings((p) => ({ ...p, fontFamily: v }))}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito'].map((f) => (
                        <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Cỡ chữ</Label>
                  <Select
                    value={fontSettings.fontSize}
                    onValueChange={(v) => setFontSettings((p) => ({ ...p, fontSize: v }))}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small" className="text-sm">Nhỏ</SelectItem>
                      <SelectItem value="medium" className="text-sm">Trung bình</SelectItem>
                      <SelectItem value="large" className="text-sm">Lớn</SelectItem>
                      <SelectItem value="extra-large" className="text-sm">Rất lớn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Khoảng cách dòng</Label>
                  <Select
                    value={fontSettings.lineHeight}
                    onValueChange={(v) => setFontSettings((p) => ({ ...p, lineHeight: v }))}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tight" className="text-sm">Chặt</SelectItem>
                      <SelectItem value="normal" className="text-sm">Bình thường</SelectItem>
                      <SelectItem value="relaxed" className="text-sm">Thoải mái</SelectItem>
                      <SelectItem value="loose" className="text-sm">Rộng rãi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Độ đậm chữ</Label>
                  <Select
                    value={fontSettings.fontWeight}
                    onValueChange={(v) => setFontSettings((p) => ({ ...p, fontWeight: v }))}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light" className="text-sm">Nhạt</SelectItem>
                      <SelectItem value="normal" className="text-sm">Bình thường</SelectItem>
                      <SelectItem value="medium" className="text-sm">Vừa</SelectItem>
                      <SelectItem value="semibold" className="text-sm">Đậm vừa</SelectItem>
                      <SelectItem value="bold" className="text-sm">Đậm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={handleSaveFontSettings}>
                <Save className="h-4 w-4 mr-2" />
                Lưu font chữ
              </Button>
            </CardContent>
          </Card>

          {/* UI Settings */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Monitor className="h-4 w-4 md:h-5 md:w-5" />
                Giao diện
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Chủ đề</Label>
                  <Select value={uiSettings.theme} onValueChange={handleThemeChange}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light" className="text-sm">Sáng</SelectItem>
                      <SelectItem value="dark" className="text-sm">Tối</SelectItem>
                      <SelectItem value="auto" className="text-sm">Tự động</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Mật độ hiển thị</Label>
                  <Select value={uiSettings.density} onValueChange={handleDensityChange}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact" className="text-sm">Chật</SelectItem>
                      <SelectItem value="comfortable" className="text-sm">Thoải mái</SelectItem>
                      <SelectItem value="spacious" className="text-sm">Rộng rãi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
