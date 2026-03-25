"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, QrCode, Save, RefreshCw, Smartphone,
  Crown, Users, User, ChevronDown, ChevronRight,
  Server, Webhook, Send, CheckCircle2, XCircle,
  Loader2, Eye, Terminal, Play,
  Image, FileText, Upload, MessageSquare,
  Bot, Copy, ExternalLink, ChevronLeft,
  HardDrive, Folder, UserPlus, AlertCircle, Zap, LogOut,
  Globe, QrCode as QrCodeIcon, Plus, Trash2, WifiOff,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRealtimeEvents } from "@/hooks/use-realtime";

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

interface ThreadSettings {
  id: string;
  threadId: string;
  ten: string | null;
  loai: string;
  nhanSuCo: boolean;
  nhanHoaDon: boolean;
  nhanTinKhach: boolean;
  nhanNguoiLa: boolean;
  nhanNhacNho: boolean;
}

const THREAD_BOOL_KEYS: (keyof ThreadSettings & string)[] = [
  'nhanSuCo', 'nhanHoaDon', 'nhanTinKhach', 'nhanNguoiLa', 'nhanNhacNho',
];

interface AccountData {
  id: string;
  ten: string;
  email: string;
  soDienThoai?: string | null;
  vaiTro?: string;
  zaloChatId: string | null;
  pendingZaloChatId?: string | null;
  zaloAccountId: string | null;
  zaloBotServerUrl: string | null;
  zaloBotUsername: string | null;
  zaloBotPassword: string | null;
  zaloBotTtl: number | null;
  zaloWebhookToken: string | null;
  nhanThongBaoZalo: boolean;
  settings: ZaloSettings | null;
  botOnline?: boolean | null; // true=online, false=bị out, null=chưa check
}

interface BuildingData {
  id: string;
  tenToaNha: string;
  chuTro: AccountData;
  quanLys: AccountData[];
}

// ─── Admin Bot Server Card ────────────────────────────────────────────────────

function BotServerCard({ account, canEdit = false, isAdmin = false }: {
  account?: AccountData; canEdit?: boolean; isAdmin?: boolean;
}) {
  const [status, setStatus] = useState<{
    ok: boolean; serverUrl?: string; accounts?: { id: string; name?: string }[];
    error?: string; accountId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Config form state (admin only)
  const [zaloAccountId, setZaloAccountId] = useState(account?.zaloAccountId ?? account?.soDienThoai ?? "");
  const [zaloBotServerUrl, setZaloBotServerUrl] = useState(account?.zaloBotServerUrl ?? "");
  const [zaloBotUsername, setZaloBotUsername] = useState(account?.zaloBotUsername ?? "");
  const [zaloBotPassword, setZaloBotPassword] = useState(account?.zaloBotPassword ? "••••••••" : "");
  const [zaloBotTtl, setZaloBotTtl] = useState(String(account?.zaloBotTtl ?? ""));
  const [saving, setSaving] = useState(false);

  // QR state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [autoSetupRunning, setAutoSetupRunning] = useState(false);
  const [autoSetupResult, setAutoSetupResult] = useState<{ ok: boolean; steps?: string[]; message?: string; error?: string } | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const ownId = zaloAccountId || account?.zaloAccountId;
      const params = ownId ? `?ownId=${encodeURIComponent(ownId)}` : "";
      const res = await fetch(`/api/zalo-bot/status${params}`);
      setStatus(await res.json());
    } catch {
      setStatus({ ok: false, error: "Không thể kết nối" });
    } finally {
      setLoading(false);
    }
  }, [zaloAccountId, account?.zaloAccountId]);

  const handleSaveConfig = async () => {
    if (!account) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/zalo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nguoiDungId: account.id,
          toaNhaId: "", // not updating settings
          zaloAccountId: zaloAccountId.trim() || null,
          zaloBotServerUrl: zaloBotServerUrl.trim() || null,
          zaloBotUsername: zaloBotUsername.trim() || null,
          zaloBotPassword: zaloBotPassword.includes("••••") ? undefined : (zaloBotPassword || null),
          zaloBotTtl: zaloBotTtl.trim() ? parseInt(zaloBotTtl, 10) || 0 : null,
        }),
      });
      const data = await res.json();
      if (data.ok) toast.success("Đã lưu cấu hình Bot Server");
      else toast.error(data.error || "Lưu thất bại");
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
        body: JSON.stringify(zaloAccountId ? { accountSelection: zaloAccountId } : {}),
      });
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
      else toast.error(data.error || "Không lấy được QR");
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Sau khi hiển thị QR, poll bot server 3s/lần để detect login → auto-setup
  useEffect(() => {
    if (!qrCode || !account?.id) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/zalo-bot/auto-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: account.id }),
        });
        const data = await res.json();
        if (data.ok) {
          if (qrPollRef.current) clearInterval(qrPollRef.current);
          qrPollRef.current = null;
          setAutoSetupRunning(false);
          setAutoSetupResult(data);
          setQrCode(null);
          toast.success(data.message || "Thiết lập tự động thành công");
          fetchStatus();
        }
      } catch { /* ignore */ }
    };
    setAutoSetupRunning(true);
    setAutoSetupResult(null);
    qrPollRef.current = setInterval(poll, 3000);
    const firstPoll = setTimeout(poll, 2000);
    return () => {
      if (qrPollRef.current) clearInterval(qrPollRef.current);
      qrPollRef.current = null;
      clearTimeout(firstPoll);
      setAutoSetupRunning(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrCode, account?.id]);

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-600" />
            Bot Server
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchStatus} disabled={loading} className="h-7 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Status */}
        <div className="space-y-2">
          {loading && !status && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra...
            </div>
          )}
          {status && (
            <>
              <div className="flex items-center gap-2">
                {status.ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className={`text-xs font-medium ${status.ok ? "text-green-700" : "text-red-700"}`}>
                  {status.ok ? "Đang kết nối" : "Mất kết nối"}
                </span>
              </div>
              {status.error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{status.error}</div>}
            </>
          )}
        </div>

        {/* Config form — admin only */}
        {isAdmin && (
          <div className="border-t pt-3 space-y-2.5">
            <p className="text-xs font-medium text-gray-600">Cấu hình Bot Server riêng
              <span className="text-gray-400 font-normal"> (để trống = dùng cài đặt hệ thống)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500">Account ID (own_id)</Label>
                <Input value={zaloAccountId} onChange={e => setZaloAccountId(e.target.value)}
                  className="h-7 text-xs font-mono" placeholder="Vd: 84912345678" disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500">URL Bot Server</Label>
                <Input value={zaloBotServerUrl} onChange={e => setZaloBotServerUrl(e.target.value)}
                  className="h-7 text-xs font-mono" placeholder="http://192.168.1.x:3000" disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500">Username</Label>
                <Input value={zaloBotUsername} onChange={e => setZaloBotUsername(e.target.value)}
                  className="h-7 text-xs" placeholder="admin" disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500">Password</Label>
                <Input type="password" value={zaloBotPassword} onChange={e => setZaloBotPassword(e.target.value)}
                  className="h-7 text-xs" placeholder="Nhập mật khẩu mới để đổi" disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500">TTL tin nhắn (ms)</Label>
                <Input value={zaloBotTtl} onChange={e => setZaloBotTtl(e.target.value)}
                  type="number" min={0} className="h-7 text-xs font-mono" placeholder="0 = không tự hủy" disabled={!canEdit} />
              </div>
            </div>
            {canEdit && (
              <Button size="sm" onClick={handleSaveConfig} disabled={saving} className="text-xs gap-1.5">
                <Save className="h-3 w-3" />
                {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            )}
          </div>
        )}

        {/* QR Login */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">Đăng nhập Zalo qua QR</p>
          <div className="flex items-start gap-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleGetQR}
              disabled={qrLoading || !canEdit} className="text-xs gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              {qrLoading ? "Đang lấy..." : "Lấy QR đăng nhập"}
            </Button>
            {qrCode && (
              <div className="flex flex-col items-center gap-1">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Zalo" className="w-48 h-48 border rounded bg-white"
                />
                <span className="text-[10px] text-gray-400">
                  {autoSetupRunning ? "Đang chờ quét QR... (tự động cài đặt sau khi đăng nhập)" : "Quét bằng app Zalo"}
                </span>
                {autoSetupRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
              </div>
            )}
            {autoSetupResult?.ok && (
              <div className="text-xs text-green-700 bg-green-50 px-2 py-1.5 rounded space-y-0.5">
                <div className="font-medium">{autoSetupResult.message}</div>
                {autoSetupResult.steps?.map((s, i) => <div key={i}>• {s}</div>)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Direct Card (Trực tiếp – zca-js) ─────────────────────────────────────────

interface DirectState {
  mode: string;
  directAccounts: { ownId: string; name: string; phone?: string; proxy?: string; loggedIn: boolean; loginTime: number }[];
  directStatus: { available: boolean; accountCount: number; loggedInCount: number };
  botServerUrl: string | null;
  botAccounts: any[];
  botError?: string;
  proxies: any[];
}

// ─── Zalo Connection Overview (hiển thị trên danh sách tòa nhà) ──────────────

function ZaloConnectionOverview() {
  const [state, setState] = useState<DirectState | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/zalo-direct");
      if (res.ok) setState(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Dedup all accounts
  const allAccounts = [
    ...(state?.directAccounts?.map((a) => ({ ...a, _source: "direct" as const })) || []),
    ...(state?.botAccounts?.map((a: any) => ({
      ownId: a.ownId || "", name: a.name || a.displayName || "", phone: a.phone || a.phoneNumber || "",
      proxy: a.proxy, loggedIn: a.isOnline ?? a.isConnected ?? true, loginTime: 0, _source: "bot-server" as const,
    })) || []),
  ];
  const uniqueAccounts = allAccounts.filter((a, i, arr) => arr.findIndex((b) => b.ownId === a.ownId) === i);

  if (loading && !state) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra kết nối Zalo...
      </div>
    );
  }

  if (!state) return null;

  const isActive = state.mode === "direct";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Status grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg p-2.5 border ${isActive ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className={`h-3.5 w-3.5 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
              <span className="text-xs font-medium">Direct (zca-js)</span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>Trạng thái: {state.directStatus.available
                ? <span className="text-emerald-700 font-medium">Hoạt động</span>
                : <span className="text-gray-400">Không hoạt động</span>}
              </div>
              <div>Online: <span className="font-medium">{state.directStatus.loggedInCount}</span>/{state.directStatus.accountCount}</div>
            </div>
          </div>
          <div className={`rounded-lg p-2.5 border ${state.mode === "bot-server" ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Server className={`h-3.5 w-3.5 ${state.mode === "bot-server" ? "text-blue-600" : "text-gray-400"}`} />
              <span className="text-xs font-medium">Bot Server</span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div className="truncate">URL: {state.botServerUrl
                ? <span className="font-mono text-[10px]">{state.botServerUrl}</span>
                : <span className="text-gray-400 italic">Chưa cấu hình</span>}
              </div>
              <div>TK: <span className="font-medium">{state.botAccounts?.length || 0}</span>
                {state.botError && <span className="text-red-500 ml-1">({state.botError})</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Current mode */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Đang dùng:</span>
          {isActive ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
              <Zap className="h-2.5 w-2.5 mr-1" /> Trực tiếp
            </Badge>
          ) : state.mode === "bot-server" ? (
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
              <Server className="h-2.5 w-2.5 mr-1" /> Bot Server
            </Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500 text-[10px]">
              <WifiOff className="h-2.5 w-2.5 mr-1" /> Chưa kết nối
            </Badge>
          )}
          <span className="text-[10px] text-gray-400">(Direct ưu tiên nếu có)</span>
        </div>

        {/* Account list */}
        {uniqueAccounts.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Tài khoản ({uniqueAccounts.length})</p>
            {uniqueAccounts.map((a) => (
              <div key={a.ownId} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.loggedIn ? "bg-green-500" : "bg-red-400"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{a.phone || a.name || a.ownId}</span>
                      {a.name && a.phone && <span className="text-gray-400">({a.name})</span>}
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {a._source === "direct" ? "Direct" : "Bot Server"}
                      </Badge>
                    </div>
                    <div className="text-gray-400 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px]">{a.ownId}</span>
                      {a.proxy
                        ? <span className="text-[10px]"><Globe className="h-2.5 w-2.5 inline mr-0.5" />{a.proxy}</span>
                        : <span className="text-[10px] text-gray-300"><Globe className="h-2.5 w-2.5 inline mr-0.5" />Không có proxy</span>
                      }
                    </div>
                  </div>
                </div>
                <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${a.loggedIn ? "text-green-500" : "text-red-400"}`} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DirectCard({ account, canEdit = false, isAdmin = false }: {
  account?: AccountData; canEdit?: boolean; isAdmin?: boolean;
}) {
  const [state, setState] = useState<DirectState | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrProxy, setQrProxy] = useState("");
  const [qrWaiting, setQrWaiting] = useState(false); // đang chờ user scan
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevAccountCountRef = useRef(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/zalo-direct");
      if (res.ok) setState(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Tìm direct account khớp với user này
  const matchedAccount = state?.directAccounts?.find(
    (a) =>
      (account?.zaloAccountId && a.ownId === account.zaloAccountId) ||
      (account?.soDienThoai && (a.ownId === account.soDienThoai || a.phone === account.soDienThoai))
  );

  const isActive = state?.mode === "direct";

  // Dedup tất cả accounts (direct ưu tiên)
  const allAccounts = [
    ...(state?.directAccounts?.map((a) => ({ ...a, _source: "direct" as const })) || []),
    ...(state?.botAccounts?.map((a: any) => ({
      ownId: a.ownId || "", name: a.name || a.displayName || "", phone: a.phone || a.phoneNumber || "",
      proxy: a.proxy, loggedIn: a.isOnline ?? a.isConnected ?? true, loginTime: 0, _source: "bot-server" as const,
    })) || []),
  ];
  const uniqueAccounts = allAccounts.filter((a, i, arr) => arr.findIndex((b) => b.ownId === a.ownId) === i);

  const postAction = async (action: string, data?: Record<string, any>) => {
    const res = await fetch("/api/admin/zalo-direct", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
    return res.json();
  };

  const handleLogout = async (ownId: string) => {
    if (!confirm("Đăng xuất tài khoản direct này?")) return;
    try {
      const r = await postAction("logout", { ownId });
      if (r.ok) { toast.success("Đã đăng xuất"); reload(); }
      else toast.error(r.error || "Đăng xuất thất bại");
    } catch { toast.error("Lỗi đăng xuất"); }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (qrPollRef.current) clearInterval(qrPollRef.current); };
  }, []);

  const handleLoginQR = async () => {
    setQrLoading(true); setQrImage(null); setQrWaiting(false);
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
    // Lưu số account hiện tại để so sánh khi poll
    prevAccountCountRef.current = state?.directAccounts?.length || 0;
    try {
      const r = await postAction("loginQR", { proxyUrl: qrProxy || undefined });
      if (r.ok) {
        if (r.qrCode) {
          setQrImage(r.qrCode);
          setQrWaiting(true);
          toast.info("Quét mã QR bằng Zalo để đăng nhập");
          // Poll 3s/lần để detect login thành công ở background
          qrPollRef.current = setInterval(async () => {
            try {
              const res = await fetch("/api/admin/zalo-direct");
              if (!res.ok) return;
              const data = await res.json();
              const newCount = data.directAccounts?.length || 0;
              if (newCount > prevAccountCountRef.current) {
                // Có tài khoản mới → login thành công
                if (qrPollRef.current) clearInterval(qrPollRef.current);
                qrPollRef.current = null;
                setState(data);
                setQrImage(null);
                setQrWaiting(false);
                const newAcc = data.directAccounts[data.directAccounts.length - 1];
                toast.success(`Đăng nhập direct thành công: ${newAcc?.name || newAcc?.ownId || "tài khoản mới"}`);
              }
            } catch { /* ignore */ }
          }, 3000);
        } else {
          toast.success(`Đã đăng nhập: ${r.ownId}`);
          reload();
        }
      } else toast.error(r.error || "Lỗi tạo QR");
    } catch { toast.error("Lỗi tạo QR"); }
    finally { setQrLoading(false); }
  };

  const handleAutoLoginAll = async () => {
    try {
      const r = await postAction("autoLoginAll");
      if (r.ok) { toast.success(`Auto-login: ${r.accounts?.length || 0} tài khoản`); reload(); }
      else toast.error(r.error || "Lỗi auto-login");
    } catch { toast.error("Lỗi auto-login"); }
  };

  // Auto-login chỉ account của user này (chuNha/quanLy)
  const handleAutoLoginSelf = async () => {
    const ownId = account?.zaloAccountId || account?.soDienThoai;
    if (!ownId) { toast.error("Chưa có Zalo Account ID"); return; }
    try {
      const r = await postAction("loginCookies", { ownId });
      if (r.ok) { toast.success(`Đã login lại: ${r.ownId || ownId}`); reload(); }
      else toast.error(r.error || "Không login được (chưa có cookies?)");
    } catch { toast.error("Lỗi auto-login"); }
  };

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-600" />
            Trực tiếp (Direct)
          </CardTitle>
          <div className="flex items-center gap-1">
            {canEdit && (
              isAdmin ? (
                <Button size="sm" variant="ghost" onClick={handleAutoLoginAll} className="h-7 px-2 text-xs gap-1">
                  <RefreshCw className="h-3 w-3" /> Auto-login tất cả
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={handleAutoLoginSelf} className="h-7 px-2 text-xs gap-1">
                  <RefreshCw className="h-3 w-3" /> Auto-login
                </Button>
              )
            )}
            <Button size="sm" variant="ghost" onClick={reload} disabled={loading} className="h-7 px-2">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {loading && !state && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra...
          </div>
        )}

        {state && (
          <>
            {/* Trạng thái tổng quan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Direct status */}
              <div className={`rounded-lg p-2.5 border ${isActive ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className={`h-3.5 w-3.5 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                  <span className="text-xs font-medium">Direct (zca-js)</span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div>Trạng thái: {state.directStatus.available
                    ? <span className="text-emerald-700 font-medium">Hoạt động</span>
                    : <span className="text-gray-400">Không hoạt động</span>}
                  </div>
                  <div>Online: <span className="font-medium text-emerald-700">{state.directStatus.loggedInCount}</span>/{state.directStatus.accountCount}</div>
                </div>
              </div>
              {/* Bot server status */}
              <div className={`rounded-lg p-2.5 border ${state.mode === "bot-server" ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Server className={`h-3.5 w-3.5 ${state.mode === "bot-server" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="text-xs font-medium">Bot Server</span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div className="truncate">URL: {state.botServerUrl
                    ? <span className="font-mono text-[10px]">{state.botServerUrl}</span>
                    : <span className="text-gray-400 italic">Chưa cấu hình</span>}
                  </div>
                  <div>TK: <span className="font-medium">{state.botAccounts?.length || 0}</span>
                    {state.botError && <span className="text-red-500 ml-1">({state.botError})</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Chế độ đang dùng */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Đang dùng:</span>
              {isActive ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                  <Zap className="h-2.5 w-2.5 mr-1" /> Trực tiếp
                </Badge>
              ) : state.mode === "bot-server" ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                  <Server className="h-2.5 w-2.5 mr-1" /> Bot Server
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500 text-[10px]">
                  <WifiOff className="h-2.5 w-2.5 mr-1" /> Chưa kết nối
                </Badge>
              )}
              <span className="text-[10px] text-gray-400">(Direct ưu tiên nếu có)</span>
            </div>

            {/* Danh sách tất cả tài khoản */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-600">
                Tài khoản ({uniqueAccounts.length})
              </p>
              {uniqueAccounts.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-3">Chưa có tài khoản nào</div>
              ) : uniqueAccounts.map((a) => (
                <div key={a.ownId} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                  (account?.zaloAccountId && a.ownId === account.zaloAccountId) ? "border-emerald-300 bg-emerald-50" : ""
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.loggedIn ? "bg-green-500" : "bg-red-400"}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate">{a.name || a.ownId}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {a._source === "direct" ? "Direct" : "Bot Server"}
                        </Badge>
                        {account?.zaloAccountId && a.ownId === account.zaloAccountId && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1 py-0">Tài khoản này</Badge>
                        )}
                      </div>
                      <div className="text-gray-400 flex items-center gap-2 flex-wrap">
                        {a.phone && <span>{a.phone}</span>}
                        <span className="font-mono text-[10px]">{a.ownId}</span>
                        {a.proxy && <span className="text-[10px]"><Globe className="h-2.5 w-2.5 inline mr-0.5" />{a.proxy}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {a.loggedIn
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    {a._source === "direct" && canEdit && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                        onClick={() => handleLogout(a.ownId)}>
                        <LogOut className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* QR Login */}
            {canEdit && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">Đăng nhập QR</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">Proxy (không bắt buộc)</Label>
                    <Input value={qrProxy} onChange={(e) => setQrProxy(e.target.value)}
                      placeholder="http://user:pass@host:port" className="h-7 text-xs font-mono" />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleLoginQR} disabled={qrLoading} className="text-xs gap-1.5">
                    {qrLoading
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo...</>
                      : <><QrCodeIcon className="h-3.5 w-3.5" /> Tạo mã QR</>}
                  </Button>
                </div>
                {qrImage && (
                  <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`}
                      alt="QR Code Zalo" className="w-48 h-48 rounded-lg border"
                    />
                    <p className="text-[11px] text-gray-500 text-center">Mở Zalo → Quét mã QR này</p>
                    {qrWaiting && (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang chờ quét... (tự động nhận khi đăng nhập xong)
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                      setQrImage(null); setQrWaiting(false);
                      if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
                      reload();
                    }}>
                      Đóng
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Proxy Card ───────────────────────────────────────────────────────────────

function ProxyCard({ canEdit = false }: { canEdit?: boolean }) {
  const [proxies, setProxies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newProxy, setNewProxy] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/zalo-direct");
      if (res.ok) {
        const data = await res.json();
        setProxies(data.proxies || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const postAction = async (action: string, data?: Record<string, any>) => {
    const res = await fetch("/api/admin/zalo-direct", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
    return res.json();
  };

  const handleAdd = async () => {
    if (!newProxy.trim()) return;
    setAdding(true);
    try {
      const r = await postAction("addProxy", { proxyUrl: newProxy.trim() });
      if (r.ok) { toast.success("Đã thêm proxy"); setNewProxy(""); reload(); }
      else toast.error(r.error || "Lỗi thêm proxy");
    } finally { setAdding(false); }
  };

  const handleRemove = async (url: string) => {
    if (!confirm(`Xóa proxy ${url}?`)) return;
    try {
      const r = await postAction("removeProxy", { proxyUrl: url });
      if (r.ok) { toast.success("Đã xóa proxy"); reload(); }
      else toast.error(r.error || "Lỗi xóa proxy");
    } catch { toast.error("Lỗi xóa proxy"); }
  };

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-600" />
            Proxy ({proxies.length})
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={reload} disabled={loading} className="h-7 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-[10px] text-gray-400">Mỗi tài khoản Zalo có thể dùng proxy riêng để tránh bị khóa IP</p>

        {/* Add proxy */}
        {canEdit && (
          <div className="flex gap-2">
            <Input value={newProxy} onChange={(e) => setNewProxy(e.target.value)}
              placeholder="http://user:pass@host:port" className="h-7 text-xs font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
            <Button size="sm" variant="outline" onClick={handleAdd} disabled={adding || !newProxy.trim()} className="h-7 px-2">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        )}

        {/* Proxy list */}
        {loading && proxies.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
          </div>
        )}
        {!loading && proxies.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <Globe className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
            <p className="text-xs">Không có proxy</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {proxies.map((proxy, i) => {
              const url = typeof proxy === "string" ? proxy : proxy.url || proxy.proxyUrl || JSON.stringify(proxy);
              return (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-mono truncate">{url}</span>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50 flex-shrink-0"
                      onClick={() => handleRemove(url)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Webhook Card ─────────────────────────────────────────────────────────────

function WebhookCard({ account }: { account?: AccountData }) {
  const [setting, setSetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; webhookUrl?: string; error?: string; ownId?: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; status?: number; error?: string } | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<{
    ownId: string; phoneNumber: string; isOnline: boolean;
    messageWebhookUrl: string | null; groupEventWebhookUrl: string | null; reactionWebhookUrl: string | null;
    hasWebhook: boolean;
  }[] | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Kiểm tra trạng thái webhook trên bot server (chỉ cho tài khoản của user)
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const params = new URLSearchParams();
      if (account?.zaloAccountId) params.set('ownId', account.zaloAccountId);
      if (account?.id) params.set('targetUserId', account.id);
      const qs = params.toString();
      const statusRes = await fetch(`/api/zalo-bot/webhook-status${qs ? `?${qs}` : ''}`).then(r => r.json()).catch(() => null);
      if (statusRes?.ok && statusRes.webhooks) {
        setWebhookStatus(statusRes.webhooks);
        // Clear result cũ khi status đã load xong (tránh mâu thuẫn hiển thị)
        setResult(null);
      }
      else if (statusRes?.error) setWebhookStatus([]);
    } finally { setLoadingStatus(false); }
  }, [account?.zaloAccountId, account?.id]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/zalo-bot/generate-webhook-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: account?.id || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setGeneratedUrl(data.webhookUrl);
        toast.success("Đã tạo URL webhook mới");
      } else {
        toast.error(data.error || "Tạo URL thất bại");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSet = async () => {
    setSetting(true);
    setResult(null);
    try {
      const res = await fetch("/api/zalo-bot/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: account?.id || undefined,
          ownId: account?.zaloAccountId || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        toast.success("Đã cài đặt webhook thành công");
        loadStatus();
      } else {
        toast.error(data.error || "Cài đặt webhook thất bại");
      }
    } finally {
      setSetting(false);
    }
  };

  const handleTest = async () => {
    const url = result?.webhookUrl || webhookStatus?.[0]?.messageWebhookUrl;
    if (!url) { toast.error("Chưa có webhook URL để test"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/zalo-bot/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: url }),
      });
      const data = await res.json();
      setTestResult({ ok: data.ok, status: data.status, error: data.error });
      if (data.ok) toast.success("Webhook phản hồi đúng");
      else toast.error(data.error || "Webhook không phản hồi");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Webhook className="h-4 w-4 text-violet-600" />
          Webhook
        </CardTitle>
        <CardDescription className="text-xs">Cài webhook cho tài khoản Zalo {account?.ten ? `của ${account.ten}` : ""}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Trạng thái webhook trên bot server */}
        {loadingStatus ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Đang kiểm tra webhook...
          </div>
        ) : webhookStatus !== null && (
          <div className="space-y-1">
            {webhookStatus.length === 0 ? (
              <div className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-700">
                Không kết nối được bot server
              </div>
            ) : webhookStatus.map(wh => (
              <div key={wh.ownId} className={`text-xs px-2 py-2 rounded ${
                !wh.isOnline ? "bg-red-50 text-red-600" :
                wh.hasWebhook ? "bg-green-50 text-green-700" :
                "bg-amber-50 text-amber-700"
              }`}>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`text-[9px] ${!wh.isOnline ? "text-red-500" : wh.hasWebhook ? "text-green-500" : "text-amber-500"}`}>●</span>
                  <span className="font-mono">{wh.phoneNumber || wh.ownId}</span>
                  <span className="mx-0.5">—</span>
                  {!wh.isOnline ? "Đã đăng xuất" :
                   wh.hasWebhook ? "Webhook OK" :
                   "Chưa cài webhook"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hiển thị Webhook URL hiện tại (luôn hiển thị để tra cứu) */}
        {(() => {
          // Lấy URL từ kết quả cài đặt gần nhất, hoặc từ trạng thái webhook trên bot server
          const whEntry = webhookStatus?.find(wh => wh.messageWebhookUrl);
          const currentUrl = result?.webhookUrl || whEntry?.messageWebhookUrl;
          const currentGroupUrl = whEntry?.groupEventWebhookUrl;
          const currentReactionUrl = whEntry?.reactionWebhookUrl;
          if (!currentUrl && !result) return null;
          return (
            <div className="border rounded-md p-2.5 space-y-1.5 bg-gray-50">
              <div className="text-[11px] font-medium text-gray-600">Webhook URL hiện tại</div>
              {currentUrl ? (
                <div className="space-y-1">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 w-14">Tin nhắn:</span>
                    <span className="text-[11px] font-mono text-green-700 break-all select-all">{currentUrl}</span>
                  </div>
                  {currentGroupUrl && currentGroupUrl !== currentUrl && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 w-14">Nhóm:</span>
                      <span className="text-[11px] font-mono text-green-700 break-all select-all">{currentGroupUrl}</span>
                    </div>
                  )}
                  {currentReactionUrl && currentReactionUrl !== currentUrl && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 w-14">Reaction:</span>
                      <span className="text-[11px] font-mono text-green-700 break-all select-all">{currentReactionUrl}</span>
                    </div>
                  )}
                </div>
              ) : result && !result.ok ? (
                <div className="text-[11px] text-red-600">{result.error}</div>
              ) : null}
            </div>
          );
        })()}

        {result && (
          <div className={`text-xs px-2 py-1.5 rounded ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {result.ok ? `✓ Đã cài webhook thành công` : `✗ ${result.error}`}
          </div>
        )}
        {testResult && (
          <div className={`text-xs px-2 py-1.5 rounded ${testResult.ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {testResult.ok ? `✓ Webhook OK (HTTP ${testResult.status})` : `✗ ${testResult.error || "Không phản hồi"}`}
          </div>
        )}

        {/* URL webhook đã tạo */}
        {generatedUrl && (
          <div className="border rounded-md p-2.5 space-y-1.5 bg-blue-50">
            <div className="text-[11px] font-medium text-blue-700">URL webhook mới (đã tạo)</div>
            <div className="text-[11px] font-mono text-blue-800 break-all select-all">{generatedUrl}</div>
            <div className="text-[10px] text-blue-500">Nhấn &quot;Cài webhook&quot; để cài URL này lên bot server</div>
          </div>
        )}

        {/* Bot Server đang dùng */}
        {account?.zaloBotServerUrl && (
          <div className="text-[10px] text-gray-400">
            Bot Server: <span className="font-mono">{account.zaloBotServerUrl}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="text-xs gap-1.5">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Tạo URL
          </Button>
          <Button size="sm" onClick={handleSet} disabled={setting} className="flex-1 text-xs gap-1.5">
            <Webhook className="h-3.5 w-3.5" />
            {setting ? "Đang cài..." : "Cài webhook"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="text-xs gap-1.5">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Test Send Card ───────────────────────────────────────────────────────────

type TestType = "text" | "image" | "file";

// ─── MinIO File Picker ────────────────────────────────────────────────────────

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MinioPickerDialog({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [buckets, setBuckets] = useState<{ name: string }[]>([]);
  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<{ name: string; size: number; url: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setBucket(null); setPrefix(""); setFolders([]); setFiles([]); return; }
    fetch("/api/admin/storage/buckets")
      .then(r => r.json())
      .then(d => setBuckets(d.buckets || []));
  }, [open]);

  const loadObjects = useCallback(async (b: string, p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/storage/objects?bucket=${encodeURIComponent(b)}&prefix=${encodeURIComponent(p)}`);
      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } finally { setLoading(false); }
  }, []);

  const selectBucket = (b: string) => { setBucket(b); setPrefix(""); loadObjects(b, ""); };
  const enterFolder = (f: string) => { setPrefix(f); loadObjects(bucket!, f); };
  const goBack = () => {
    const parts = prefix.split("/").filter(Boolean);
    parts.pop();
    const p = parts.length ? parts.join("/") + "/" : "";
    setPrefix(p);
    loadObjects(bucket!, p);
  };
  const shortName = (path: string) => path.replace(prefix, "").replace(/\/$/, "");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-600" /> Chọn file từ MinIO
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {!bucket ? (
            <>
              <p className="text-xs text-gray-500 mb-2">Chọn bucket:</p>
              {buckets.map(b => (
                <button key={b.name} type="button" onClick={() => selectBucket(b.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-blue-50 text-sm text-left">
                  <HardDrive className="h-4 w-4 text-blue-500 shrink-0" /> {b.name}
                </button>
              ))}
              {buckets.length === 0 && <p className="text-xs text-gray-400">Không có bucket</p>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                <button type="button" onClick={() => { setBucket(null); setPrefix(""); }}
                  className="hover:text-blue-600 font-medium">{bucket}</button>
                {prefix && <><ChevronRight className="h-3 w-3" /><span className="truncate max-w-[200px]">{prefix}</span></>}
              </div>
              {prefix && (
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md w-full text-left">
                  <ChevronLeft className="h-3.5 w-3.5" /> Quay lại
                </button>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
                </div>
              )}
              {folders.map(f => (
                <button key={f} type="button" onClick={() => enterFolder(f)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-yellow-50 text-sm text-left">
                  <Folder className="h-4 w-4 text-yellow-500 shrink-0" /> {shortName(f)}
                </button>
              ))}
              {files.map(f => (
                <button key={f.name} type="button" onClick={() => { onSelect(f.url); onClose(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-green-50 text-sm text-left">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="flex-1 truncate">{shortName(f.name)}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{fmtBytes(f.size)}</span>
                </button>
              ))}
              {!loading && folders.length === 0 && files.length === 0 && (
                <p className="text-xs text-gray-400 py-2">Thư mục trống</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test Send Card ───────────────────────────────────────────────────────────

function TestSendCard({ account }: { account?: AccountData }) {
  const [chatId, setChatId] = useState(account?.zaloChatId ?? "");
  const [testType, setTestType] = useState<TestType>("text");
  const [threadType, setThreadType] = useState<0 | 1>(0); // 0=user, 1=group
  const [message, setMessage] = useState("Tin nhắn test từ hệ thống QL Trọ");
  const [imageUrl, setImageUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMinioPicker, setShowMinioPicker] = useState(false);
  const [minioPickerTarget, setMinioPickerTarget] = useState<"image" | "file">("image");

  const switchType = (t: TestType) => {
    setTestType(t);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", testType === "image" ? "image" : "file");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) {
        if (testType === "image") setImageUrl(data.secure_url);
        else setFileUrl(data.secure_url);
        toast.success("Upload thành công");
      } else {
        toast.error(data.message || "Upload thất bại");
      }
    } catch {
      toast.error("Lỗi upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!chatId.trim()) {
      toast.error("Cần nhập Chat ID người nhận");
      return;
    }
    if (testType === "text" && !message.trim()) {
      toast.error("Cần nhập nội dung tin nhắn");
      return;
    }
    if (testType === "image" && !imageUrl.trim()) {
      toast.error("Cần nhập URL hình ảnh hoặc upload từ máy");
      return;
    }
    if (testType === "file" && !fileUrl.trim()) {
      toast.error("Cần nhập URL file hoặc upload từ máy");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        chatId: chatId.trim(),
        threadType,
      };
      if (account?.id) body.targetUserId = account.id;
      if (testType === "text") body.message = message;
      else if (testType === "image") {
        body.imageUrl = imageUrl.trim();
        if (message.trim()) body.message = message;
      } else {
        body.fileUrl = fileUrl.trim();
        if (message.trim()) body.message = message;
      }
      const res = await fetch("/api/gui-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const ok = data.success === true;
      setResult({ ok, error: data.message || data.error });
      if (ok) toast.success("Đã gửi thành công");
      else toast.error(data.message || data.error || "Gửi thất bại");
    } finally {
      setSending(false);
    }
  };

  const typeLabel: Record<TestType, string> = { text: "Văn bản", image: "Hình ảnh", file: "File" };
  const typeIcon = { text: MessageSquare, image: Image, file: FileText };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="h-4 w-4 text-green-600" />
          Test gửi tin
        </CardTitle>
        <CardDescription className="text-xs">Kiểm tra gửi tin nhắn, hình ảnh hoặc file qua Zalo Bot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Loại gửi */}
        <div className="flex gap-2">
          {(["text", "image", "file"] as const).map(t => {
            const Icon = typeIcon[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  testType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {typeLabel[t]}
              </button>
            );
          })}
        </div>

        {/* Chat ID */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Chat ID người nhận (Thread ID)</Label>
          <Input
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="VD: 6643404425553198601"
            className="h-8 text-xs font-mono"
          />
        </div>

        {/* Loại thread */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Loại thread</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setThreadType(0)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                threadType === 0
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Người dùng
            </button>
            <button
              type="button"
              onClick={() => setThreadType(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                threadType === 1
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Nhóm
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Chọn sai loại thread có thể khiến bot báo lỗi.</p>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={testType === "image" ? "image/*" : "*/*"}
          onChange={handleUpload}
        />

        {/* MinIO Picker */}
        <MinioPickerDialog
          open={showMinioPicker}
          onClose={() => setShowMinioPicker(false)}
          onSelect={url => { if (minioPickerTarget === "image") setImageUrl(url); else setFileUrl(url); }}
        />

        {/* URL hình ảnh */}
        {testType === "image" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">URL hình ảnh</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={() => { setMinioPickerTarget("image"); setShowMinioPicker(true); }}
                >
                  <HardDrive className="h-3 w-3" /> Chọn từ MinIO
                </button>
                <button
                  type="button"
                  className="text-xs text-green-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploading ? "Đang upload..." : "Upload từ máy"}
                </button>
              </div>
            </div>
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="text-xs"
            />
            {imageUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl) && (
              <img src={imageUrl} alt="preview" className="rounded max-h-24 max-w-xs object-contain border" />
            )}
          </div>
        )}

        {/* URL file */}
        {testType === "file" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500">URL file</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={() => { setMinioPickerTarget("file"); setShowMinioPicker(true); }}
                >
                  <HardDrive className="h-3 w-3" /> Chọn từ MinIO
                </button>
                <button
                  type="button"
                  className="text-xs text-green-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploading ? "Đang upload..." : "Upload từ máy"}
                </button>
              </div>
            </div>
            <Input
              type="url"
              placeholder="https://example.com/document.pdf"
              value={fileUrl}
              onChange={e => setFileUrl(e.target.value)}
              className="text-xs"
            />
          </div>
        )}

        {/* Nội dung / caption */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">
            {testType === "text" ? "Nội dung tin nhắn" : "Caption / mô tả (tùy chọn)"}
          </Label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={testType === "text" ? "Nội dung tin nhắn..." : "Để trống nếu không cần caption"}
            className="text-xs min-h-[60px] resize-none"
          />
        </div>

        {result && (
          <div className={`text-xs px-2 py-1.5 rounded ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {result.ok ? "✓ Đã gửi thành công" : `✗ ${result.error}`}
          </div>
        )}
        <Button size="sm" onClick={handleSend} disabled={sending || uploading} className="w-full text-xs gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {sending ? "Đang gửi..." : "Gửi thử"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Monitor Card ─────────────────────────────────────────────────────────────

interface ZaloMsgItem {
  id: string;
  chatId: string;
  displayName?: string | null;
  content: string;
  role: string;
  createdAt: string;
  attachmentUrl?: string | null;
  rawPayload?: any;
  eventName?: string | null;
}

function msgImgUrl(m: ZaloMsgItem): string | null {
  return m.attachmentUrl || m.rawPayload?.data?.content?.href || null;
}

function msgFileUrl(m: ZaloMsgItem): string | null {
  const msgType = m.rawPayload?.data?.msgType;
  if (msgType === 'share.file') return m.rawPayload?.data?.content?.href || null;
  return null;
}

function msgSenderName(m: ZaloMsgItem): string {
  return m.rawPayload?.data?.dName || m.displayName || m.chatId;
}

function msgIsGroup(m: ZaloMsgItem): boolean {
  return m.rawPayload?.type === 1;
}

function msgThreadId(m: ZaloMsgItem): string {
  return m.rawPayload?.threadId || m.chatId;
}

function fmtTime(s: string) {
  const d = new Date(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function MsgBubble({ m, compact = false }: { m: ZaloMsgItem; compact?: boolean }) {
  const isBot = m.role === 'bot';
  const imgUrl = msgImgUrl(m);
  const fileUrl = msgFileUrl(m);
  const msgType = m.rawPayload?.data?.msgType;

  return (
    <div className={`flex items-end gap-1.5 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${isBot ? 'bg-gray-200' : 'bg-blue-100'}`}>
        {isBot ? <Bot className="h-3.5 w-3.5 text-gray-500" /> : <User className="h-3.5 w-3.5 text-blue-600" />}
      </div>
      <div className={`rounded-2xl px-3 py-2 text-sm ${compact ? 'max-w-[85%]' : 'max-w-[75%]'} ${
        isBot ? 'bg-gray-100 text-gray-800 rounded-bl-sm' : 'bg-blue-500 text-white rounded-br-sm'
      }`}>
        {imgUrl && msgType !== 'share.file' && (
          <a href={imgUrl} target="_blank" rel="noopener noreferrer">
            <img src={imgUrl} alt="" className="rounded-lg max-h-48 max-w-full mb-1 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </a>
        )}
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-xs underline ${isBot ? 'text-blue-600' : 'text-blue-100'}`}>
            <FileText className="h-4 w-4 shrink-0" />
            <span>{m.content}</span>
          </a>
        )}
        {!fileUrl && (
          <span className="whitespace-pre-wrap break-words leading-relaxed text-sm">
            {m.content === '[hình ảnh]' && imgUrl ? '' : m.content}
          </span>
        )}
        <span className={`block text-[10px] mt-0.5 ${isBot ? 'text-gray-400' : 'text-blue-100'}`}>
          {fmtTime(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

function ChatHistoryDialog({ chatId, name, open, onClose }: {
  chatId: string; name: string; open: boolean; onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<ZaloMsgItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    try {
      const url = `/api/zalo/messages?chatId=${encodeURIComponent(chatId)}&limit=50${before ? `&before=${before}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      const batch: ZaloMsgItem[] = data.data ?? [];
      if (before) setMsgs(prev => [...batch, ...prev]);
      else {
        setMsgs(batch);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
      setHasMore(batch.length === 50);
    } finally { setLoading(false); }
  }, [chatId]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useRealtimeEvents(['zalo-message'], () => { if (open) void load(); });

  const tid = msgs.length ? msgThreadId(msgs[0]) : chatId;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-blue-500" />
            <span>{name}</span>
          </DialogTitle>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-gray-400 font-mono">Thread ID: {tid}</span>
            <button onClick={() => { navigator.clipboard.writeText(tid); toast.success('Đã copy'); }}
              className="text-gray-300 hover:text-blue-500 ml-0.5">
              <Copy className="h-3 w-3" />
            </button>
            <a href="/dashboard/zalo-monitor" target="_blank"
              className="ml-2 text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-3 w-3" />Mở trang đầy đủ
            </a>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {hasMore && (
            <div className="text-center pb-1">
              <Button size="sm" variant="outline" className="text-xs h-7"
                onClick={() => load(msgs[0]?.createdAt)} disabled={loading}>
                {loading ? 'Đang tải...' : 'Tải thêm'}
              </Button>
            </div>
          )}
          {msgs.map((m, i) => {
            const showDate = i === 0 || new Date(m.createdAt).toDateString() !== new Date(msgs[i - 1].createdAt).toDateString();
            return (
              <div key={m.id}>
                {showDate && (
                  <div className="text-center text-[10px] text-gray-400 py-1">
                    {new Date(m.createdAt).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </div>
                )}
                <MsgBubble m={m} />
              </div>
            );
          })}
          {msgs.length === 0 && !loading && (
            <p className="text-center text-gray-400 text-sm py-8">Chưa có tin nhắn.</p>
          )}
          {loading && msgs.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Công cụ kết bạn + gửi tin nhắn (2 tab riêng) ───────────────────────────

const ENTITY_OPTIONS = [
  { value: 'khachThue', label: 'Khách thuê' },
  { value: 'nguoiDung', label: 'Quản lý / Nhân viên' },
] as const;

type FRTab = 'ketBan' | 'guiTin' | 'vanMau';

/** Hiển thị kết quả từng bước */
function StepResult({ result }: { result: { ok: boolean; message?: string; steps?: any[] } }) {
  return (
    <div className={`rounded-md p-2.5 text-xs space-y-1.5 ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <div className="flex items-center gap-1.5">
        {result.ok
          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          : <XCircle className="h-3.5 w-3.5 text-red-600" />}
        <span className={`font-medium ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
          {result.message}
        </span>
      </div>
      {result.steps && result.steps.length > 0 && (
        <div className="space-y-0.5 pl-5">
          {result.steps.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px]">
              {s.ok
                ? <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                : <XCircle className="h-2.5 w-2.5 text-red-500" />}
              <span className="text-gray-600">{s.step}:</span>
              <span className={s.ok ? 'text-green-600' : 'text-red-600'}>{s.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Auto Message Card (Tin nhắn tự động) ────────────────────────────────────

interface AutoMsgRecipient {
  id: string;
  ten: string;
  soDienThoai?: string | null;
  phong?: string;
  zaloChatId?: string | null;
  nhanThongBaoZalo?: boolean;
  type: 'khachThue' | 'nguoiDung';
}

function AutoMessageCard({ account, buildingId }: { account?: AccountData; buildingId: string }) {
  const [recipients, setRecipients] = useState<AutoMsgRecipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ id: string; ten: string; ok: boolean; error?: string }[]>([]);
  const [tab, setTab] = useState<'all' | 'hasZalo'>('hasZalo');

  const MAX_MSG = 2000;

  // Tải danh sách khách thuê + quản lý của tòa nhà
  const loadRecipients = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/zalo?toaNhaId=${encodeURIComponent(buildingId)}`);
      if (!res.ok) return;
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (!data.ok) return;

      const building = data.buildings?.[0];
      if (!building) return;

      const list: AutoMsgRecipient[] = [];

      // Chủ trọ
      if (building.chuTro) {
        list.push({
          id: building.chuTro.id,
          ten: building.chuTro.ten,
          soDienThoai: building.chuTro.soDienThoai,
          zaloChatId: building.chuTro.zaloChatId,
          nhanThongBaoZalo: building.chuTro.nhanThongBaoZalo,
          type: 'nguoiDung',
        });
      }

      // Quản lý
      for (const ql of building.quanLys || []) {
        list.push({
          id: ql.id,
          ten: ql.ten,
          soDienThoai: ql.soDienThoai,
          zaloChatId: ql.zaloChatId,
          nhanThongBaoZalo: ql.nhanThongBaoZalo,
          type: 'nguoiDung',
        });
      }

      // Khách thuê (qua API riêng)
      try {
        const ktRes = await fetch(`/api/admin/zalo/khach-thue?toaNhaId=${encodeURIComponent(buildingId)}`);
        if (ktRes.ok) {
          const ktText = await ktRes.text();
          if (ktText) {
            const ktData = JSON.parse(ktText);
            for (const kt of ktData.khachThues || []) {
              list.push({
                id: kt.id,
                ten: kt.hoTen || kt.ten || 'Không tên',
                soDienThoai: kt.soDienThoai,
                phong: kt.phong?.maPhong || kt.phong?.soPhong,
                zaloChatId: kt.zaloChatId,
                nhanThongBaoZalo: kt.nhanThongBaoZalo,
                type: 'khachThue',
              });
            }
          }
        }
      } catch { /* ignore - API might not exist yet */ }

      setRecipients(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [buildingId]);

  useEffect(() => { loadRecipients(); }, [loadRecipients]);

  const filtered = tab === 'hasZalo'
    ? recipients.filter(r => r.zaloChatId && r.nhanThongBaoZalo)
    : recipients;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Cần nhập nội dung'); return; }
    if (selected.size === 0) { toast.error('Chưa chọn người nhận'); return; }

    setSending(true);
    setResults([]);
    const newResults: typeof results = [];

    for (const id of selected) {
      const r = recipients.find(x => x.id === id);
      if (!r) continue;

      try {
        const body: Record<string, any> = {
          message: message.trim(),
          threadType: 0,
        };

        if (r.zaloChatId) {
          body.chatId = r.zaloChatId;
        } else if (r.soDienThoai) {
          body.phone = r.soDienThoai;
        } else {
          newResults.push({ id, ten: r.ten, ok: false, error: 'Không có SĐT hoặc ChatID' });
          continue;
        }

        if (account?.zaloAccountId) body.targetUserId = account.id;

        const res = await fetch('/api/gui-zalo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        newResults.push({ id, ten: r.ten, ok: data.ok || data.success, error: data.error || data.message });
      } catch (err: any) {
        newResults.push({ id, ten: r.ten, ok: false, error: err.message });
      }
    }

    setResults(newResults);
    setSending(false);
    const ok = newResults.filter(r => r.ok).length;
    const fail = newResults.filter(r => !r.ok).length;
    if (ok > 0) toast.success(`Đã gửi ${ok} tin nhắn thành công`);
    if (fail > 0) toast.error(`${fail} tin nhắn thất bại`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-600" />
          Tin nhắn tự động
        </CardTitle>
        <CardDescription className="text-xs">
          Gửi tin nhắn hàng loạt cho khách thuê và quản lý trong tòa nhà
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Nội dung tin nhắn */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Nội dung tin nhắn *</Label>
            <span className={`text-[10px] ${message.length > MAX_MSG ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
              {message.length}/{MAX_MSG}
            </span>
          </div>
          <Textarea
            placeholder="Nhập nội dung tin nhắn gửi cho tất cả người đã chọn..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            className={`text-xs resize-none ${message.length > MAX_MSG ? 'border-red-400' : ''}`}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border rounded-md overflow-hidden">
            <button type="button" onClick={() => setTab('hasZalo')}
              className={`px-2.5 py-1 text-[11px] ${tab === 'hasZalo' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Có Zalo ({recipients.filter(r => r.zaloChatId && r.nhanThongBaoZalo).length})
            </button>
            <button type="button" onClick={() => setTab('all')}
              className={`px-2.5 py-1 text-[11px] ${tab === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Tất cả ({recipients.length})
            </button>
          </div>
          <button type="button" onClick={selectAll} className="text-[10px] text-indigo-600 hover:underline">
            {selected.size === filtered.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
          <Button size="sm" variant="ghost" onClick={loadRecipients} disabled={loading} className="h-6 px-1.5 ml-auto">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Danh sách người nhận */}
        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-1.5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-xs">
              {tab === 'hasZalo' ? 'Không có ai đã kết nối Zalo' : 'Không có người nhận'}
            </div>
          ) : filtered.map(r => (
            <label key={r.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50 text-xs ${
              selected.has(r.id) ? 'bg-indigo-50 border border-indigo-200' : ''
            }`}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                className="rounded border-gray-300 text-indigo-600 h-3.5 w-3.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium truncate">{r.ten}</span>
                  {r.phong && <Badge variant="outline" className="text-[9px] px-1 py-0">P.{r.phong}</Badge>}
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                    r.type === 'khachThue' ? 'text-blue-600 border-blue-200' : 'text-amber-600 border-amber-200'
                  }`}>
                    {r.type === 'khachThue' ? 'KT' : 'QL'}
                  </Badge>
                </div>
                <div className="text-gray-400 flex items-center gap-2">
                  {r.soDienThoai && <span>{r.soDienThoai}</span>}
                  {r.zaloChatId ? (
                    <span className="text-green-600 text-[10px]">Zalo OK</span>
                  ) : (
                    <span className="text-gray-300 text-[10px]">Chưa kết nối</span>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Gửi */}
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || selected.size === 0 || !message.trim() || message.length > MAX_MSG}
          className="w-full gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {sending ? 'Đang gửi...' : `Gửi cho ${selected.size} người`}
        </Button>

        {/* Kết quả */}
        {results.length > 0 && (
          <div className="border rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
            <p className="text-[10px] font-medium text-gray-500">Kết quả:</p>
            {results.map(r => (
              <div key={r.id} className="flex items-center gap-1.5 text-[11px]">
                {r.ok
                  ? <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  : <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                <span className="truncate">{r.ten}</span>
                {!r.ok && r.error && <span className="text-red-500 truncate">— {r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FriendRequestCard({ account, buildingId }: { account?: AccountData; buildingId: string }) {
  const [tab, setTab] = useState<FRTab>('ketBan');

  // Thông tin chung dùng cho cả 2 tab
  const [phone, setPhone] = useState('');
  const [tenNguoiNhan, setTenNguoiNhan] = useState('');
  const [entityType, setEntityType] = useState<'khachThue' | 'nguoiDung'>('khachThue');
  const [phong, setPhong] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Tab 1: Kết bạn
  const [friendMsg, setFriendMsg] = useState('');
  const [sendingFR, setSendingFR] = useState(false);
  const [resultFR, setResultFR] = useState<{ ok: boolean; message?: string; steps?: any[] } | null>(null);

  // Tab 2: Gửi tin nhắn
  const [followUpMsg, setFollowUpMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; message?: string; steps?: any[] } | null>(null);

  // Tab 3: Văn mẫu tùy chỉnh
  const [tplFriendKT, setTplFriendKT] = useState('');
  const [tplFriendQL, setTplFriendQL] = useState('');
  const [tplFollowKT, setTplFollowKT] = useState('');
  const [tplFollowQL, setTplFollowQL] = useState('');
  const [tplLoaded, setTplLoaded] = useState(false);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSaving, setTplSaving] = useState(false);

  const MAX_FRIEND = 150;
  const MAX_MSG = 2000;

  // Lấy văn mẫu
  const loadTemplate = useCallback(async () => {
    if (!tenNguoiNhan.trim()) return;
    setLoadingTemplate(true);
    try {
      const params = new URLSearchParams({
        ten: tenNguoiNhan.trim(),
        entityType,
        ...(buildingId && { toaNhaId: buildingId }),
        ...(phong && { phong }),
      });
      const res = await fetch(`/api/zalo-bot/friend-request/template?${params}`);
      if (!res.ok) { toast.error(`Lỗi tải văn mẫu (${res.status})`); return; }
      const text = await res.text();
      if (!text) { toast.error('Server trả về rỗng'); return; }
      const data = JSON.parse(text);
      if (data.ok) {
        setFriendMsg(data.friendMsg);
        setFollowUpMsg(data.followUpMsg);
        toast.success('Đã tải văn mẫu');
      } else {
        toast.error(data.error || 'Không thể tải văn mẫu');
      }
    } catch (err: any) {
      toast.error(`Không thể tải văn mẫu: ${err?.message || 'Lỗi kết nối'}`);
    } finally {
      setLoadingTemplate(false);
    }
  }, [tenNguoiNhan, entityType, buildingId, phong]);

  // Tải văn mẫu gốc (raw templates) cho tab Văn mẫu
  const loadRawTemplates = useCallback(async () => {
    if (!buildingId) { toast.error('Không có tòa nhà'); return; }
    setTplLoading(true);
    try {
      const res = await fetch(`/api/zalo-bot/friend-request/template?toaNhaId=${encodeURIComponent(buildingId)}&ten=bạn&entityType=khachThue`);
      if (!res.ok) { toast.error(`Lỗi tải văn mẫu (${res.status})`); return; }
      const text = await res.text();
      if (!text) { toast.error('Server trả về rỗng'); return; }
      const data = JSON.parse(text);
      if (data.ok && data.rawTemplates) {
        setTplFriendKT(data.rawTemplates.friendMsgKT || '');
        setTplFriendQL(data.rawTemplates.friendMsgQL || '');
        setTplFollowKT(data.rawTemplates.followUpMsgKT || '');
        setTplFollowQL(data.rawTemplates.followUpMsgQL || '');
        setTplLoaded(true);
      } else {
        toast.error(data.error || 'Không thể tải văn mẫu');
      }
    } catch (err: any) {
      toast.error(`Không thể tải văn mẫu: ${err?.message || 'Lỗi kết nối'}`);
    } finally {
      setTplLoading(false);
    }
  }, [buildingId]);

  // Lưu văn mẫu tùy chỉnh
  const saveTemplates = async () => {
    if (!buildingId) { toast.error('Không có tòa nhà'); return; }
    setTplSaving(true);
    try {
      const res = await fetch('/api/zalo-bot/friend-request/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toaNhaId: buildingId,
          friendMsgKT: tplFriendKT.trim() || undefined,
          friendMsgQL: tplFriendQL.trim() || undefined,
          followUpMsgKT: tplFollowKT.trim() || undefined,
          followUpMsgQL: tplFollowQL.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) toast.success('Đã lưu văn mẫu');
      else toast.error(data.error || 'Lưu thất bại');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setTplSaving(false);
    }
  };

  // Gửi kết bạn
  const handleSendFR = async () => {
    if (!phone.trim()) { toast.error('Cần nhập SĐT'); return; }
    if (!friendMsg.trim()) { toast.error('Cần nhập lời mời kết bạn'); return; }
    if (friendMsg.length > MAX_FRIEND) { toast.error(`Tối đa ${MAX_FRIEND} ký tự`); return; }
    setSendingFR(true);
    setResultFR(null);
    try {
      const res = await fetch('/api/zalo-bot/friend-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'friendRequest',
          phone: phone.trim(),
          friendMsg: friendMsg.trim(),
          accountSelection: account?.zaloAccountId || undefined,
        }),
      });
      const data = await res.json();
      setResultFR({ ok: data.ok, message: data.message ?? data.error, steps: data.steps });
      if (data.ok) toast.success(data.message || 'Thành công');
      else toast.error(data.error || 'Thất bại');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSendingFR(false);
    }
  };

  // Gửi tin nhắn
  const handleSendMsg = async () => {
    if (!phone.trim()) { toast.error('Cần nhập SĐT'); return; }
    if (!followUpMsg.trim()) { toast.error('Cần nhập nội dung tin nhắn'); return; }
    setSendingMsg(true);
    setResultMsg(null);
    try {
      const res = await fetch('/api/zalo-bot/friend-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          phone: phone.trim(),
          message: followUpMsg.trim(),
          accountSelection: account?.zaloAccountId || undefined,
        }),
      });
      const data = await res.json();
      setResultMsg({ ok: data.ok, message: data.message ?? data.error, steps: data.steps });
      if (data.ok) toast.success(data.message || 'Đã gửi');
      else toast.error(data.error || 'Thất bại');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSendingMsg(false);
    }
  };

  const friendMsgOverLimit = friendMsg.length > MAX_FRIEND;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-pink-600" />
          Kết bạn &amp; gửi tin nhắn
        </CardTitle>
        <CardDescription className="text-xs">
          Tìm SĐT trên Zalo → kết bạn hoặc gửi tin nhắn. Bấm "Văn mẫu" để tự điền theo tòa nhà.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ── Thông tin chung ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">SĐT người nhận *</Label>
            <Input
              placeholder="0345324515"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Tên người nhận</Label>
            <Input
              placeholder="Nguyễn Văn A"
              value={tenNguoiNhan}
              onChange={e => setTenNguoiNhan(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Loại</Label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value as 'khachThue' | 'nguoiDung')}
              className="w-full h-8 text-xs border rounded-md px-2 bg-background"
            >
              {ENTITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Phòng</Label>
            <Input
              placeholder="101"
              value={phong}
              onChange={e => setPhong(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTemplate}
            disabled={loadingTemplate || !tenNguoiNhan.trim()}
            className="h-8 text-xs gap-1"
          >
            {loadingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Văn mẫu
          </Button>
        </div>

        {/* ── 2 Tab ── */}
        <div className="flex gap-1 border-b">
          <button
            type="button"
            onClick={() => setTab('ketBan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'ketBan'
                ? 'border-pink-500 text-pink-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="h-3 w-3" />
            Kết bạn
          </button>
          <button
            type="button"
            onClick={() => setTab('guiTin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'guiTin'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send className="h-3 w-3" />
            Gửi tin nhắn
          </button>
          <button
            type="button"
            onClick={() => { setTab('vanMau'); if (!tplLoaded) loadRawTemplates(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'vanMau'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-3 w-3" />
            Văn mẫu
          </button>
        </div>

        {/* ── Tab 1: Kết bạn ── */}
        {tab === 'ketBan' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Lời mời kết bạn *</Label>
                <span className={`text-[10px] ${friendMsgOverLimit ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                  {friendMsg.length}/{MAX_FRIEND}
                </span>
              </div>
              <Textarea
                placeholder="Chào bạn, kết bạn với tôi để nhận thông báo..."
                value={friendMsg}
                onChange={e => setFriendMsg(e.target.value)}
                rows={2}
                className={`text-xs resize-none ${friendMsgOverLimit ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {friendMsgOverLimit && (
                <p className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Zalo giới hạn lời mời kết bạn tối đa {MAX_FRIEND} ký tự
                </p>
              )}
            </div>
            {resultFR && <StepResult result={resultFR} />}
            <Button
              size="sm"
              onClick={handleSendFR}
              disabled={sendingFR || !phone.trim() || !friendMsg.trim() || friendMsgOverLimit}
              className="w-full gap-1.5 text-xs bg-pink-600 hover:bg-pink-700"
            >
              {sendingFR ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {sendingFR ? 'Đang gửi kết bạn...' : 'Tìm & Kết bạn'}
            </Button>
          </div>
        )}

        {/* ── Tab 2: Gửi tin nhắn ── */}
        {tab === 'guiTin' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Nội dung tin nhắn *</Label>
                <span className="text-[10px] text-muted-foreground">{followUpMsg.length}/{MAX_MSG}</span>
              </div>
              <Textarea
                placeholder="Chào bạn, bạn đang ở nhà trọ... Xác nhận 'đúng' hay 'không phải'..."
                value={followUpMsg}
                onChange={e => setFollowUpMsg(e.target.value)}
                rows={4}
                className="text-xs resize-none"
              />
            </div>
            {resultMsg && <StepResult result={resultMsg} />}
            <Button
              size="sm"
              onClick={handleSendMsg}
              disabled={sendingMsg || !phone.trim() || !followUpMsg.trim()}
              className="w-full gap-1.5 text-xs"
            >
              {sendingMsg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sendingMsg ? 'Đang gửi tin nhắn...' : 'Tìm & Gửi tin nhắn'}
            </Button>
          </div>
        )}

        {/* ── Tab 3: Văn mẫu tùy chỉnh ── */}
        {tab === 'vanMau' && (
          <div className="space-y-3">
            {tplLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải văn mẫu...
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
                  Chỉnh sửa văn mẫu cho tòa nhà này. Dùng biến: <code className="bg-amber-100 px-0.5 rounded">{'{ten}'}</code> <code className="bg-amber-100 px-0.5 rounded">{'{tenToaNha}'}</code> <code className="bg-amber-100 px-0.5 rounded">{'{diaChiNgan}'}</code> <code className="bg-amber-100 px-0.5 rounded">{'{phong}'}</code> <code className="bg-amber-100 px-0.5 rounded">{'{soNha}'}</code> <code className="bg-amber-100 px-0.5 rounded">{'{duong}'}</code>.
                  Để trống = dùng mặc định.
                </p>

                {/* Lời kết bạn — Khách thuê */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium">Lời kết bạn — Khách thuê</Label>
                    <span className={`text-[10px] ${tplFriendKT.length > MAX_FRIEND ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      {tplFriendKT.length}/{MAX_FRIEND}
                    </span>
                  </div>
                  <Textarea
                    value={tplFriendKT}
                    onChange={e => setTplFriendKT(e.target.value)}
                    rows={2}
                    placeholder="Chào {ten}, kết bạn với tôi để nhận thông báo từ nhà trọ {soNha}, {duong}."
                    className={`text-xs resize-none ${tplFriendKT.length > MAX_FRIEND ? 'border-red-400' : ''}`}
                  />
                </div>

                {/* Lời kết bạn — Quản lý */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium">Lời kết bạn — Quản lý</Label>
                    <span className={`text-[10px] ${tplFriendQL.length > MAX_FRIEND ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      {tplFriendQL.length}/{MAX_FRIEND}
                    </span>
                  </div>
                  <Textarea
                    value={tplFriendQL}
                    onChange={e => setTplFriendQL(e.target.value)}
                    rows={2}
                    placeholder="Chào {ten}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ {soNha}, {duong}."
                    className={`text-xs resize-none ${tplFriendQL.length > MAX_FRIEND ? 'border-red-400' : ''}`}
                  />
                </div>

                {/* Tin nhắn sau kết bạn — Khách thuê */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Tin nhắn sau kết bạn — Khách thuê</Label>
                  <Textarea
                    value={tplFollowKT}
                    onChange={e => setTplFollowKT(e.target.value)}
                    rows={3}
                    placeholder={'Chào {ten}, bạn đang ở nhà trọ {diaChiNgan} (phòng {phong}). Bạn cần xác nhận "đúng" hay "không phải"...'}
                    className="text-xs resize-none"
                  />
                </div>

                {/* Tin nhắn sau kết bạn — Quản lý */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Tin nhắn sau kết bạn — Quản lý</Label>
                  <Textarea
                    value={tplFollowQL}
                    onChange={e => setTplFollowQL(e.target.value)}
                    rows={3}
                    placeholder={'Chào {ten}, bạn đang làm việc tại nhà trọ {diaChiNgan}. Bạn cần xác nhận "đúng" hay "không phải".'}
                    className="text-xs resize-none"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={saveTemplates}
                  disabled={tplSaving}
                  className="w-full gap-1.5 text-xs bg-amber-600 hover:bg-amber-700"
                >
                  {tplSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {tplSaving ? 'Đang lưu...' : 'Lưu văn mẫu'}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Monitor Card ────────────────────────────────────────────────────────────

function MonitorCard({ account }: { account?: AccountData }) {
  const [convs, setConvs] = useState<ZaloMsgItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ZaloMsgItem | null>(null);

  const fetchConvs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ conversations: '1' });
      if (account?.zaloAccountId) params.set('ownId', account.zaloAccountId);
      const res = await fetch(`/api/zalo/messages?${params}`);
      const data = await res.json();
      if (data.data) setConvs(data.data);
    } finally { setLoading(false); }
  }, [account?.zaloAccountId]);

  useEffect(() => { fetchConvs(); }, [fetchConvs]);
  useRealtimeEvents(['zalo-message'], () => { void fetchConvs(); });

  return (
    <>
      <Card>
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-600" />
              Theo dõi tin nhắn
            </CardTitle>
            <div className="flex items-center gap-1">
              <a href="/dashboard/zalo-monitor" target="_blank"
                className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 mr-1">
                <ExternalLink className="h-3 w-3" />Xem đầy đủ
              </a>
              <Button size="sm" variant="ghost" onClick={fetchConvs} disabled={loading} className="h-7 w-7 p-0">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">Hội thoại gần đây — click để xem lịch sử chat</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {loading && convs.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
            </div>
          ) : convs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Chưa có tin nhắn nào</p>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {convs.map(m => {
                const isGroup = msgIsGroup(m);
                const name = msgSenderName(m);
                const tid = msgThreadId(m);
                const imgUrl = msgImgUrl(m);
                const isBot = m.role === 'bot';
                const msgType = m.rawPayload?.data?.msgType;

                return (
                  <button key={m.id} type="button"
                    onClick={() => setSelected(m)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                    <div className="flex items-start gap-2.5">
                      {/* Avatar */}
                      <div className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isGroup ? 'bg-purple-100' : isBot ? 'bg-gray-100' : 'bg-blue-100'}`}>
                        {isGroup ? <Users className="h-4.5 w-4.5 text-purple-600" /> :
                         isBot ? <Bot className="h-4 w-4 text-gray-500" /> :
                         <User className="h-4 w-4 text-blue-600" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1 mb-0.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(m.createdAt)}</span>
                        </div>

                        {/* Content preview */}
                        <div className="flex items-center gap-1.5">
                          {isBot && <span className="text-[10px] text-blue-500 shrink-0">🤖</span>}
                          {imgUrl && msgType !== 'share.file' && (
                            <img src={imgUrl} alt="" className="h-6 w-6 rounded object-cover shrink-0 border"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          {msgType === 'share.file' && <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                          <p className="text-xs text-gray-500 truncate">
                            {m.content === '[hình ảnh]' ? '📷 Ảnh' : m.content}
                          </p>
                        </div>

                        {/* Thread ID */}
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">ID: {tid}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ChatHistoryDialog
          chatId={selected.chatId}
          name={msgSenderName(selected)}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ─── Bot Server API Explorer ──────────────────────────────────────────────────

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-green-700 bg-green-100 border-green-300',
  POST: 'text-blue-700 bg-blue-100 border-blue-300',
  DELETE: 'text-red-700 bg-red-100 border-red-300',
};

interface BotApiItem {
  id: string;
  endpoint: string;
  method: string;
  nhom: string;
  tenNhom: string;
  moTa?: string | null;
  defaultPayload?: string | null;
}

function ApiExplorerCard({ defaultAccountId = "" }: { defaultAccountId?: string }) {
  const [apis, setApis] = useState<BotApiItem[]>([]);
  const [loadingApis, setLoadingApis] = useState(false);
  const [openEndpoint, setOpenEndpoint] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; status?: number; data: unknown } | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [filterNhom, setFilterNhom] = useState<string>('all');

  const fetchApis = useCallback(async () => {
    setLoadingApis(true);
    try {
      const res = await fetch('/api/zalo-bot/endpoints');
      const data = await res.json();
      if (data.ok) {
        setApis(data.apis);
        // Init payloads từ defaultPayload trong DB, pre-fill accountSelection
        const init: Record<string, string> = {};
        for (const a of data.apis as BotApiItem[]) {
          if (a.defaultPayload) {
            try {
              const parsed = JSON.parse(a.defaultPayload);
              if (defaultAccountId && 'accountSelection' in parsed) {
                parsed.accountSelection = defaultAccountId;
              }
              init[a.endpoint] = JSON.stringify(parsed, null, 2);
            }
            catch { init[a.endpoint] = a.defaultPayload; }
          }
        }
        setPayloads(init);
      }
    } finally {
      setLoadingApis(false);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/zalo-bot/endpoints', { method: 'POST' });
      const data = await res.json();
      if (data.ok) { toast.success(`Đã đồng bộ ${data.synced} endpoints`); fetchApis(); }
    } finally { setSyncing(false); }
  };

  useEffect(() => { fetchApis(); }, [fetchApis]);

  const callApi = async (api: BotApiItem) => {
    setLoading(prev => ({ ...prev, [api.endpoint]: true }));
    setResults(prev => ({ ...prev, [api.endpoint]: null }));
    try {
      let payload: Record<string, unknown> = {};
      const raw = payloads[api.endpoint]?.trim();
      if (raw) {
        try { payload = JSON.parse(raw); }
        catch { toast.error('Payload JSON không hợp lệ'); return; }
      }
      const res = await fetch('/api/zalo-bot/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: api.endpoint, method: api.method, payload }),
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, [api.endpoint]: data }));
    } catch (e: unknown) {
      setResults(prev => ({ ...prev, [api.endpoint]: { ok: false, data: e instanceof Error ? e.message : 'Lỗi' } }));
    } finally {
      setLoading(prev => ({ ...prev, [api.endpoint]: false }));
    }
  };

  // Group by tenNhom
  const nhomList = Array.from(new Set(apis.map(a => a.nhom)));
  const filtered = filterNhom === 'all' ? apis : apis.filter(a => a.nhom === filterNhom);
  const grouped = filtered.reduce<Record<string, BotApiItem[]>>((acc, a) => {
    (acc[a.tenNhom] ??= []).push(a);
    return acc;
  }, {});

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4 text-gray-600" />
            Bot Server API Explorer
            {apis.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">{apis.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchApis} disabled={loadingApis} className="h-7 px-2">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingApis ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="h-7 px-2 text-xs gap-1">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Đồng bộ DB
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          {apis.length} endpoints từ DB — click để mở rộng và gọi thử
        </CardDescription>
        {/* Filter by nhom */}
        {nhomList.length > 1 && (
          <div className="flex flex-wrap gap-1 pt-1">
            <button
              type="button"
              onClick={() => setFilterNhom('all')}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filterNhom === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-500 hover:border-gray-500'}`}
            >
              Tất cả
            </button>
            {nhomList.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setFilterNhom(n)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filterNhom === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-500 hover:border-gray-500'}`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingApis && apis.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải danh sách API...
          </div>
        )}
        {Object.entries(grouped).map(([tenNhom, items]) => (
          <div key={tenNhom}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{tenNhom}</p>
            <div className="space-y-1">
              {items.map(api => (
                <div key={api.endpoint} className="border rounded-md overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    onClick={() => setOpenEndpoint(openEndpoint === api.endpoint ? null : api.endpoint)}
                  >
                    <Badge variant="outline" className={`text-[9px] px-1 h-4 font-mono shrink-0 ${METHOD_COLOR[api.method] ?? ''}`}>
                      {api.method}
                    </Badge>
                    <code className="text-xs text-gray-700 font-mono flex-1 truncate">{api.endpoint}</code>
                    {api.moTa && <span className="text-[10px] text-gray-400 hidden md:block truncate max-w-[160px]">{api.moTa}</span>}
                    {openEndpoint === api.endpoint
                      ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                  </button>

                  {openEndpoint === api.endpoint && (
                    <div className="p-3 space-y-3 bg-white">
                      {api.moTa && <p className="text-xs text-gray-500">{api.moTa}</p>}
                      {api.method !== 'GET' && (
                        <div className="space-y-1">
                          <Label className="text-[10px] text-gray-500 uppercase tracking-wide">Payload (JSON)</Label>
                          <Textarea
                            value={payloads[api.endpoint] || ''}
                            onChange={e => setPayloads(prev => ({ ...prev, [api.endpoint]: e.target.value }))}
                            className="text-xs font-mono min-h-[80px] resize-y"
                            spellCheck={false}
                          />
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() => callApi(api)}
                        disabled={loading[api.endpoint]}
                        className="gap-1.5 text-xs"
                      >
                        {loading[api.endpoint]
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5" />}
                        {loading[api.endpoint] ? 'Đang gọi...' : 'Gọi API'}
                      </Button>
                      {results[api.endpoint] && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {results[api.endpoint]!.ok
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                            <span className={`text-xs font-medium ${results[api.endpoint]!.ok ? 'text-green-700' : 'text-red-700'}`}>
                              {results[api.endpoint]!.ok ? `HTTP ${results[api.endpoint]!.status ?? 200} OK` : 'Thất bại'}
                            </span>
                          </div>
                          <pre className="text-[10px] bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-[180px] whitespace-pre-wrap break-all">
                            {JSON.stringify(results[api.endpoint]!.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Collapsible section helper ──────────────────────────────────────────────

function Section({ title, sub, defaultOpen = false, children }: {
  title: string; sub?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-md overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {sub && <span className="text-xs text-gray-400 hidden sm:block">{sub}</span>}
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t bg-gray-50/50">{children}</div>}
    </div>
  );
}

// ─── Thread Manager (đồng chủ trọ) ───────────────────────────────────────────

const DEFAULT_THREAD: Omit<ThreadSettings, 'id'> = {
  threadId: '', ten: null, loai: 'user',
  nhanSuCo: true, nhanHoaDon: true, nhanTinKhach: true, nhanNguoiLa: true, nhanNhacNho: true,
};

type ThreadBoolKey = 'nhanSuCo' | 'nhanHoaDon' | 'nhanTinKhach' | 'nhanNguoiLa' | 'nhanNhacNho';
const THREAD_CATEGORY_LABELS: { key: ThreadBoolKey; label: string }[] = [
  { key: 'nhanSuCo',     label: 'Sự cố' },
  { key: 'nhanHoaDon',   label: 'Hóa đơn' },
  { key: 'nhanTinKhach', label: 'Tin KT' },
  { key: 'nhanNguoiLa',  label: 'Người lạ' },
  { key: 'nhanNhacNho',  label: 'Nhắc nhở' },
];

function ThreadManager({ account, buildingId, canEdit }: {
  account: AccountData;
  buildingId: string;
  canEdit: boolean;
}) {
  const [threads, setThreads] = useState<ThreadSettings[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // id or 'new'
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newThread, setNewThread] = useState<Omit<ThreadSettings, 'id'>>(DEFAULT_THREAD);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/zalo/threads?nguoiDungId=${account.id}&toaNhaId=${buildingId}`
      );
      const data = await res.json();
      if (data.ok) setThreads(data.threads);
    } finally {
      setLoading(false);
    }
  }, [account.id, buildingId]);

  useEffect(() => { load(); }, [load]);

  const handleSaveNew = async () => {
    if (!newThread.threadId.trim()) { toast.error('Cần nhập Thread ID'); return; }
    setSaving('new');
    try {
      const res = await fetch('/api/admin/zalo/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nguoiDungId: account.id, toaNhaId: buildingId, ...newThread }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Đã thêm thread');
        setNewThread(DEFAULT_THREAD);
        setShowAdd(false);
        load();
      } else toast.error(data.error || 'Lỗi');
    } finally { setSaving(null); }
  };

  const handleUpdateThread = async (t: ThreadSettings) => {
    setSaving(t.id);
    try {
      const res = await fetch('/api/admin/zalo/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nguoiDungId: account.id, toaNhaId: buildingId, ...t }),
      });
      const data = await res.json();
      if (data.ok) toast.success('Đã lưu');
      else toast.error(data.error || 'Lỗi');
    } finally { setSaving(null); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/admin/zalo/threads?id=${id}`, { method: 'DELETE' });
      setThreads(prev => prev.filter(t => t.id !== id));
      toast.success('Đã xóa');
    } finally { setDeleting(null); }
  };

  const updateLocal = (id: string, key: keyof ThreadSettings, value: unknown) =>
    setThreads(prev => prev.map(t => t.id === id ? { ...t, [key]: value } : t));

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...</div>;

  return (
    <div className="space-y-2">
      {/* Thread list */}
      {threads.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400">Chưa có thread nào. Nhấn "+ Thêm" để thêm.</p>
      )}
      {threads.map(t => (
        <div key={t.id} className="border rounded-md bg-white overflow-hidden">
          {/* Thread header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${t.loai === 'group' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {t.loai === 'group' ? 'Nhóm' : 'Cá nhân'}
            </span>
            <code className="text-xs font-mono text-gray-700 flex-1 min-w-0 truncate">{t.threadId}</code>
            {t.ten && <span className="text-xs text-gray-500 italic truncate max-w-[120px]">{t.ten}</span>}
            {canEdit && (
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={deleting === t.id}
                className="text-[10px] text-red-500 hover:text-red-700 ml-auto shrink-0"
              >
                {deleting === t.id ? '...' : 'Xóa'}
              </button>
            )}
          </div>
          {/* Notification toggles */}
          <div className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
            {THREAD_CATEGORY_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <Switch
                  checked={t[key] as boolean}
                  onCheckedChange={v => updateLocal(t.id, key, v)}
                  disabled={!canEdit}
                  className="scale-[0.65]"
                />
                <span className="text-[11px] text-gray-600">{label}</span>
              </div>
            ))}
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUpdateThread(t)}
                disabled={saving === t.id}
                className="text-[10px] h-6 px-2 ml-auto text-blue-600 hover:text-blue-800"
              >
                {saving === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Lưu
              </Button>
            )}
          </div>
        </div>
      ))}

      {/* Add new thread form */}
      {showAdd && (
        <div className="border rounded-md bg-white p-3 space-y-2.5">
          <p className="text-xs font-medium text-gray-600">Thêm Thread ID mới</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">Thread ID *</Label>
              <Input
                value={newThread.threadId}
                onChange={e => setNewThread(p => ({ ...p, threadId: e.target.value }))}
                className="h-7 text-xs font-mono" placeholder="Zalo chat/group ID"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">Nhãn (tùy chọn)</Label>
              <Input
                value={newThread.ten ?? ''}
                onChange={e => setNewThread(p => ({ ...p, ten: e.target.value || null }))}
                className="h-7 text-xs" placeholder="Vd: Nhóm chủ trọ toà A"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-gray-500">Loại:</Label>
            {(['user', 'group'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setNewThread(p => ({ ...p, loai: v }))}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${newThread.loai === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-500'}`}
              >
                {v === 'user' ? 'Cá nhân' : 'Nhóm'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
            {THREAD_CATEGORY_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <Switch
                  checked={newThread[key] as boolean}
                  onCheckedChange={v => setNewThread(p => ({ ...p, [key]: v }))}
                  className="scale-[0.65]"
                />
                <span className="text-[11px] text-gray-600">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveNew} disabled={saving === 'new'} className="text-xs gap-1">
              {saving === 'new' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Thêm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="text-xs text-gray-500">Hủy</Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {canEdit && !showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-1 py-0.5"
        >
          + Thêm thread ID
        </button>
      )}
    </div>
  );
}

// ─── Account Settings (nội dung khi mở rộng một người) ───────────────────────

function AccountSettings({
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
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: keyof ZaloSettings, value: boolean) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/zalo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nguoiDungId: account.id, toaNhaId: buildingId, settings }),
      });
      toast.success("Đã lưu cài đặt thông báo");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 p-3 bg-gray-50 border-t">
      {/* Thread IDs đồng chủ trọ — chỉ hiện với chuTro (chuNha/dongChuTro), ẩn với quanLy/nhanVien và admin */}
      {!isAdmin && isChuTro && (
        <Section
          title="Tài khoản Zalo đồng chủ trọ"
          sub="Mỗi thread ID có cài đặt thông báo riêng"
          defaultOpen={false}
        >
          <p className="text-xs text-gray-500 mb-3">
            Khi quản lý gửi thông báo, hệ thống chuyển tiếp đến các thread ID này.
            Thêm chat ID cá nhân hoặc ID nhóm Zalo. Mỗi thread có thể chọn loại thông báo nhận.
          </p>
          <ThreadManager
            account={account}
            buildingId={buildingId}
            canEdit={canEdit}
          />
        </Section>
      )}

      {/* Cài đặt thông báo — ẩn/hiện */}
      <Section
        title="Cài đặt thông báo"
        sub={isChuTro && !isAdmin ? "— Chuyển QL: chỉ báo lại khi xong/thanh toán" : undefined}
        defaultOpen={false}
      >
        <div className="divide-y border rounded-md overflow-hidden bg-white">
          {CATEGORIES.map(cat => (
            <div key={cat.key} className="flex items-center px-3 py-2 gap-4">
              <div className="w-24 text-xs text-gray-700 font-medium">{cat.label}</div>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={settings[cat.key] as boolean}
                  onCheckedChange={v => handleToggle(cat.key, v)}
                  disabled={!canEdit}
                  className="scale-75"
                />
                <span className="text-[11px] text-gray-500">Nhận</span>
              </div>
              {isChuTro && !isAdmin && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={settings[cat.chuyenKey] as boolean}
                    onCheckedChange={v => handleToggle(cat.chuyenKey, v)}
                    disabled={!canEdit}
                    className="scale-75"
                  />
                  <span className="text-[11px] text-gray-500">Chuyển QL</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex justify-end mt-3">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
              <Save className="h-3.5 w-3.5" />
              {saving ? "Đang lưu..." : "Lưu thông báo"}
            </Button>
          </div>
        )}
      </Section>

      {/* tool cards — mỗi cái ẩn/hiện độc lập */}
      <PerAccountCards account={account} isAdmin={isAdmin} canEdit={canEdit} buildingId={buildingId} />
    </div>
  );
}

// ─── 4 cards ẩn/hiện per-account ─────────────────────────────────────────────

const ACCOUNT_CARDS = [
  { key: "botserver",  label: "Bot Server",     Icon: Server,        color: "text-blue-600",    adminOnly: false },
  { key: "direct",     label: "Trực tiếp",      Icon: Zap,           color: "text-emerald-600", adminOnly: false },
  { key: "proxy",      label: "Proxy",          Icon: Globe,         color: "text-cyan-600",    adminOnly: true },
  { key: "webhook",    label: "Webhook",        Icon: Webhook,       color: "text-violet-600",  adminOnly: true },
  { key: "automsg",    label: "Tin tự động",    Icon: MessageSquare, color: "text-indigo-600",  adminOnly: false },
  { key: "testsend",   label: "Test gửi",       Icon: Send,          color: "text-green-600",   adminOnly: false },
  { key: "friendreq",  label: "Kết bạn",        Icon: UserPlus,      color: "text-pink-600",    adminOnly: false },
  { key: "monitor",    label: "Theo dõi tin",   Icon: Eye,           color: "text-orange-500",  adminOnly: false },
] as const;

function PerAccountCards({ account, isAdmin, canEdit, buildingId }: { account: AccountData; isAdmin: boolean; canEdit: boolean; buildingId: string }) {
  const [openCard, setOpenCard] = useState<string | null>(null);

  return (
    <div className="border-t pt-4 space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Công cụ</h3>
      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_CARDS.filter(c => !c.adminOnly || isAdmin).map(({ key, label, Icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpenCard(openCard === key ? null : key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              openCard === key
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            <Icon className={`h-3 w-3 ${openCard === key ? "text-white" : color}`} />
            {label}
            {openCard === key
              ? <ChevronDown className="h-3 w-3 ml-0.5" />
              : <ChevronRight className="h-3 w-3 ml-0.5" />}
          </button>
        ))}
      </div>

      {/* Expanded card content */}
      {openCard === "botserver" && (
        <div className="border rounded-lg overflow-hidden">
          <BotServerCard account={account} canEdit={canEdit} isAdmin={isAdmin} />
        </div>
      )}
      {openCard === "direct" && (
        <div className="border rounded-lg overflow-hidden">
          <DirectCard account={account} canEdit={canEdit} isAdmin={isAdmin} />
        </div>
      )}
      {openCard === "proxy" && (
        <div className="border rounded-lg overflow-hidden">
          <ProxyCard canEdit={canEdit} />
        </div>
      )}
      {openCard === "webhook" && (
        <div className="border rounded-lg overflow-hidden">
          <WebhookCard account={account} />
        </div>
      )}
      {openCard === "automsg" && (
        <div className="border rounded-lg overflow-hidden">
          <AutoMessageCard account={account} buildingId={buildingId} />
        </div>
      )}
      {openCard === "testsend" && (
        <div className="border rounded-lg overflow-hidden">
          <TestSendCard account={account} />
        </div>
      )}
      {openCard === "friendreq" && (
        <div className="border rounded-lg overflow-hidden">
          <FriendRequestCard account={account} buildingId={buildingId} />
        </div>
      )}
      {openCard === "monitor" && (
        <div className="border rounded-lg overflow-hidden">
          <MonitorCard account={account} />
        </div>
      )}
      {isAdmin && (
        <ApiExplorerToggle account={account} />
      )}
    </div>
  );
}

// Inline mini ApiExplorer toggle per account
function ApiExplorerToggle({ account }: { account: AccountData }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
          open ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
        }`}
      >
        <Terminal className={`h-3 w-3 ${open ? "text-white" : "text-gray-500"}`} />
        API Explorer
        {open ? <ChevronDown className="h-3 w-3 ml-0.5" /> : <ChevronRight className="h-3 w-3 ml-0.5" />}
      </button>
      {open && (
        <div className="border rounded-lg overflow-hidden mt-2">
          <ApiExplorerCard defaultAccountId={account.zaloAccountId ?? ""} />
        </div>
      )}
    </div>
  );
}

// ─── Person Row ───────────────────────────────────────────────────────────────

function PersonRow({
  account,
  buildingId,
  isChuTro,
  isAdmin,
  sessionUserId,
  onRefresh,
}: {
  account: AccountData;
  buildingId: string;
  isChuTro: boolean;
  isAdmin: boolean;
  sessionUserId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isSelf = account.id === sessionUserId;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium truncate">{account.ten}</span>
          {isSelf && <span className="text-[10px] text-gray-400">(bạn)</span>}
          {isSelf && isAdmin && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Admin</Badge>
          )}
          <span className={`text-[9px] ml-1 ${
            account.botOnline === false ? "text-red-500" :
            account.zaloChatId ? "text-green-500" :
            account.pendingZaloChatId ? "text-amber-400" : "text-gray-300"
          }`}>
            {account.botOnline === false ? "●" :
             account.zaloChatId ? "●" :
             account.pendingZaloChatId ? "◐" : "○"}
          </span>
          {account.botOnline === false ? (
            <span className="text-[10px] text-red-500 font-medium">
              Zalo đã bị đăng xuất
            </span>
          ) : !account.zaloChatId ? (
            <span className="text-[10px] text-gray-400">
              {account.pendingZaloChatId ? "Chờ xác nhận Zalo" : "Chưa liên kết Zalo"}
            </span>
          ) : null}
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>
      {open && (
        <AccountSettings
          account={account}
          buildingId={buildingId}
          isChuTro={isChuTro}
          isAdmin={isAdmin}
          isSelf={isSelf}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

// ─── Role Group ───────────────────────────────────────────────────────────────

function RoleGroup({
  role,
  people,
  buildingId,
  isAdmin,
  sessionUserId,
  onRefresh,
}: {
  role: "chuTro" | "quanLy";
  people: AccountData[];
  buildingId: string;
  isAdmin: boolean;
  sessionUserId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);
  const isChuTroRole = role === "chuTro";

  const visiblePeople = people;
  if (visiblePeople.length === 0) return null;

  const roleLabel = isChuTroRole ? "Chủ trọ" : "Quản lý";
  const RoleIcon = isChuTroRole ? Crown : Users;
  const iconColor = isChuTroRole ? "text-amber-500" : "text-blue-400";
  const badgeClass = isChuTroRole
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-blue-100 text-blue-700 border-blue-200";

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RoleIcon className={`h-3.5 w-3.5 ${iconColor}`} />
          <span className="text-sm font-medium">{roleLabel}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${badgeClass}`}>
            {visiblePeople.length}
          </Badge>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400" />
          : <ChevronRight className="h-4 w-4 text-gray-400" />
        }
      </button>
      {open && (
        <div className="divide-y border-t">
          {visiblePeople.map(person => (
            <PersonRow
              key={person.id}
              account={person}
              buildingId={buildingId}
              isChuTro={isChuTroRole}
              isAdmin={isAdmin}
              sessionUserId={sessionUserId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Building Accordion ───────────────────────────────────────────────────────

function BuildingAccordion({
  building,
  isAdmin,
  sessionUserId,
  defaultOpen,
  onRefresh,
}: {
  building: BuildingData;
  isAdmin: boolean;
  sessionUserId: string;
  defaultOpen: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Gom tất cả từ chuTro + quanLys, loại trùng và loại vaiTro admin
  const allPeople = [building.chuTro, ...building.quanLys];
  const seen = new Set<string>();
  const uniquePeople = allPeople.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  // Không hiển thị admin hệ thống trong danh sách tòa nhà
  const visiblePeople = uniquePeople.filter(p => p.vaiTro !== 'admin');

  // Phân nhóm theo vaiTro thực tế (không theo vị trí DB)
  // Admin chỉ thấy chuNha; chuNha/dongChuTro thấy tất cả
  const chuTroGroup = isAdmin
    ? visiblePeople.filter(p => p.vaiTro === 'chuNha')
    : visiblePeople.filter(p => p.vaiTro === 'chuNha' || p.vaiTro === 'dongChuTro');
  const quanLyGroup = isAdmin
    ? []
    : visiblePeople.filter(p => p.vaiTro === 'quanLy' || p.vaiTro === 'nhanVien');
  const totalPeople = chuTroGroup.length + quanLyGroup.length;

  if (totalPeople === 0 && !isAdmin) return null;

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
          <span className="font-semibold text-gray-800 truncate">{building.tenToaNha}</span>
          {totalPeople > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 text-gray-500 shrink-0">
              {totalPeople} người
            </Badge>
          )}
        </div>
        {open
          ? <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
          : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
        }
      </button>
      {open && (
        <div className="bg-gray-50 border-t p-3 space-y-2">
          {chuTroGroup.length > 0 && (
            <RoleGroup
              role="chuTro"
              people={chuTroGroup}
              buildingId={building.id}
              isAdmin={isAdmin}
              sessionUserId={sessionUserId}
              onRefresh={onRefresh}
            />
          )}
          {quanLyGroup.length > 0 && (
            <RoleGroup
              role="quanLy"
              people={quanLyGroup}
              buildingId={building.id}
              isAdmin={isAdmin}
              sessionUserId={sessionUserId}
              onRefresh={onRefresh}
            />
          )}
          {totalPeople === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Chưa gán người quản lý cho tòa nhà này</p>
          )}
        </div>
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
    <div className="space-y-4 p-4 md:p-6 max-w-3xl">
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

      {/* Zalo Connection Overview (admin only) */}
      {isAdmin && <ZaloConnectionOverview />}

      {/* Building list */}
      <div className="space-y-2">
        {!isAdmin && (
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Tòa nhà của bạn
          </h2>
        )}
        {isAdmin && (
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Danh sách tòa nhà
          </h2>
        )}
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : buildings.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Chưa có tòa nhà nào</div>
        ) : (
          <div className="space-y-3">
            {buildings.map((b, i) => (
              <BuildingAccordion
                key={b.id}
                building={b}
                isAdmin={isAdmin}
                sessionUserId={sessionUserId}
                defaultOpen={i === 0}
                onRefresh={loadBuildings}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
