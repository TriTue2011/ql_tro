'use client';

/**
 * Cài đặt Hotline - Giai đoạn 4.1
 *
 * Cho phép chủ trọ/admin cấu hình 3 công tắc:
 * - batHotline: Bật/tắt Hotline
 * - uyQuyenQL: Ủy quyền cho quản lý
 * - uyQuyenHotline: Quản lý phụ trách kỹ thuật
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/dashboard/page-header';
import BuildingSelector from '@/components/dashboard/building-selector';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface HotlineSettings {
  batHotline: boolean;
  uyQuyenQL: boolean;
  uyQuyenHotline: boolean;
}

interface Building {
  id: string;
  tenToaNha: string;
}

const SCENARIO_LABELS: Record<string, { label: string; desc: string }> = {
  'A.1': { label: 'A.1 - Giao phó toàn diện', desc: 'Quản lý lo kỹ thuật, nhận thông báo, khách nhận tin từ Hotline' },
  'A.2': { label: 'A.2 - Ủy quyền qua Zalo CN', desc: 'Quản lý lo kỹ thuật, nhận thông báo, khách nhận từ Zalo cá nhân' },
  'A.3': { label: 'A.3 - Chủ trực Hotline, QL sửa', desc: 'Quản lý lo kỹ thuật, chủ trọ trực Hotline' },
  'A.4': { label: 'A.4 - Chủ tự làm tất cả', desc: 'Quản lý lo kỹ thuật, chủ trọ làm mọi việc' },
  'B.1': { label: 'B.1 - QL làm việc, chủ sửa Hotline', desc: 'Chủ trọ lo kỹ thuật, quản lý nhận thông báo, khách nhận Hotline' },
  'B.2': { label: 'B.2 - QL quản khách qua Zalo CN', desc: 'Chủ trọ lo kỹ thuật, quản lý nhận thông báo, khách nhận Zalo CN' },
  'B.3': { label: 'B.3 - Chủ làm tất cả qua Hotline', desc: 'Chủ trọ lo mọi việc, khách nhận Hotline' },
  'B.4': { label: 'B.4 - Mô hình truyền thống', desc: 'Chủ trọ làm mọi việc, khách nhận Zalo cá nhân' },
};

function identifyScenario(sw: HotlineSettings): string {
  const { batHotline, uyQuyenQL, uyQuyenHotline } = sw;
  if (uyQuyenHotline) {
    if (batHotline && uyQuyenQL) return 'A.1';
    if (!batHotline && uyQuyenQL) return 'A.2';
    if (batHotline && !uyQuyenQL) return 'A.3';
    return 'A.4';
  } else {
    if (batHotline && uyQuyenQL) return 'B.1';
    if (!batHotline && uyQuyenQL) return 'B.2';
    if (batHotline && !uyQuyenQL) return 'B.3';
    return 'B.4';
  }
}

export default function CaiDatHotlinePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [settings, setSettings] = useState<HotlineSettings>({
    batHotline: true,
    uyQuyenQL: false,
    uyQuyenHotline: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch('/api/toa-nha')
      .then(r => r.json())
      .then(res => {
        if (res.success) setBuildings(res.data || []);
      })
      .catch(console.error);
  }, [session]);

  useEffect(() => {
    if (!selectedBuildingId) return;
    setLoading(true);
    fetch(`/api/toa-nha/${selectedBuildingId}/cai-dat-hotline`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setSettings(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBuildingId]);

  const handleSave = useCallback(async () => {
    if (!selectedBuildingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/toa-nha/${selectedBuildingId}/cai-dat-hotline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu cài đặt hotline');
      } else {
        toast.error(data.message || 'Lỗi lưu');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  }, [selectedBuildingId, settings]);

  const scenarioId = identifyScenario(settings);
  const scenario = SCENARIO_LABELS[scenarioId];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Cài đặt Hotline"
        description="Cấu hình 3 công tắc quyền hạn Zalo Hotline"
      />

      <Card className="p-4 md:p-6">
        <div className="mb-4">
          <BuildingSelector
            buildings={buildings}
            value={selectedBuildingId}
            onChange={setSelectedBuildingId}
          />
        </div>

        {!selectedBuildingId ? (
          <p className="text-muted-foreground text-sm">Vui lòng chọn tòa nhà</p>
        ) : loading ? (
          <p className="text-muted-foreground text-sm">Đang tải...</p>
        ) : (
          <div className="space-y-6">
            {/* 3 công tắc */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">3 Công tắc quyền hạn</h3>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">Bật Hotline (Đối ngoại)</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.batHotline
                      ? 'Khách nhận tin từ Hotline'
                      : 'Khách nhận tin từ Zalo cá nhân người xử lý'}
                  </p>
                </div>
                <Switch
                  checked={settings.batHotline}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, batHotline: v }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">Ủy quyền Quản lý (Đối nội)</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.uyQuyenQL
                      ? 'Chuyển thông báo cho Quản lý'
                      : 'Thông báo đổ về Chủ trọ'}
                  </p>
                </div>
                <Switch
                  checked={settings.uyQuyenQL}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, uyQuyenQL: v }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">Ủy quyền Hotline (Kỹ thuật)</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.uyQuyenHotline
                      ? 'Quản lý chịu trách nhiệm bảo trì/quét QR'
                      : 'Chủ trọ chịu trách nhiệm'}
                  </p>
                </div>
                <Switch
                  checked={settings.uyQuyenHotline}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, uyQuyenHotline: v }))}
                />
              </div>
            </div>

            {/* Kịch bản hiện tại */}
            {scenario && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default" className="bg-blue-600">
                    Kịch bản {scenarioId}
                  </Badge>
                </div>
                <p className="font-medium">{scenario.label}</p>
                <p className="text-sm text-blue-700">{scenario.desc}</p>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
