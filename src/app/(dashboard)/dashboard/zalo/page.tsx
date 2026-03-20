"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, ChevronDown, ChevronRight, User, QrCode,
  Save, RefreshCw, Smartphone, Shield, Crown, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZaloSettings {
  nhanSuCo: boolean;
  nhanHoaDon: boolean;
  nhanTinKhach: boolean;
  nhanNguoiLa: boolean;
  nhanNhacNho: boolean;
  chuyenSuCoChoQL: boolean;
  chuyenHoaDonChoQL: boolean;
  chuyenTinKhachChoQL: boolean;
  chuyenNguoiLaChoQL: boolean;
  chuyenNhacNhoChoQL: boolean;
}

const DEFAULT_SETTINGS: ZaloSettings = {
  nhanSuCo: true, nhanHoaDon: true, nhanTinKhach: true, nhanNguoiLa: true, nhanNhacNho: true,
  chuyenSuCoChoQL: false, chuyenHoaDonChoQL: false, chuyenTinKhachChoQL: false,
  chuyenNguoiLaChoQL: false, chuyenNhacNhoChoQL: false,
};

const CATEGORIES: { key: keyof ZaloSettings; label: string; chuyenKey: keyof ZaloSettings }[] = [
  { key: 'nhanSuCo',     label: 'Sự cố',          chuyenKey: 'chuyenSuCoChoQL' },
  { key: 'nhanHoaDon',   label: 'Hóa đơn',         chuyenKey: 'chuyenHoaDonChoQL' },
  { key: 'nhanTinKhach', label: 'Tin nhắn KT',     chuyenKey: 'chuyenTinKhachChoQL' },
  { key: 'nhanNguoiLa',  label: 'Người lạ',        chuyenKey: 'chuyenNguoiLaChoQL' },
  { key: 'nhanNhacNho',  label: 'Nhắc nhở ĐN',    chuyenKey: 'chuyenNhacNhoChoQL' },
];

interface AccountData {
  id: string;
  ten: string;
  email: string;
  zaloChatId: string | null;
  zaloAccountId: string | null;
  nhanThongBaoZalo: boolean;
  settings: ZaloSettings | null;
  role: 'chuTro' | 'quanLy';
}

interface BuildingData {
  id: string;
  tenToaNha: string;
  chuTro: Omit<AccountData, 'role'>;
  quanLys: Omit<AccountData, 'role'>[];
}

// ─── Account Settings Panel ───────────────────────────────────────────────────

function AccountPanel({
  account,
  buildingId,
  isChuTro,
  isAdmin,
  isSelf,
  onSaved,
}: {
  account: Omit<AccountData, 'role'>;
  buildingId: string;
  isChuTro: boolean;
  isAdmin: boolean;
  isSelf: boolean;
  onSaved: () => void;
}) {
  const canEdit = isAdmin || isSelf;

  const [settings, setSettings] = useState<ZaloSettings>(account.settings ?? DEFAULT_SETTINGS);
  const [zaloAccountId, setZaloAccountId] = useState(account.zaloAccountId ?? '');
  const [saving, setSaving] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleToggle = (key: keyof ZaloSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/zalo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nguoiDungId: account.id,
          toaNhaId: buildingId,
          zaloAccountId: zaloAccountId.trim() || null,
          settings,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleGetQR = async () => {
    setQrLoading(true);
    setQrCode(null);
    try {
      const res = await fetch('/api/zalo-bot/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAdmin && zaloAccountId ? { accountSelection: zaloAccountId } : {}),
      });
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Zalo Account Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Zalo Chat ID (nhận tin)</Label>
          <div className="flex items-center gap-2">
            <Input
              value={account.zaloChatId ?? ''}
              readOnly
              className="h-8 text-xs bg-gray-50"
              placeholder="Chưa liên kết"
            />
            {account.zaloChatId
              ? <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] whitespace-nowrap">Đã liên kết</Badge>
              : <Badge variant="outline" className="text-gray-400 text-[10px] whitespace-nowrap">Chưa liên kết</Badge>
            }
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Account ID trên Bot Server (gửi tin)</Label>
          <Input
            value={zaloAccountId}
            onChange={e => setZaloAccountId(e.target.value)}
            disabled={!canEdit}
            className="h-8 text-xs"
            placeholder="Vd: 84912345678"
          />
        </div>
      </div>

      {/* QR Login */}
      <div className="flex items-start gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={handleGetQR}
          disabled={qrLoading}
          className="text-xs gap-1.5"
        >
          <QrCode className="h-3.5 w-3.5" />
          {qrLoading ? 'Đang lấy QR...' : 'Lấy QR đăng nhập'}
        </Button>
        {qrCode && (
          <div className="flex flex-col items-center gap-1">
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Zalo"
              className="w-28 h-28 border rounded"
            />
            <span className="text-[10px] text-gray-400">Quét bằng Zalo</span>
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border-b">
          Cài đặt thông báo
          {isChuTro && (
            <span className="ml-2 text-gray-400 font-normal">
              — "Chuyển QL" khi bật: chỉ báo lại khi xong/thanh toán
            </span>
          )}
        </div>
        <div className="divide-y">
          {CATEGORIES.map(cat => (
            <div key={cat.key} className="flex items-center px-3 py-2 gap-4">
              <div className="w-28 text-xs text-gray-700 font-medium">{cat.label}</div>

              {/* Nhận */}
              <div className="flex items-center gap-1.5">
                <Switch
                  id={`${account.id}-${cat.key}`}
                  checked={settings[cat.key] as boolean}
                  onCheckedChange={v => handleToggle(cat.key, v)}
                  disabled={!canEdit}
                  className="scale-75"
                />
                <label htmlFor={`${account.id}-${cat.key}`} className="text-[11px] text-gray-500">
                  Nhận
                </label>
              </div>

              {/* Chuyển QL — chỉ hiện với chủ trọ */}
              {isChuTro && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`${account.id}-${cat.chuyenKey}`}
                    checked={settings[cat.chuyenKey] as boolean}
                    onCheckedChange={v => handleToggle(cat.chuyenKey, v)}
                    disabled={!canEdit || !(settings[cat.key] as boolean)}
                    className="scale-75"
                  />
                  <label htmlFor={`${account.id}-${cat.chuyenKey}`} className="text-[11px] text-gray-500">
                    Chuyển QL
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Building Section ─────────────────────────────────────────────────────────

function BuildingSection({
  building,
  isAdmin,
  sessionUserId,
}: {
  building: BuildingData;
  isAdmin: boolean;
  sessionUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const toggleAccount = (id: string) =>
    setOpenAccounts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const accounts: (Omit<AccountData, 'role'> & { role: 'chuTro' | 'quanLy' })[] = [
    { ...building.chuTro, role: 'chuTro' as const },
    ...building.quanLys.map(q => ({ ...q, role: 'quanLy' as const })),
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Building Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <span className="font-semibold text-gray-900 text-sm">{building.tenToaNha}</span>
            <p className="text-[10px] text-gray-500">
              1 chủ trọ · {building.quanLys.length} quản lý
            </p>
          </div>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="divide-y bg-white">
          {accounts.map(acc => {
            const isAccountOpen = openAccounts.has(acc.id);
            const isSelf = acc.id === sessionUserId;
            const isChuTro = acc.role === 'chuTro';

            return (
              <div key={acc.id}>
                {/* Account Header */}
                <button
                  type="button"
                  onClick={() => toggleAccount(acc.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    {isChuTro
                      ? <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                      : <Users className="h-4 w-4 text-blue-400 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{acc.ten}</span>
                        <Badge variant="outline" className={`text-[10px] ${isChuTro ? 'border-amber-300 text-amber-600' : 'border-blue-300 text-blue-600'}`}>
                          {isChuTro ? 'Chủ trọ' : 'Quản lý'}
                        </Badge>
                        {isSelf && <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500">Bạn</Badge>}
                      </div>
                      <p className="text-[10px] text-gray-400">{acc.email}</p>
                    </div>
                    <div className="ml-2">
                      {acc.zaloChatId
                        ? <span className="text-[10px] text-green-500">● Đã liên kết</span>
                        : <span className="text-[10px] text-gray-400">○ Chưa liên kết</span>}
                    </div>
                  </div>
                  {isAccountOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                </button>

                {/* Account Content */}
                {isAccountOpen && (
                  <div className="border-t bg-white" key={refreshKey}>
                    <AccountPanel
                      account={acc}
                      buildingId={building.id}
                      isChuTro={isChuTro}
                      isAdmin={isAdmin}
                      isSelf={isSelf}
                      onSaved={() => setRefreshKey(k => k + 1)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZaloSettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const sessionUserId = session?.user?.id ?? '';

  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBuildings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/zalo');
      const data = await res.json();
      if (data.ok) setBuildings(data.buildings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Cài đặt Zalo
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý tài khoản Zalo, thông báo và phân quyền theo từng tòa nhà
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadBuildings} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Admin-only: Bot Server & Webhook info */}
      {isAdmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Shield className="h-4 w-4" />
              Cài đặt hệ thống (Admin)
            </CardTitle>
            <CardDescription className="text-xs text-amber-600">
              Cấu hình Bot Server URL, webhook và tài khoản mặc định — xem tại{' '}
              <a href="/dashboard/cai-dat" className="underline">Cài đặt → Zalo</a>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Buildings */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Đang tải...</div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Chưa có tòa nhà nào</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 px-1">
            Nhấn vào tòa nhà để mở, nhấn vào tên người dùng để cấu hình Zalo của họ.
            Mỗi mục hiển thị <strong>luôn thu gọn</strong> — nhấn để mở.
          </p>
          {buildings.map(b => (
            <BuildingSection
              key={b.id}
              building={b}
              isAdmin={isAdmin}
              sessionUserId={sessionUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
