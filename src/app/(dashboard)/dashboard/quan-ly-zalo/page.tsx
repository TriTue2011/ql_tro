"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  QrCode,
  Wifi,
  WifiOff,
  Trash2,
  Plus,
  LogOut,
  Globe,
  Users,
  MessageSquare,
  Shield,
  CheckCircle,
  XCircle,
  Server,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DirectAccount {
  ownId: string;
  name: string;
  phone?: string;
  proxy?: string;
  loggedIn: boolean;
  loginTime: number;
}

interface ZaloDirectState {
  mode: "direct" | "bot-server" | "none";
  directStatus: { available: boolean; accountCount: number; loggedInCount: number };
  botServerUrl: string | null;
  botAccounts: any[];
  botError?: string;
  directAccounts: DirectAccount[];
  proxies: any[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchStatus(): Promise<ZaloDirectState> {
  const res = await fetch("/api/admin/zalo-direct");
  if (!res.ok) throw new Error("Không thể tải trạng thái");
  return res.json();
}

async function postAction(action: string, data?: Record<string, any>) {
  const res = await fetch("/api/admin/zalo-direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

// ─── Mode Badge ──────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: string }) {
  if (mode === "direct")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        <Zap className="h-3 w-3 mr-1" />
        Direct Mode
      </Badge>
    );
  if (mode === "bot-server")
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
        <Server className="h-3 w-3 mr-1" />
        Bot Server
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-gray-500">
      <WifiOff className="h-3 w-3 mr-1" />
      Chưa kết nối
    </Badge>
  );
}

// ─── Account Card ────────────────────────────────────────────────────────────

function AccountCard({
  account,
  source,
  onLogout,
}: {
  account: any;
  source: "direct" | "bot-server";
  onLogout?: (ownId: string) => void;
}) {
  const isOnline = source === "direct" ? account.loggedIn : (account.isOnline ?? account.isConnected ?? true);
  const name = account.name || account.displayName || "";
  const phone = account.phone || account.phoneNumber || "";
  const ownId = account.ownId || "";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? "bg-green-500" : "bg-red-400"}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{name || ownId}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {source === "direct" ? "Direct" : "Bot Server"}
            </Badge>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
            {phone && <span>{phone}</span>}
            <span className="font-mono text-[10px]">{ownId}</span>
          </div>
          {account.proxy && (
            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Globe className="h-2.5 w-2.5" />
              {account.proxy}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isOnline ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" />
        )}
        {source === "direct" && onLogout && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onLogout(ownId)}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Proxy Card ──────────────────────────────────────────────────────────────

function ProxyItem({
  proxy,
  onRemove,
}: {
  proxy: any;
  onRemove: (url: string) => void;
}) {
  const url = typeof proxy === "string" ? proxy : proxy.url || proxy.proxyUrl || JSON.stringify(proxy);
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border">
      <div className="flex items-center gap-2 min-w-0">
        <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-mono truncate">{url}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
        onClick={() => onRemove(url)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function QuanLyZaloPage() {
  const { data: session } = useSession();
  const [state, setState] = useState<ZaloDirectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // QR login state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrProxy, setQrProxy] = useState("");

  // Proxy add
  const [newProxy, setNewProxy] = useState("");
  const [addingProxy, setAddingProxy] = useState(false);

  const role = session?.user?.role;

  // Fetch status
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStatus();
      setState(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === "admin") reload();
  }, [role, reload]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleLoginQR() {
    setQrLoading(true);
    setQrImage(null);
    try {
      const result = await postAction("loginQR", { proxyUrl: qrProxy || undefined });
      if (result.ok) {
        if (result.qrCode) {
          setQrImage(result.qrCode);
          toast.info("Quét mã QR bằng ứng dụng Zalo để đăng nhập");
        } else {
          toast.success(`Đã đăng nhập thành công: ${result.ownId}`);
          setQrImage(null);
          reload();
        }
      } else {
        toast.error(result.error || "Lỗi tạo QR");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setQrLoading(false);
    }
  }

  async function handleAutoLoginAll() {
    try {
      const result = await postAction("autoLoginAll");
      if (result.ok) {
        toast.success(`Auto-login hoàn tất: ${result.accounts?.length || 0} tài khoản`);
        reload();
      } else {
        toast.error(result.error || "Lỗi auto-login");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleLogout(ownId: string) {
    if (!confirm(`Đăng xuất tài khoản ${ownId}?`)) return;
    try {
      const result = await postAction("logout", { ownId });
      if (result.ok) {
        toast.success("Đã đăng xuất");
        reload();
      } else {
        toast.error(result.error || "Lỗi đăng xuất");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleAddProxy() {
    if (!newProxy.trim()) return;
    setAddingProxy(true);
    try {
      const result = await postAction("addProxy", { proxyUrl: newProxy.trim() });
      if (result.ok) {
        toast.success("Đã thêm proxy");
        setNewProxy("");
        reload();
      } else {
        toast.error(result.error || "Lỗi thêm proxy");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingProxy(false);
    }
  }

  async function handleRemoveProxy(url: string) {
    if (!confirm(`Xóa proxy ${url}?`)) return;
    try {
      const result = await postAction("removeProxy", { proxyUrl: url });
      if (result.ok) {
        toast.success("Đã xóa proxy");
        reload();
      } else {
        toast.error(result.error || "Lỗi xóa proxy");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Shield className="h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Chỉ quản trị viên mới có quyền truy cập trang này.</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const allAccounts = [
    ...(state?.directAccounts?.map((a) => ({ ...a, _source: "direct" as const })) || []),
    ...(state?.botAccounts?.map((a) => ({ ...a, _source: "bot-server" as const })) || []),
  ];

  // Deduplicate by ownId (direct takes priority)
  const uniqueAccounts = allAccounts.filter(
    (a, i, arr) => arr.findIndex((b) => b.ownId === a.ownId) === i
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Quản lý Zalo
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Quản lý tài khoản Zalo, proxy và chế độ kết nối
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state && <ModeBadge mode={state.mode} />}
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !state && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Đang tải...</span>
        </div>
      )}

      {state && (
        <Tabs defaultValue="accounts">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full md:w-auto">
            <TabsTrigger value="accounts" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Users className="h-3.5 w-3.5" />
              Tài khoản ({uniqueAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="login" className="flex items-center gap-1.5 text-xs md:text-sm">
              <QrCode className="h-3.5 w-3.5" />
              Đăng nhập
            </TabsTrigger>
            <TabsTrigger value="proxy" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Globe className="h-3.5 w-3.5" />
              Proxy ({state.proxies?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Wifi className="h-3.5 w-3.5" />
              Trạng thái
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Tài khoản ── */}
          <TabsContent value="accounts" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base md:text-lg">Danh sách tài khoản Zalo</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Tất cả tài khoản đang đăng nhập (direct + bot server)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAutoLoginAll}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Auto-login tất cả
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-2">
                {uniqueAccounts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Chưa có tài khoản nào đăng nhập</p>
                    <p className="text-xs mt-1">Chuyển sang tab &quot;Đăng nhập&quot; để thêm tài khoản</p>
                  </div>
                ) : (
                  uniqueAccounts.map((acc) => (
                    <AccountCard
                      key={acc.ownId}
                      account={acc}
                      source={acc._source}
                      onLogout={acc._source === "direct" ? handleLogout : undefined}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Đăng nhập ── */}
          <TabsContent value="login" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Đăng nhập Zalo bằng QR Code
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Quét mã QR bằng ứng dụng Zalo trên điện thoại để đăng nhập tài khoản mới
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Proxy (không bắt buộc)</Label>
                  <Input
                    value={qrProxy}
                    onChange={(e) => setQrProxy(e.target.value)}
                    placeholder="http://user:pass@host:port"
                    className="text-sm font-mono"
                  />
                </div>
                <Button onClick={handleLoginQR} disabled={qrLoading} className="w-full sm:w-auto">
                  {qrLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Đang tạo mã QR...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Tạo mã QR
                    </>
                  )}
                </Button>

                {qrImage && (
                  <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImage}
                      alt="QR Code Zalo"
                      className="w-64 h-64 rounded-lg border"
                    />
                    <p className="text-sm text-gray-600 text-center">
                      Mở ứng dụng Zalo &rarr; Quét mã QR này để đăng nhập
                    </p>
                    <Button variant="outline" size="sm" onClick={() => { setQrImage(null); reload(); }}>
                      Đã quét xong
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Proxy ── */}
          <TabsContent value="proxy" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Quản lý Proxy
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Mỗi tài khoản Zalo có thể dùng proxy riêng để tránh bị khóa IP
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                {/* Add proxy form */}
                <div className="flex gap-2">
                  <Input
                    value={newProxy}
                    onChange={(e) => setNewProxy(e.target.value)}
                    placeholder="http://username:password@host:port"
                    className="text-sm font-mono"
                    onKeyDown={(e) => e.key === "Enter" && handleAddProxy()}
                  />
                  <Button onClick={handleAddProxy} disabled={addingProxy || !newProxy.trim()} className="flex-shrink-0">
                    {addingProxy ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Proxy list */}
                <div className="space-y-1.5">
                  {!state.proxies?.length ? (
                    <div className="text-center py-8 text-gray-400">
                      <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Chưa có proxy nào</p>
                    </div>
                  ) : (
                    state.proxies.map((proxy, i) => (
                      <ProxyItem key={i} proxy={proxy} onRemove={handleRemoveProxy} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Trạng thái ── */}
          <TabsContent value="status" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Direct Mode Status */}
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-5 w-5 text-green-600" />
                    Direct Mode (zca-js)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Trạng thái:</span>
                    <span>
                      {state.directStatus.available ? (
                        <Badge className="bg-green-100 text-green-800">Hoạt động</Badge>
                      ) : (
                        <Badge variant="outline">Không hoạt động</Badge>
                      )}
                    </span>
                    <span className="text-gray-500">Tài khoản:</span>
                    <span className="font-medium">{state.directStatus.accountCount}</span>
                    <span className="text-gray-500">Đang online:</span>
                    <span className="font-medium text-green-600">{state.directStatus.loggedInCount}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Direct mode kết nối trực tiếp tới Zalo qua zca-js SDK, không cần Docker bot server.
                    Cookies được lưu tại <code className="bg-gray-100 px-1 rounded">tmp/zalo/cookies/</code>.
                  </p>
                </CardContent>
              </Card>

              {/* Bot Server Status */}
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-600" />
                    Bot Server (Docker)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">URL:</span>
                    <span className="font-mono text-xs truncate">
                      {state.botServerUrl || <span className="text-gray-400 italic">Chưa cấu hình</span>}
                    </span>
                    <span className="text-gray-500">Tài khoản:</span>
                    <span className="font-medium">{state.botAccounts?.length || 0}</span>
                    <span className="text-gray-500">Lỗi:</span>
                    <span className="text-xs">
                      {state.botError ? (
                        <span className="text-red-500">{state.botError}</span>
                      ) : (
                        <span className="text-green-600">Không có lỗi</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Bot server chạy trên Docker container. Cấu hình URL tại{" "}
                    <code className="bg-gray-100 px-1 rounded">Cài đặt &gt; Home Assistant</code>.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Mode explanation */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-base">Chế độ hoạt động</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <Zap className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">Direct Mode</p>
                      <p className="text-green-700 text-xs mt-0.5">
                        Tích hợp zca-js trực tiếp. Khi có tài khoản direct đăng nhập, hệ thống tự động
                        ưu tiên direct mode. Không cần Docker.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Server className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900">Bot Server Mode</p>
                      <p className="text-blue-700 text-xs mt-0.5">
                        Kết nối qua HTTP tới Docker bot server. Hoạt động khi chưa có direct account
                        và đã cấu hình bot server URL.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <WifiOff className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">Chưa kết nối</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        Không có tài khoản nào đăng nhập và chưa cấu hình bot server.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
