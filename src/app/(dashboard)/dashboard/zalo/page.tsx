"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, User, QrCode, Save, RefreshCw, Smartphone,
  Shield, Crown, Users, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  { key: "nhanSuCo",     label: "Sự cố",       chuyenKey: "chuyenSuCoChoQL" },
  { key: "nhanHoaDon",   label: "Hóa đơn",      chuyenKey: "chuyenHoaDonChoQL" },
  { key: "nhanTinKhach", label: "Tin nhắn KT",  chuyenKey: "chuyenTinKhachChoQL" },
  { key: "nhanNguoiLa",  label: "Người lạ",     chuyenKey: "chuyenNguoiLaChoQL" },
  { key: "nhanNhacNho",  label: "Nhắc nhở ĐN",  chuyenKey: "chuyenNhacNhoChoQL" },
];

interface AccountData {
  id: string;
  ten: string;
  email: string;
  zaloChatId: string | null;
  zaloAccountId: string | null;
  nhanThongBaoZalo: boolean;
  settings: ZaloSettings | null;
}

interface BuildingData {
  id: string;
  tenToaNha: string;
  chuTro: AccountData;
  quanLys: AccountData[];
}

// ─── Account Tab Content ──────────────────────────────────────────────────────

function AccountTabContent({
  account,
  buildingId,
  isChuTro,
  isAdmin,
  isSelf,
  onSaved,
}: {
  account: AccountData;
  buildingId: string;
  isChuTro: boolean;
  isAdmin: boolean;
  isSelf: boolean;
  onSaved: () => void;
}) {
  const canEdit = isAdmin || isSelf;

  const [settings, setSettings] = useState<ZaloSettings>(account.settings ?? DEFAULT_SETTINGS);
  const [zaloAccountId, setZaloAccountId] = useState(account.zaloAccountId ?? "");
  const [saving, setSaving] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleToggle = (key: keyof ZaloSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/zalo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch("/api/zalo-bot/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin && zaloAccountId ? { accountSelection: zaloAccountId } : {}),
      });
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="space-y-5 p-4">
      {/* Zalo Account Info */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Thông tin tài khoản Zalo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Zalo Chat ID (nhận tin)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={account.zaloChatId ?? ""}
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

          {/* Account ID chỉ admin mới thấy và chỉnh */}
          {isAdmin && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Account ID trên Bot Server (gửi tin)</Label>
              <Input
                value={zaloAccountId}
                onChange={e => setZaloAccountId(e.target.value)}
                className="h-8 text-xs"
                placeholder="Vd: 84912345678"
              />
            </div>
          )}
        </div>
      </div>

      {/* QR Login */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Đăng nhập Zalo qua QR
        </h3>
        <div className="flex items-start gap-4">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGetQR}
            disabled={qrLoading || !canEdit}
            className="text-xs gap-1.5"
          >
            <QrCode className="h-3.5 w-3.5" />
            {qrLoading ? "Đang lấy QR..." : "Lấy QR đăng nhập"}
          </Button>
          {qrCode && (
            <div className="flex flex-col items-center gap-1">
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Zalo"
                className="w-28 h-28 border rounded"
              />
              <span className="text-[10px] text-gray-400">Quét bằng Zalo</span>
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Cài đặt thông báo
          {isChuTro && (
            <span className="ml-2 text-gray-400 font-normal normal-case">
              — "Chuyển QL" khi bật: chỉ báo lại khi xong/thanh toán
            </span>
          )}
        </h3>
        <div className="border rounded-md overflow-hidden">
          <div className="divide-y">
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="flex items-center px-4 py-2.5 gap-6">
                <div className="w-28 text-xs text-gray-700 font-medium">{cat.label}</div>

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
      </div>

      {canEdit && (
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Đang lưu..." : "Lưu cài đặt"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Building Tab Content ─────────────────────────────────────────────────────

function BuildingTabContent({
  building,
  isAdmin,
  sessionUserId,
}: {
  building: BuildingData;
  isAdmin: boolean;
  sessionUserId: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const accounts = [
    { ...building.chuTro, role: "chuTro" as const },
    ...building.quanLys.map(q => ({ ...q, role: "quanLy" as const })),
  ];

  const defaultTab = accounts[0]?.id ?? "";

  return (
    <div className="pt-3" key={refreshKey}>
      {accounts.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Tòa nhà này chưa có chủ trọ hoặc quản lý
        </div>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full h-auto flex-wrap justify-start bg-gray-100 p-1 gap-1">
            {accounts.map(acc => {
              const isChuTro = acc.role === "chuTro";
              const isSelf = acc.id === sessionUserId;
              return (
                <TabsTrigger
                  key={acc.id}
                  value={acc.id}
                  className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  {isChuTro
                    ? <Crown className="h-3 w-3 text-amber-500" />
                    : <Users className="h-3 w-3 text-blue-400" />
                  }
                  <span>{acc.ten}</span>
                  {isSelf && <span className="text-[10px] text-gray-400">(bạn)</span>}
                  <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                    isSelf && isAdmin
                      ? "bg-red-100 text-red-600"
                      : isChuTro
                      ? "bg-amber-100 text-amber-600"
                      : "bg-blue-100 text-blue-600"
                  }`}>
                    {isSelf && isAdmin ? "Admin" : isChuTro ? "Chủ trọ" : "Quản lý"}
                  </span>
                  {acc.zaloChatId
                    ? <span className="text-[9px] text-green-500">●</span>
                    : <span className="text-[9px] text-gray-300">○</span>
                  }
                </TabsTrigger>
              );
            })}
          </TabsList>

          {accounts.map(acc => {
            const isChuTro = acc.role === "chuTro";
            const isSelf = acc.id === sessionUserId;
            return (
              <TabsContent key={acc.id} value={acc.id} className="mt-3 border rounded-lg">
                <AccountTabContent
                  account={acc}
                  buildingId={building.id}
                  isChuTro={isChuTro}
                  isAdmin={isAdmin}
                  isSelf={isSelf}
                  onSaved={() => setRefreshKey(k => k + 1)}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZaloSettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const sessionUserId = session?.user?.id ?? "";

  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBuildings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/zalo");
      const data = await res.json();
      if (data.ok) setBuildings(data.buildings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-blue-600" />
            Cài đặt Zalo
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý tài khoản Zalo, thông báo và phân quyền theo từng tòa nhà
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadBuildings} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Admin-only: Bot Server & Webhook */}
      {isAdmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Shield className="h-4 w-4" />
              Cài đặt hệ thống (Admin)
            </CardTitle>
            <CardDescription className="text-xs text-amber-600">
              Cấu hình Bot Server URL, webhook và tài khoản mặc định — xem tại{" "}
              <a href="/dashboard/cai-dat" className="underline font-medium">Cài đặt → Zalo</a>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Buildings Tabs */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Đang tải...</div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Chưa có tòa nhà nào</div>
      ) : (
        <Tabs defaultValue={buildings[0].id}>
          <div className="border-b">
            <TabsList className="h-auto bg-transparent p-0 gap-0">
              {buildings.map(b => (
                <TabsTrigger
                  key={b.id}
                  value={b.id}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Building2 className="h-4 w-4" />
                  {b.tenToaNha}
                  <span className="text-[10px] text-gray-400">
                    {1 + b.quanLys.length} người
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {buildings.map(b => (
            <TabsContent key={b.id} value={b.id} className="mt-0 pt-2">
              <BuildingTabContent
                building={b}
                isAdmin={isAdmin}
                sessionUserId={sessionUserId}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
