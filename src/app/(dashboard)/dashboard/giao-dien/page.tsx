'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type SidebarStyle = 'default' | 'compact';
type FontSize = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'ql-tro-appearance';

interface AppearanceSettings {
  sidebarStyle: SidebarStyle;
  fontSize: FontSize;
}

const defaults: AppearanceSettings = {
  sidebarStyle: 'default',
  fontSize: 'medium',
};

function loadSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function saveSettings(s: AppearanceSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function GiaoDienPage() {
  const [settings, setSettings] = useState<AppearanceSettings>(defaults);

  useEffect(() => {
    document.title = 'Giao diện';
    setSettings(loadSettings());
  }, []);

  const update = (patch: Partial<AppearanceSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    toast.success('Đã lưu cài đặt giao diện');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Giao diện</h1>
        <p className="text-sm text-gray-600">Tùy chỉnh giao diện hiển thị</p>
      </div>

      {/* Sidebar style */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kiểu sidebar</CardTitle>
          <CardDescription>Chọn cách hiển thị thanh điều hướng bên trái</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { value: 'default' as const, label: 'Mặc định', desc: 'Sidebar đầy đủ với tên menu' },
            { value: 'compact' as const, label: 'Thu gọn', desc: 'Sidebar nhỏ chỉ hiện icon' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                settings.sidebarStyle === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="sidebarStyle"
                value={opt.value}
                checked={settings.sidebarStyle === opt.value}
                onChange={() => update({ sidebarStyle: opt.value })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Font size */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cỡ chữ</CardTitle>
          <CardDescription>Thay đổi kích thước chữ trong ứng dụng</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { value: 'small' as const, label: 'Nhỏ', desc: 'Phù hợp màn hình lớn, hiển thị nhiều dữ liệu' },
            { value: 'medium' as const, label: 'Vừa', desc: 'Kích thước mặc định' },
            { value: 'large' as const, label: 'Lớn', desc: 'Dễ đọc hơn trên thiết bị nhỏ' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                settings.fontSize === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="fontSize"
                value={opt.value}
                checked={settings.fontSize === opt.value}
                onChange={() => update({ fontSize: opt.value })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
