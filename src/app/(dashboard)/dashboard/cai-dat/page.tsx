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
import { Switch } from '@/components/ui/switch';
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
  Webhook,
  CheckCircle,
  XCircle,
  Copy,
  Trash2,
  CreditCard,
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  Image,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
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
  thanhToan: { label: 'Thanh toán', icon: <CreditCard className="h-4 w-4" /> },
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

  if (item.khoa === 'ngan_hang_ten') {
    const banks = [
      'Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'MBBank', 'Techcombank',
      'ACB', 'VPBank', 'TPBank', 'Sacombank', 'HDBank', 'VIB', 'MSB', 'OCB',
      'SHB', 'SeABank', 'LienVietPostBank', 'Eximbank', 'NamABank', 'ABBank',
      'VietABank', 'BacABank', 'VietBank', 'KienLongBank', 'SCB', 'PGBank',
      'BaoVietBank', 'VietCapitalBank', 'GPBank', 'NCB', 'CBBank', 'COOPBANK',
      'SaigonBank', 'DongABank', 'Oceanbank', 'VRB', 'Indovinabank', 'PublicBank',
      'CIMB', 'ShinhanBank', 'HSBC', 'DBSBank', 'StandardChartered',
      'Nonghyup', 'HongLeong', 'Woori', 'UnitedOverseas', 'KookminHN', 'KookminHCM',
    ];
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Chọn ngân hàng" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {banks.map(b => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

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
    const isOn = value === 'true';
    return (
      <div className="flex items-center gap-3 py-1">
        <Switch
          checked={isOn}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          id="cloudflare_tunnel_switch"
        />
        <label
          htmlFor="cloudflare_tunnel_switch"
          className={`text-sm cursor-pointer select-none ${isOn ? 'text-green-700 font-medium' : 'text-gray-500'}`}
        >
          {isOn ? 'Đang bật — ứng dụng chạy qua Cloudflare Tunnel' : 'Đang tắt — không dùng Cloudflare Tunnel'}
        </label>
      </div>
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
  // Chủ trọ và admin đều có thể xem/thay đổi cài đặt hệ thống (Zalo, thông báo, ...)
  const canManage = isAdmin || session?.user?.role === 'chuNha';

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
  const [errorSystem, setErrorSystem] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  useEffect(() => {
    if (canManage) fetchSystemSettings();
  }, [isAdmin]);

  async function fetchSystemSettings() {
    setLoadingSystem(true);
    setErrorSystem(null);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        setSystemSettings(data.data);
        const vals: Record<string, string> = {};
        for (const s of data.data) vals[s.khoa] = s.giaTri ?? '';
        setSettingValues(vals);
      } else if (res.status === 403) {
        setErrorSystem('Không có quyền truy cập (403). Vui lòng đăng xuất và đăng nhập lại.');
        toast.error('Không có quyền truy cập cài đặt hệ thống');
      } else {
        setErrorSystem(`Lỗi máy chủ (HTTP ${res.status}): ${data.message ?? 'Không xác định'}. Kiểm tra log PM2.`);
        toast.error(`Lỗi tải cài đặt (${res.status})`);
      }
    } catch {
      setErrorSystem('Không thể kết nối cơ sở dữ liệu. Kiểm tra PostgreSQL đang chạy.');
      toast.error('Lỗi kết nối cơ sở dữ liệu');
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

  // --- Polling worker ---
  const [pollingStatus, setPollingStatus] = useState<{
    running: boolean;
    startedAt: string | null;
    messagesProcessed: number;
    lastMessageAt: string | null;
    lastError: string | null;
    webhookWillRestore: boolean;
  } | null>(null);
  const [pollingLoading, setPollingLoading] = useState(false);

  async function fetchPollingStatus() {
    try {
      const res = await fetch('/api/zalo/polling');
      if (res.ok) setPollingStatus(await res.json());
    } catch { /* bỏ qua */ }
  }

  useEffect(() => {
    fetchPollingStatus();
    const interval = setInterval(() => {
      setPollingStatus(prev => {
        if (prev?.running) fetchPollingStatus();
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartPolling() {
    setPollingLoading(true);
    try {
      const res = await fetch('/api/zalo/polling', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message);
        await fetchPollingStatus();
      } else {
        toast.error(data.message || 'Không thể khởi động');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setPollingLoading(false);
    }
  }

  async function handleStopPolling(_unused?: boolean) {
    setPollingLoading(true);
    try {
      const res = await fetch('/api/zalo/polling', { method: 'DELETE' });
      const data = await res.json();
      toast.success(data.message);
      await fetchPollingStatus();
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setPollingLoading(false);
    }
  }

  // --- Gửi test Zalo ---
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('Tin nhắn test từ hệ thống Quản Lý Trọ 🏠');
  const [testType, setTestType] = useState<'text' | 'image' | 'file'>('text');
  const [testImageUrl, setTestImageUrl] = useState('');
  const [testFileUrl, setTestFileUrl] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSendTest() {
    if (!testChatId.trim()) { toast.error('Vui lòng nhập Chat ID'); return; }
    if (testType === 'image' && !testImageUrl.trim()) { toast.error('Vui lòng nhập URL hình ảnh'); return; }
    if (testType === 'file' && !testFileUrl.trim()) { toast.error('Vui lòng nhập URL file'); return; }
    setTestLoading(true);
    setTestResult(null);
    try {
      const payload: Record<string, string> = { chatId: testChatId.trim() };
      if (testType === 'image') {
        payload.imageUrl = testImageUrl.trim();
        if (testMessage) payload.message = testMessage;
      } else if (testType === 'file') {
        payload.fileUrl = testFileUrl.trim();
        if (testMessage) payload.message = testMessage;
      } else {
        payload.message = testMessage || 'Test message';
      }
      const res = await fetch('/api/gui-zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setTestResult({ ok: true, message: data.message || 'Gửi thành công!' });
        toast.success('Đã gửi thành công');
      } else {
        const errMsg = data.error || data.message || `HTTP ${res.status}`;
        setTestResult({ ok: false, message: errMsg });
        toast.error(`Gửi thất bại: ${errMsg}`);
      }
    } catch {
      setTestResult({ ok: false, message: 'Lỗi kết nối máy chủ' });
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setTestLoading(false);
    }
  }

  // --- Theo dõi tin nhắn: expand raw payload ---
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  async function handleClearMessages() {
    if (!confirm('Xóa tất cả tin nhắn đã nhận?')) return;
    try {
      await fetch('/api/zalo/messages', { method: 'DELETE' });
      setWebhookMessages([]);
      toast.success('Đã xóa tất cả tin nhắn');
    } catch { toast.error('Lỗi xóa tin nhắn'); }
  }

  // --- Kiểm tra kết nối MinIO ---
  const [minioTestLoading, setMinioTestLoading] = useState(false);
  const [minioTestResult, setMinioTestResult] = useState<{ ok: boolean; message: string; details?: Record<string, unknown> } | null>(null);

  async function handleTestMinio() {
    setMinioTestLoading(true);
    setMinioTestResult(null);
    try {
      const res = await fetch('/api/admin/settings/test-minio', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMinioTestResult({ ok: true, message: data.message, details: data.details });
        toast.success('Kết nối MinIO thành công');
      } else {
        setMinioTestResult({ ok: false, message: data.message });
        toast.error(data.message);
      }
    } catch {
      setMinioTestResult({ ok: false, message: 'Lỗi kết nối máy chủ' });
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setMinioTestLoading(false);
    }
  }

  // --- Zalo Bot Server ---
  const [botStatus, setBotStatus] = useState<any>(null);
  const [botStatusLoading, setBotStatusLoading] = useState(false);
  const [botQR, setBotQR] = useState<string | null>(null);
  const [botQRLoading, setBotQRLoading] = useState(false);
  const [botWebhookResult, setBotWebhookResult] = useState<any>(null);
  const [botWebhookLoading, setBotWebhookLoading] = useState(false);
  const [botWebhookUrl, setBotWebhookUrl] = useState('');

  // Load gợi ý webhook URL cho bot server
  useEffect(() => {
    if (!canManage) return;
    fetch('/api/zalo/set-webhook')
      .then(r => r.json())
      .then(d => { if (d.webhookUrl) setBotWebhookUrl(d.webhookUrl); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  async function handleBotStatus() {
    setBotStatusLoading(true);
    setBotQR(null);
    try {
      const res = await fetch('/api/zalo-bot/status');
      const data = await res.json();
      setBotStatus(data);
      if (!data.ok) toast.error(data.error || 'Không kết nối được bot server');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBotStatusLoading(false);
    }
  }

  async function handleBotQR() {
    setBotQRLoading(true);
    setBotQR(null);
    try {
      const res = await fetch('/api/zalo-bot/qr', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.qrCode) {
        setBotQR(data.qrCode);
      } else {
        toast.error(data.error || 'Không lấy được QR code');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBotQRLoading(false);
    }
  }

  async function handleBotSetWebhook(ownId?: string) {
    setBotWebhookLoading(true);
    setBotWebhookResult(null);
    try {
      const body: any = {};
      if (ownId) body.ownId = ownId;
      if (botWebhookUrl.trim()) body.webhookUrl = botWebhookUrl.trim();
      const res = await fetch('/api/zalo-bot/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setBotWebhookResult(data);
      if (data.ok) {
        toast.success('Đã cài webhook trên bot server');
        if (data.webhookUrl) setBotWebhookUrl(data.webhookUrl);
      } else {
        toast.error(data.error || 'Cài webhook thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBotWebhookLoading(false);
    }
  }

  // --- Tin nhắn webhook nhận được ---
  const [webhookMessages, setWebhookMessages] = useState<any[]>([]);
  const [webhookMsgLoading, setWebhookMsgLoading] = useState(false);

  async function loadWebhookMessages() {
    setWebhookMsgLoading(true);
    try {
      const res = await fetch('/api/zalo/messages?conversations=1');
      const data = await res.json();
      if (data.data) setWebhookMessages(data.data);
    } catch {
      toast.error('Không thể tải tin nhắn webhook');
    } finally {
      setWebhookMsgLoading(false);
    }
  }

  // SSE: tự động cập nhật khi có tin nhắn mới (không cần bấm nút)
  useEffect(() => {
    if (!canManage) return;
    // Load lần đầu
    loadWebhookMessages();

    const es = new EventSource('/api/zalo/messages/stream');
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type !== 'messages') return;
        const newMsgs: any[] = payload.data;
        setWebhookMessages(prev => {
          const map = new Map(prev.map((m: any) => [m.chatId, m]));
          for (const m of newMsgs) {
            const existing = map.get(m.chatId);
            if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
              map.set(m.chatId, m);
            }
          }
          return Array.from(map.values()).sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      } catch { /* ignore */ }
    };
    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  // Nhóm các cài đặt
  const settingsByGroup = systemSettings.reduce<Record<string, CaiDatItem[]>>((acc, s) => {
    if (!acc[s.nhom]) acc[s.nhom] = [];
    acc[s.nhom].push(s);
    return acc;
  }, {});

  const groupOrder = ['luuTru', 'thongBao', 'thanhToan', 'heThong', 'baoMat'];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-xs md:text-sm text-gray-600">
          Tùy chỉnh giao diện{canManage ? ' và cài đặt hệ thống' : ''}
        </p>
      </div>

      <Tabs defaultValue={canManage ? 'thanhToan' : 'display'}>
        <TabsList className="flex flex-wrap h-auto gap-1 w-full md:w-auto">
          {canManage && (<>
            <TabsTrigger value="thanhToan" className="flex items-center gap-1.5 text-xs md:text-sm">
              <CreditCard className="h-3.5 w-3.5" />
              Thanh toán
            </TabsTrigger>
            <TabsTrigger value="thongBao" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Bell className="h-3.5 w-3.5" />
              Thông báo
            </TabsTrigger>
            <TabsTrigger value="luuTru" className="flex items-center gap-1.5 text-xs md:text-sm">
              <HardDrive className="h-3.5 w-3.5" />
              Lưu trữ
            </TabsTrigger>
            <TabsTrigger value="heThong" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Shield className="h-3.5 w-3.5" />
              Hệ thống
            </TabsTrigger>
          </>)}
          <TabsTrigger value="display" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Monitor className="h-3.5 w-3.5" />
            Giao diện
          </TabsTrigger>
        </TabsList>

        {/* ── Skeleton lỗi/loading dùng chung ── */}
        {canManage && (loadingSystem || errorSystem) && (
          <div className="mt-4">
            {loadingSystem ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Đang tải cài đặt hệ thống...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="rounded-full bg-red-50 p-4">
                  <Settings className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">Không thể tải cài đặt</p>
                  <p className="text-sm text-red-500 mt-1">{errorSystem}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchSystemSettings}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Thử lại
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Thanh toán ─────────────────────────────────────────────────── */}
        {canManage && !loadingSystem && !errorSystem && (
          <TabsContent value="thanhToan" className="space-y-4 mt-4">
            {settingsByGroup['thanhToan']?.length ? (
              <SettingGroupCard
                nhom="thanhToan"
                items={settingsByGroup['thanhToan']}
                values={settingValues}
                onChange={handleSettingChange}
                onSave={handleSaveGroup}
                saving={savingGroup === 'thanhToan'}
              />
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">Chưa có cài đặt thanh toán nào.</p>
            )}
          </TabsContent>
        )}

        {/* ── Tab Thông báo (Zalo) ───────────────────────────────────────────── */}
        {canManage && !loadingSystem && !errorSystem && (
          <TabsContent value="thongBao" className="space-y-4 mt-4">
            {settingsByGroup['thongBao']?.length && (
              <SettingGroupCard
                nhom="thongBao"
                items={settingsByGroup['thongBao']}
                values={settingValues}
                onChange={handleSettingChange}
                onSave={handleSaveGroup}
                saving={savingGroup === 'thongBao'}
              />
            )}

            {/* ── Gửi test Zalo ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Bell className="h-4 w-4" />
                  Gửi test Zalo
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Kiểm tra kết nối Zalo Bot — gửi tin nhắn, hình ảnh hoặc file đến Chat ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">
                {/* Loại gửi */}
                <div className="flex gap-2">
                  {(['text', 'image', 'file'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setTestType(t)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        testType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}>
                      {t === 'text' && <MessageSquare className="h-3.5 w-3.5" />}
                      {t === 'image' && <Image className="h-3.5 w-3.5" />}
                      {t === 'file' && <FileText className="h-3.5 w-3.5" />}
                      {t === 'text' ? 'Văn bản' : t === 'image' ? 'Hình ảnh' : 'File'}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs md:text-sm font-medium">Chat ID người nhận (Thread ID)</Label>
                  <Input type="text" placeholder="VD: 6643404425553198601"
                    value={testChatId} onChange={(e) => setTestChatId(e.target.value)}
                    className="text-sm font-mono" />
                </div>
                {testType === 'image' && (
                  <div className="space-y-1">
                    <Label className="text-xs md:text-sm font-medium">URL hình ảnh</Label>
                    <Input type="url" placeholder="https://example.com/image.jpg"
                      value={testImageUrl} onChange={(e) => setTestImageUrl(e.target.value)}
                      className="text-sm" />
                  </div>
                )}
                {testType === 'file' && (
                  <div className="space-y-1">
                    <Label className="text-xs md:text-sm font-medium">URL file</Label>
                    <Input type="url" placeholder="https://example.com/document.pdf"
                      value={testFileUrl} onChange={(e) => setTestFileUrl(e.target.value)}
                      className="text-sm" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs md:text-sm font-medium">
                    {testType === 'text' ? 'Nội dung tin nhắn' : 'Caption / mô tả (tuỳ chọn)'}
                  </Label>
                  <Input type="text"
                    value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
                    className="text-sm" maxLength={500} />
                </div>
                <Button size="sm" onClick={handleSendTest} disabled={testLoading} className="w-full">
                  {testLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
                  Gửi test
                </Button>
                {testResult && (
                  <div className={`rounded-md p-3 text-sm flex items-center gap-2 ${
                    testResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    {testResult.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" /> : <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
                    {testResult.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Theo dõi tin nhắn Zalo Bot (thread ID) ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <MessageSquare className="h-4 w-4" />
                      Theo dõi tin nhắn Zalo Bot
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm mt-1">
                      Hiển thị tin nhắn đến theo thời gian thực — lấy <strong>Thread ID</strong> để điền vào hồ sơ khách thuê.
                    </CardDescription>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                    onClick={handleClearMessages}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Xóa tất cả
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-2">
                {webhookMessages.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-6">
                    {webhookMsgLoading ? 'Đang tải...' : 'Chưa có tin nhắn nào. Nhắn vào Zalo Bot để xem Thread ID tại đây.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {webhookMessages.map((msg: any) => (
                      <div key={msg.id} className="rounded-lg border bg-blue-50 border-blue-100 p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-blue-700">Thread ID:</span>
                            <code className="font-bold text-blue-900 select-all">{msg.chatId}</code>
                            <button type="button" title="Sao chép Thread ID"
                              className="text-blue-400 hover:text-blue-700"
                              onClick={() => { navigator.clipboard.writeText(msg.chatId); toast.success('Đã sao chép Thread ID'); }}>
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button type="button"
                            className="text-gray-400 hover:text-gray-700 shrink-0"
                            onClick={() => setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id)}
                            title={expandedMsgId === msg.id ? 'Thu gọn' : 'Xem raw payload'}>
                            {expandedMsgId === msg.id
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                        {msg.displayName && (
                          <div className="text-gray-600">
                            <span className="font-medium">{msg.displayName}</span>
                          </div>
                        )}
                        {msg.attachmentUrl && (
                          <img src={msg.attachmentUrl} alt="ảnh" className="rounded max-h-20 max-w-[160px] object-contain border" />
                        )}
                        <p className="text-gray-700 truncate">{msg.content}</p>
                        <p className="text-gray-400 text-[10px]">Nhận lúc: {new Date(msg.createdAt).toLocaleString('vi-VN')}</p>
                        {expandedMsgId === msg.id && msg.rawPayload && (
                          <pre className="mt-2 p-2 bg-white border rounded text-[10px] text-gray-600 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                            {JSON.stringify(msg.rawPayload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Polling Worker ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <RefreshCw className="h-4 w-4" />
                  Polling Worker (dự phòng khi không dùng Webhook)
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Mặc định hệ thống dùng <strong>Webhook</strong> (bot.zapps.me push về server).
                  Chỉ bật Polling khi không thể dùng Webhook.
                  <span className="block mt-1 text-amber-600 font-medium">
                    ⚠ Polling và Webhook không thể chạy cùng lúc.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">
                {pollingStatus && (
                  <div className={`rounded-md border p-3 text-sm space-y-1.5 ${
                    pollingStatus.running ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Trạng thái</span>
                      {pollingStatus.running ? (
                        <Badge className="bg-green-600 text-xs">Đang chạy</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Dừng</Badge>
                      )}
                    </div>
                    {pollingStatus.running && pollingStatus.startedAt && (
                      <div className="text-xs text-gray-500">
                        Bắt đầu: {new Date(pollingStatus.startedAt).toLocaleTimeString('vi-VN')}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      Tin nhắn đã xử lý: <strong>{pollingStatus.messagesProcessed}</strong>
                    </div>
                    {pollingStatus.lastMessageAt && (
                      <div className="text-xs text-gray-500">
                        Tin cuối: {new Date(pollingStatus.lastMessageAt).toLocaleTimeString('vi-VN')}
                      </div>
                    )}
                    {pollingStatus.lastError && (
                      <div className="text-xs text-red-600">Lỗi: {pollingStatus.lastError}</div>
                    )}
                  </div>
                )}
                {!pollingStatus?.running ? (
                  <Button size="sm" onClick={handleStartPolling} disabled={pollingLoading} className="w-full bg-green-600 hover:bg-green-700">
                    <RefreshCw className={`h-4 w-4 mr-2 ${pollingLoading ? 'animate-spin' : ''}`} />
                    {pollingLoading ? 'Đang khởi động…' : 'Bật Polling Worker'}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleStopPolling(false)} disabled={pollingLoading}
                    className="w-full border-red-300 text-red-600 hover:bg-red-50">
                    {pollingLoading ? 'Đang dừng…' : 'Dừng Polling (tự khôi phục Webhook)'}
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Khi dừng Polling, hệ thống tự đăng ký lại Webhook.
                </p>
              </CardContent>
            </Card>

            {/* ── Zalo Bot Server (zalo_mode=bot_server) ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Smartphone className="h-4 w-4" />
                  Zalo Bot Server (Web Login)
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Quản lý Docker bot server chạy trên Home Assistant (cổng 3000).
                  Dùng khi <code className="bg-gray-100 px-1 rounded">zalo_mode = bot_server</code>.
                  Lưu các cài đặt <strong>zalo_bot_server_url</strong>, <strong>zalo_bot_username/password</strong> và <strong>zalo_bot_account_id</strong> trước.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">

                {/* Kiểm tra kết nối + danh sách tài khoản */}
                <Button size="sm" variant="outline" onClick={handleBotStatus} disabled={botStatusLoading} className="w-full">
                  {botStatusLoading
                    ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    : <Wifi className="h-4 w-4 mr-2" />}
                  Kiểm tra kết nối & danh sách tài khoản
                </Button>

                {botStatus && (
                  <div className={`rounded-md p-3 text-xs space-y-2 border ${botStatus.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-1.5 font-medium">
                      {botStatus.ok
                        ? <Wifi className="h-3.5 w-3.5 text-green-600" />
                        : <WifiOff className="h-3.5 w-3.5 text-red-600" />}
                      <span className={botStatus.ok ? 'text-green-800' : 'text-red-800'}>
                        {botStatus.ok ? `Kết nối OK — ${botStatus.serverUrl}` : botStatus.error}
                      </span>
                    </div>
                    {botStatus.ok && botStatus.accounts?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-gray-500 font-medium">Tài khoản đang đăng nhập ({botStatus.accounts.length}):</p>
                        {botStatus.accounts.map((acc: any, i: number) => {
                          const id = acc?.id || acc?.ownId || acc?.userId || acc?.uid || JSON.stringify(acc).slice(0, 40);
                          const name = acc?.name || acc?.displayName || acc?.zaloName || acc?.dName || '';
                          const isActive = botStatus.accountId && (acc?.id === botStatus.accountId || acc?.ownId === botStatus.accountId);
                          return (
                            <div key={i} className={`flex items-center gap-2 p-1.5 rounded ${isActive ? 'bg-green-100 border border-green-300' : 'bg-white border'}`}>
                              <code className="font-mono text-[10px] text-gray-600 select-all">{id}</code>
                              {name && <span className="text-gray-700">{name}</span>}
                              {isActive && <Badge className="text-[9px] h-4 px-1 bg-green-600">đang dùng</Badge>}
                              <button type="button" title="Sao chép ID"
                                className="ml-auto text-gray-400 hover:text-blue-600"
                                onClick={() => { navigator.clipboard.writeText(String(id)); toast.success('Đã sao chép account ID'); }}>
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {botStatus.ok && botStatus.accounts?.length === 0 && (
                      <p className="text-amber-700">Chưa có tài khoản Zalo nào đăng nhập — hãy quét QR bên dưới.</p>
                    )}
                  </div>
                )}

                {/* QR Code đăng nhập */}
                <Button size="sm" variant="outline" onClick={handleBotQR} disabled={botQRLoading} className="w-full">
                  {botQRLoading
                    ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    : <QrCode className="h-4 w-4 mr-2" />}
                  Lấy QR code đăng nhập Zalo
                </Button>

                {botQR && (
                  <div className="flex flex-col items-center gap-2 p-3 bg-white border rounded-md">
                    <p className="text-xs text-gray-500">Mở Zalo trên điện thoại → Quét mã QR bên dưới để đăng nhập</p>
                    {botQR.startsWith('data:image') ? (
                      <img src={botQR} alt="QR Code Zalo" className="w-48 h-48 border rounded" />
                    ) : (
                      <code className="text-[10px] text-gray-600 break-all">{botQR}</code>
                    )}
                    <Button size="sm" variant="ghost" className="text-xs"
                      onClick={() => { setBotQR(null); handleBotQR(); }}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Làm mới QR
                    </Button>
                  </div>
                )}

                {/* Cài webhook */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-medium text-gray-700">Webhook URL (ql_tro nhận tin nhắn)</Label>
                  <div className="flex gap-2">
                    <Input type="url" placeholder="https://your-domain.com/api/zalo/webhook"
                      value={botWebhookUrl} onChange={e => setBotWebhookUrl(e.target.value)}
                      className="text-xs font-mono" />
                    <Button type="button" variant="outline" size="icon" title="Sao chép"
                      onClick={() => { navigator.clipboard.writeText(botWebhookUrl); toast.success('Đã sao chép'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Tự động lấy từ URL đã lưu hoặc <code>NEXTAUTH_URL</code>. Sửa nếu cần dùng URL khác.
                  </p>
                  <Button size="sm" onClick={() => handleBotSetWebhook()} disabled={botWebhookLoading} className="w-full">
                    {botWebhookLoading
                      ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      : <Webhook className="h-4 w-4 mr-2" />}
                    Cài Webhook trên Bot Server
                  </Button>
                </div>

                {botWebhookResult && (
                  <div className={`rounded-md p-3 text-xs space-y-1 border ${botWebhookResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-1.5 font-medium">
                      {botWebhookResult.ok
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                      {botWebhookResult.ok ? 'Webhook đã được cài đặt thành công' : botWebhookResult.error}
                    </div>
                    {botWebhookResult.ok && (
                      <div className="pl-5 space-y-0.5 text-green-700">
                        <div>Account ID: <code className="font-mono">{botWebhookResult.ownId}</code></div>
                        <div>Webhook URL: <code className="font-mono break-all">{botWebhookResult.webhookUrl}</code></div>
                      </div>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>

          </TabsContent>
        )}

        {/* ── Tab Lưu trữ ───────────────────────────────────────────────────── */}
        {canManage && !loadingSystem && !errorSystem && (
          <TabsContent value="luuTru" className="space-y-4 mt-4">
            {settingsByGroup['luuTru']?.length && (
              <SettingGroupCard
                nhom="luuTru"
                items={settingsByGroup['luuTru']}
                values={settingValues}
                onChange={handleSettingChange}
                onSave={handleSaveGroup}
                saving={savingGroup === 'luuTru'}
              />
            )}

            {/* ── Kiểm tra kết nối MinIO ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <HardDrive className="h-4 w-4" />
                  Kiểm tra kết nối MinIO
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Lưu cài đặt MinIO trước, sau đó bấm kiểm tra để xác nhận kết nối thành công.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">
                <Button size="sm" variant="outline" onClick={handleTestMinio} disabled={minioTestLoading} className="w-full">
                  {minioTestLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Kiểm tra kết nối
                </Button>
                {minioTestResult && (
                  <div className={`rounded-md p-3 text-sm flex flex-col gap-1 ${
                    minioTestResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <div className="flex items-center gap-2 font-medium">
                      {minioTestResult.ok
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                        : <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
                      {minioTestResult.message}
                    </div>
                    {minioTestResult.ok && minioTestResult.details && (
                      <div className="text-xs font-mono text-green-700 mt-1 space-y-0.5 pl-6">
                        <div>Endpoint: {String(minioTestResult.details.endpoint)}</div>
                        <div>Bucket: {String(minioTestResult.details.bucket)}</div>
                        <div>Tổng buckets: {String(minioTestResult.details.totalBuckets)}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Tab Hệ thống + Bảo mật ────────────────────────────────────────── */}
        {canManage && !loadingSystem && !errorSystem && (
          <TabsContent value="heThong" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {['heThong', 'baoMat'].map((nhom) =>
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
