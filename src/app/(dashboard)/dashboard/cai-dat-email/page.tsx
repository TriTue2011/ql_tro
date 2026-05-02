'use client';

/**
 * Cài đặt Email - Giai đoạn 4.2
 *
 * Cho phép người dùng cấu hình SMTP để gửi email tự động.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface EmailConfig {
  email: string;
  appPassword: string;
  host: string;
  port: number;
  tenHienThi: string;
  tuDongGuiHoaDon: boolean;
  tuDongGuiNhacNo: boolean;
  tuDongGuiBaoCao: boolean;
  tuDongGuiBaoTri: boolean;
}

const defaultConfig: EmailConfig = {
  email: '',
  appPassword: '',
  host: 'smtp.gmail.com',
  port: 587,
  tenHienThi: '',
  tuDongGuiHoaDon: false,
  tuDongGuiNhacNo: false,
  tuDongGuiBaoCao: false,
  tuDongGuiBaoTri: false,
};

export default function CaiDatEmailPage() {
  const { data: session } = useSession();
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch('/api/admin/email-config')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setConfig({ ...defaultConfig, ...res.data, appPassword: '' });
          setHasConfig(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu cấu hình email');
        setHasConfig(true);
      } else {
        toast.error(data.message || 'Lỗi lưu');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Xóa cấu hình email?')) return;
    try {
      const res = await fetch('/api/admin/email-config', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã xóa cấu hình email');
        setConfig(defaultConfig);
        setHasConfig(false);
      }
    } catch {
      toast.error('Lỗi kết nối');
    }
  }, []);

  const updateField = (field: keyof EmailConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader title="Cài đặt Email" description="Cấu hình SMTP gửi email tự động" />
        <Card className="p-6"><p className="text-muted-foreground">Đang tải...</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Cài đặt Email"
        description="Cấu hình SMTP gửi email tự động (hóa đơn, nhắc nợ, bảo trì)"
      />

      <Card className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={config.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder="your-email@gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Mật khẩu ứng dụng</Label>
            <Input
              type="password"
              value={config.appPassword}
              onChange={e => updateField('appPassword', e.target.value)}
              placeholder={hasConfig ? '•••••••• (để trống nếu không đổi)' : 'Mật khẩu ứng dụng Gmail'}
            />
          </div>
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input
              value={config.host}
              onChange={e => updateField('host', e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Cổng</Label>
            <Input
              type="number"
              value={config.port}
              onChange={e => updateField('port', parseInt(e.target.value) || 587)}
              placeholder="587"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tên hiển thị</Label>
            <Input
              value={config.tenHienThi}
              onChange={e => updateField('tenHienThi', e.target.value)}
              placeholder="QL Trọ"
            />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <h3 className="font-semibold">Tự động gửi</h3>
          <div className="flex items-center justify-between">
            <Label>Hóa đơn mới</Label>
            <Switch checked={config.tuDongGuiHoaDon} onCheckedChange={v => updateField('tuDongGuiHoaDon', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Nhắc nợ quá hạn</Label>
            <Switch checked={config.tuDongGuiNhacNo} onCheckedChange={v => updateField('tuDongGuiNhacNo', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Báo cáo định kỳ</Label>
            <Switch checked={config.tuDongGuiBaoCao} onCheckedChange={v => updateField('tuDongGuiBaoCao', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Nhắc bảo trì</Label>
            <Switch checked={config.tuDongGuiBaoTri} onCheckedChange={v => updateField('tuDongGuiBaoTri', v)} />
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </Button>
          {hasConfig && (
            <Button variant="destructive" onClick={handleDelete}>
              Xóa cấu hình
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
