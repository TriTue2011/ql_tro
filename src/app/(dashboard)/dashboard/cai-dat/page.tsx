"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  QrCode,
  Wifi,
  WifiOff,
  Image,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Upload,
  User,
  Users,
  Clock,
  AlertTriangle,
  Zap,
  Cloud,
  Bot,
} from "lucide-react";
import { toast } from "sonner";

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
  luuTru: { label: "Lưu trữ ảnh", icon: <HardDrive className="h-4 w-4" /> },
  thongBao: { label: "Thông báo", icon: <Bell className="h-4 w-4" /> },
  thanhToan: { label: "Thanh toán", icon: <CreditCard className="h-4 w-4" /> },
  heThong: { label: "Hệ thống", icon: <Building2 className="h-4 w-4" /> },
  baoMat: { label: "Bảo mật", icon: <Lock className="h-4 w-4" /> },
  ai: { label: "AI", icon: <Bot className="h-4 w-4" /> },
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

  if (item.khoa === "ngan_hang_ten") {
    const banks = [
      "Vietcombank",
      "VietinBank",
      "BIDV",
      "Agribank",
      "MBBank",
      "Techcombank",
      "ACB",
      "VPBank",
      "TPBank",
      "Sacombank",
      "HDBank",
      "VIB",
      "MSB",
      "OCB",
      "SHB",
      "SeABank",
      "LienVietPostBank",
      "Eximbank",
      "NamABank",
      "ABBank",
      "VietABank",
      "BacABank",
      "VietBank",
      "KienLongBank",
      "SCB",
      "PGBank",
      "BaoVietBank",
      "VietCapitalBank",
      "GPBank",
      "NCB",
      "CBBank",
      "COOPBANK",
      "SaigonBank",
      "DongABank",
      "Oceanbank",
      "VRB",
      "Indovinabank",
      "PublicBank",
      "CIMB",
      "ShinhanBank",
      "HSBC",
      "DBSBank",
      "StandardChartered",
      "Nonghyup",
      "HongLeong",
      "Woori",
      "UnitedOverseas",
      "KookminHN",
      "KookminHCM",
    ];
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Chọn ngân hàng" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {banks.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (item.khoa === "storage_provider") {
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

  if (item.khoa === "cloudflare_tunnel") {
    const isOn = value === "true";
    return (
      <div className="flex items-center gap-3 py-1">
        <Switch
          checked={isOn}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          id="cloudflare_tunnel_switch"
        />
        <label
          htmlFor="cloudflare_tunnel_switch"
          className={`text-sm cursor-pointer select-none ${isOn ? "text-green-700 font-medium" : "text-gray-500"}`}
        >
          {isOn
            ? "Đang bật — ứng dụng chạy qua Cloudflare Tunnel"
            : "Đang tắt — không dùng Cloudflare Tunnel"}
        </label>
      </div>
    );
  }

  if (item.laBiMat) {
    return (
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
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
  const meta = NHOM_LABELS[nhom] ?? {
    label: nhom,
    icon: <Settings className="h-4 w-4" />,
  };

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
              value={values[item.khoa] ?? ""}
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
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Lưu {meta.label}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Component: Lưu trữ thông minh (ẩn/hiện theo provider) ───────────────────

function StorageSettingsCard({
  items,
  values,
  onChange,
  onSave,
  saving,
}: {
  items: CaiDatItem[];
  values: Record<string, string>;
  onChange: (khoa: string, val: string) => void;
  onSave: (nhom: string) => void;
  saving: boolean;
}) {
  const provider = values["storage_provider"] || "local";
  const showMinio = provider === "minio" || provider === "both";
  const showCloudinary = provider === "cloudinary" || provider === "both";

  const providerItem = items.find((i) => i.khoa === "storage_provider");
  const maxSizeItem = items.find((i) => i.khoa === "upload_max_size_mb");
  const minioItems = items.filter((i) => i.khoa.startsWith("minio_"));
  const cloudinaryItems = items.filter((i) => i.khoa.startsWith("cloudinary_"));

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <HardDrive className="h-4 w-4" />
          Lưu trữ ảnh
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {providerItem && (
          <div className="space-y-1">
            <Label className="text-xs md:text-sm font-medium">{providerItem.moTa}</Label>
            <SettingInput
              item={providerItem}
              value={values["storage_provider"] ?? ""}
              onChange={(v) => onChange("storage_provider", v)}
            />
          </div>
        )}
        {maxSizeItem && (
          <div className="space-y-1">
            <Label className="text-xs md:text-sm font-medium">{maxSizeItem.moTa}</Label>
            <SettingInput
              item={maxSizeItem}
              value={values["upload_max_size_mb"] ?? ""}
              onChange={(v) => onChange("upload_max_size_mb", v)}
            />
          </div>
        )}
        {showMinio && minioItems.length > 0 && (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> MinIO (self-hosted)
            </p>
            {minioItems.map((item) => (
              <div key={item.khoa} className="space-y-1">
                <Label className="text-xs md:text-sm font-medium">
                  {item.moTa}
                  {item.laBiMat && (
                    <Badge variant="outline" className="ml-2 text-xs py-0">
                      <Lock className="h-2.5 w-2.5 mr-1" />bí mật
                    </Badge>
                  )}
                </Label>
                <SettingInput
                  item={item}
                  value={values[item.khoa] ?? ""}
                  onChange={(v) => onChange(item.khoa, v)}
                />
              </div>
            ))}
          </div>
        )}
        {showCloudinary && cloudinaryItems.length > 0 && (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" /> Cloudinary (online)
            </p>
            {cloudinaryItems.map((item) => (
              <div key={item.khoa} className="space-y-1">
                <Label className="text-xs md:text-sm font-medium">
                  {item.moTa}
                  {item.laBiMat && (
                    <Badge variant="outline" className="ml-2 text-xs py-0">
                      <Lock className="h-2.5 w-2.5 mr-1" />bí mật
                    </Badge>
                  )}
                </Label>
                <SettingInput
                  item={item}
                  value={values[item.khoa] ?? ""}
                  onChange={(v) => onChange(item.khoa, v)}
                />
              </div>
            ))}
          </div>
        )}
        {provider === "local" && (
          <p className="text-xs text-gray-400 italic border-t pt-3">
            Lưu trữ local — ảnh lưu trực tiếp trên server, không cần cấu hình thêm.
          </p>
        )}
        <Button
          size="sm"
          className="w-full mt-2"
          onClick={() => onSave("luuTru")}
          disabled={saving}
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Lưu Lưu trữ
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Component: Cảnh báo / Nhắc nhở ──────────────────────────────────────────

const ALERT_KEYS = new Set([
  "thong_bao_truoc_han_hop_dong",
  "thong_bao_qua_han_hoa_don",
  "hoa_don_canh_bao_lan_1",
  "hoa_don_canh_bao_lan_2",
  "hoa_don_canh_bao_lan_3",
  "hop_dong_canh_bao_lan_1",
  "hop_dong_canh_bao_lan_2",
  "hop_dong_canh_bao_lan_3",
  "chot_chi_so_truoc_ngay",
  "chot_chi_so_ngay_trong_thang",
  "su_co_chua_nhan_gio",
  "su_co_chua_xu_ly_gio",
]);


function AlertSettingsCard({
  items,
  values,
  onChange,
  onSave,
  saving,
}: {
  items: CaiDatItem[];
  values: Record<string, string>;
  onChange: (khoa: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const sections: { label: string; icon: React.ReactNode; keys: string[] }[] = [
    {
      label: "Hóa đơn quá hạn",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
      keys: ["thong_bao_qua_han_hoa_don", "hoa_don_canh_bao_lan_1", "hoa_don_canh_bao_lan_2", "hoa_don_canh_bao_lan_3"],
    },
    {
      label: "Hợp đồng sắp hết hạn",
      icon: <FileText className="h-3.5 w-3.5 text-blue-500" />,
      keys: ["thong_bao_truoc_han_hop_dong", "hop_dong_canh_bao_lan_1", "hop_dong_canh_bao_lan_2", "hop_dong_canh_bao_lan_3"],
    },
    {
      label: "Chốt chỉ số điện nước",
      icon: <Zap className="h-3.5 w-3.5 text-yellow-500" />,
      keys: ["chot_chi_so_ngay_trong_thang", "chot_chi_so_truoc_ngay"],
    },
    {
      label: "Sự cố",
      icon: <Clock className="h-3.5 w-3.5 text-red-500" />,
      keys: ["su_co_chua_nhan_gio", "su_co_chua_xu_ly_gio"],
    },
  ];

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Bell className="h-4 w-4" />
          Cài đặt cảnh báo & nhắc nhở
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {sections.map((sec) => {
          const secItems = sec.keys.map((k) => items.find((i) => i.khoa === k)).filter(Boolean) as CaiDatItem[];
          if (!secItems.length) return null;
          return (
            <div key={sec.label} className="space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 pt-1">
                {sec.icon} {sec.label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-1">
                {secItems.map((item) => (
                  <div key={item.khoa} className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">{item.moTa}</Label>
                    <SettingInput
                      item={item}
                      value={values[item.khoa] ?? ""}
                      onChange={(v) => onChange(item.khoa, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <Button size="sm" className="w-full mt-2" onClick={onSave} disabled={saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Lưu cảnh báo
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── ChuNha Hệ thống Tab ──────────────────────────────────────────────────────

function ChuNhaHeThongTab() {
  const [data, setData] = useState({
    tenCongTy: '', emailLienHe: '', sdtLienHe: '', diaChiCongTy: '', appDomainUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chuNha/settings')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setData({
            tenCongTy: res.data.tenCongTy ?? '',
            emailLienHe: res.data.emailLienHe ?? '',
            sdtLienHe: res.data.sdtLienHe ?? '',
            diaChiCongTy: res.data.diaChiCongTy ?? '',
            appDomainUrl: res.data.appDomainUrl ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/chuNha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) toast.success('Đã lưu thông tin hệ thống');
      else toast.error(json.error || 'Lưu thất bại');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-gray-400" /></div>;

  const fields = [
    { key: 'tenCongTy', label: 'Tên công ty / tên nhà trọ', placeholder: 'VD: Nhà trọ Phòng Trọ Pro' },
    { key: 'emailLienHe', label: 'Email liên hệ', placeholder: 'contact@example.com' },
    { key: 'sdtLienHe', label: 'Số điện thoại liên hệ', placeholder: '0909123456' },
    { key: 'diaChiCongTy', label: 'Địa chỉ', placeholder: '123 đường ABC, quận 1, TP.HCM' },
    { key: 'appDomainUrl', label: 'Domain công khai', placeholder: 'https://myhouse.com' },
  ] as const;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Building2 className="h-4 w-4" /> Thông tin hệ thống
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Thông tin công ty / nhà trọ của bạn. Mỗi chủ trọ có dữ liệu riêng.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs md:text-sm font-medium">{f.label}</Label>
            <Input
              value={data[f.key]}
              onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="text-sm"
            />
          </div>
        ))}
        <Button size="sm" className="w-full mt-2" onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Lưu hệ thống
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Zalo Webhook URL Card ────────────────────────────────────────────────────

function ZaloWebhookCard({
  currentWebhookId,
  webhookBaseUrl,
  webhookDomainUrl,
  webhookFullUrl,
  webhookDomainFullUrl,
  webhookIdGenerating,
  webhookTestLoading,
  webhookTestResult,
  botWebhookUrl,
  botWebhookLoading,
  botWebhookResult,
  onChangeBaseUrl,
  onChangeDomainUrl,
  onSaveBaseUrl,
  onSaveDomainUrl,
  onGenerate,
  onTest,
  onChangeBotUrl,
  onSetBotWebhook,
}: {
  currentWebhookId: string | null;
  webhookBaseUrl: string;
  webhookDomainUrl: string;
  webhookFullUrl: string;
  webhookDomainFullUrl: string;
  webhookIdGenerating: boolean;
  webhookTestLoading: boolean;
  webhookTestResult: { ok: boolean; message: string } | null;
  botWebhookUrl: string;
  botWebhookLoading: boolean;
  botWebhookResult: Record<string, unknown> | null;
  onChangeBaseUrl: (v: string) => void;
  onChangeDomainUrl: (v: string) => void;
  onSaveBaseUrl: (v: string) => void;
  onSaveDomainUrl: (v: string) => void;
  onGenerate: (customId?: string) => void;
  onTest: () => void;
  onChangeBotUrl: (v: string) => void;
  onSetBotWebhook: () => void;
}) {
  const [customId, setCustomId] = useState('');

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Đã copy URL'));
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <MessageSquare className="h-4 w-4" />
          Zalo Webhook
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          URL để Zalo Bot gửi tin nhắn về hệ thống. Dán URL này vào cấu hình bot server.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* App URL settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium">URL LAN (IP nội bộ)</Label>
            <div className="flex gap-1.5">
              <Input
                value={webhookBaseUrl}
                onChange={e => onChangeBaseUrl(e.target.value)}
                placeholder="http://192.168.x.x:3000"
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => onSaveBaseUrl(webhookBaseUrl)}>
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">URL Domain (internet)</Label>
            <div className="flex gap-1.5">
              <Input
                value={webhookDomainUrl}
                onChange={e => onChangeDomainUrl(e.target.value)}
                placeholder="https://yourdomain.com"
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => onSaveDomainUrl(webhookDomainUrl)}>
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Webhook ID section */}
        {!currentWebhookId ? (
          <div className="rounded-md border border-dashed p-4 space-y-3">
            <p className="text-sm text-gray-500 text-center">Chưa có Webhook ID. Tạo ngẫu nhiên hoặc nhập ID từ bot server.</p>
            <div className="flex gap-1.5">
              <Input
                value={customId}
                onChange={e => setCustomId(e.target.value)}
                placeholder="Nhập webhook_id từ bot server (tuỳ chọn)"
                className="text-xs font-mono"
              />
              <Button size="sm" onClick={() => onGenerate(customId.trim() || undefined)} disabled={webhookIdGenerating}>
                {webhookIdGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span className="ml-1">{customId.trim() ? 'Dùng ID này' : 'Tạo ngẫu nhiên'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Webhook URL (dán vào bot server)</Label>
              {webhookFullUrl && (
                <div className="flex items-center gap-1.5 rounded-md border bg-gray-50 px-3 py-2">
                  <Wifi className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1 break-all text-gray-700">{webhookFullUrl}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => copyToClipboard(webhookFullUrl)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {webhookDomainFullUrl && webhookDomainFullUrl !== webhookFullUrl && (
                <div className="flex items-center gap-1.5 rounded-md border bg-gray-50 px-3 py-2">
                  <Cloud className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1 break-all text-gray-700">{webhookDomainFullUrl}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => copyToClipboard(webhookDomainFullUrl)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {!webhookFullUrl && !webhookDomainFullUrl && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Cần nhập URL LAN hoặc URL Domain ở trên để hiển thị webhook URL đầy đủ.
                </p>
              )}
            </div>

            {/* Test + Regenerate */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onTest} disabled={webhookTestLoading} className="flex-1">
                {webhookTestLoading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                Test nhận tin
              </Button>
              <Button size="sm" variant="outline" onClick={() => onGenerate()} disabled={webhookIdGenerating}>
                {webhookIdGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Tạo ID mới</span>
              </Button>
            </div>

            {/* Đổi sang ID từ bot server */}
            <div className="flex gap-1.5 pt-1">
              <Input
                value={customId}
                onChange={e => setCustomId(e.target.value)}
                placeholder="Dán webhook_id từ bot server để đổi"
                className="text-xs font-mono"
              />
              <Button size="sm" variant="outline" disabled={!customId.trim() || webhookIdGenerating}
                onClick={() => { onGenerate(customId.trim()); setCustomId(''); }}>
                Dùng ID này
              </Button>
            </div>
            {webhookTestResult && (
              <div className={`rounded-md p-2.5 text-sm flex items-center gap-2 ${webhookTestResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {webhookTestResult.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
                {webhookTestResult.message}
              </div>
            )}

            {/* Set bot webhook */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-medium">Cài webhook cho bot server</Label>
              <div className="flex gap-1.5">
                <Input
                  value={botWebhookUrl}
                  onChange={e => onChangeBotUrl(e.target.value)}
                  placeholder="URL webhook (tự điền từ trên)"
                  className="text-sm"
                />
                <Button size="sm" onClick={onSetBotWebhook} disabled={botWebhookLoading}>
                  {botWebhookLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Cài</span>
                </Button>
              </div>
              {botWebhookResult && (
                <div className={`rounded-md p-2.5 text-sm flex items-center gap-2 ${(botWebhookResult as { success?: boolean }).success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {(botWebhookResult as { success?: boolean }).success ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
                  {String((botWebhookResult as { message?: string; error?: string }).message || (botWebhookResult as { error?: string }).error || '')}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Admin Building Selector for HA + Storage ────────────────────────────────

function AdminToaNhaSettingsPanel({ tab }: { tab: 'ha' | 'storage' }) {
  const [buildings, setBuildings] = useState<{ id: string; tenToaNha: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // HA thread filter state
  const [haThreadEntries, setHaThreadEntries] = useState<{ threadId: string; type: number }[]>([]);

  // Test states
  const [minioTestLoading, setMinioTestLoading] = useState(false);
  const [minioTestResult, setMinioTestResult] = useState<{ ok: boolean; message: string; details?: Record<string, unknown> } | null>(null);
  // Connect & bucket list
  const [minioConnecting, setMinioConnecting] = useState(false);
  const [minioBuckets, setMinioBuckets] = useState<string[]>([]);
  const [minioConnectError, setMinioConnectError] = useState('');
  const [minioConnected, setMinioConnected] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [haWebhookTestLoading, setHaWebhookTestLoading] = useState(false);
  const [haWebhookTestResult, setHaWebhookTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/toa-nha-settings')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const list = res.data.map((b: { id: string; tenToaNha: string }) => ({ id: b.id, tenToaNha: b.tenToaNha }));
          setBuildings(list);
          // Tự chọn tòa nhà đầu tiên nếu chỉ có 1 hoặc chưa chọn
          if (list.length > 0) setSelectedId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setMinioTestResult(null);
    setHaWebhookTestResult(null);
    fetch(`/api/admin/toa-nha-settings?toaNhaId=${selectedId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          const d = res.data;
          setSettings({
            haUrl: d.haUrl ?? '',
            haToken: d.haToken ?? '',
            haWebhookUrl: d.haWebhookUrl ?? '',
            storageProvider: d.storageProvider ?? 'local',
            minioEndpoint: d.minioEndpoint ?? '',
            minioAccessKey: d.minioAccessKey ?? '',
            minioSecretKey: d.minioSecretKey ?? '',
            minioBucket: d.minioBucket ?? '',
            cloudinaryCloudName: d.cloudinaryCloudName ?? '',
            cloudinaryApiKey: d.cloudinaryApiKey ?? '',
            cloudinaryApiSecret: d.cloudinaryApiSecret ?? '',
            cloudinaryPreset: d.cloudinaryPreset ?? '',
            uploadMaxSizeMb: String(d.uploadMaxSizeMb ?? 10),
          });
          // Parse haAllowedThreads
          const raw = d.haAllowedThreads ?? '';
          if (raw.startsWith('[')) {
            try { setHaThreadEntries(JSON.parse(raw)); } catch { setHaThreadEntries([]); }
          } else {
            setHaThreadEntries([]);
          }
        } else {
          setSettings({});
          setHaThreadEntries([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function handleSave() {
    if (!selectedId) { toast.error('Vui lòng chọn tòa nhà'); return; }
    setSaving(true);
    try {
      let payload: Record<string, unknown> = { toaNhaId: selectedId };
      if (tab === 'ha') {
        const threads = haThreadEntries.filter(e => e.threadId.trim());
        payload = {
          ...payload,
          haUrl: settings.haUrl,
          haToken: settings.haToken,
          haWebhookUrl: settings.haWebhookUrl,
          haAllowedThreads: threads.length > 0 ? JSON.stringify(threads) : '',
        };
      } else {
        payload = {
          ...payload,
          storageProvider: settings.storageProvider,
          minioEndpoint: settings.minioEndpoint,
          minioAccessKey: settings.minioAccessKey,
          minioSecretKey: settings.minioSecretKey,
          minioBucket: settings.minioBucket,
          cloudinaryCloudName: settings.cloudinaryCloudName,
          cloudinaryApiKey: settings.cloudinaryApiKey,
          cloudinaryApiSecret: settings.cloudinaryApiSecret,
          cloudinaryPreset: settings.cloudinaryPreset,
          uploadMaxSizeMb: Number(settings.uploadMaxSizeMb),
        };
      }
      const res = await fetch('/api/admin/toa-nha-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã lưu cài đặt tòa nhà');
        // Re-fetch để đồng bộ state với DB
        const r2 = await fetch(`/api/admin/toa-nha-settings?toaNhaId=${selectedId}`);
        const d2 = await r2.json();
        if (d2.success && d2.data) {
          const d = d2.data;
          setSettings({
            haUrl: d.haUrl ?? '',
            haToken: d.haToken ?? '',
            haWebhookUrl: d.haWebhookUrl ?? '',
            storageProvider: d.storageProvider ?? 'local',
            minioEndpoint: d.minioEndpoint ?? '',
            minioAccessKey: d.minioAccessKey ?? '',
            minioSecretKey: d.minioSecretKey ?? '',
            minioBucket: d.minioBucket ?? '',
            cloudinaryCloudName: d.cloudinaryCloudName ?? '',
            cloudinaryApiKey: d.cloudinaryApiKey ?? '',
            cloudinaryApiSecret: d.cloudinaryApiSecret ?? '',
            cloudinaryPreset: d.cloudinaryPreset ?? '',
            uploadMaxSizeMb: String(d.uploadMaxSizeMb ?? 10),
          });
        }
      } else {
        toast.error(json.error || 'Lưu thất bại');
      }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setSaving(false); }
  }

  async function handleMinioConnect() {
    const endpoint = settings.minioEndpoint?.trim();
    const accessKey = settings.minioAccessKey?.trim();
    const secretKey = settings.minioSecretKey?.trim();
    if (!endpoint || !accessKey || !secretKey) {
      setMinioConnectError('Cần điền Endpoint, Username và Password trước');
      return;
    }
    setMinioConnecting(true);
    setMinioConnectError('');
    setMinioBuckets([]);
    try {
      const res = await fetch('/api/admin/storage/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, accessKey, secretKey }),
      });
      const data = await res.json();
      if (data.success) {
        setMinioBuckets(data.buckets as string[]);
        setMinioConnected(true);
        toast.success('Kết nối thành công');
        if (data.buckets.length > 0 && !data.buckets.includes(settings.minioBucket)) {
          setSettings(prev => ({ ...prev, minioBucket: data.buckets[0] }));
        }
      } else {
        setMinioConnected(false);
        setMinioConnectError(data.message || 'Kết nối thất bại');
      }
    } catch {
      setMinioConnected(false);
      setMinioConnectError('Lỗi kết nối máy chủ');
    } finally {
      setMinioConnecting(false);
    }
  }

  async function handleMinioCreateBucket() {
    const name = newBucketName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!name || name.length < 3) { toast.error('Tên bucket tối thiểu 3 ký tự'); return; }
    setCreatingBucket(true);
    try {
      const res = await fetch('/api/admin/storage/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: settings.minioEndpoint,
          accessKey: settings.minioAccessKey,
          secretKey: settings.minioSecretKey,
          createBucket: name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMinioBuckets(data.buckets as string[]);
        setSettings(prev => ({ ...prev, minioBucket: name }));
        setNewBucketName('');
        toast.success(`Đã tạo bucket "${name}"`);
      } else {
        toast.error(data.message || 'Tạo bucket thất bại');
      }
    } catch {
      toast.error('Lỗi tạo bucket');
    } finally {
      setCreatingBucket(false);
    }
  }

  async function handleTestMinio() {
    const endpoint = settings.minioEndpoint?.trim();
    const accessKey = settings.minioAccessKey?.trim();
    const secretKey = settings.minioSecretKey?.trim();
    const bucket = settings.minioBucket?.trim();
    if (!endpoint || !accessKey) {
      toast.error('Cần nhập Endpoint và Username trước khi kiểm tra');
      return;
    }
    setMinioTestLoading(true);
    setMinioTestResult(null);
    try {
      const res = await fetch('/api/admin/storage/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, accessKey, secretKey, testBucket: bucket }),
      });
      const data = await res.json();
      if (data.success) {
        const hasBucket = bucket && data.buckets?.includes(bucket);
        setMinioTestResult({
          ok: true,
          message: hasBucket ? `Kết nối thành công! Bucket "${bucket}" sẵn sàng.` : `Kết nối thành công! ${data.buckets?.length ?? 0} bucket(s).`,
          details: { endpoint, bucket: bucket || '(chưa chọn)', 'Tổng buckets': data.buckets?.length ?? 0 },
        });
        toast.success('Kết nối MinIO thành công');
      } else {
        setMinioTestResult({ ok: false, message: data.message });
        toast.error(data.message);
      }
    } catch {
      setMinioTestResult({ ok: false, message: 'Lỗi kết nối máy chủ' });
    } finally { setMinioTestLoading(false); }
  }

  async function handleTestHaWebhook() {
    const url = settings.haWebhookUrl?.trim();
    if (!url) { toast.error('Chưa nhập Webhook URL'); return; }
    setHaWebhookTestLoading(true);
    setHaWebhookTestResult(null);
    try {
      const res = await fetch('/api/admin/test-ha-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setHaWebhookTestResult({ ok: data.ok, message: data.message });
      if (data.ok) toast.success('Webhook phản hồi OK');
      else toast.error('Webhook không phản hồi');
    } catch {
      setHaWebhookTestResult({ ok: false, message: 'Lỗi kết nối tới server' });
    } finally { setHaWebhookTestLoading(false); }
  }

  const provider = settings.storageProvider ?? 'local';
  const showMinio = provider === 'minio' || provider === 'both';
  const showCloudinary = provider === 'cloudinary' || provider === 'both';

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          {tab === 'ha' ? <Webhook className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
          {tab === 'ha' ? 'Home Assistant' : 'Lưu trữ'} — theo tòa nhà
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Mỗi tòa nhà có cấu hình {tab === 'ha' ? 'Home Assistant' : 'lưu trữ ảnh'} riêng.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Building selector */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Chọn tòa nhà</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={buildings.length === 0 ? 'Đang tải...' : '— Chọn tòa nhà —'} />
            </SelectTrigger>
            <SelectContent>
              {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.tenToaNha}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading && <div className="flex justify-center py-4"><RefreshCw className="h-4 w-4 animate-spin text-gray-400" /></div>}

        {/* ── HA fields ── */}
        {selectedId && !loading && tab === 'ha' && (
          <div className="space-y-4">
            {[
              { key: 'haUrl', label: 'Home Assistant URL', placeholder: 'https://ha.myhouse.com hoặc http://192.168.1.x:8123' },
              { key: 'haToken', label: 'Long-lived access token', placeholder: 'eyJ0...' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs font-medium">{f.label}</Label>
                <Input
                  value={settings[f.key] ?? ''}
                  onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-sm"
                />
              </div>
            ))}

            {/* Webhook URL */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Webhook URL</Label>
              <p className="text-[11px] text-gray-400">URL webhook nhận / gửi thông báo HA (local hoặc domain đều dùng được)</p>
              <Input
                value={settings.haWebhookUrl ?? ''}
                onChange={e => setSettings(prev => ({ ...prev, haWebhookUrl: e.target.value }))}
                placeholder="http://192.168.1.x:3000/api/... hoặc https://myapp.com/api/..."
                className="text-sm font-mono"
              />
            </div>

            {/* Thread filter */}
            <div className="space-y-2 border rounded-md p-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">Bộ lọc chuyển tiếp</p>
                <button
                  type="button"
                  onClick={() => setHaThreadEntries(prev => [...prev, { threadId: '', type: 0 }])}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </button>
              </div>
              <p className="text-[11px] text-gray-400">Giới hạn tin nhắn forward đến HA theo Thread ID. Trống = chuyển tiếp tất cả.</p>
              {haThreadEntries.length === 0 && (
                <p className="text-[11px] text-gray-400 italic">Chưa có thread — tất cả tin nhắn sẽ được chuyển tiếp.</p>
              )}
              <div className="space-y-2">
                {haThreadEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Thread ID"
                      value={entry.threadId}
                      onChange={e => setHaThreadEntries(prev => prev.map((x, j) => j === i ? { ...x, threadId: e.target.value } : x))}
                      className="text-xs font-mono flex-1"
                    />
                    <div className="flex gap-1">
                      {[{ val: 0, label: 'User' }, { val: 1, label: 'Nhóm' }].map(({ val, label }) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setHaThreadEntries(prev => prev.map((x, j) => j === i ? { ...x, type: val } : x))}
                          className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${entry.type === val ? (val === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-green-600 text-white border-green-600') : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setHaThreadEntries(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Lưu cài đặt Home Assistant
            </Button>

            {/* Test Webhook */}
            <div className="border-t pt-3 space-y-2">
              <Button size="sm" variant="outline" className="w-full" onClick={handleTestHaWebhook} disabled={haWebhookTestLoading}>
                {haWebhookTestLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Test Webhook
              </Button>
              {haWebhookTestResult && (
                <div className={`rounded-md p-3 text-sm flex items-center gap-2 ${haWebhookTestResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {haWebhookTestResult.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" /> : <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
                  {haWebhookTestResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Storage fields ── */}
        {selectedId && !loading && tab === 'storage' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Nhà cung cấp lưu trữ</Label>
              <Select value={provider} onValueChange={v => setSettings(prev => ({ ...prev, storageProvider: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (máy chủ)</SelectItem>
                  <SelectItem value="minio">MinIO</SelectItem>
                  <SelectItem value="cloudinary">Cloudinary</SelectItem>
                  <SelectItem value="both">Cả hai (MinIO + Cloudinary)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Dung lượng tối đa (MB)</Label>
              <Input
                type="number" min={1} max={100}
                value={settings.uploadMaxSizeMb ?? '10'}
                onChange={e => setSettings(prev => ({ ...prev, uploadMaxSizeMb: e.target.value }))}
                className="text-sm"
              />
            </div>

            {showMinio && (
              <div className="space-y-3 border rounded-md p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600">MinIO</p>

                {/* Endpoint */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Endpoint</Label>
                  <Input
                    value={settings.minioEndpoint ?? ''}
                    onChange={e => { setSettings(prev => ({ ...prev, minioEndpoint: e.target.value })); setMinioBuckets([]); setMinioConnected(false); }}
                    placeholder="http://192.168.1.10:9000"
                    className="text-sm"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Username (Access Key)</Label>
                  <Input
                    value={settings.minioAccessKey ?? ''}
                    onChange={e => { setSettings(prev => ({ ...prev, minioAccessKey: e.target.value })); setMinioBuckets([]); setMinioConnected(false); }}
                    placeholder="minioadmin"
                    className="text-sm"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Password (Secret Key)</Label>
                  <Input
                    type="password"
                    value={settings.minioSecretKey ?? ''}
                    onChange={e => { setSettings(prev => ({ ...prev, minioSecretKey: e.target.value })); setMinioBuckets([]); setMinioConnected(false); }}
                    className="text-sm"
                  />
                </div>

                {/* Nút kết nối */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleMinioConnect}
                  disabled={minioConnecting}
                >
                  {minioConnecting
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Đang kết nối...</>
                    : <><Wifi className="h-3.5 w-3.5 mr-2" />Kết nối</>
                  }
                </Button>
                {minioConnectError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />{minioConnectError}
                  </p>
                )}

                {/* Bucket */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Bucket</Label>
                  {minioBuckets.length > 0 ? (
                    <Select
                      value={settings.minioBucket ?? ''}
                      onValueChange={v => setSettings(prev => ({ ...prev, minioBucket: v }))}
                    >
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue placeholder="Chọn bucket" />
                      </SelectTrigger>
                      <SelectContent>
                        {minioBuckets.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : minioConnected ? (
                    /* Đã kết nối nhưng chưa có bucket → tạo mới */
                    <div className="space-y-2">
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <WifiOff className="h-3.5 w-3.5 shrink-0" />
                        Chưa có bucket nào. Nhập tên để tạo mới.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={newBucketName}
                          onChange={e => setNewBucketName(e.target.value)}
                          placeholder="vd: ql-tro"
                          className="text-sm"
                          onKeyDown={e => { if (e.key === 'Enter') handleMinioCreateBucket(); }}
                        />
                        <Button
                          size="sm"
                          onClick={handleMinioCreateBucket}
                          disabled={creatingBucket || !newBucketName.trim()}
                        >
                          {creatingBucket ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Tạo'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Input
                      value={settings.minioBucket ?? ''}
                      onChange={e => setSettings(prev => ({ ...prev, minioBucket: e.target.value }))}
                      placeholder="ql-tro"
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            )}

            {showCloudinary && (
              <div className="space-y-3 border rounded-md p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600">Cloudinary</p>
                {[
                  { key: 'cloudinaryCloudName', label: 'Cloud Name', placeholder: 'mycloud' },
                  { key: 'cloudinaryApiKey', label: 'API Key', placeholder: '' },
                  { key: 'cloudinaryApiSecret', label: 'API Secret', placeholder: '' },
                  { key: 'cloudinaryPreset', label: 'Upload Preset', placeholder: 'unsigned_preset' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Input
                      value={settings[f.key] ?? ''}
                      onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Lưu cài đặt lưu trữ
            </Button>

            {/* MinIO test connection */}
            {showMinio && (
              <div className="border-t pt-3 space-y-2">
                <Button size="sm" variant="outline" className="w-full" onClick={handleTestMinio} disabled={minioTestLoading}>
                  {minioTestLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Kiểm tra kết nối MinIO
                </Button>
                {minioTestResult && (
                  <div className={`rounded-md p-3 text-sm flex flex-col gap-1 ${minioTestResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-2 font-medium">
                      {minioTestResult.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" /> : <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
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
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Chủ trọ: Bật/tắt đăng nhập khách thuê per tòa nhà ─────────────────────

function ChuNhaDangNhapKTTab() {
  const { data: session } = useSession();
  const [buildings, setBuildings] = useState<{ id: string; tenToaNha: string }[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  // Per-building state: { [toaNhaId]: { adminBat, chuTroBat, gioiHan, soLuongDaBat, loading, saving } }
  const [buildingStates, setBuildingStates] = useState<Record<string, {
    adminBat: boolean; chuTroBat: boolean; gioiHan: number | null; soLuongDaBat: number;
    loading: boolean; saving: boolean;
  }>>({});

  // Chỉ hiện cho chủ trọ có ít nhất 1 tòa nhà admin đã bật
  const [hasAnyEnabled, setHasAnyEnabled] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    // Lấy danh sách tòa nhà của chủ trọ
    fetch('/api/toa-nha')
      .then(r => r.json())
      .then(res => {
        const list = (res.data || res || [])
          .filter((b: { id: string }) => b.id)
          .map((b: { id: string; tenToaNha: string }) => ({ id: b.id, tenToaNha: b.tenToaNha }));
        setBuildings(list);
        // Fetch cài đặt cho từng tòa nhà
        list.forEach((b: { id: string }) => {
          setBuildingStates(prev => ({
            ...prev,
            [b.id]: { adminBat: false, chuTroBat: true, gioiHan: null, soLuongDaBat: 0, loading: true, saving: false },
          }));
          fetch(`/api/toa-nha/${b.id}/dang-nhap-khach-thue`)
            .then(r => r.json())
            .then(res2 => {
              if (res2.success && res2.data) {
                setBuildingStates(prev => ({
                  ...prev,
                  [b.id]: {
                    adminBat: res2.data.adminBatDangNhapKT,
                    chuTroBat: res2.data.chuTroBatDangNhapKT,
                    gioiHan: res2.data.gioiHanDangNhapKT,
                    soLuongDaBat: res2.data.soLuongDaBat ?? 0,
                    loading: false,
                    saving: false,
                  },
                }));
                if (res2.data.adminBatDangNhapKT) setHasAnyEnabled(true);
              } else {
                setBuildingStates(prev => ({
                  ...prev,
                  [b.id]: { ...prev[b.id], loading: false },
                }));
              }
            })
            .catch((err) => {
              console.error(`[ChuNhaDangNhapKTTab] Lỗi fetch cài đặt tòa nhà ${b.id}:`, err);
              setBuildingStates(prev => ({
                ...prev,
                [b.id]: { ...prev[b.id], loading: false },
              }));
            });
        });
      })
      .catch(() => {})
      .finally(() => setLoadingBuildings(false));
  }, [session?.user?.id]);

  async function handleToggle(toaNhaId: string, newVal: boolean) {
    setBuildingStates(prev => ({
      ...prev,
      [toaNhaId]: { ...prev[toaNhaId], saving: true },
    }));
    try {
      const res = await fetch(`/api/toa-nha/${toaNhaId}/dang-nhap-khach-thue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chuTroBatDangNhapKT: newVal }),
      });
      const json = await res.json();
      if (json.success) {
        setBuildingStates(prev => ({
          ...prev,
          [toaNhaId]: { ...prev[toaNhaId], chuTroBat: newVal, saving: false },
        }));
        toast.success(newVal ? 'Đã bật đăng nhập khách thuê' : 'Đã tắt đăng nhập khách thuê');
      } else {
        toast.error(json.error || 'Thao tác thất bại');
        setBuildingStates(prev => ({
          ...prev,
          [toaNhaId]: { ...prev[toaNhaId], saving: false },
        }));
      }
    } catch {
      toast.error('Lỗi kết nối');
      setBuildingStates(prev => ({
        ...prev,
        [toaNhaId]: { ...prev[toaNhaId], saving: false },
      }));
    }
  }

  if (loadingBuildings) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 text-sm">Đang tải...</span>
      </div>
    );
  }

  // Hiện thông báo nếu admin chưa bật cho bất kỳ tòa nhà nào
  if (!hasAnyEnabled) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Admin chưa bật tính năng đăng nhập web cho tòa nhà nào.</p>
          <p className="text-xs text-gray-400 mt-1">Liên hệ admin để bật tính năng này.</p>
        </CardContent>
      </Card>
    );
  }

  const enabledBuildings = buildings.filter(b => buildingStates[b.id]?.adminBat);

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Users className="h-4 w-4 md:h-5 md:w-5" />
          Đăng nhập web khách thuê
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Bật/tắt cho phép khách thuê đăng nhập web xem hóa đơn, báo sự cố... theo từng tòa nhà
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-3">
        {enabledBuildings.map(b => {
          const state = buildingStates[b.id];
          if (!state || state.loading) return (
            <div key={b.id} className="flex items-center gap-2 py-2">
              <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">{b.tenToaNha}...</span>
            </div>
          );
          return (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{b.tenToaNha}</Label>
                <p className="text-xs text-gray-500">
                  {state.soLuongDaBat} đã kích hoạt
                  {state.gioiHan !== null && <> / {state.gioiHan} giới hạn</>}
                </p>
              </div>
              <Switch
                checked={state.chuTroBat}
                onCheckedChange={val => handleToggle(b.id, val)}
                disabled={state.saving}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Admin: Quản lý đăng nhập khách thuê per tòa nhà ────────────────────────

function AdminDangNhapKTPanel() {
  const [buildings, setBuildings] = useState<{ id: string; tenToaNha: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adminBat, setAdminBat] = useState(false);
  const [gioiHan, setGioiHan] = useState<string>('');
  const [chuTroBat, setChuTroBat] = useState(false);
  const [soLuongDaBat, setSoLuongDaBat] = useState(0);

  useEffect(() => {
    fetch('/api/admin/toa-nha-settings')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const list = res.data.map((b: { id: string; tenToaNha: string }) => ({ id: b.id, tenToaNha: b.tenToaNha }));
          setBuildings(list);
          if (list.length > 0) setSelectedId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/toa-nha/${selectedId}/dang-nhap-khach-thue`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setAdminBat(res.data.adminBatDangNhapKT);
          setGioiHan(res.data.gioiHanDangNhapKT !== null ? String(res.data.gioiHanDangNhapKT) : '');
          setChuTroBat(res.data.chuTroBatDangNhapKT);
          setSoLuongDaBat(res.data.soLuongDaBat ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function handleSave() {
    if (!selectedId) { toast.error('Vui lòng chọn tòa nhà'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        toaNhaId: selectedId,
        adminBatDangNhapKT: adminBat,
        gioiHanDangNhapKT: gioiHan === '' ? null : Number(gioiHan),
      };
      const res = await fetch('/api/admin/toa-nha-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã lưu cài đặt đăng nhập khách thuê');
        // Khi admin tắt → chuTroBat cũng bị tắt
        if (!adminBat) setChuTroBat(false);
      } else {
        toast.error(json.error || 'Lưu thất bại');
      }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Users className="h-4 w-4 md:h-5 md:w-5" />
          Quản lý đăng nhập web khách thuê
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Bật/tắt tính năng đăng nhập web cho khách thuê theo từng tòa nhà. Admin bật = mặc định cho phép. Chủ trọ có thể tắt thêm nếu muốn.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
        {/* Chọn tòa nhà */}
        {buildings.length > 1 && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Chọn tòa nhà</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn tòa nhà" /></SelectTrigger>
              <SelectContent>
                {buildings.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.tenToaNha}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500 text-sm">Đang tải...</span>
          </div>
        ) : (
          <>
            {/* Toggle admin bật đăng nhập KT */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Cho phép đăng nhập web khách thuê</Label>
                <p className="text-xs text-gray-500">
                  Bật = khách thuê tòa nhà này được đăng nhập web. Chủ trọ có thể tắt thêm nếu muốn.
                </p>
              </div>
              <Switch checked={adminBat} onCheckedChange={setAdminBat} />
            </div>

            {/* Giới hạn số lượng */}
            {adminBat && (
              <div className="space-y-2 p-3 rounded-lg border">
                <Label className="text-sm font-medium">Giới hạn số khách thuê được đăng nhập</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Không giới hạn"
                    value={gioiHan}
                    onChange={e => setGioiHan(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-xs text-gray-500">
                    (để trống = không giới hạn)
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Hiện tại: <span className="font-medium">{soLuongDaBat}</span> khách thuê đã kích hoạt
                  {gioiHan !== '' && <> / <span className="font-medium">{gioiHan}</span> giới hạn</>}
                </p>
              </div>
            )}

            {/* Trạng thái */}
            {adminBat && (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Đăng nhập web khách thuê đang hoạt động{!chuTroBat && ' (chủ trọ đã tắt — khách thuê sẽ không đăng nhập được)'}
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !selectedId} size="sm">
                {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu cài đặt
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── AdminAiSettingsPanel ──────────────────────────────────────────────────────

function AdminAiSettingsPanel({
  items,
  values,
  onChange,
  onSave,
  saving,
}: {
  items: CaiDatItem[];
  values: Record<string, string>;
  onChange: (khoa: string, val: string) => void;
  onSave: (nhom: string) => void;
  saving: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');

  const provider = values['ai_provider'] ?? 'none';
  const apiKey   = values['ai_api_key']  ?? '';
  const baseUrl  = values['ai_base_url'] ?? '';
  const model    = values['ai_model']    ?? '';

  async function handleFetchModels() {
    setLoadingModels(true);
    setModelError('');
    setModels([]);
    try {
      const res = await fetch('/api/admin/ai-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, baseUrl }),
      });
      const data = await res.json();
      if (data.models?.length) {
        setModels(data.models);
        toast.success(`Tìm thấy ${data.models.length} model`);
      } else {
        setModelError(data.error ?? 'Không tìm thấy model nào');
      }
    } catch {
      setModelError('Lỗi kết nối');
    }
    setLoadingModels(false);
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Bot className="h-4 w-4 md:h-5 md:w-5" />
          Cấu hình AI
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Thiết lập nhà cung cấp AI, API key và model. Hỗ trợ OpenAI, Gemini và các API tương thích OpenAI.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-5">

        {/* Provider */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Nhà cung cấp AI</Label>
          <Select value={provider} onValueChange={v => onChange('ai_provider', v)}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tắt AI</SelectItem>
              <SelectItem value="openai">OpenAI / OpenAI-compatible</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* API Key */}
        {provider !== 'none' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => onChange('ai_api_key', e.target.value)}
                placeholder={provider === 'gemini' ? 'AIza...' : 'sk-...'}
                className="pr-9 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey
                  ? <Eye className="h-4 w-4" />
                  : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Base URL — chỉ OpenAI */}
        {provider === 'openai' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Base URL <span className="text-gray-400 font-normal">(để trống = dùng api.openai.com)</span>
            </Label>
            <Input
              value={baseUrl}
              onChange={e => onChange('ai_base_url', e.target.value)}
              placeholder="http://localhost:5001"
              className="text-sm font-mono"
            />
          </div>
        )}

        {/* Model */}
        {provider !== 'none' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Model</Label>
            <div className="flex gap-2">
              {models.length > 0 ? (
                <Select value={model} onValueChange={v => onChange('ai_model', v)}>
                  <SelectTrigger className="text-sm flex-1"><SelectValue placeholder="Chọn model" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {models.map(m => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={model}
                  onChange={e => onChange('ai_model', e.target.value)}
                  placeholder={provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'}
                  className="text-sm font-mono flex-1"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchModels}
                disabled={loadingModels || !apiKey || provider === 'none'}
                className="shrink-0"
                title="Tải danh sách model từ API"
              >
                {loadingModels
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Tải model</span>
              </Button>
            </div>
            {modelError && <p className="text-xs text-red-500">{modelError}</p>}
            {models.length > 0 && (
              <p className="text-xs text-gray-500">{models.length} model khả dụng — nhập tay hoặc chọn từ danh sách.</p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => onSave('ai')} disabled={saving} size="sm">
            {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Lưu cài đặt AI
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AdminAiAccountsPanel ──────────────────────────────────────────────────────

interface AiAccount {
  id: string;
  ten: string;
  email: string | null;
  soDienThoai: string | null;
  vaiTro: string;
  vaiTroLabel: string;
  trangThai: string;
  aiEnabled: boolean;
}

function AdminAiAccountsPanel() {
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/ai-accounts')
      .then(r => r.json())
      .then(res => { if (res.success) setAccounts(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleAi(userId: string, current: boolean) {
    setSaving(userId);
    try {
      const res = await fetch('/api/admin/ai-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, aiEnabled: !current }),
      });
      const json = await res.json();
      if (json.success) {
        setAccounts(prev => prev.map(a => a.id === userId ? { ...a, aiEnabled: !current } : a));
        toast.success(!current ? 'Đã kích hoạt AI' : 'Đã tắt AI');
      } else {
        toast.error('Lưu thất bại');
      }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setSaving(null); }
  }

  const grouped = accounts.reduce<Record<string, AiAccount[]>>((acc, a) => {
    if (!acc[a.vaiTroLabel]) acc[a.vaiTroLabel] = [];
    acc[a.vaiTroLabel].push(a);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Bot className="h-4 w-4 md:h-5 md:w-5" />
          Kích hoạt AI theo tài khoản
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Bật/tắt tính năng trợ lý AI cho từng tài khoản trong hệ thống. Admin luôn có quyền dùng AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500 text-sm">Đang tải...</span>
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Chưa có tài khoản nào.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([label, list]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</p>
                <div className="space-y-2">
                  {list.map(account => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${account.trangThai === 'hoatDong' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{account.ten}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {account.email ?? account.soDienThoai ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {account.aiEnabled && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
                            AI bật
                          </Badge>
                        )}
                        <Switch
                          checked={account.aiEnabled}
                          disabled={saving === account.id}
                          onCheckedChange={() => toggleAi(account.id, account.aiEnabled)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CaiDatPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isChuNha = session?.user?.role === "chuNha" || session?.user?.role === "dongChuTro";
  // Admin quản lý HA + lưu trữ theo tòa nhà; chuNha quản lý thanh toán + cảnh báo + hệ thống
  const canManage = isAdmin || isChuNha;

  // --- Cài đặt giao diện (cho tất cả users) ---
  const [fontSettings, setFontSettings] = useState({
    fontFamily: "Inter",
    fontSize: "medium",
    lineHeight: "normal",
    fontWeight: "normal",
  });
  const [uiSettings, setUiSettings] = useState({
    theme: "light",
    density: "comfortable",
  });

  useEffect(() => {
    document.title = "Cài đặt";
    const savedFont = localStorage.getItem("fontSettings");
    if (savedFont) setFontSettings(JSON.parse(savedFont));
    const savedUi = localStorage.getItem("uiSettings");
    if (savedUi) {
      const ui = JSON.parse(savedUi);
      setUiSettings(ui);
      applyTheme(ui.theme);
      applyDensity(ui.density);
    }
  }, []);

  function applyFontSettings() {
    const fontSizeMap: Record<string, string> = {
      small: "14px",
      medium: "16px",
      large: "18px",
      "extra-large": "20px",
    };
    const lineHeightMap: Record<string, string> = {
      tight: "1.2",
      normal: "1.5",
      relaxed: "1.75",
      loose: "2",
    };
    // Quote multi-word font names for CSS
    const fontValue = fontSettings.fontFamily.includes(" ")
      ? `'${fontSettings.fontFamily}'`
      : fontSettings.fontFamily;
    // Override CSS variables so Tailwind font-sans (var(--font-geist-sans)) also updates
    document.documentElement.style.setProperty("--font-geist-sans", fontValue);
    document.documentElement.style.setProperty("--font-family", fontValue);
    document.body.style.fontFamily = fontValue;
    document.body.style.fontSize = fontSizeMap[fontSettings.fontSize];
    document.body.style.lineHeight = lineHeightMap[fontSettings.lineHeight];
  }

  function applyTheme(theme: string) {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else if (theme === "light")
      document.documentElement.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }

  function applyDensity(density: string) {
    document.body.classList.remove(
      "density-compact",
      "density-comfortable",
      "density-spacious",
    );
    document.body.classList.add(`density-${density}`);
  }

  function handleSaveFontSettings() {
    localStorage.setItem("fontSettings", JSON.stringify(fontSettings));
    applyFontSettings();
    toast.success("Đã lưu cài đặt font chữ");
  }

  function handleThemeChange(theme: string) {
    const newUi = { ...uiSettings, theme };
    setUiSettings(newUi);
    applyTheme(theme);
    localStorage.setItem("uiSettings", JSON.stringify(newUi));
    toast.success("Đã lưu giao diện");
  }

  function handleDensityChange(density: string) {
    const newUi = { ...uiSettings, density };
    setUiSettings(newUi);
    applyDensity(density);
    localStorage.setItem("uiSettings", JSON.stringify(newUi));
    toast.success("Đã lưu mật độ hiển thị");
  }

  // --- Cài đặt hệ thống (chỉ admin) ---
  const [systemSettings, setSystemSettings] = useState<CaiDatItem[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>(
    {},
  );
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [errorSystem, setErrorSystem] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  useEffect(() => {
    if (canManage) fetchSystemSettings();
  }, [canManage]);

  async function fetchSystemSettings() {
    setLoadingSystem(true);
    setErrorSystem(null);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setSystemSettings(data.data);
        const vals: Record<string, string> = {};
        for (const s of data.data) vals[s.khoa] = s.giaTri ?? "";
        setSettingValues(vals);
      } else if (res.status === 403) {
        setErrorSystem(
          "Không có quyền truy cập (403). Vui lòng đăng xuất và đăng nhập lại.",
        );
        toast.error("Không có quyền truy cập cài đặt hệ thống");
      } else {
        setErrorSystem(
          `Lỗi máy chủ (HTTP ${res.status}): ${data.message ?? "Không xác định"}. Kiểm tra log PM2.`,
        );
        toast.error(`Lỗi tải cài đặt (${res.status})`);
      }
    } catch {
      setErrorSystem(
        "Không thể kết nối cơ sở dữ liệu. Kiểm tra PostgreSQL đang chạy.",
      );
      toast.error("Lỗi kết nối cơ sở dữ liệu");
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
        giaTri: settingValues[s.khoa] ?? "",
      }));

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        // Reload để cập nhật mask cho bí mật
        await fetchSystemSettings();
      } else {
        toast.error(data.message || "Lưu thất bại");
      }
    } catch {
      toast.error("Lỗi khi lưu cài đặt");
    } finally {
      setSavingGroup(null);
    }
  }

  // --- Gửi test Zalo ---
  const [testChatId, setTestChatId] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Tin nhắn test từ hệ thống Quản Lý Trọ 🏠",
  );
  const [testType, setTestType] = useState<"text" | "image" | "file">("text");
  const [testThreadType, setTestThreadType] = useState<0 | 1>(0);
  function switchTestType(type: "text" | "image" | "file") {
    setTestType(type);
    // Xóa caption mặc định khi chuyển sang tab hình ảnh/file
    if (type !== "text") setTestMessage("");
    else if (!testMessage)
      setTestMessage("Tin nhắn test từ hệ thống Quản Lý Trọ 🏠");
  }
  const [testImageUrl, setTestImageUrl] = useState("");
  const [testFileUrl, setTestFileUrl] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testUploading, setTestUploading] = useState(false);
  const testFileInputRef = useRef<HTMLInputElement>(null);

  /** Upload file từ máy lên MinIO, trả về URL */
  async function handleTestUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTestUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "test");
      if (testType === "file") formData.append("type", "file");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.data?.secure_url) {
        toast.error(data?.message || "Upload thất bại");
        return;
      }
      const url = data.data.secure_url;
      if (testType === "image") setTestImageUrl(url);
      else setTestFileUrl(url);
      toast.success("Upload thành công — đã lưu vào MinIO");
    } catch (err: any) {
      toast.error(err?.message || "Lỗi upload");
    } finally {
      setTestUploading(false);
      if (testFileInputRef.current) testFileInputRef.current.value = "";
    }
  }

  // MinIO file browser
  const [minioBrowserOpen, setMinioBrowserOpen] = useState(false);
  const [minioFiles, setMinioFiles] = useState<
    { name: string; size: number; lastModified: Date; url: string }[]
  >([]);
  const [minioFilesLoading, setMinioFilesLoading] = useState(false);
  const [minioPrefix, setMinioPrefix] = useState("");

  async function loadMinioFiles(prefix = minioPrefix) {
    setMinioFilesLoading(true);
    try {
      const res = await fetch(
        `/api/minio/files?prefix=${encodeURIComponent(prefix)}&limit=100`,
      );
      const data = await res.json();
      if (data.success) setMinioFiles(data.files ?? []);
      else toast.error(data.error || "Lỗi tải file MinIO");
    } catch {
      toast.error("Lỗi kết nối");
    } finally {
      setMinioFilesLoading(false);
    }
  }

  function openMinioBrowser() {
    setMinioBrowserOpen(true);
    loadMinioFiles();
  }

  function selectMinioFile(file: { name: string; url: string }) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name);
    if (testType === "image" || isImage) {
      setTestImageUrl(file.url);
      if (isImage) setTestType("image");
    } else {
      setTestFileUrl(file.url);
      setTestType("file");
    }
    setMinioBrowserOpen(false);
    toast.success(`Đã chọn: ${file.name.split("/").pop()}`);
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSendTest() {
    if (!testChatId.trim()) {
      toast.error("Vui lòng nhập Chat ID");
      return;
    }
    if (testType === "image" && !testImageUrl.trim()) {
      toast.error("Vui lòng nhập URL hình ảnh");
      return;
    }
    if (testType === "file" && !testFileUrl.trim()) {
      toast.error("Vui lòng nhập URL file");
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const payload: Record<string, string | number> = {
        chatId: testChatId.trim(),
        threadType: testThreadType,
      };
      if (testType === "image") {
        payload.imageUrl = testImageUrl.trim();
        if (testMessage) payload.message = testMessage;
      } else if (testType === "file") {
        payload.fileUrl = testFileUrl.trim();
        if (testMessage) payload.message = testMessage;
      } else {
        payload.message = testMessage || "Test message";
      }
      const res = await fetch("/api/gui-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setTestResult({ ok: true, message: data.message || "Gửi thành công!" });
        toast.success("Đã gửi thành công");
      } else {
        const errMsg = data.error || data.message || `HTTP ${res.status}`;
        setTestResult({ ok: false, message: errMsg });
        toast.error(`Gửi thất bại: ${errMsg}`);
      }
    } catch {
      setTestResult({ ok: false, message: "Lỗi kết nối máy chủ" });
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setTestLoading(false);
    }
  }

  // --- Theo dõi tin nhắn: expand raw payload ---
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  async function handleClearMessages() {
    if (!confirm("Xóa tất cả tin nhắn đã nhận?")) return;
    try {
      await fetch("/api/zalo/messages", { method: "DELETE" });
      setWebhookMessages([]);
      toast.success("Đã xóa tất cả tin nhắn");
    } catch {
      toast.error("Lỗi xóa tin nhắn");
    }
  }

  // --- Webhook ID (giống HA) ---
  const [currentWebhookId, setCurrentWebhookId] = useState<string | null>(null);
  const [webhookIdGenerating, setWebhookIdGenerating] = useState(false);
  const [webhookBaseUrl, setWebhookBaseUrl] = useState("");
  const [webhookDomainUrl, setWebhookDomainUrl] = useState("");

  // Load webhook ID hiện tại + init base URL từ app_local_url
  useEffect(() => {
    if (!canManage) return;
    fetch("/api/webhook/generate")
      .then((r) => r.json())
      .then((d) => {
        if (d.webhookId) setCurrentWebhookId(d.webhookId);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  // Sync webhookBaseUrl + webhookDomainUrl khi settingValues load xong
  useEffect(() => {
    const savedLocal = settingValues["app_local_url"]?.trim();
    const savedDomain = settingValues["app_domain_url"]?.trim();
    if (savedLocal) {
      setWebhookBaseUrl(savedLocal.replace(/\/$/, ""));
    } else if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === "localhost";
      if (isIP) {
        setWebhookBaseUrl(window.location.origin);
      }
    }
    if (savedDomain) {
      setWebhookDomainUrl(savedDomain.replace(/\/$/, ""));
    } else if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === "localhost";
      if (!isIP) {
        // Đang truy cập qua domain → auto-detect domain
        setWebhookDomainUrl(window.location.origin);
      }
    }
  }, [settingValues]);

  // Tính webhook full URL (IP LAN)
  const webhookFullUrl =
    currentWebhookId && webhookBaseUrl
      ? `${webhookBaseUrl}/api/webhook/${currentWebhookId}`
      : "";

  // Tính webhook domain URL
  const webhookDomainFullUrl =
    currentWebhookId && webhookDomainUrl
      ? `${webhookDomainUrl}/api/webhook/${currentWebhookId}`
      : "";

  // Lưu app_local_url khi user thay đổi base URL
  async function handleSaveBaseUrl(url: string) {
    const clean = url.trim().replace(/\/$/, "");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [{ khoa: "app_local_url", giaTri: clean }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingValues((prev) => ({ ...prev, app_local_url: clean }));
        toast.success("Đã lưu URL LAN");
      } else {
        toast.error(data.message || "Lưu thất bại");
      }
    } catch {
      toast.error("Lỗi lưu cài đặt");
    }
  }

  // Lưu app_domain_url khi user thay đổi domain URL
  async function handleSaveDomainUrl(url: string) {
    const clean = url.trim().replace(/\/$/, "");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [{ khoa: "app_domain_url", giaTri: clean }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingValues((prev) => ({ ...prev, app_domain_url: clean }));
        toast.success("Đã lưu URL domain");
      } else {
        toast.error(data.message || "Lưu thất bại");
      }
    } catch {
      toast.error("Lỗi lưu cài đặt");
    }
  }

  async function handleGenerateWebhookId(customId?: string) {
    if (currentWebhookId && !confirm(customId ? "Thay đổi Webhook ID sẽ vô hiệu URL cũ. Tiếp tục?" : "Tạo ID mới sẽ vô hiệu URL cũ. Tiếp tục?"))
      return;
    setWebhookIdGenerating(true);
    try {
      const res = await fetch("/api/webhook/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: customId ? JSON.stringify({ webhookId: customId }) : undefined,
      });
      const data = await res.json();
      if (data.success && data.webhookId) {
        setCurrentWebhookId(data.webhookId);
        toast.success(customId ? "Đã lưu Webhook ID" : "Đã tạo Webhook ID mới");
      } else {
        toast.error(data.error || "Tạo thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối");
    } finally {
      setWebhookIdGenerating(false);
    }
  }

  // --- Test webhook nhận tin ---
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleTestWebhook() {
    setWebhookTestLoading(true);
    setWebhookTestResult(null);
    try {
      const fakePayload = {
        type: 0,
        threadId: "test_thread_" + Date.now(),
        isSelf: false,
        data: {
          uidFrom: "test_user",
          dName: "[Test] Webhook Check",
          msgType: "webchat",
          content: "Tin nhắn test webhook — kiểm tra nhận thành công!",
          ts: String(Date.now()),
        },
        _accountId: "test",
      };

      // Ưu tiên test qua webhook ID mới (giống HA), fallback sang endpoint cũ
      const testUrl = currentWebhookId
        ? `/api/webhook/${currentWebhookId}`
        : "/api/zalo/webhook";

      const res = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fakePayload),
      });
      if (res.ok) {
        setWebhookTestResult({
          ok: true,
          message: `Webhook nhận được qua ${currentWebhookId ? "/api/webhook/[id]" : "/api/zalo/webhook"}! Kiểm tra "Theo dõi tin nhắn".`,
        });
        toast.success("Webhook đang hoạt động");
      } else {
        setWebhookTestResult({
          ok: false,
          message: `HTTP ${res.status} — webhook không phản hồi`,
        });
        toast.error("Webhook không phản hồi");
      }
    } catch {
      setWebhookTestResult({ ok: false, message: "Lỗi kết nối" });
      toast.error("Lỗi kết nối");
    } finally {
      setWebhookTestLoading(false);
    }
  }

  // --- Zalo Bot Server ---
  const [botStatus, setBotStatus] = useState<any>(null);
  const [botStatusLoading, setBotStatusLoading] = useState(false);
  const [botQR, setBotQR] = useState<string | null>(null);
  const [botQRLoading, setBotQRLoading] = useState(false);
  const [botWebhookResult, setBotWebhookResult] = useState<any>(null);
  const [botWebhookLoading, setBotWebhookLoading] = useState(false);
  const [botWebhookUrl, setBotWebhookUrl] = useState("");

  // Load URL đã lưu từ lần cài bot webhook thành công trước (zalo_webhook_url trong DB)
  useEffect(() => {
    if (!canManage) return;
    fetch("/api/zalo-bot/saved-webhook-url")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        const url: string = d.webhookUrl || "";
        const isBotUrl = url.includes("/api/webhook/") || url.includes("/api/zalowebhook/");
        if (isBotUrl) setBotWebhookUrl(url);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  // Khi webhookFullUrl thay đổi (IP LAN + webhook ID), cập nhật botWebhookUrl
  useEffect(() => {
    if (webhookFullUrl) {
      setBotWebhookUrl(webhookFullUrl);
    }
  }, [webhookFullUrl]);

  async function handleBotStatus() {
    setBotStatusLoading(true);
    setBotQR(null);
    try {
      const res = await fetch("/api/zalo-bot/status");
      const data = await res.json();
      setBotStatus(data);
      if (!data.ok) toast.error(data.error || "Không kết nối được bot server");
    } catch {
      toast.error("Lỗi kết nối");
    } finally {
      setBotStatusLoading(false);
    }
  }

  async function handleBotQR() {
    setBotQRLoading(true);
    setBotQR(null);
    try {
      const res = await fetch("/api/zalo-bot/qr", { method: "POST" });
      const data = await res.json();
      if (data.ok && data.qrCode) {
        setBotQR(data.qrCode);
      } else {
        toast.error(data.error || "Không lấy được QR code");
      }
    } catch {
      toast.error("Lỗi kết nối");
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
      const res = await fetch("/api/zalo-bot/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setBotWebhookResult(data);
      if (data.ok) {
        toast.success("Đã cài webhook trên bot server");
        if (data.webhookUrl) setBotWebhookUrl(data.webhookUrl);
      } else {
        toast.error(data.error || "Cài webhook thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối");
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
      const res = await fetch("/api/zalo/messages?conversations=1");
      const data = await res.json();
      if (data.data) setWebhookMessages(data.data);
    } catch {
      toast.error("Không thể tải tin nhắn webhook");
    } finally {
      setWebhookMsgLoading(false);
    }
  }

  // SSE: tự động cập nhật khi có tin nhắn mới (không cần bấm nút)
  useEffect(() => {
    if (!canManage) return;
    loadWebhookMessages();

    let retryDelay = 2000;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      const es = new EventSource("/api/zalo/messages/stream");
      es.onopen = () => {
        retryDelay = 2000;
      };
      es.onerror = () => {
        es.close();
        timer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30_000);
          connect();
        }, retryDelay);
      };
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type !== "messages") return;
          const newMsgs: any[] = payload.data;
          setWebhookMessages((prev) => {
            const map = new Map(prev.map((m: any) => [m.chatId, m]));
            for (const m of newMsgs) {
              const existing = map.get(m.chatId);
              if (
                !existing ||
                new Date(m.createdAt) > new Date(existing.createdAt)
              ) {
                // Giữ lại roomInfo từ message cũ nếu SSE không có
                if (existing?.roomInfo && !m.roomInfo) {
                  m.roomInfo = existing.roomInfo;
                }
                map.set(m.chatId, m);
              }
            }
            return Array.from(map.values()).sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          });
        } catch {
          /* ignore */
        }
      };
      return es;
    }

    const es = connect();
    return () => {
      clearTimeout(timer);
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  // Nhóm các cài đặt
  const settingsByGroup = systemSettings.reduce<Record<string, CaiDatItem[]>>(
    (acc, s) => {
      if (!acc[s.nhom]) acc[s.nhom] = [];
      acc[s.nhom].push(s);
      return acc;
    },
    {},
  );

  const groupOrder = ["luuTru", "thongBao", "thanhToan", "heThong", "baoMat", "ai"];

  const alertItems = (settingsByGroup["thongBao"] ?? []).filter((s) =>
    ALERT_KEYS.has(s.khoa),
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">
          Cài đặt
        </h1>
        <p className="text-xs md:text-sm text-gray-600">
          Tùy chỉnh giao diện{canManage ? " và cài đặt hệ thống" : ""}
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? "homeAssistant" : isChuNha ? "thanhToan" : "display"}>
        <TabsList className="flex flex-wrap h-auto gap-1 w-full md:w-auto">
          {/* Admin: Home Assistant + Lưu trữ (per tòa nhà) */}
          {isAdmin && (
            <>
              <TabsTrigger
                value="homeAssistant"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <Webhook className="h-3.5 w-3.5" />
                Home Assistant
              </TabsTrigger>
              <TabsTrigger
                value="luuTru"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <HardDrive className="h-3.5 w-3.5" />
                Lưu trữ
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <Bot className="h-3.5 w-3.5" />
                AI
              </TabsTrigger>
              <TabsTrigger
                value="dangNhapKT"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <Users className="h-3.5 w-3.5" />
                Đăng nhập KT
              </TabsTrigger>
            </>
          )}
          {/* Chủ trọ: Thanh toán + Cảnh báo + Hệ thống */}
          {isChuNha && (
            <>
              <TabsTrigger
                value="thanhToan"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Thanh toán
              </TabsTrigger>
              <TabsTrigger
                value="canhBao"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <Clock className="h-3.5 w-3.5" />
                Cảnh báo
              </TabsTrigger>
              <TabsTrigger
                value="heThong"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <Shield className="h-3.5 w-3.5" />
                Hệ thống
              </TabsTrigger>
              <TabsTrigger
                value="dangNhapKT"
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <Users className="h-3.5 w-3.5" />
                Đăng nhập KT
              </TabsTrigger>
            </>
          )}
          <TabsTrigger
            value="display"
            className="flex items-center gap-1.5 text-xs md:text-sm"
          >
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
                <span className="ml-2 text-gray-500">
                  Đang tải cài đặt hệ thống...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="rounded-full bg-red-50 p-4">
                  <Settings className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    Không thể tải cài đặt
                  </p>
                  <p className="text-sm text-red-500 mt-1">{errorSystem}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSystemSettings}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Thử lại
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Thanh toán ─────────────────────────────────────────────────── */}
        {isChuNha && !loadingSystem && !errorSystem && (
          <TabsContent value="thanhToan" className="space-y-4 mt-4">
            {settingsByGroup["thanhToan"]?.length ? (
              <SettingGroupCard
                nhom="thanhToan"
                items={settingsByGroup["thanhToan"]}
                values={settingValues}
                onChange={handleSettingChange}
                onSave={handleSaveGroup}
                saving={savingGroup === "thanhToan"}
              />
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">
                Chưa có cài đặt thanh toán nào.
              </p>
            )}
          </TabsContent>
        )}

        {/* ── Tab Cảnh báo ──────────────────────────────────────────────────── */}
        {isChuNha && !loadingSystem && !errorSystem && (
          <TabsContent value="canhBao" className="space-y-4 mt-4">
            {alertItems.length > 0 ? (
              <AlertSettingsCard
                items={alertItems}
                values={settingValues}
                onChange={handleSettingChange}
                onSave={() => handleSaveGroup("thongBao")}
                saving={savingGroup === "thongBao"}
              />
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">
                Chưa có cài đặt cảnh báo nào.
              </p>
            )}
            <ZaloWebhookCard
              currentWebhookId={currentWebhookId}
              webhookBaseUrl={webhookBaseUrl}
              webhookDomainUrl={webhookDomainUrl}
              webhookFullUrl={webhookFullUrl}
              webhookDomainFullUrl={webhookDomainFullUrl}
              webhookIdGenerating={webhookIdGenerating}
              webhookTestLoading={webhookTestLoading}
              webhookTestResult={webhookTestResult}
              botWebhookUrl={botWebhookUrl}
              botWebhookLoading={botWebhookLoading}
              botWebhookResult={botWebhookResult}
              onChangeBaseUrl={setWebhookBaseUrl}
              onChangeDomainUrl={setWebhookDomainUrl}
              onSaveBaseUrl={handleSaveBaseUrl}
              onSaveDomainUrl={handleSaveDomainUrl}
              onGenerate={handleGenerateWebhookId}
              onTest={handleTestWebhook}
              onChangeBotUrl={setBotWebhookUrl}
              onSetBotWebhook={() => handleBotSetWebhook()}
            />
          </TabsContent>
        )}


        {/* ── Tab Home Assistant ──────────────────────────────────────────────── */}
        {isAdmin && !loadingSystem && !errorSystem && (
          <TabsContent value="homeAssistant" className="space-y-4 mt-4">
            <AdminToaNhaSettingsPanel tab="ha" />
            <ZaloWebhookCard
              currentWebhookId={currentWebhookId}
              webhookBaseUrl={webhookBaseUrl}
              webhookDomainUrl={webhookDomainUrl}
              webhookFullUrl={webhookFullUrl}
              webhookDomainFullUrl={webhookDomainFullUrl}
              webhookIdGenerating={webhookIdGenerating}
              webhookTestLoading={webhookTestLoading}
              webhookTestResult={webhookTestResult}
              botWebhookUrl={botWebhookUrl}
              botWebhookLoading={botWebhookLoading}
              botWebhookResult={botWebhookResult}
              onChangeBaseUrl={setWebhookBaseUrl}
              onChangeDomainUrl={setWebhookDomainUrl}
              onSaveBaseUrl={handleSaveBaseUrl}
              onSaveDomainUrl={handleSaveDomainUrl}
              onGenerate={handleGenerateWebhookId}
              onTest={handleTestWebhook}
              onChangeBotUrl={setBotWebhookUrl}
              onSetBotWebhook={() => handleBotSetWebhook()}
            />
          </TabsContent>
        )}

        {/* ── Tab Lưu trữ ───────────────────────────────────────────────────── */}
        {isAdmin && !loadingSystem && !errorSystem && (
          <TabsContent value="luuTru" className="space-y-4 mt-4">
            <AdminToaNhaSettingsPanel tab="storage" />
          </TabsContent>
        )}

        {/* ── Tab AI (chỉ admin) ─────────────────────────────────────────────── */}
        {isAdmin && !loadingSystem && !errorSystem && (
          <TabsContent value="ai" className="space-y-4 mt-4">
            <AdminAiSettingsPanel
              items={settingsByGroup["ai"] ?? []}
              values={settingValues}
              onChange={handleSettingChange}
              onSave={handleSaveGroup}
              saving={savingGroup === "ai"}
            />
            <AdminAiAccountsPanel />
          </TabsContent>
        )}

        {/* ── Tab Đăng nhập khách thuê (admin) ───────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="dangNhapKT" className="space-y-4 mt-4">
            <AdminDangNhapKTPanel />
          </TabsContent>
        )}

        {/* ── Tab Hệ thống — chủ trọ: thông tin công ty riêng ─────────────── */}
        {isChuNha && !loadingSystem && (
          <TabsContent value="heThong" className="space-y-4 mt-4">
            <ChuNhaHeThongTab />
          </TabsContent>
        )}

        {/* ── Tab Đăng nhập khách thuê (chủ trọ) ────────────────────────────── */}
        {isChuNha && (
          <TabsContent value="dangNhapKT" className="space-y-4 mt-4">
            <ChuNhaDangNhapKTTab />
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
                    onValueChange={(v) =>
                      setFontSettings((p) => ({ ...p, fontFamily: v }))
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Inter",
                        "Roboto",
                        "Open Sans",
                        "Lato",
                        "Montserrat",
                        "Poppins",
                        "Nunito",
                        "Times New Roman",
                      ].map((f) => (
                        <SelectItem key={f} value={f} className="text-sm">
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Cỡ chữ</Label>
                  <Select
                    value={fontSettings.fontSize}
                    onValueChange={(v) =>
                      setFontSettings((p) => ({ ...p, fontSize: v }))
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small" className="text-sm">
                        Nhỏ
                      </SelectItem>
                      <SelectItem value="medium" className="text-sm">
                        Trung bình
                      </SelectItem>
                      <SelectItem value="large" className="text-sm">
                        Lớn
                      </SelectItem>
                      <SelectItem value="extra-large" className="text-sm">
                        Rất lớn
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Khoảng cách dòng</Label>
                  <Select
                    value={fontSettings.lineHeight}
                    onValueChange={(v) =>
                      setFontSettings((p) => ({ ...p, lineHeight: v }))
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tight" className="text-sm">
                        Chặt
                      </SelectItem>
                      <SelectItem value="normal" className="text-sm">
                        Bình thường
                      </SelectItem>
                      <SelectItem value="relaxed" className="text-sm">
                        Thoải mái
                      </SelectItem>
                      <SelectItem value="loose" className="text-sm">
                        Rộng rãi
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Độ đậm chữ</Label>
                  <Select
                    value={fontSettings.fontWeight}
                    onValueChange={(v) =>
                      setFontSettings((p) => ({ ...p, fontWeight: v }))
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light" className="text-sm">
                        Nhạt
                      </SelectItem>
                      <SelectItem value="normal" className="text-sm">
                        Bình thường
                      </SelectItem>
                      <SelectItem value="medium" className="text-sm">
                        Vừa
                      </SelectItem>
                      <SelectItem value="semibold" className="text-sm">
                        Đậm vừa
                      </SelectItem>
                      <SelectItem value="bold" className="text-sm">
                        Đậm
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleSaveFontSettings}
              >
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
                  <Select
                    value={uiSettings.theme}
                    onValueChange={handleThemeChange}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light" className="text-sm">
                        Sáng
                      </SelectItem>
                      <SelectItem value="dark" className="text-sm">
                        Tối
                      </SelectItem>
                      <SelectItem value="auto" className="text-sm">
                        Tự động
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Mật độ hiển thị</Label>
                  <Select
                    value={uiSettings.density}
                    onValueChange={handleDensityChange}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact" className="text-sm">
                        Chật
                      </SelectItem>
                      <SelectItem value="comfortable" className="text-sm">
                        Thoải mái
                      </SelectItem>
                      <SelectItem value="spacious" className="text-sm">
                        Rộng rãi
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── MinIO File Browser Modal ── */}
      {minioBrowserOpen && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Chọn file từ MinIO
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                onClick={() => setMinioBrowserOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-3 border-b flex gap-2">
              <Input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc thư mục..."
                value={minioPrefix}
                onChange={(e) => setMinioPrefix(e.target.value)}
                className="text-sm flex-1"
                onKeyDown={(e) =>
                  e.key === "Enter" && loadMinioFiles(minioPrefix)
                }
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadMinioFiles(minioPrefix)}
                disabled={minioFilesLoading}
              >
                {minioFilesLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {minioFilesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">
                    Đang tải...
                  </span>
                </div>
              ) : minioFiles.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  Không có file nào.
                </p>
              ) : (
                <div className="space-y-1">
                  {minioFiles.map((f, i) => {
                    const name = f.name.split("/").pop() || f.name;
                    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(
                      name,
                    );
                    const ttlMs = (f as any).ttl;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-50 border hover:border-blue-200 transition-colors"
                        onClick={() => selectMinioFile(f)}
                      >
                        {isImage ? (
                          <img
                            src={f.url}
                            alt=""
                            className="h-10 w-10 rounded object-contain border shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatBytes(f.size)} ·{" "}
                            {new Date(f.lastModified).toLocaleDateString(
                              "vi-VN",
                            )}
                            {f.name.includes("/") && (
                              <span className="ml-1 text-gray-300">
                                {f.name.replace("/" + name, "")}
                              </span>
                            )}
                          </p>
                          {ttlMs > 0 && (
                            <p className="text-[10px] text-amber-600">
                              TTL:{" "}
                              {ttlMs >= 86400000
                                ? `${Math.round(ttlMs / 86400000)} ngày`
                                : `${Math.round(ttlMs / 3600000)} giờ`}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-blue-600 shrink-0">
                          Chọn
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
