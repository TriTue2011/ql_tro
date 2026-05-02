'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  HardDrive,
  Server,
  Key,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  FileText,
  ExternalLink,
  Building2,
} from 'lucide-react';
import PageHeader from '@/components/dashboard/page-header';

// ── Types ───────────────────────────────────────────────────────────────────────
interface Building {
  id: string;
  tenToaNha: string;
}

interface MinioConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

interface TestResult {
  success: boolean;
  message: string;
  buckets?: string[];
}

// ── Main Component ───────────────────────────────────────────────────────────────
export default function LuuTruPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [status, session, router]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');

  const [config, setConfig] = useState<MinioConfig>({
    endpoint: '',
    accessKey: '',
    secretKey: '',
    bucket: 'ql-tro',
  });

  // ── Load building list ──────────────────────────────────────────────────────
  const fetchBuildings = async () => {
    try {
      const res = await fetch('/api/admin/toa-nha-settings');
      const data = await res.json();
      if (data.success) {
        setBuildings(data.data);
        // Auto-select first building if none selected
        if (data.data.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(data.data[0].id);
        }
      }
    } catch {
      toast.error('Không thể tải danh sách tòa nhà');
    }
  };

  // ── Fetch config for selected building ──────────────────────────────────────
  const fetchConfig = async (toaNhaId: string) => {
    if (!toaNhaId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/toa-nha-settings?toaNhaId=${toaNhaId}`);
      const data = await res.json();
      if (data.success) {
        setConfig({
          endpoint: data.data.minioEndpoint || '',
          accessKey: data.data.minioAccessKey || '',
          secretKey: data.data.minioSecretKey || '',
          bucket: data.data.minioBucket || 'ql-tro',
        });
      } else {
        toast.error('Không thể tải cấu hình MinIO');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBuildings();
  }, []);

  // Load config when building changes
  useEffect(() => {
    if (selectedBuildingId) {
      fetchConfig(selectedBuildingId);
    }
  }, [selectedBuildingId]);

  // ── Save config (per-building) ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedBuildingId) {
      toast.error('Vui lòng chọn tòa nhà');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/toa-nha-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toaNhaId: selectedBuildingId,
          minioEndpoint: config.endpoint,
          minioAccessKey: config.accessKey,
          minioSecretKey: config.secretKey,
          minioBucket: config.bucket,
          storageProvider: config.endpoint ? 'minio' : 'local',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu cấu hình MinIO cho tòa nhà');
      } else {
        toast.error(data.error || data.message || 'Lỗi lưu cấu hình');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection ──────────────────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/settings/test-minio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success('Kết nối MinIO thành công');
      } else {
        toast.error(data.message || 'Kết nối thất bại');
      }
    } catch {
      setTestResult({ success: false, message: 'Không thể kết nối đến server' });
      toast.error('Lỗi kết nối server');
    } finally {
      setTesting(false);
    }
  };

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-64"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Quản lý lưu trữ MinIO"
        description="Cấu hình kết nối MinIO để lưu trữ ảnh, file và tài liệu"
        onRefresh={() => selectedBuildingId && fetchConfig(selectedBuildingId)}
        loading={loading}
      />

      {/* ── Building Selector ────────────────────────────────────────────────── */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-200">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-indigo-900">Cấu hình MinIO</h2>
              <p className="text-xs text-indigo-500">Cấu hình lưu trữ theo từng tòa nhà</p>
            </div>
          </div>

          {/* Building selector */}
          <div className="max-w-xs mb-6">
            <label className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 mb-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Chọn tòa nhà
            </label>
            <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
              <SelectTrigger className="bg-white/80 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400">
                <SelectValue placeholder="Chọn tòa nhà..." />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.tenToaNha}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : !selectedBuildingId ? (
            <div className="py-8 text-center text-sm text-indigo-400">
              Vui lòng chọn tòa nhà để cấu hình MinIO
            </div>
          ) : (
            <>
              <div className="space-y-4 max-w-2xl">
                {/* Endpoint */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                    <Server className="h-3.5 w-3.5" />
                    Endpoint URL
                  </label>
                  <Input
                    value={config.endpoint}
                    onChange={e => setConfig(p => ({ ...p, endpoint: e.target.value }))}
                    placeholder="http://192.168.1.100:9000"
                    className="bg-white/80 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                  <p className="text-xs text-indigo-400">Địa chỉ MinIO server (ví dụ: http://172.16.10.27:9000)</p>
                </div>

                {/* Access Key */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                    <Key className="h-3.5 w-3.5" />
                    Access Key
                  </label>
                  <Input
                    value={config.accessKey}
                    onChange={e => setConfig(p => ({ ...p, accessKey: e.target.value }))}
                    placeholder="minioadmin"
                    className="bg-white/80 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>

                {/* Secret Key */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                    <Key className="h-3.5 w-3.5" />
                    Secret Key
                  </label>
                  <Input
                    type="password"
                    value={config.secretKey}
                    onChange={e => setConfig(p => ({ ...p, secretKey: e.target.value }))}
                    placeholder="••••••••"
                    className="bg-white/80 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>

                {/* Bucket */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                    <Database className="h-3.5 w-3.5" />
                    Bucket Name
                  </label>
                  <Input
                    value={config.bucket}
                    onChange={e => setConfig(p => ({ ...p, bucket: e.target.value }))}
                    placeholder="ql-tro"
                    className="bg-white/80 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                  <p className="text-xs text-indigo-400">Tên bucket mặc định để lưu trữ file</p>
                </div>
              </div>

              <Separator className="my-5 bg-indigo-100" />

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving || !config.endpoint || !config.accessKey || !config.secretKey}
                  className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Lưu cấu hình
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || !config.endpoint}
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Kiểm tra kết nối
                </Button>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success
                      ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                      : <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                    }
                    <div>
                      <p className="font-medium">{testResult.success ? 'Kết nối thành công' : 'Kết nối thất bại'}</p>
                      <p className="mt-0.5 opacity-80">{testResult.message}</p>
                      {testResult.buckets && testResult.buckets.length > 0 && (
                        <p className="mt-1 text-xs opacity-70">
                          Buckets: {testResult.buckets.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Ghi chú hướng dẫn ───────────────────────────────────────────────── */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-amber-50/80 to-orange-50/80 shadow-lg shadow-amber-100/50">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-amber-900">Ghi chú</h2>
              <p className="text-xs text-amber-600">Thông tin và lưu ý khi sử dụng MinIO</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">•</span>
              <span><strong>MinIO</strong> là hệ thống lưu trữ đối tượng tương thích S3, dùng để lưu trữ ảnh chụp chỉ số điện/nước, ảnh sự cố, file đính kèm và tài liệu.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">•</span>
              <span>Cấu hình MinIO được quản lý <strong>theo từng tòa nhà</strong>. Chọn tòa nhà ở trên để cấu hình kết nối MinIO cho tòa nhà đó.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">•</span>
              <span>Sau khi thay đổi cấu hình, nhấn <strong>"Kiểm tra kết nối"</strong> để xác nhận MinIO server hoạt động trước khi lưu.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">•</span>
              <span>Nếu chưa có MinIO server, bạn có thể cài đặt MinIO trên máy chủ nội bộ hoặc sử dụng dịch vụ đám mây tương thích S3.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">•</span>
              <span>File upload qua Zalo Bot, ảnh hóa đơn và ảnh sự cố sẽ tự động được lưu vào MinIO nếu đã cấu hình.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">•</span>
              <span>Chính sách dọn dẹp file cũ: ảnh Zalo giữ <strong>7 ngày</strong>, ảnh hóa đơn giữ <strong>365 ngày</strong> (có thể cấu hình trong Cài đặt).</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Thông tin bổ sung ────────────────────────────────────────────────── */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-sky-50/80 to-cyan-50/80 shadow-lg shadow-sky-100/50">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-200">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-sky-900">Liên kết nhanh</h2>
              <p className="text-xs text-sky-600">Truy cập các trang liên quan</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-sky-200 text-sky-700 hover:bg-sky-50"
              onClick={() => router.push('/dashboard/cai-dat')}
            >
              <Server className="h-3.5 w-3.5 mr-1.5" />
              Cài đặt hệ thống
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
