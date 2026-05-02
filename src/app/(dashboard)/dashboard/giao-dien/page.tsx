'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

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
        <h1 className="text-2xl font-bold text-indigo-900">Giao diện</h1>
        <p className="text-sm text-indigo-500/70">Tùy chỉnh giao diện hiển thị</p>
      </div>

      {/* Sidebar style */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <div className="text-base md:text-lg font-semibold text-indigo-900">Kiểu sidebar</div>
            <div className="text-xs text-indigo-500/70">Chọn cách hiển thị thanh điều hướng bên trái</div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {([
            { value: 'default' as const, label: 'Mặc định', desc: 'Sidebar đầy đủ với tên menu' },
            { value: 'compact' as const, label: 'Thu gọn', desc: 'Sidebar nhỏ chỉ hiện icon' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                settings.sidebarStyle === opt.value
                  ? 'border-indigo-300 bg-white/80 shadow-sm'
                  : 'border-indigo-100 bg-white/60 backdrop-blur-sm hover:border-indigo-200 hover:shadow-sm'
              }`}
            >
              <input
                type="radio"
                name="sidebarStyle"
                value={opt.value}
                checked={settings.sidebarStyle === opt.value}
                onChange={() => update({ sidebarStyle: opt.value })}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <div className="text-sm font-semibold text-indigo-900">{opt.label}</div>
                <div className="text-xs text-indigo-500/70">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 12h18M3 20h18" />
            </svg>
          </div>
          <div>
            <div className="text-base md:text-lg font-semibold text-indigo-900">Cỡ chữ</div>
            <div className="text-xs text-indigo-500/70">Thay đổi kích thước chữ trong ứng dụng</div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {([
            { value: 'small' as const, label: 'Nhỏ', desc: 'Phù hợp màn hình lớn, hiển thị nhiều dữ liệu' },
            { value: 'medium' as const, label: 'Vừa', desc: 'Kích thước mặc định' },
            { value: 'large' as const, label: 'Lớn', desc: 'Dễ đọc hơn trên thiết bị nhỏ' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                settings.fontSize === opt.value
                  ? 'border-indigo-300 bg-white/80 shadow-sm'
                  : 'border-indigo-100 bg-white/60 backdrop-blur-sm hover:border-indigo-200 hover:shadow-sm'
              }`}
            >
              <input
                type="radio"
                name="fontSize"
                value={opt.value}
                checked={settings.fontSize === opt.value}
                onChange={() => update({ fontSize: opt.value })}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <div className="text-sm font-semibold text-indigo-900">{opt.label}</div>
                <div className="text-xs text-indigo-500/70">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
