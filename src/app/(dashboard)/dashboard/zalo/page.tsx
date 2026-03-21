"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, QrCode, Save, RefreshCw, Smartphone,
  Crown, Users, User, ChevronDown, ChevronRight,
  Server, Webhook, Send, CheckCircle2, XCircle,
  Loader2, Eye, Terminal, Play,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  vaiTro?: string;
  zaloChatId: string | null;
  zaloAccountId: string | null;
  zaloBotServerUrl: string | null;
  zaloBotUsername: string | null;
  zaloBotPassword: string | null;
  zaloBotTtl: number | null;
  nhanThongBaoZalo: boolean;
  settings: ZaloSettings | null;
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
  const [zaloAccountId, setZaloAccountId] = useState(account?.zaloAccountId ?? "");
  const [zaloBotServerUrl, setZaloBotServerUrl] = useState(account?.zaloBotServerUrl ?? "");
  const [zaloBotUsername, setZaloBotUsername] = useState(account?.zaloBotUsername ?? "");
  const [zaloBotPassword, setZaloBotPassword] = useState(account?.zaloBotPassword ? "••••••••" : "");
  const [zaloBotTtl, setZaloBotTtl] = useState(String(account?.zaloBotTtl ?? ""));
  const [saving, setSaving] = useState(false);

  // QR state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

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
                {status.serverUrl && <span className="text-[10px] text-gray-400 font-mono truncate">{status.serverUrl}</span>}
              </div>
              {status.error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{status.error}</div>}
              {status.accounts && status.accounts.length > 0 && (
                <div className="divide-y border rounded overflow-hidden">
                  {status.accounts.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[10px] text-green-500">●</span>
                      <span className="text-xs font-mono">{acc.name || acc.id}</span>
                      {acc.id === status.accountId && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 ml-auto">Mặc định</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                  alt="QR Zalo" className="w-24 h-24 border rounded bg-white"
                />
                <span className="text-[10px] text-gray-400">Quét bằng app Zalo</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Webhook Card ─────────────────────────────────────────────────────────────

function WebhookCard({ account }: { account?: AccountData }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [ownId, setOwnId] = useState(account?.zaloAccountId ?? "");
  const [setting, setSetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; webhookUrl?: string; error?: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; status?: number; error?: string } | null>(null);

  const handleSet = async () => {
    setSetting(true);
    setResult(null);
    try {
      const res = await fetch("/api/zalo-bot/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: webhookUrl || undefined, ownId: ownId || undefined }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        setWebhookUrl(data.webhookUrl || "");
        toast.success("Đã cài đặt webhook thành công");
      } else {
        toast.error(data.error || "Cài đặt webhook thất bại");
      }
    } finally {
      setSetting(false);
    }
  };

  const handleGenerateRandom = async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    // base64url (A-Z a-z 0-9 - _)
    const token = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/api/zalowebhook/${token}`;
    setWebhookUrl(url);
    // Lưu token vào DB để route [token] có thể validate
    try {
      const existing = await fetch("/api/admin/settings").then(r => r.json())
        .then((d: { success: boolean; data?: { khoa: string; giaTri: string }[] }) =>
          d.success ? (d.data?.find((s: { khoa: string }) => s.khoa === "zalo_webhook_tokens")?.giaTri) : null
        ).catch(() => null);
      const tokens: string[] = existing ? JSON.parse(existing) : [];
      if (!tokens.includes(token)) tokens.push(token);
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: [{ khoa: "zalo_webhook_tokens", giaTri: JSON.stringify(tokens) }] }),
      });
    } catch { /* non-critical */ }
    toast.success("Đã tạo webhook URL ngẫu nhiên");
  };

  const handleTest = async () => {
    const url = webhookUrl || result?.webhookUrl;
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
        <CardDescription className="text-xs">Cài đặt webhook nhận tin nhắn Zalo từ bot server</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Zalo Account ID (ownId)</Label>
          <Input value={ownId} onChange={e => setOwnId(e.target.value)}
            placeholder="Để trống dùng mặc định" className="h-8 text-xs font-mono" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Webhook URL</Label>
            <button
              type="button"
              onClick={handleGenerateRandom}
              className="text-[10px] text-blue-600 hover:text-blue-800 underline"
            >
              Tạo ngẫu nhiên
            </button>
          </div>
          <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="Để trống tự dùng URL hệ thống" className="h-8 text-xs font-mono" />
        </div>
        {result && (
          <div className={`text-xs px-2 py-1.5 rounded ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {result.ok ? `✓ ${result.webhookUrl}` : `✗ ${result.error}`}
          </div>
        )}
        {testResult && (
          <div className={`text-xs px-2 py-1.5 rounded ${testResult.ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {testResult.ok ? `✓ Webhook OK (HTTP ${testResult.status})` : `✗ ${testResult.error || "Không phản hồi"}`}
          </div>
        )}
        <div className="flex gap-2">
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

function TestSendCard({ account }: { account?: AccountData }) {
  const [chatId, setChatId] = useState(account?.zaloChatId ?? "");
  const [message, setMessage] = useState("Tin nhắn test từ hệ thống QL Trọ");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const handleSend = async () => {
    if (!chatId.trim() || !message.trim()) {
      toast.error("Cần nhập Chat ID và nội dung tin nhắn");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/gui-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.trim(), message }),
      });
      const data = await res.json();
      const ok = data.success === true;
      setResult({ ok, error: data.message || data.error });
      if (ok) toast.success("Đã gửi tin nhắn test thành công");
      else toast.error(data.message || data.error || "Gửi thất bại");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="h-4 w-4 text-green-600" />
          Test gửi tin
        </CardTitle>
        <CardDescription className="text-xs">Gửi tin nhắn thử nghiệm qua Zalo Bot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Zalo Chat ID (người nhận)</Label>
          <Input
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="Nhập Zalo Chat ID"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Nội dung</Label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Nhập nội dung tin nhắn..."
            className="text-xs min-h-[60px] resize-none"
          />
        </div>
        {result && (
          <div className={`text-xs px-2 py-1.5 rounded ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {result.ok ? "✓ Đã gửi thành công" : `✗ ${result.error}`}
          </div>
        )}
        <Button size="sm" onClick={handleSend} disabled={sending} className="w-full text-xs gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {sending ? "Đang gửi..." : "Gửi thử"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Monitor Card ─────────────────────────────────────────────────────────────

function MonitorCard({ account }: { account?: AccountData }) {
  const [messages, setMessages] = useState<{ id: string; chatId: string; displayName?: string; content: string; role: string; createdAt: string; attachmentUrl?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = account?.zaloChatId ? `?chatId=${encodeURIComponent(account.zaloChatId)}&conversations=1` : "?conversations=1";
      const res = await fetch(`/api/zalo/messages${params}`);
      const data = await res.json();
      if (data.data) setMessages(data.data.slice(0, 20) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-600" />
            Theo dõi tin nhắn
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchMessages} disabled={loading} className="h-7 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription className="text-xs">20 tin nhắn gần nhất qua Zalo Bot</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && messages.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Chưa có tin nhắn nào</p>
        ) : (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`text-xs px-2 py-1.5 rounded ${m.role === "user" ? "bg-gray-50" : "bg-blue-50"}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-medium text-gray-700 truncate max-w-[120px]">
                    {m.displayName || m.chatId}
                  </span>
                  <Badge variant="outline" className={`text-[9px] h-4 px-1 ${m.role === "bot" ? "border-blue-300 text-blue-600" : "border-gray-300"}`}>
                    {m.role === "bot" ? "Bot" : "User"}
                  </Badge>
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {new Date(m.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-gray-600 truncate">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
      {/* Thread IDs đồng chủ trọ — ẩn/hiện */}
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

      {/* Cài đặt thông báo — ẩn/hiện */}
      <Section
        title="Cài đặt thông báo"
        sub={isChuTro ? "— Chuyển QL: chỉ báo lại khi xong/thanh toán" : undefined}
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
              {isChuTro && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={settings[cat.chuyenKey] as boolean}
                    onCheckedChange={v => handleToggle(cat.chuyenKey, v)}
                    disabled={!canEdit || !(settings[cat.key] as boolean)}
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

      {/* 4 tool cards — mỗi cái ẩn/hiện độc lập */}
      <PerAccountCards account={account} isAdmin={isAdmin} canEdit={canEdit} />
    </div>
  );
}

// ─── 4 cards ẩn/hiện per-account ─────────────────────────────────────────────

const ACCOUNT_CARDS = [
  { key: "botserver", label: "Bot Server", Icon: Server, color: "text-blue-600" },
  { key: "webhook",   label: "Webhook",    Icon: Webhook, color: "text-violet-600" },
  { key: "testsend",  label: "Test gửi",   Icon: Send, color: "text-green-600" },
  { key: "monitor",   label: "Theo dõi tin", Icon: Eye, color: "text-orange-500" },
] as const;

function PerAccountCards({ account, isAdmin, canEdit }: { account: AccountData; isAdmin: boolean; canEdit: boolean }) {
  const [openCard, setOpenCard] = useState<string | null>(null);

  return (
    <div className="border-t pt-4 space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Công cụ</h3>
      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_CARDS.map(({ key, label, Icon, color }) => (
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
      {openCard === "webhook" && (
        <div className="border rounded-lg overflow-hidden">
          <WebhookCard account={account} />
        </div>
      )}
      {openCard === "testsend" && (
        <div className="border rounded-lg overflow-hidden">
          <TestSendCard account={account} />
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
          <span className={`text-[9px] ml-1 ${account.zaloChatId ? "text-green-500" : "text-gray-300"}`}>
            {account.zaloChatId ? "●" : "○"}
          </span>
          {!account.zaloChatId && (
            <span className="text-[10px] text-gray-400">Chưa liên kết Zalo</span>
          )}
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

  // Filter out admin-role users from building view (admins have their own section)
  const visiblePeople = people.filter(p => p.vaiTro !== "admin");
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

  // Gom tất cả người, lọc admin, nhóm theo vaiTro thực tế
  const allPeople = [building.chuTro, ...building.quanLys].filter(p => p.vaiTro !== "admin");
  // Người có vaiTro chuNha → hiển thị là Chủ trọ; còn lại → Quản lý
  const chuTroGroup = allPeople.filter(p => p.vaiTro === "chuNha");
  const quanLyGroup = allPeople.filter(p => p.vaiTro !== "chuNha");
  const totalPeople = allPeople.length;

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
          <RoleGroup
            role="chuTro"
            people={chuTroGroup}
            buildingId={building.id}
            isAdmin={isAdmin}
            sessionUserId={sessionUserId}
            onRefresh={onRefresh}
          />
          <RoleGroup
            role="quanLy"
            people={quanLyGroup}
            buildingId={building.id}
            isAdmin={isAdmin}
            sessionUserId={sessionUserId}
            onRefresh={onRefresh}
          />
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
