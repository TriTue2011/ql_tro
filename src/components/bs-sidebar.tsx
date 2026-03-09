'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import '@/styles/bs-admin.css';

interface NavSubItem {
  label: string;
  href: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavSubItem[];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

export function BsSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'admin';

  const navGroups: NavGroup[] = [
    {
      label: 'Quản lý cơ bản',
      icon: 'bi-building',
      items: [
        { label: 'Tòa nhà', href: '/dashboard/toa-nha' },
        { label: 'Phòng', href: '/dashboard/phong' },
        { label: 'Khách thuê', href: '/dashboard/khach-thue' },
      ],
    },
    {
      label: 'Tài chính',
      icon: 'bi-receipt',
      items: [
        { label: 'Hợp đồng', href: '/dashboard/hop-dong' },
        { label: 'Hóa đơn', href: '/dashboard/hoa-don' },
        { label: 'Thanh toán', href: '/dashboard/thanh-toan' },
      ],
    },
    {
      label: 'Vận hành',
      icon: 'bi-tools',
      items: [
        { label: 'Sự cố', href: '/dashboard/su-co' },
        { label: 'Thông báo', href: '/dashboard/thong-bao' },
        { label: 'Xem Web', href: '/dashboard/xem-web' },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Quản trị',
            icon: 'bi-shield-lock',
            items: [
              { label: 'Quản lý tài khoản', href: '/dashboard/quan-ly-tai-khoan' },
              { label: 'Cài đặt hệ thống', href: '/dashboard/cai-dat' },
            ],
          },
        ]
      : []),
    {
      label: 'Cài đặt',
      icon: 'bi-gear',
      items: [
        { label: 'Hồ sơ', href: '/dashboard/ho-so' },
        { label: 'Cài đặt', href: '/dashboard/cai-dat' },
      ],
    },
  ];

  // Auto-open group containing current path
  useEffect(() => {
    for (const g of navGroups) {
      if (g.items.some((it) => pathname.startsWith(it.href))) {
        setOpenGroup(g.label);
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const userName = session?.user?.name ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const userRole = session?.user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="bs-sidebar-overlay"
          style={{ display: 'block' }}
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`bs-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand */}
        <Link href="/dashboard" className="bs-sidebar-brand">
          <div className="brand-icon">
            <i className="bi bi-house-door-fill" />
          </div>
          <div className="brand-text">
            <div className="brand-name">Phòng Trọ Pro</div>
            <div className="brand-sub">Quản lý thông minh</div>
          </div>
        </Link>

        {/* Dashboard link */}
        <div className="bs-nav-body">
          <Link
            href="/dashboard"
            className={`bs-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
          >
            <i className="bi bi-grid-1x2-fill" />
            <span className="nav-label">Tổng quan</span>
          </Link>

          {navGroups.map((group) => {
            const isGroupActive = group.items.some((it) => pathname.startsWith(it.href));
            const isOpen = openGroup === group.label;

            return (
              <div key={group.label}>
                <div className="bs-nav-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`bs-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (window.innerWidth < 768) onMobileClose();
                      }}
                    >
                      <i className={`bi ${getGroupIcon(group.label, item.label)}`} />
                      <span className="nav-label">{item.label}</span>
                      {item.badge ? (
                        <span className="nav-badge">{item.badge}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User footer */}
        <div className="bs-sidebar-footer">
          <div className="bs-user-card" onClick={() => signOut({ callbackUrl: '/dang-nhap' })}>
            <div className="bs-user-avatar">{getInitials(userName)}</div>
            <div className="bs-user-info">
              <div className="bs-user-name">{userName}</div>
              <div className="bs-user-role">{userRole}</div>
            </div>
            <i className="bi bi-box-arrow-right" style={{ color: 'rgba(139,148,158,0.6)', fontSize: 15 }} />
          </div>
        </div>
      </aside>
    </>
  );
}

function getGroupIcon(groupLabel: string, itemLabel: string): string {
  const iconMap: Record<string, string> = {
    'Tòa nhà': 'bi-building',
    'Phòng': 'bi-door-open',
    'Khách thuê': 'bi-people',
    'Hợp đồng': 'bi-file-earmark-text',
    'Hóa đơn': 'bi-receipt-cutoff',
    'Thanh toán': 'bi-credit-card',
    'Sự cố': 'bi-exclamation-triangle',
    'Thông báo': 'bi-bell',
    'Xem Web': 'bi-globe',
    'Quản lý tài khoản': 'bi-person-badge',
    'Cài đặt hệ thống': 'bi-gear-wide-connected',
    'Hồ sơ': 'bi-person-circle',
    'Cài đặt': 'bi-sliders',
  };
  return iconMap[itemLabel] ?? 'bi-dot';
}
