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
  Link2,
  CheckCircle,
  XCircle,
  Copy,
  Trash2,
  CreditCard,
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

  // --- Zalo getUpdates ---
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesResult, setUpdatesResult] = useState<{
    ok: boolean;
    chatId?: string;
    displayName?: string;
    eventName?: string;
    pendingDetected?: number;
    pendingDetails?: Array<{ hoTen: string; soDienThoai: string; pendingZaloChatId: string }>;
    webhookWasActive?: boolean;
    webhookRestored?: boolean;
    webhookRestoreError?: string;
    error?: string;
  } | null>(null);

  async function handleGetUpdates() {
    setUpdatesLoading(true);
    setUpdatesResult(null);
    try {
      const res = await fetch('/api/zalo/updates', {
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUpdatesResult({ ok: false, error: data.error || `HTTP ${res.status}` });
        toast.error(data.error || 'Lấy updates thất bại');
        return;
      }
      const msg = data.data?.result?.message;
      if (!msg?.from?.id) {
        setUpdatesResult({ ok: true, error: 'Chưa có tin nhắn nào. Hãy nhắn bất kỳ cho Zalo Bot rồi thử lại.' });
        toast.info('Chưa có tin nhắn mới');
        return;
      }
      setUpdatesResult({
        ok: true,
        chatId: String(msg.from.id),
        displayName: msg.from.display_name,
        eventName: data.data?.result?.event_name,
        pendingDetected: data.pendingDetected,
        pendingDetails: data.pendingDetails,
        webhookWasActive: data.webhookWasActive,
        webhookRestored: data.webhookRestored,
        webhookRestoreError: data.webhookRestoreError,
      });
      toast.success('Lấy Chat ID thành công');
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const msg = isTimeout ? 'Quá thời gian chờ (45s). Thử lại sau.' : 'Lỗi kết nối máy chủ';
      setUpdatesResult({ ok: false, error: msg });
      toast.error(msg);
    } finally {
      setUpdatesLoading(false);
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

  async function handleStopPolling(restoreWebhook: boolean) {
    setPollingLoading(true);
    try {
      const res = await fetch('/api/zalo/polling', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreWebhook }),
      });
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
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSendTest() {
    if (!testChatId.trim()) {
      toast.error('Vui lòng nhập Chat ID');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/gui-zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: testChatId.trim(), message: testMessage || 'Test message' }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setTestResult({ ok: true, message: 'Gửi thành công!' });
        toast.success('Đã gửi tin nhắn test thành công');
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

  // --- Webhook Zalo ---
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookUrlSource, setWebhookUrlSource] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState<string | null>(null); // 'set' | 'delete' | 'info'

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

  // Load webhook URL gợi ý từ server (dựa vào NEXTAUTH_URL → đúng khi dùng Cloudflare Tunnel)
  useEffect(() => {
    if (!canManage) return;
    fetch('/api/zalo/set-webhook')
      .then((r) => r.json())
      .then((d) => {
        if (d.webhookUrl) {
          setWebhookUrl(d.webhookUrl);
          setWebhookUrlSource(d.source || '');
        } else {
          // fallback: dùng origin của browser
          setWebhookUrl(`${window.location.origin}/api/zalo/webhook`);
          setWebhookUrlSource('browser');
        }
      })
      .catch(() => {
        setWebhookUrl(`${window.location.origin}/api/zalo/webhook`);
        setWebhookUrlSource('browser');
      });
  }, [canManage]);

  async function handleWebhookAction(action: 'setWebhook' | 'deleteWebhook' | 'getWebhookInfo') {
    setWebhookLoading(action === 'setWebhook' ? 'set' : action === 'deleteWebhook' ? 'delete' : 'info');
    setWebhookStatus(null);
    try {
      const body: any = { action };
      if (action === 'setWebhook') {
        // Gửi URL do user nhập (hoặc URL đã load từ server)
        if (webhookUrl.trim()) body.webhookUrl = webhookUrl.trim();
      }
      const res = await fetch('/api/zalo/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setWebhookStatus({ ok: true, result: data.result });
        if (action === 'setWebhook') toast.success('Đã đăng ký Webhook thành công');
        else if (action === 'deleteWebhook') toast.success('Đã xóa Webhook');
      } else {
        setWebhookStatus({ ok: false, error: data.error || data.message });
        toast.error(data.error || data.message || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
      setWebhookStatus({ ok: false, error: 'Lỗi kết nối máy chủ' });
    } finally {
      setWebhookLoading(null);
    }
  }

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
                  Gửi tin nhắn Zalo test
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Kiểm tra kết nối Zalo Bot bằng cách gửi tin nhắn đến một Chat ID cụ thể.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs md:text-sm font-medium">Chat ID người nhận</Label>
                  <Input
                    type="text"
                    placeholder="Nhập Zalo Chat ID (vd: 1234567890)"
                    value={testChatId}
                    onChange={(e) => setTestChatId(e.target.value)}
                    className="text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs md:text-sm font-medium">Nội dung tin nhắn</Label>
                  <Input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="text-sm"
                    maxLength={500}
                  />
                </div>
                <Button size="sm" onClick={handleSendTest} disabled={testLoading} className="w-full">
                  {testLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
                  Gửi tin nhắn test
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

            {/* ── Lấy Chat ID từ Zalo getUpdates ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Bell className="h-4 w-4" />
                  Lấy Zalo Chat ID
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Nhắn bất kỳ cho Zalo Bot, sau đó bấm nút bên dưới.
                  Hệ thống sẽ tự động: <strong>xóa Webhook → lấy tin nhắn → đăng ký lại Webhook</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">
                <Button size="sm" variant="outline" onClick={handleGetUpdates} disabled={updatesLoading} className="w-full">
                  <RefreshCw className={`h-4 w-4 mr-2 ${updatesLoading ? 'animate-spin' : ''}`} />
                  {updatesLoading ? 'Đang chờ (tối đa 30s)…' : 'Lấy tin nhắn mới nhất'}
                </Button>
                {updatesResult && (
                  <div className={`rounded-md p-3 text-sm space-y-2 ${
                    updatesResult.ok && updatesResult.chatId
                      ? 'bg-green-50 border border-green-200'
                      : updatesResult.ok
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {!updatesResult.ok || !updatesResult.chatId ? (
                      <div className="flex items-center gap-2 text-sm">
                        {updatesResult.ok
                          ? <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                        <span className={updatesResult.ok ? 'text-amber-800' : 'text-red-800'}>{updatesResult.error}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 font-medium text-green-800">
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          Tìm thấy người nhắn tin
                        </div>
                        <div className="space-y-1 pl-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-24">Chat ID</span>
                            <code className="bg-white border rounded px-2 py-0.5 text-xs font-mono font-bold text-gray-800 select-all">
                              {updatesResult.chatId}
                            </code>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Sao chép Chat ID"
                              onClick={() => { navigator.clipboard.writeText(updatesResult.chatId!); toast.success('Đã sao chép Chat ID'); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {updatesResult.displayName && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-24">Tên Zalo</span>
                              <span className="text-xs text-gray-700">{updatesResult.displayName}</span>
                            </div>
                          )}
                          {updatesResult.eventName && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-24">Sự kiện</span>
                              <span className="text-xs text-gray-500 font-mono">{updatesResult.eventName}</span>
                            </div>
                          )}
                        </div>
                        {updatesResult.pendingDetected && updatesResult.pendingDetected > 0 ? (
                          <div className="mt-2 rounded bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800">
                            <strong>Gợi ý liên kết:</strong> Tìm thấy {updatesResult.pendingDetected} khách thuê tên gần giống.
                            Vào <strong>Quản lý khách thuê</strong> để xác nhận liên kết Chat ID.
                            {updatesResult.pendingDetails?.map((p) => (
                              <div key={p.pendingZaloChatId} className="mt-1 font-mono">→ {p.hoTen} ({p.soDienThoai})</div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 pl-6">Không tìm thấy khách thuê trùng tên. Sao chép Chat ID và điền thủ công.</p>
                        )}
                        {updatesResult.webhookWasActive && (
                          <div className={`mt-2 rounded px-2 py-1.5 text-xs ${
                            updatesResult.webhookRestored
                              ? 'bg-green-50 border border-green-200 text-green-800'
                              : 'bg-amber-50 border border-amber-200 text-amber-800'
                          }`}>
                            {updatesResult.webhookRestored
                              ? '✓ Webhook đã được đăng ký lại tự động'
                              : `⚠ ${updatesResult.webhookRestoreError || 'Webhook chưa được đăng ký lại — vào tab Webhook để đăng ký lại.'}`}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Polling Worker ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <RefreshCw className="h-4 w-4" />
                  Polling Worker (thay thế Webhook)
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Khi Webhook bị lỗi, dùng Polling để nhận tin nhắn liên tục từ nhiều người.
                  Worker chạy nền trong server — không cần giữ trình duyệt mở.
                  <span className="block mt-1 text-amber-600 font-medium">
                    ⚠ Polling và Webhook không thể chạy cùng lúc. Bật Polling sẽ tự xóa Webhook.
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
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleStopPolling(false)} disabled={pollingLoading}
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                      {pollingLoading ? 'Đang dừng…' : 'Dừng Polling'}
                    </Button>
                    {pollingStatus.webhookWillRestore && (
                      <Button size="sm" variant="outline" onClick={() => handleStopPolling(true)} disabled={pollingLoading}
                        className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50">
                        Dừng & Bật lại Webhook
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Worker dừng khi server khởi động lại. Sau khi restart, bấm "Bật Polling Worker" lại nếu cần.
                </p>
              </CardContent>
            </Card>

            {/* ── Webhook Zalo ── */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Webhook className="h-4 w-4" />
                  Zalo Webhook
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Zalo sẽ gửi HTTP POST đến Webhook URL khi có tin nhắn từ người dùng.
                  Hãy lưu <strong>Secret Token</strong> trong phần cài đặt bên trên trước, sau đó nhấn&nbsp;
                  <em>Đăng ký Webhook</em>.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs md:text-sm font-medium">Webhook URL</Label>
                    {webhookUrlSource && webhookUrlSource !== 'browser' && (
                      <span className="text-xs text-green-600 font-medium">✓ từ {webhookUrlSource} (Cloudflare Tunnel)</span>
                    )}
                    {webhookUrlSource === 'browser' && (
                      <span className="text-xs text-amber-600 font-medium">⚠ URL từ trình duyệt — có thể là localhost</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://your-domain.com/api/zalo/webhook"
                      className="text-sm font-mono"
                    />
                    <Button type="button" variant="outline" size="icon" title="Sao chép URL"
                      onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Đã sao chép Webhook URL'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    URL được lấy từ <code className="bg-gray-100 px-1 rounded">NEXTAUTH_URL</code>.
                    Nếu dùng Cloudflare Tunnel, đặt <code className="bg-gray-100 px-1 rounded">NEXTAUTH_URL=https://tunnel-url.com</code> để tự động đúng.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleWebhookAction('setWebhook')} disabled={!!webhookLoading}>
                    {webhookLoading === 'set' ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                    Đăng ký Webhook
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleWebhookAction('getWebhookInfo')} disabled={!!webhookLoading}>
                    {webhookLoading === 'info' ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Kiểm tra trạng thái
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleWebhookAction('deleteWebhook')} disabled={!!webhookLoading}>
                    {webhookLoading === 'delete' ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Xóa Webhook
                  </Button>
                </div>
                {webhookStatus && (
                  <div className={`rounded-md p-3 text-sm font-mono whitespace-pre-wrap break-all ${
                    webhookStatus.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1 font-sans font-medium text-xs">
                      {webhookStatus.ok
                        ? <><CheckCircle className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Thành công</span></>
                        : <><XCircle className="h-3.5 w-3.5 text-red-600" /><span className="text-red-700">Lỗi</span></>}
                    </div>
                    {webhookStatus.ok ? JSON.stringify(webhookStatus.result, null, 2) : webhookStatus.error}
                  </div>
                )}

                {/* ── Tin nhắn webhook nhận được ── */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Tin nhắn nhận qua Webhook</span>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2"
                      disabled={webhookMsgLoading} onClick={loadWebhookMessages}>
                      <RefreshCw className={`h-3 w-3 mr-1 ${webhookMsgLoading ? 'animate-spin' : ''}`} />
                      Tải tin nhắn
                    </Button>
                  </div>
                  {webhookMessages.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      {webhookMsgLoading ? 'Đang tải...' : 'Nhấn "Tải tin nhắn" để xem các tin nhắn bot đã nhận'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {webhookMessages.map((msg: any) => (
                        <div key={msg.id} className="flex items-start gap-2 p-2 rounded border bg-gray-50 text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-gray-800 truncate">{msg.displayName || 'Ẩn danh'}</span>
                              <span className="font-mono text-gray-400 text-[10px]">{msg.chatId}</span>
                              {msg.eventName && msg.eventName !== 'message' && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1">{msg.eventName}</Badge>
                              )}
                            </div>
                            <p className="text-gray-600 mt-0.5 truncate">{msg.content}</p>
                            <p className="text-gray-400 text-[10px] mt-0.5">{new Date(msg.createdAt).toLocaleString('vi-VN')}</p>
                          </div>
                          <button type="button" title="Sao chép Chat ID" className="shrink-0 text-gray-400 hover:text-blue-600"
                            onClick={() => { navigator.clipboard.writeText(msg.chatId); toast.success('Đã sao chép Chat ID'); }}>
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
