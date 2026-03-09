'use client';

import { useEffect, useState, useRef } from 'react';
import { SessionProvider } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { BsSidebar } from '@/components/bs-sidebar';
import '@/styles/bs-admin.css';

// Bootstrap 5 + Bootstrap Icons — CDN
function BootstrapCDN() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
      />
    </>
  );
}

const breadcrumbMap: Record<string, string> = {
  'toa-nha': 'Tòa nhà',
  'phong': 'Phòng',
  'khach-thue': 'Khách thuê',
  'hop-dong': 'Hợp đồng',
  'hoa-don': 'Hóa đơn',
  'thanh-toan': 'Thanh toán',
  'su-co': 'Sự cố',
  'thong-bao': 'Thông báo',
  'xem-web': 'Xem Web',
  'quan-ly-tai-khoan': 'Quản lý tài khoản',
  'ho-so': 'Hồ sơ',
  'cai-dat': 'Cài đặt',
  'them-moi': 'Thêm mới',
};

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
}

// ─── Notification types ────────────────────────────────────────────────────────

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  createdAt: string;
}

// ─── Notification helpers ──────────────────────────────────────────────────────

function getNotifIcon(type: string): string {
  const map: Record<string, string> = {
    overdue_invoices: 'bi-receipt-cutoff',
    expiring_contracts: 'bi-file-earmark-x',
    pending_issues: 'bi-exclamation-triangle',
    system: 'bi-megaphone',
  };
  return map[type] ?? 'bi-bell';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Vừa xong';
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

// ─── TopBar ────────────────────────────────────────────────────────────────────

function TopBar({
  onMenuClick,
  collapsed,
  onToggleCollapse,
}: {
  onMenuClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userName = session?.user?.name ?? 'User';

  const segments = pathname.replace('/dashboard', '').split('/').filter(Boolean);

  // Notification state
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load count on mount
  useEffect(() => {
    fetchNotifCount();
  }, []);

  async function fetchNotifCount() {
    try {
      const res = await fetch('/api/notifications?limit=1');
      const data = await res.json();
      if (data.success) setNotifCount(data.pagination?.total ?? data.data?.length ?? 0);
    } catch { /* ignore */ }
  }

  async function fetchNotifications() {
    setLoadingNotif(true);
    try {
      const res = await fetch('/api/notifications?limit=10');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
        setNotifCount(data.pagination?.total ?? data.data?.length ?? 0);
      }
    } catch { /* ignore */ }
    finally { setLoadingNotif(false); }
  }

  async function handleBellClick() {
    const next = !showNotif;
    setShowNotif(next);
    if (next) await fetchNotifications();
  }

  return (
    <header className="bs-topbar">
      <button
        className="bs-topbar-toggle d-none d-md-flex"
        onClick={onToggleCollapse}
        title={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
      >
        <i className={`bi ${collapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-reverse'}`} />
      </button>
      <button
        className="bs-topbar-toggle d-flex d-md-none"
        onClick={onMenuClick}
      >
        <i className="bi bi-list" />
      </button>

      <nav className="bs-breadcrumb">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <Link href="/dashboard" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 13 }}>
              <i className="bi bi-house me-1" />Tổng quan
            </Link>
          </li>
          {segments.map((seg, i) => (
            <li
              key={seg}
              className={`breadcrumb-item${i === segments.length - 1 ? ' active' : ''}`}
              style={{ fontSize: 13 }}
            >
              {breadcrumbMap[seg] ?? seg}
            </li>
          ))}
        </ol>
      </nav>

      <div className="bs-topbar-actions">
        {/* ── Notification Bell ── */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button className="bs-icon-btn" title="Thông báo" onClick={handleBellClick}>
            <i className="bi bi-bell" />
            {notifCount > 0 && (
              <span className="notif-dot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9, fontSize: 9, fontWeight: 700 }}>
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <span>Thông báo</span>
                {notifCount > 0 && <span className="notif-count-badge">{notifCount > 99 ? '99+' : notifCount}</span>}
              </div>

              <div className="notif-list">
                {loadingNotif ? (
                  <div className="notif-empty">
                    <div className="spinner-border spinner-border-sm" style={{ color: '#6366f1' }} />
                    <span>Đang tải...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notif-empty">
                    <i className="bi bi-bell-slash" style={{ fontSize: 28 }} />
                    <p style={{ margin: 0 }}>Không có thông báo mới</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`notif-item priority-${n.priority}`}>
                      <div className="notif-icon">
                        <i className={`bi ${getNotifIcon(n.type)}`} />
                      </div>
                      <div className="notif-body">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">{formatRelativeTime(n.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notif-footer">
                  <Link href="/dashboard/thong-bao" onClick={() => setShowNotif(false)}>
                    Xem tất cả thông báo →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <button className="bs-icon-btn" title="Tìm kiếm">
          <i className="bi bi-search" />
        </button>
        <div className="bs-topbar-avatar" title={userName}>
          {getInitials(userName)}
        </div>
      </div>
    </header>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────────

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/dang-nhap');
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f6fb',
        }}
      >
        <div className="text-center">
          <div
            className="spinner-border"
            style={{ color: '#6366f1', width: 40, height: 40 }}
            role="status"
          />
          <p className="mt-3 fw-600" style={{ color: '#6b7280', fontSize: 14 }}>
            Đang tải hệ thống...
          </p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <BootstrapCDN />
      <div className="bs-admin-shell">
        <BsSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className={`bs-main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
          <TopBar
            onMenuClick={() => setMobileOpen(true)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((p) => !p)}
          />
          <main className="bs-page">{children}</main>
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SessionProvider>
  );
}
