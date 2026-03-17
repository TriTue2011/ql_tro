'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import '@/styles/bs-admin.css';

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

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
}

const navItems = [
  { label: 'Tổng quan',  href: '/khach-thue/dashboard',           icon: 'bi-grid-1x2-fill' },
  { label: 'Hóa đơn',   href: '/khach-thue/dashboard/hoa-don',   icon: 'bi-receipt' },
  { label: 'Hợp đồng',  href: '/khach-thue/dashboard/hop-dong',  icon: 'bi-file-earmark-text' },
  { label: 'Sự cố',     href: '/khach-thue/dashboard/su-co',     icon: 'bi-exclamation-triangle' },
  { label: 'Cài đặt',   href: '/khach-thue/dashboard/cai-dat',   icon: 'bi-gear' },
];

const breadcrumbMap: Record<string, string> = {
  'hoa-don':  'Hóa đơn',
  'hop-dong': 'Hợp đồng',
  'su-co':    'Sự cố',
  'cai-dat':  'Cài đặt',
};

export default function KhachThueDashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'khachThue') {
      router.replace('/dang-nhap');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fb' }}>
        <div className="text-center">
          <div className="spinner-border" style={{ color: '#6366f1', width: 40, height: 40 }} role="status" />
          <p className="mt-3" style={{ color: '#6b7280', fontSize: 14 }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'khachThue') return null;

  const userName = session.user.name ?? 'Khách thuê';
  const segments = pathname.replace('/khach-thue/dashboard', '').split('/').filter(Boolean);

  return (
    <>
      <BootstrapCDN />
      <div className="bs-admin-shell">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="bs-sidebar-overlay"
            style={{ display: 'block' }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`bs-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          {/* Brand */}
          <Link href="/khach-thue/dashboard" className="bs-sidebar-brand">
            <div className="brand-icon">
              <i className="bi bi-house-heart-fill" />
            </div>
            <div className="brand-text">
              <div className="brand-name">Phòng Trọ Pro</div>
              <div className="brand-sub">Cổng khách thuê</div>
            </div>
          </Link>

          {/* Nav */}
          <div className="bs-nav-body">
            {navItems.map((item) => {
              const isActive = item.href === '/khach-thue/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`bs-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <i className={`bi ${item.icon}`} />
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User footer */}
          <div className="bs-sidebar-footer">
            <div className="bs-user-card" onClick={() => signOut({ callbackUrl: '/dang-nhap' })} style={{ cursor: 'pointer' }}>
              <div className="bs-user-avatar">{getInitials(userName)}</div>
              <div className="bs-user-info">
                <div className="bs-user-name">{userName}</div>
                <div className="bs-user-role">Khách thuê</div>
              </div>
              <i className="bi bi-box-arrow-right" style={{ color: 'rgba(139,148,158,0.6)', fontSize: 15 }} />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="bs-main-content">
          {/* Topbar */}
          <header className="bs-topbar">
            <button className="bs-topbar-toggle d-flex d-md-none" onClick={() => setMobileOpen(true)}>
              <i className="bi bi-list" />
            </button>

            <nav className="bs-breadcrumb">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link href="/khach-thue/dashboard" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 13 }}>
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
              <div className="bs-topbar-avatar" title={userName}>
                {getInitials(userName)}
              </div>
            </div>
          </header>

          <main className="bs-page">{children}</main>
        </div>
      </div>
    </>
  );
}
