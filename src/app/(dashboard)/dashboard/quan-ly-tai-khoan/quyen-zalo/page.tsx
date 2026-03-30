'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Building2, ArrowLeft, Shield, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface Building { id: string; tenToaNha: string; }

const ZALO_FEATURES = [
  { key: 'botServer', label: 'Bot Server' },
  { key: 'trucTiep', label: 'Trực tiếp' },
  { key: 'proxy', label: 'Proxy' },
  { key: 'webhook', label: 'Webhook' },
  { key: 'tinTuDong', label: 'Tin tự động' },
  { key: 'testGui', label: 'Test gửi' },
  { key: 'ketBan', label: 'Kết bạn' },
  { key: 'theoDoiTin', label: 'Theo dõi tin' },
  { key: 'zaloMonitor', label: 'Zalo Monitor' },
];
const ZALO_ROLES = [
  { key: 'chuNha', label: 'Chủ nhà' },
  { key: 'dongChuTro', label: 'Đồng chủ trọ' },
  { key: 'quanLy', label: 'Quản lý' },
  { key: 'nhanVien', label: 'Nhân viên' },
];
const CHU_NHA_ROLES = ['dongChuTro', 'quanLy', 'nhanVien'];

const defaultFeatures = () => Object.fromEntries(ZALO_FEATURES.map(f => [f.key, true]));

export default function QuyenZaloPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const isChuNha = session?.user?.role === 'chuNha';

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [adminPerms, setAdminPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [chuNhaPerms, setChuNhaPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);

  useEffect(() => {
    document.title = 'Quyền Zalo';
    fetch('/api/toa-nha?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(bData => {
        const list = bData.data || [];
        setBuildings(list);
        if (list.length > 0) setSelectedBuilding(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadPermissions = useCallback(async (toaNhaId: string) => {
    if (!toaNhaId) return;
    setLoadingPerms(true);
    try {
      const res = await fetch(`/api/admin/zalo-quyen?toaNhaId=${toaNhaId}`);
      const data = await res.json();
      if (data.ok) {
        setAdminPerms(data.admin || {});
        setChuNhaPerms(data.chuNha || {});
      } else {
        // Default all on
        const def: Record<string, Record<string, boolean>> = {};
        ZALO_ROLES.forEach(r => { def[r.key] = defaultFeatures(); });
        setAdminPerms(def);
        const defCN: Record<string, Record<string, boolean>> = {};
        CHU_NHA_ROLES.forEach(r => { defCN[r] = defaultFeatures(); });
        setChuNhaPerms(defCN);
      }
    } catch {
      toast.error('Lỗi tải quyền Zalo');
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBuilding) loadPermissions(selectedBuilding);
  }, [selectedBuilding, loadPermissions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const level = isAdmin ? 'admin' : 'chuNha';
      const permissions = isAdmin ? adminPerms : chuNhaPerms;
      const res = await fetch('/api/admin/zalo-quyen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: selectedBuilding, level, permissions }),
      });
      const data = await res.json();
      if (data.ok) toast.success('Đã lưu quyền Zalo');
      else toast.error(data.error || 'Lỗi');
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && !isChuNha) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Không có quyền truy cập</h2>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  const visibleRoles = isAdmin ? ZALO_ROLES : ZALO_ROLES.filter(r => CHU_NHA_ROLES.includes(r.key));

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/quan-ly-tai-khoan">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Quyền Zalo
          </h1>
          <p className="text-xs text-gray-500">
            {isAdmin
              ? 'Bật/tắt từng tính năng Zalo cho mỗi vai trò. Chủ trọ chỉ có thể tắt thêm, không bật lại những gì đã tắt.'
              : 'Bật/tắt tính năng Zalo cho các vai trò dưới quyền (trong giới hạn quản trị viên cho phép).'}
          </p>
        </div>
      </div>

      {/* Building selector */}
      {buildings.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs">Tòa nhà</Label>
          <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Chọn tòa nhà" />
            </SelectTrigger>
            <SelectContent>
              {buildings.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.tenToaNha}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {buildings.length === 1 && (
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-sm font-medium">{buildings[0].tenToaNha}</span>
        </div>
      )}

      {/* Toggle matrix */}
      {loadingPerms ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Tính năng</th>
                {visibleRoles.map(r => (
                  <th key={r.key} className="text-center py-2.5 px-2 font-medium text-muted-foreground whitespace-nowrap">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ZALO_FEATURES.map(feat => (
                <tr key={feat.key} className="border-b last:border-0">
                  <td className="py-2.5 px-3 font-medium">{feat.label}</td>
                  {visibleRoles.map(role => {
                    const adminOff = isAdmin ? false : (adminPerms[role.key]?.[feat.key] === false);
                    const currentData = isAdmin ? adminPerms : chuNhaPerms;
                    const checked = currentData[role.key]?.[feat.key] ?? true;
                    return (
                      <td key={role.key} className="text-center py-2.5 px-2">
                        <Switch
                          checked={adminOff ? false : checked}
                          disabled={adminOff}
                          onCheckedChange={(v) => {
                            if (isAdmin) {
                              setAdminPerms(prev => ({
                                ...prev,
                                [role.key]: { ...(prev[role.key] || defaultFeatures()), [feat.key]: v },
                              }));
                            } else {
                              setChuNhaPerms(prev => ({
                                ...prev,
                                [role.key]: { ...(prev[role.key] || defaultFeatures()), [feat.key]: v },
                              }));
                            }
                          }}
                          className="scale-75"
                        />
                        {adminOff && (
                          <p className="text-[9px] text-red-400 mt-0.5">Admin tắt</p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu quyền'}
        </Button>
      </div>
    </div>
  );
}
