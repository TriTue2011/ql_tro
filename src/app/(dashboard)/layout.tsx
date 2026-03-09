'use client';

import { useEffect, useState } from 'react';
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
        <button className="bs-icon-btn" title="Thông báo">
          <i className="bi bi-bell" />
          <span className="notif-dot" />
        </button>
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
