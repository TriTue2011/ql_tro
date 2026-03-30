'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ArrowLeft, Shield } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Building { id: string; tenToaNha: string; }

const ROLE_LABELS: Record<string, string> = {
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
};
const DEFAULT_ROLE_LIMITS: Record<string, number> = { dongChuTro: 2, quanLy: 3, nhanVien: 5 };

export default function GioiHanPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const isChuNha = session?.user?.role === 'chuNha';

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [globalLimits, setGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [editGlobalLimits, setEditGlobalLimits] = useState<Record<string, number>>(DEFAULT_ROLE_LIMITS);
  const [editBuildingLimits, setEditBuildingLimits] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Giới hạn vai trò';
    Promise.all([
      fetch('/api/toa-nha?limit=100').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/admin/role-limits?all=1').then(r => r.ok ? r.json() : null),
    ]).then(([bData, limitsData]: [any, any]) => {
      setBuildings(bData.data || []);
      const g = limitsData?.global || DEFAULT_ROLE_LIMITS;
      const pb = limitsData?.perBuilding || {};
      setGlobalLimits(g);
      setPerBuildingLimits(pb);
      setEditGlobalLimits({ ...g });
      setEditBuildingLimits({ ...pb });
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const globalRes = await fetch('/api/admin/role-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGlobalLimits),
      });
      if (!globalRes.ok) {
        const err = await globalRes.json();
        toast.error(err.error || 'Lưu giới hạn chung thất bại');
        return;
      }
      for (const building of buildings) {
        const edited = editBuildingLimits[building.id];
        if (!edited) continue;
        await fetch('/api/admin/role-limits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toaNhaId: building.id, ...edited }),
        });
      }
      setGlobalLimits({ ...editGlobalLimits });
      setPerBuildingLimits({ ...editBuildingLimits });
      toast.success('Đã lưu giới hạn vai trò');
    } catch {
      toast.error('Không thể kết nối máy chủ');
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

  return (
    <div className="max-w-xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/quan-ly-tai-khoan">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Giới hạn vai trò</h1>
          <p className="text-xs text-gray-500">
            {isAdmin
              ? 'Cài đặt số lượng tối đa mỗi vai trò trên mỗi tòa nhà.'
              : 'Giới hạn số lượng mỗi vai trò do quản trị viên cài đặt.'}
          </p>
        </div>
      </div>

      {/* Global limits — chỉ admin */}
      {isAdmin && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giới hạn chung (mặc định)</p>
          <div className="grid gap-2">
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label className="text-sm">{label}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editGlobalLimits[key] ?? 0}
                  onChange={(e) => setEditGlobalLimits({ ...editGlobalLimits, [key]: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm text-center"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-building limits */}
      {buildings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giới hạn theo tòa nhà</p>
          {isAdmin && <p className="text-[10px] text-muted-foreground">Để trống (0) = dùng giới hạn chung</p>}
          <div className="space-y-3">
            {buildings.map(b => {
              const bLimits = editBuildingLimits[b.id] || {};
              const displayLimits = isChuNha
                ? Object.fromEntries(Object.keys(ROLE_LABELS).map(k => [k, bLimits[k] || globalLimits[k] || 0]))
                : bLimits;
              return (
                <div key={b.id} className="border rounded-md p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-sm font-medium">{b.tenToaNha}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <div key={key} className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">{label}</Label>
                        {isAdmin ? (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder={String(editGlobalLimits[key] ?? 0)}
                            value={bLimits[key] || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setEditBuildingLimits({
                                ...editBuildingLimits,
                                [b.id]: { ...bLimits, [key]: val },
                              });
                            }}
                            className="h-8 text-xs text-center"
                          />
                        ) : (
                          <div className="h-8 flex items-center justify-center text-sm font-medium bg-muted rounded-md">
                            {displayLimits[key] ?? 0}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        {isAdmin && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu giới hạn'}
          </Button>
        )}
      </div>
    </div>
  );
}
