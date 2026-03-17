'use client';

import { useEffect, useState } from 'react';
import '@/styles/bs-admin.css';

interface ThongBaoItem {
  id: string;
  tieuDe: string;
  noiDung: string;
  ngayGui: string;
  daDoc: boolean;
  loai?: string;
}

interface ThongBaoData {
  hoaDon: ThongBaoItem[];
  suCo: ThongBaoItem[];
  nhacNho: ThongBaoItem[];
  khac: ThongBaoItem[];
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const TABS = [
  { key: 'nhacNho', label: 'Nhắc nhở',   icon: 'bi-bell-fill',        color: '#f59e0b' },
  { key: 'hoaDon',  label: 'Hóa đơn',    icon: 'bi-receipt-cutoff',   color: '#6366f1' },
  { key: 'suCo',    label: 'Sự cố',      icon: 'bi-exclamation-triangle-fill', color: '#ef4444' },
  { key: 'khac',    label: 'Khác',       icon: 'bi-chat-dots-fill',   color: '#6b7280' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function ThongBaoPage() {
  const [data, setData] = useState<ThongBaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('nhacNho');

  const fetchData = () => {
    fetch('/api/auth/khach-thue/thong-bao')
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    document.title = 'Thông báo — Cổng Khách Thuê';
    fetchData();
  }, []);

  const markRead = async (id: string) => {
    if (id.startsWith('nhac-')) return; // auto reminders don't persist
    await fetch('/api/auth/khach-thue/thong-bao', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setData(prev => {
      if (!prev) return prev;
      const mark = (list: ThongBaoItem[]) =>
        list.map(tb => tb.id === id ? { ...tb, daDoc: true } : tb);
      return { hoaDon: mark(prev.hoaDon), suCo: mark(prev.suCo), nhacNho: prev.nhacNho, khac: mark(prev.khac) };
    });
  };

  const totalUnread = data
    ? data.nhacNho.filter(t => !t.daDoc).length +
      data.hoaDon.filter(t => !t.daDoc).length +
      data.suCo.filter(t => !t.daDoc).length +
      data.khac.filter(t => !t.daDoc).length
    : 0;

  const currentList: ThongBaoItem[] = data ? data[activeTab] : [];
  const tab = TABS.find(t => t.key === activeTab)!;

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h5 className="fw-bold mb-1" style={{ fontSize: 18 }}>
            <i className="bi bi-bell me-2" style={{ color: '#6366f1' }} />
            Thông báo
            {totalUnread > 0 && (
              <span className="badge rounded-pill ms-2" style={{ background: '#ef4444', fontSize: 11 }}>{totalUnread}</span>
            )}
          </h5>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 0 }}>Các thông báo và nhắc nhở từ hệ thống</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="d-flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => {
          const count = data ? data[t.key].filter(x => !x.daDoc).length : 0;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="btn btn-sm d-flex align-items-center gap-2"
              style={{
                border: `1.5px solid ${activeTab === t.key ? t.color : '#e5e7eb'}`,
                background: activeTab === t.key ? t.color : '#fff',
                color: activeTab === t.key ? '#fff' : '#374151',
                borderRadius: 20,
                padding: '6px 14px',
                fontWeight: activeTab === t.key ? 600 : 400,
                fontSize: 13,
                transition: 'all .2s',
              }}
            >
              <i className={`bi ${t.icon}`} style={{ fontSize: 13 }} />
              {t.label}
              {count > 0 && (
                <span
                  className="badge rounded-pill"
                  style={{ background: activeTab === t.key ? 'rgba(255,255,255,0.35)' : t.color, color: '#fff', fontSize: 10, padding: '2px 6px' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bs-card">
        {loading ? (
          <div className="py-4 text-center" style={{ color: '#9ca3af', fontSize: 13 }}>
            <div className="spinner-border spinner-border-sm me-2" />
            Đang tải...
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-5" style={{ color: '#9ca3af' }}>
            <i className={`bi ${tab.icon} fs-1 d-block mb-2`} style={{ color: '#e5e7eb' }} />
            <p style={{ fontSize: 14 }}>Không có thông báo nào</p>
          </div>
        ) : (
          <div className="d-flex flex-column">
            {currentList.map((tb, idx) => (
              <div
                key={tb.id}
                onClick={() => !tb.daDoc && markRead(tb.id)}
                style={{
                  padding: '14px 16px',
                  borderBottom: idx < currentList.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: tb.daDoc ? '#fff' : 'rgba(99,102,241,0.04)',
                  cursor: tb.daDoc ? 'default' : 'pointer',
                  transition: 'background .15s',
                }}
              >
                <div className="d-flex align-items-start gap-3">
                  {/* Icon dot */}
                  <div style={{ marginTop: 3 }}>
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: tb.daDoc ? '#e5e7eb' : tab.color,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div className="flex-fill" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <p
                        className="mb-1"
                        style={{ fontSize: 14, fontWeight: tb.daDoc ? 400 : 600, color: '#111827', lineHeight: 1.4 }}
                      >
                        {tb.tieuDe}
                      </p>
                      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {fmtDate(tb.ngayGui)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{tb.noiDung}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
