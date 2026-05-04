"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ChevronRight,
  MessageCircle,
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
  Phone,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PillTabs } from "@/components/dashboard";

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
        <Checkbox
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

  if (item.khoa === "cho_phep_quan_ly_tai_khoan") {
    const isOn = value === "true";
    return (
      <div className="flex items-center gap-3 py-1">
        <Checkbox
          checked={isOn}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          id="cho_phep_ql_switch"
        />
        <label
          htmlFor="cho_phep_ql_switch"
          className={`text-sm cursor-pointer select-none ${isOn ? "text-green-700 font-medium" : "text-gray-500"}`}
        >
          {isOn
            ? "Đang bật — quản lý được tự cấu hình TK, hóa đơn họ tạo dùng TK riêng"
            : "Đang tắt — toàn hệ thống dùng TK chung của chủ trọ"}
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <div className="text-white">{meta.icon}</div>
        </div>
        <h3 className="text-base font-bold text-indigo-900">{meta.label}</h3>
      </div>
      <div className="p-4 space-y-4">
        {items.map((item) => (
          <div key={item.khoa} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">
              {item.moTa}
              {item.laBiMat && (
                <Badge variant="outline" className="ml-2 text-xs py-0 border-indigo-200 text-indigo-600 bg-indigo-50">
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
          className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
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
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <HardDrive className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-base font-bold text-indigo-900">Lưu trữ ảnh</h3>
      </div>
      <div className="p-4 space-y-4">
        {providerItem && (
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">{providerItem.moTa}</Label>
            <SettingInput
              item={providerItem}
              value={values["storage_provider"] ?? ""}
              onChange={(v) => onChange("storage_provider", v)}
            />
          </div>
        )}
        {maxSizeItem && (
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">{maxSizeItem.moTa}</Label>
            <SettingInput
              item={maxSizeItem}
              value={values["upload_max_size_mb"] ?? ""}
              onChange={(v) => onChange("upload_max_size_mb", v)}
            />
          </div>
        )}
        {showMinio && minioItems.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-indigo-100">
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> MinIO (self-hosted)
            </p>
            {minioItems.map((item) => (
              <div key={item.khoa} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                <Label className="text-xs md:text-sm font-semibold text-indigo-900">
                  {item.moTa}
                  {item.laBiMat && (
                    <Badge variant="outline" className="ml-2 text-xs py-0 border-indigo-200 text-indigo-600 bg-indigo-50">
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
          <div className="space-y-3 pt-3 border-t border-indigo-100">
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" /> Cloudinary (online)
            </p>
            {cloudinaryItems.map((item) => (
              <div key={item.khoa} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                <Label className="text-xs md:text-sm font-semibold text-indigo-900">
                  {item.moTa}
                  {item.laBiMat && (
                    <Badge variant="outline" className="ml-2 text-xs py-0 border-indigo-200 text-indigo-600 bg-indigo-50">
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
          <p className="text-xs text-indigo-400 italic border-t border-indigo-100 pt-3">
            Lưu trữ local — ảnh lưu trực tiếp trên server, không cần cấu hình thêm.
          </p>
        )}
        <Button
          size="sm"
          className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
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
      </div>
    </div>
  );
}

// ─── Component: Gửi Zalo tự động ─────────────────────────────────────────────

function AutoZaloCard({
  items,
  values,
  onChange,
  onSave,
  saving,
  filterCategory,
}: {
  items: CaiDatItem[];
  values: Record<string, string>;
  onChange: (khoa: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  filterCategory?: string | null;
}) {
  const allSections: { key: string; label?: string; icon?: React.ReactNode; keys: string[] }[] = [
    {
      key: 'autoHoaDon',
      label: "Hóa đơn",
      icon: <FileText className="h-3.5 w-3.5 text-blue-500" />,
      keys: ["auto_zalo_hoa_don_tao", "auto_zalo_hoa_don_thanh_toan", "auto_zalo_hoa_don_huy", "auto_zalo_hoa_don_huy_kem_ly_do"],
    },
    {
      key: 'autoSuCo',
      label: "Sự cố",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
      keys: ["auto_zalo_su_co_ghi_nhan", "auto_zalo_su_co_tiep_nhan", "auto_zalo_su_co_xu_ly_xong", "auto_zalo_su_co_huy", "auto_zalo_su_co_huy_kem_ly_do"],
    },
    {
      key: 'autoThongBao',
      label: "Thông báo & Cảnh báo",
      icon: <Bell className="h-3.5 w-3.5 text-yellow-500" />,
      keys: ["auto_zalo_yeu_cau_phe_duyet", "auto_zalo_thong_bao_da_xu_ly"],
    },
  ];

  const sections = filterCategory
    ? allSections.filter(s => s.key === filterCategory)
    : allSections;

  return (
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Bell className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-indigo-900">Gửi Zalo tự động</h3>
          <p className="text-xs text-indigo-500/70">Tự động gửi thông báo Zalo cho khách thuê khi có sự kiện tương ứng.</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {sections.map((sec) => {
          const secItems = sec.keys.map(k => items.find(i => i.khoa === k)).filter(Boolean) as CaiDatItem[];
          if (!secItems.length) return null;
          return (
            <div key={sec.key} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                {sec.icon} {sec.label}
              </p>
              <div className="space-y-1">
                {secItems.map((item) => (
                  <div key={item.khoa} className="flex items-center justify-between gap-3 py-1.5 border-b border-indigo-100/50 last:border-b-0">
                    <Label className="text-xs text-indigo-800 flex-1">{item.moTa}</Label>
                    <Checkbox
                      checked={values[item.khoa] === 'true'}
                      onCheckedChange={(checked) => onChange(item.khoa, checked ? 'true' : 'false')}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <Button size="sm" className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={onSave} disabled={saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Lưu cài đặt tự động
        </Button>
      </div>
    </div>
  );
}

// ─── Component: Zalo Hotline — 3 công tắc quyền hạn ──────────────────────────

interface HotlineSwitchState {
  batHotline: boolean;
  uyQuyenQL: boolean;
  uyQuyenHotline: boolean;
}

interface HotlineScenario {
  id: string;
  label: string;
}

function ZaloHotlineCard() {
  const [buildings, setBuildings] = useState<{ id: string; tenToaNha: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [switches, setSwitches] = useState<HotlineSwitchState>({
    batHotline: true,
    uyQuyenQL: false,
    uyQuyenHotline: false,
  });
  const [scenario, setScenario] = useState<HotlineScenario | null>(null);
  const [permWarning, setPermWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tải danh sách tòa nhà
  useEffect(() => {
    fetch('/api/admin/toa-nha-settings')
      .then(res => res.json())
      .then(data => {
        if (data.success) setBuildings(data.data);
      })
      .catch(() => {});
  }, []);

  // Tải trạng thái công tắc khi chọn tòa nhà
  useEffect(() => {
    if (!selectedId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/zalo-hotline-switches?toaNhaId=${selectedId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSwitches(data.data.switches);
          setScenario(data.data.scenario);
          if (!data.data.permissions.ok) {
            setPermWarning('⚠️ Quản lý thiếu quyền: ' + data.data.permissions.missing.join(', '));
          } else {
            setPermWarning(null);
          }
        }
      })
      .catch(() => toast.error('Không thể tải cài đặt Zalo Hotline'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function handleToggle(key: keyof HotlineSwitchState) {
    if (!selectedId) return;
    const newVal = !switches[key];
    const updated = { ...switches, [key]: newVal };
    setSwitches(updated);
    setSaving(true);

    try {
      const res = await fetch('/api/admin/zalo-hotline-switches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: selectedId, [key]: newVal }),
      });
      const data = await res.json();
      if (data.success) {
        setScenario(data.data.scenario);
        if (key === 'uyQuyenQL' && newVal) {
          // Kiểm tra quyền sau khi bật
          const checkRes = await fetch(`/api/admin/zalo-hotline-switches?toaNhaId=${selectedId}`);
          const checkData = await checkRes.json();
          if (checkData.success && !checkData.data.permissions.ok) {
            setPermWarning('⚠️ Quản lý thiếu quyền: ' + checkData.data.permissions.missing.join(', '));
          } else {
            setPermWarning(null);
          }
        } else {
          setPermWarning(null);
        }
        toast.success('Đã cập nhật cài đặt Zalo Hotline');
      } else {
        // Rollback nếu API từ chối
        setSwitches(switches);
        toast.error(data.error || 'Lỗi khi lưu');
      }
    } catch {
      setSwitches(switches);
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  }

  const switchConfigs: { key: keyof HotlineSwitchState; label: string; moTa: string; icon: string }[] = [
    {
      key: 'batHotline',
      label: 'Bật Hotline (Đối ngoại)',
      moTa: switches.batHotline
        ? 'Khách thuê nhận/gửi tin qua Hotline Zalo'
        : 'Khách thuê nhận/gửi tin qua Zalo cá nhân người xử lý',
      icon: '📞',
    },
    {
      key: 'uyQuyenQL',
      label: 'Ủy quyền QL (Thông báo - Đối nội)',
      moTa: switches.uyQuyenQL
        ? 'Thông báo nội bộ chuyển cho Quản lý xử lý'
        : 'Thông báo nội bộ đổ về Chủ trọ',
      icon: '👥',
    },
    {
      key: 'uyQuyenHotline',
      label: 'Ủy quyền Hotline (Kỹ thuật)',
      moTa: switches.uyQuyenHotline
        ? 'Quản lý chịu trách nhiệm bảo trì/quét QR Hotline'
        : 'Chủ trọ chịu trách nhiệm bảo trì/quét QR Hotline',
      icon: '🔧',
    },
  ];

  const scenarioColors: Record<string, string> = {
    'A.1': 'text-green-600 bg-green-50 border-green-200',
    'A.2': 'text-blue-600 bg-blue-50 border-blue-200',
    'A.3': 'text-purple-600 bg-purple-50 border-purple-200',
    'A.4': 'text-gray-600 bg-gray-50 border-gray-200',
    'B.1': 'text-green-600 bg-green-50 border-green-200',
    'B.2': 'text-blue-600 bg-blue-50 border-blue-200',
    'B.3': 'text-purple-600 bg-purple-50 border-purple-200',
    'B.4': 'text-gray-600 bg-gray-50 border-gray-200',
  };

  return (
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Phone className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-indigo-900">Zalo Hotline — 3 công tắc quyền hạn</h3>
          <p className="text-xs text-indigo-500/70">Cấu hình luồng giao tiếp Zalo giữa khách thuê, quản lý và chủ trọ.</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Chọn tòa nhà */}
        <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
          <Label className="text-xs md:text-sm font-semibold text-indigo-900">Chọn tòa nhà</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="-- Chọn tòa nhà --" />
            </SelectTrigger>
            <SelectContent>
              {buildings.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.tenToaNha}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedId ? (
          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center text-sm text-indigo-400">
            Vui lòng chọn tòa nhà để cấu hình Zalo Hotline.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Kịch bản hiện tại */}
            {scenario && (
              <div className={`text-xs font-medium px-3 py-2 rounded-md border ${scenarioColors[scenario.id] ?? 'text-indigo-600 bg-indigo-50 border-indigo-200'}`}>
                <span className="font-bold">Kịch bản {scenario.id}:</span> {scenario.label}
              </div>
            )}

            {/* Cảnh báo quyền */}
            {permWarning && (
              <div className="rounded-full border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 backdrop-blur-sm">
                {permWarning}
                <br />
                <span className="text-amber-700">
                  Cấp đủ 4 nhóm quyền (Sự cố, Hóa đơn, Thông báo, Phê duyệt Yêu cầu) cho ít nhất 1 quản lý.
                </span>
              </div>
            )}

            {/* 3 công tắc */}
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1">
              {switchConfigs.map(cfg => (
                <div key={cfg.key} className="flex items-center justify-between gap-3 py-2 border-b border-indigo-100/50 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{cfg.icon}</span>
                      <Label className="text-xs md:text-sm font-semibold text-indigo-900 cursor-pointer">
                        {cfg.label}
                      </Label>
                    </div>
                    <p className="text-xs text-indigo-500/70 mt-0.5 ml-6">{cfg.moTa}</p>
                  </div>
                  <Checkbox
                    checked={switches[cfg.key]}
                    onCheckedChange={() => handleToggle(cfg.key)}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>

            {/* Nút lưu — không cần vì toggle tự động lưu */}
            <p className="text-xs text-indigo-400 italic">
              Thay đổi được lưu tự động khi bật/tắt công tắc.
            </p>
          </>
        )}
      </div>
    </div>
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

const AUTO_ZALO_KEYS = [
  "auto_zalo_hoa_don_tao",
  "auto_zalo_hoa_don_thanh_toan",
  "auto_zalo_hoa_don_huy",
  "auto_zalo_hoa_don_huy_kem_ly_do",
  "auto_zalo_su_co_ghi_nhan",
  "auto_zalo_su_co_tiep_nhan",
  "auto_zalo_su_co_xu_ly_xong",
  "auto_zalo_su_co_huy",
  "auto_zalo_su_co_huy_kem_ly_do",
  "auto_zalo_yeu_cau_phe_duyet",
  "auto_zalo_thong_bao_da_xu_ly",
];


function AlertSettingsCard({
  items,
  values,
  onChange,
  onSave,
  saving,
  filterCategory,
}: {
  items: CaiDatItem[];
  values: Record<string, string>;
  onChange: (khoa: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  filterCategory?: string | null;
}) {
  const allSections: { key: string; label: string; icon: React.ReactNode; keys: string[] }[] = [
    {
      key: 'hoaDonQuaHan',
      label: "Hóa đơn quá hạn",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
      keys: ["thong_bao_qua_han_hoa_don", "hoa_don_canh_bao_lan_1", "hoa_don_canh_bao_lan_2", "hoa_don_canh_bao_lan_3"],
    },
    {
      key: 'hopDongSapHetHan',
      label: "Hợp đồng sắp hết hạn",
      icon: <FileText className="h-3.5 w-3.5 text-blue-500" />,
      keys: ["thong_bao_truoc_han_hop_dong", "hop_dong_canh_bao_lan_1", "hop_dong_canh_bao_lan_2", "hop_dong_canh_bao_lan_3"],
    },
    {
      key: 'chotChiSo',
      label: "Chốt chỉ số điện nước",
      icon: <Zap className="h-3.5 w-3.5 text-yellow-500" />,
      keys: ["chot_chi_so_ngay_trong_thang", "chot_chi_so_truoc_ngay"],
    },
    {
      key: 'suCo',
      label: "Sự cố",
      icon: <Clock className="h-3.5 w-3.5 text-red-500" />,
      keys: ["su_co_chua_nhan_gio", "su_co_chua_xu_ly_gio"],
    },
  ];

  const sections = filterCategory
    ? allSections.filter(s => s.key === filterCategory)
    : allSections;

  return (
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Bell className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-base font-bold text-indigo-900">Cài đặt cảnh báo & nhắc nhở</h3>
      </div>
      <div className="p-4 space-y-4">
        {sections.map((sec) => {
          const secItems = sec.keys.map((k) => items.find((i) => i.khoa === k)).filter(Boolean) as CaiDatItem[];
          if (!secItems.length) return null;
          return (
            <div key={sec.key} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                {sec.icon} {sec.label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {secItems.map((item) => (
                  <div key={item.khoa} className="space-y-1">
                    <Label className="text-xs font-semibold text-indigo-900">{item.moTa}</Label>
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
        <Button size="sm" className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={onSave} disabled={saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Lưu cảnh báo
        </Button>
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-indigo-900">Thông tin hệ thống</h3>
          <p className="text-xs text-indigo-500/70">Thông tin công ty / nhà trọ của bạn. Mỗi chủ trọ có dữ liệu riêng.</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {fields.map(f => (
          <div key={f.key} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">{f.label}</Label>
            <Input
              value={data[f.key]}
              onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="text-sm"
            />
          </div>
        ))}
        <Button size="sm" className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Lưu hệ thống
        </Button>
      </div>
    </div>
  );
}

// ─── Tab Tài khoản ngân hàng (quanLy, khi chủ trọ cho phép) ────────────────

function QuanLyBankTab() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [data, setData] = useState({ nganHangTen: '', nganHangSoTaiKhoan: '', nganHangChuTaiKhoan: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cai-dat/cho-phep-quan-ly-tai-khoan')
      .then(r => r.json())
      .then(res => setEnabled(!!res.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (enabled !== true) return;
    fetch('/api/chuNha/settings')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setData({
            nganHangTen: res.data.nganHangTen ?? '',
            nganHangSoTaiKhoan: res.data.nganHangSoTaiKhoan ?? '',
            nganHangChuTaiKhoan: res.data.nganHangChuTaiKhoan ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/chuNha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) toast.success('Đã lưu tài khoản ngân hàng');
      else toast.error(json.error || 'Lưu thất bại');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  }

  if (enabled === null) return <p className="text-sm text-indigo-400 text-center py-8">Đang kiểm tra...</p>;
  if (enabled === false) {
    return (
      <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center space-y-2">
        <CreditCard className="h-10 w-10 mx-auto text-indigo-300" />
        <p className="text-sm font-medium text-indigo-700">Tính năng chưa được kích hoạt</p>
        <p className="text-xs text-indigo-400">
          Chủ trọ chưa cho phép quản lý tự cấu hình tài khoản nhận tiền riêng.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <CreditCard className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-indigo-900">Tài khoản ngân hàng cá nhân</h3>
          <p className="text-xs text-indigo-500/70">Tài khoản này sẽ được dùng trên các hóa đơn do bạn tạo, thay cho tài khoản chung của chủ trọ.</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs md:text-sm font-semibold text-indigo-900">Ngân hàng</Label>
              <Input
                value={data.nganHangTen}
                onChange={(e) => setData({ ...data, nganHangTen: e.target.value })}
                placeholder="VD: Vietcombank"
                className="text-sm"
              />
            </div>
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs md:text-sm font-semibold text-indigo-900">Số tài khoản</Label>
              <Input
                value={data.nganHangSoTaiKhoan}
                onChange={(e) => setData({ ...data, nganHangSoTaiKhoan: e.target.value })}
                placeholder="VD: 1234567890"
                className="text-sm"
              />
            </div>
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs md:text-sm font-semibold text-indigo-900">Chủ tài khoản</Label>
              <Input
                value={data.nganHangChuTaiKhoan}
                onChange={(e) => setData({ ...data, nganHangChuTaiKhoan: e.target.value })}
                placeholder="VD: NGUYEN VAN A"
                className="text-sm"
              />
            </div>
            <Button size="sm" className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={handleSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Lưu tài khoản ngân hàng
            </Button>
          </>
        )}
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <MessageSquare className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-indigo-900">Zalo Webhook</h3>
          <p className="text-xs text-indigo-500/70">URL để Zalo Bot gửi tin nhắn về hệ thống. Dán URL này vào cấu hình bot server.</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* App URL settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs font-semibold text-indigo-900">URL LAN (IP nội bộ)</Label>
            <div className="flex gap-1.5">
              <Input
                value={webhookBaseUrl}
                onChange={e => onChangeBaseUrl(e.target.value)}
                placeholder="http://192.168.x.x:3000"
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => onSaveBaseUrl(webhookBaseUrl)} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs font-semibold text-indigo-900">URL Domain (internet)</Label>
            <div className="flex gap-1.5">
              <Input
                value={webhookDomainUrl}
                onChange={e => onChangeDomainUrl(e.target.value)}
                placeholder="https://yourdomain.com"
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => onSaveDomainUrl(webhookDomainUrl)} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Webhook ID section */}
        {!currentWebhookId ? (
          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-4 space-y-3">
            <p className="text-sm text-indigo-400 text-center">Chưa có Webhook ID. Tạo ngẫu nhiên hoặc nhập ID từ bot server.</p>
            <div className="flex gap-1.5">
              <Input
                value={customId}
                onChange={e => setCustomId(e.target.value)}
                placeholder="Nhập webhook_id từ bot server (tuỳ chọn)"
                className="text-xs font-mono"
              />
              <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={() => onGenerate(customId.trim() || undefined)} disabled={webhookIdGenerating}>
                {webhookIdGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span className="ml-1">{customId.trim() ? 'Dùng ID này' : 'Tạo ngẫu nhiên'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs font-semibold text-indigo-900">Webhook URL (dán vào bot server)</Label>
              {webhookFullUrl && (
                <div className="flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                  <Wifi className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1 break-all text-indigo-700">{webhookFullUrl}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0 text-indigo-500 hover:text-indigo-700" onClick={() => copyToClipboard(webhookFullUrl)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {webhookDomainFullUrl && webhookDomainFullUrl !== webhookFullUrl && (
                <div className="flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                  <Cloud className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1 break-all text-indigo-700">{webhookDomainFullUrl}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0 text-indigo-500 hover:text-indigo-700" onClick={() => copyToClipboard(webhookDomainFullUrl)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {!webhookFullUrl && !webhookDomainFullUrl && (
                <div className="rounded-full border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 backdrop-blur-sm">
                  Cần nhập URL LAN hoặc URL Domain ở trên để hiển thị webhook URL đầy đủ.
                </div>
              )}
            </div>

            {/* Test + Regenerate */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onTest} disabled={webhookTestLoading} className="flex-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                {webhookTestLoading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                Test nhận tin
              </Button>
              <Button size="sm" variant="outline" onClick={() => onGenerate()} disabled={webhookIdGenerating} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
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
              <Button size="sm" variant="outline" disabled={!customId.trim() || webhookIdGenerating} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
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
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs font-semibold text-indigo-900">Cài webhook cho bot server</Label>
              <div className="flex gap-1.5">
                <Input
                  value={botWebhookUrl}
                  onChange={e => onChangeBotUrl(e.target.value)}
                  placeholder="URL webhook (tự điền từ trên)"
                  className="text-sm"
                />
                <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={onSetBotWebhook} disabled={botWebhookLoading}>
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
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          {tab === 'ha' ? <Webhook className="h-4 w-4 text-white" /> : <HardDrive className="h-4 w-4 text-white" />}
        </div>
        <div>
          <h3 className="text-base md:text-lg font-semibold text-indigo-900">
            {tab === 'ha' ? 'Home Assistant' : 'Lưu trữ'} — theo tòa nhà
          </h3>
          <p className="text-xs text-indigo-500/70">
            Mỗi tòa nhà có cấu hình {tab === 'ha' ? 'Home Assistant' : 'lưu trữ ảnh'} riêng.
          </p>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Building selector */}
        <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
          <Label className="text-xs md:text-sm font-semibold text-indigo-900">Chọn tòa nhà</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={buildings.length === 0 ? 'Đang tải...' : '— Chọn tòa nhà —'} />
            </SelectTrigger>
            <SelectContent>
              {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.tenToaNha}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading && <div className="flex justify-center py-4"><RefreshCw className="h-4 w-4 animate-spin text-blue-600" /></div>}

        {/* ── HA fields ── */}
        {selectedId && !loading && tab === 'ha' && (
          <div className="space-y-4">
            {[
              { key: 'haUrl', label: 'Home Assistant URL', placeholder: 'https://ha.myhouse.com hoặc http://192.168.1.x:8123' },
              { key: 'haToken', label: 'Long-lived access token', placeholder: 'eyJ0...' },
            ].map(f => (
              <div key={f.key} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                <Label className="text-xs md:text-sm font-semibold text-indigo-900">{f.label}</Label>
                <Input
                  value={settings[f.key] ?? ''}
                  onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-sm"
                />
              </div>
            ))}

            {/* Webhook URL */}
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs md:text-sm font-semibold text-indigo-900">Webhook URL</Label>
              <p className="text-xs text-indigo-500/70">URL webhook nhận / gửi thông báo HA (local hoặc domain đều dùng được)</p>
              <Input
                value={settings.haWebhookUrl ?? ''}
                onChange={e => setSettings(prev => ({ ...prev, haWebhookUrl: e.target.value }))}
                placeholder="http://192.168.1.x:3000/api/... hoặc https://myapp.com/api/..."
                className="text-sm font-mono"
              />
            </div>

            {/* Thread filter */}
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-indigo-700">Bộ lọc chuyển tiếp</p>
                <button
                  type="button"
                  onClick={() => setHaThreadEntries(prev => [...prev, { threadId: '', type: 0 }])}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </button>
              </div>
              <p className="text-xs text-indigo-500/70">Giới hạn tin nhắn forward đến HA theo Thread ID. Trống = chuyển tiếp tất cả.</p>
              {haThreadEntries.length === 0 && (
                <p className="text-xs text-indigo-500/70 italic">Chưa có thread — tất cả tin nhắn sẽ được chuyển tiếp.</p>
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
            <Button size="sm" className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Lưu cài đặt Home Assistant
            </Button>

            {/* Test Webhook */}
            <Separator className="my-2 bg-indigo-100" />
            <div className="space-y-2">
              <Button size="sm" variant="outline" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={handleTestHaWebhook} disabled={haWebhookTestLoading}>
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
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs md:text-sm font-semibold text-indigo-900">Nhà cung cấp lưu trữ</Label>
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

            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
              <Label className="text-xs md:text-sm font-semibold text-indigo-900">Dung lượng tối đa (MB)</Label>
              <Input
                type="number" min={1} max={100}
                value={settings.uploadMaxSizeMb ?? '10'}
                onChange={e => setSettings(prev => ({ ...prev, uploadMaxSizeMb: e.target.value }))}
                className="text-sm"
              />
            </div>

            {showMinio && (
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-3">
                <p className="text-xs font-semibold text-indigo-700">MinIO</p>

                {/* Endpoint */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-indigo-900">Endpoint</Label>
                  <Input
                    value={settings.minioEndpoint ?? ''}
                    onChange={e => { setSettings(prev => ({ ...prev, minioEndpoint: e.target.value })); setMinioBuckets([]); setMinioConnected(false); }}
                    placeholder="http://192.168.1.10:9000"
                    className="text-sm"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-indigo-900">Username (Access Key)</Label>
                  <Input
                    value={settings.minioAccessKey ?? ''}
                    onChange={e => { setSettings(prev => ({ ...prev, minioAccessKey: e.target.value })); setMinioBuckets([]); setMinioConnected(false); }}
                    placeholder="minioadmin"
                    className="text-sm"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-indigo-900">Password (Secret Key)</Label>
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
                  className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50"
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
                  <Label className="text-xs font-medium text-indigo-900">Bucket</Label>
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
                      <p className="rounded-full border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 backdrop-blur-sm flex items-center gap-1">
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
                          className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
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
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-3">
                <p className="text-xs font-semibold text-indigo-700">Cloudinary</p>
                {[
                  { key: 'cloudinaryCloudName', label: 'Cloud Name', placeholder: 'mycloud' },
                  { key: 'cloudinaryApiKey', label: 'API Key', placeholder: '' },
                  { key: 'cloudinaryApiSecret', label: 'API Secret', placeholder: '' },
                  { key: 'cloudinaryPreset', label: 'Upload Preset', placeholder: 'unsigned_preset' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs font-medium text-indigo-900">{f.label}</Label>
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

            <Button size="sm" className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200" onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Lưu cài đặt lưu trữ
            </Button>

            {/* MinIO test connection */}
            {showMinio && (
              <div className="space-y-2">
                <Separator className="my-2 bg-indigo-100" />
                <Button size="sm" variant="outline" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={handleTestMinio} disabled={minioTestLoading}>
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
      </div>
    </div>
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
        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
        <span className="ml-2 text-indigo-500 text-sm">Đang tải...</span>
      </div>
    );
  }

  // Hiện thông báo nếu admin chưa bật cho bất kỳ tòa nhà nào
  if (!hasAnyEnabled) {
    return (
      <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center">
        <Users className="h-8 w-8 text-indigo-300 mx-auto mb-3" />
        <p className="text-sm text-indigo-400">Admin chưa bật tính năng đăng nhập web cho tòa nhà nào.</p>
        <p className="text-xs text-indigo-300 mt-1">Liên hệ admin để bật tính năng này.</p>
      </div>
    );
  }

  const enabledBuildings = buildings.filter(b => buildingStates[b.id]?.adminBat);

  return (
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-semibold text-indigo-900">Đăng nhập web khách thuê</h3>
          <p className="text-xs text-indigo-500/70">Bật/tắt cho phép khách thuê đăng nhập web xem hóa đơn, báo sự cố... theo từng tòa nhà</p>
        </div>
      </div>
      <div className="p-4 md:p-6 space-y-3">
        {enabledBuildings.map(b => {
          const state = buildingStates[b.id];
          if (!state || state.loading) return (
            <div key={b.id} className="flex items-center gap-2 py-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-indigo-500">{b.tenToaNha}...</span>
            </div>
          );
          return (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm shadow-sm">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-indigo-900">{b.tenToaNha}</Label>
                <p className="text-xs text-indigo-500/70">
                  {state.soLuongDaBat} đã kích hoạt
                  {state.gioiHan !== null && <> / {state.gioiHan} giới hạn</>}
                </p>
              </div>
              <Checkbox
                checked={state.chuTroBat}
                onCheckedChange={val => handleToggle(b.id, val === true)}
                disabled={state.saving}
              />
            </div>
          );
        })}
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-semibold text-indigo-900">Quản lý đăng nhập web khách thuê</h3>
          <p className="text-xs text-indigo-500/70">Bật/tắt tính năng đăng nhập web cho khách thuê theo từng tòa nhà. Admin bật = mặc định cho phép. Chủ trọ có thể tắt thêm nếu muốn.</p>
        </div>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        {/* Chọn tòa nhà */}
        {buildings.length > 1 && (
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Chọn tòa nhà</Label>
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
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="ml-2 text-indigo-500 text-sm">Đang tải...</span>
          </div>
        ) : (
          <>
            {/* Toggle admin bật đăng nhập KT */}
            <div className="flex items-center justify-between p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm shadow-sm">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-indigo-900">Cho phép đăng nhập web khách thuê</Label>
                <p className="text-xs text-indigo-500/70">
                  Bật = khách thuê tòa nhà này được đăng nhập web. Chủ trọ có thể tắt thêm nếu muốn.
                </p>
              </div>
              <Checkbox checked={adminBat} onCheckedChange={(checked) => setAdminBat(checked === true)} />
            </div>

            {/* Giới hạn số lượng */}
            {adminBat && (
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
                <Label className="text-xs md:text-sm font-semibold text-indigo-900">Giới hạn số khách thuê được đăng nhập</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Không giới hạn"
                    value={gioiHan}
                    onChange={e => setGioiHan(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-xs text-indigo-500/70">
                    (để trống = không giới hạn)
                  </span>
                </div>
                <p className="text-xs text-indigo-500/70">
                  Hiện tại: <span className="font-medium text-indigo-900">{soLuongDaBat}</span> khách thuê đã kích hoạt
                  {gioiHan !== '' && <> / <span className="font-medium text-indigo-900">{gioiHan}</span> giới hạn</>}
                </p>
              </div>
            )}

            {/* Trạng thái */}
            {adminBat && (
              <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm shadow-sm">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-indigo-700">
                  Đăng nhập web khách thuê đang hoạt động{!chuTroBat && ' (chủ trọ đã tắt — khách thuê sẽ không đăng nhập được)'}
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !selectedId} size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
                {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu cài đặt
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Bot className="h-4 w-4 md:h-5 md:w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-semibold text-indigo-900">Cấu hình AI</h3>
          <p className="text-xs text-indigo-500/70">Thiết lập nhà cung cấp AI, API key và model. Hỗ trợ OpenAI, Gemini và các API tương thích OpenAI.</p>
        </div>
      </div>
      <div className="p-4 md:p-6 space-y-5">

        {/* Provider */}
        <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
          <Label className="text-xs md:text-sm font-semibold text-indigo-900">Nhà cung cấp AI</Label>
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
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">API Key</Label>
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
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">
              Base URL <span className="text-indigo-400 font-normal">(để trống = dùng api.openai.com)</span>
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
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Model</Label>
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
                className="shrink-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
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
              <p className="text-xs text-indigo-500/70">{models.length} model khả dụng — nhập tay hoặc chọn từ danh sách.</p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => onSave('ai')} disabled={saving} size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
            {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Lưu cài đặt AI
          </Button>
        </div>
      </div>
    </div>
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
    <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
      <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Bot className="h-4 w-4 md:h-5 md:w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-semibold text-indigo-900">Kích hoạt AI theo tài khoản</h3>
          <p className="text-xs text-indigo-500/70">Bật/tắt tính năng trợ lý AI cho từng tài khoản trong hệ thống. Admin luôn có quyền dùng AI.</p>
        </div>
      </div>
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="ml-2 text-indigo-500 text-sm">Đang tải...</span>
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-indigo-400 text-center py-8">Chưa có tài khoản nào.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([label, list]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">{label}</p>
                <div className="space-y-2">
                  {list.map(account => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm shadow-sm hover:border-indigo-300 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${account.trangThai === 'hoatDong' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-indigo-900 truncate">{account.ten}</p>
                          <p className="text-xs text-indigo-500/70 truncate">
                            {account.email ?? account.soDienThoai ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {account.aiEnabled && (
                          <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">
                            AI bật
                          </Badge>
                        )}
                        <Checkbox
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
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CaiDatPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isChuNha = session?.user?.role === "chuNha" || session?.user?.role === "dongChuTro";
  const isQuanLy = session?.user?.role === "quanLy";
  // Admin quản lý HA + lưu trữ theo tòa nhà; chuNha quản lý thanh toán + cảnh báo + hệ thống
  const canManage = isAdmin || isChuNha;

  const [activeTab, setActiveTab] = useState(
    isChuNha ? "thanhToan"
    : isQuanLy ? "bankQL"
    : "thanhToan"
  );
  const [selectedAlertCategory, setSelectedAlertCategory] = useState<string | null>(null);

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
  const autoZaloItems = (settingsByGroup["thongBao"] ?? []).filter((s) =>
    AUTO_ZALO_KEYS.includes(s.khoa),
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-indigo-900">Cài đặt</h1>
          <p className="text-xs md:text-sm text-indigo-500/70">Tùy chỉnh hệ thống và giao diện</p>
        </div>
      </div>

      <PillTabs
        tabs={[
          ...(isChuNha ? [
            { value: "thanhToan", label: "Thanh toán", icon: CreditCard },
            { value: "canhBao", label: "Cảnh báo", icon: Clock },
            { value: "heThong", label: "Hệ thống", icon: Shield },
            { value: "dangNhapKT", label: "Đăng nhập KT", icon: Users },
          ] as const : []),
          ...(isQuanLy ? [
            { value: "bankQL", label: "Tài khoản ngân hàng", icon: CreditCard },
          ] as const : []),
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

        {/* ── Skeleton lỗi/loading dùng chung ── */}
        {canManage && (loadingSystem || errorSystem) && (
          <div className="mt-4">
            {loadingSystem ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-indigo-500">
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
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Thử lại
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Thanh toán ─────────────────────────────────────────────────── */}
        {activeTab === "thanhToan" && isChuNha && !loadingSystem && !errorSystem && (
          <div className="space-y-4 mt-4">
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
              <p className="text-sm text-indigo-400 text-center py-8">
                Chưa có cài đặt thanh toán nào.
              </p>
            )}
          </div>
        )}

        {/* ── Tab Cảnh báo ──────────────────────────────────────────────────── */}
        {activeTab === "canhBao" && isChuNha && !loadingSystem && !errorSystem && (
          <div className="mt-4">
            {alertItems.length > 0 || autoZaloItems.length > 0 ? (
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Left column: tree-style category list */}
                <div className="w-full lg:w-72 shrink-0 space-y-2">
                  {/* Alert settings categories */}
                  <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-1 shadow-sm">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider px-1 mb-2">
                      <Bell className="h-3.5 w-3.5 inline mr-1" />
                      Cảnh báo & Nhắc nhở
                    </p>
                    {[
                      { key: 'hoaDonQuaHan', label: 'Hóa đơn quá hạn', icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> },
                      { key: 'hopDongSapHetHan', label: 'Hợp đồng sắp hết hạn', icon: <FileText className="h-3.5 w-3.5 text-blue-500" /> },
                      { key: 'chotChiSo', label: 'Chốt chỉ số điện nước', icon: <Zap className="h-3.5 w-3.5 text-yellow-500" /> },
                      { key: 'suCo', label: 'Sự cố', icon: <Clock className="h-3.5 w-3.5 text-red-500" /> },
                    ].map(cat => {
                      const isSelected = selectedAlertCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSelectedAlertCategory(isSelected ? null : cat.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all duration-200 text-xs ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-lg shadow-indigo-200'
                              : 'bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <span className="shrink-0">{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                          {isSelected
                            ? <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
                            : <ChevronRight className="h-3 w-3 shrink-0 ml-auto" />
                          }
                        </button>
                      );
                    })}
                  </div>

                  {/* Auto Zalo categories */}
                  <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-1 shadow-sm">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider px-1 mb-2">
                      <MessageCircle className="h-3.5 w-3.5 inline mr-1" />
                      Gửi Zalo tự động
                    </p>
                    {[
                      { key: 'autoHoaDon', label: 'Hóa đơn', icon: <FileText className="h-3.5 w-3.5 text-blue-500" /> },
                      { key: 'autoSuCo', label: 'Sự cố', icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> },
                      { key: 'autoThongBao', label: 'Thông báo & Cảnh báo', icon: <Bell className="h-3.5 w-3.5 text-yellow-500" /> },
                    ].map(cat => {
                      const isSelected = selectedAlertCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSelectedAlertCategory(isSelected ? null : cat.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all duration-200 text-xs ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-lg shadow-indigo-200'
                              : 'bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <span className="shrink-0">{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                          {isSelected
                            ? <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
                            : <ChevronRight className="h-3 w-3 shrink-0 ml-auto" />
                          }
                        </button>
                      );
                    })}
                  </div>

                  {/* Webhook category */}
                  <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-1 shadow-sm">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider px-1 mb-2">
                      <Webhook className="h-3.5 w-3.5 inline mr-1" />
                      Webhook
                    </p>
                    {[
                      { key: 'webhook', label: 'Cấu hình Webhook', icon: <Webhook className="h-3.5 w-3.5 text-indigo-500" /> },
                    ].map(cat => {
                      const isSelected = selectedAlertCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSelectedAlertCategory(isSelected ? null : cat.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all duration-200 text-xs ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-lg shadow-indigo-200'
                              : 'bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <span className="shrink-0">{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                          {isSelected
                            ? <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
                            : <ChevronRight className="h-3 w-3 shrink-0 ml-auto" />
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right column: content for selected category */}
                <div className="flex-1 min-w-0">
                  {!selectedAlertCategory ? (
                    <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-8 text-center">
                      <Bell className="mx-auto h-8 w-8 text-indigo-300 mb-2" />
                      <p className="text-sm text-indigo-400">Chọn một danh mục bên trái để xem cài đặt</p>
                    </div>
                  ) : selectedAlertCategory === 'webhook' ? (
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
                  ) : ['autoHoaDon', 'autoSuCo', 'autoThongBao'].includes(selectedAlertCategory) ? (
                    <AutoZaloCard
                      items={autoZaloItems}
                      values={settingValues}
                      onChange={handleSettingChange}
                      onSave={() => handleSaveGroup("thongBao")}
                      saving={savingGroup === "thongBao"}
                      filterCategory={selectedAlertCategory}
                    />
                  ) : (
                    <AlertSettingsCard
                      items={alertItems}
                      values={settingValues}
                      onChange={handleSettingChange}
                      onSave={() => handleSaveGroup("thongBao")}
                      saving={savingGroup === "thongBao"}
                      filterCategory={selectedAlertCategory}
                    />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-indigo-400 text-center py-8">
                Chưa có cài đặt cảnh báo nào.
              </p>
            )}
          </div>
        )}


        {/* ── Tab Hệ thống — chủ trọ: thông tin công ty riêng ─────────────── */}
        {activeTab === "heThong" && isChuNha && !loadingSystem && (
          <div className="space-y-4 mt-4">
            <ChuNhaHeThongTab />
          </div>
        )}

        {/* ── Tab Đăng nhập khách thuê (chủ trọ) ────────────────────────────── */}
        {activeTab === "dangNhapKT" && isChuNha && (
          <div className="space-y-4 mt-4">
            <ChuNhaDangNhapKTTab />
          </div>
        )}

        {/* ── Tab Tài khoản ngân hàng (chỉ quản lý) ─────────────────────────── */}
        {activeTab === "bankQL" && isQuanLy && (
          <div className="space-y-4 mt-4">
            <QuanLyBankTab />
          </div>
        )}

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
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 border hover:border-blue-200 transition-colors"
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
