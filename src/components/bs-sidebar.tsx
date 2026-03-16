'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import '@/styles/bs-admin.css';

interface NavItem {
  label: string;
  href: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

// ─── Phân quyền sidebar theo role ──────────────────────────────────────────
type Role = 'admin' | 'chuNha' | 'quanLy' | 'nhanVien' | string;

/**
 * Trả về danh sách NavGroup dựa vào role hiện tại.
 *
 * admin    → toàn quyền
 * chuNha   → tất cả trừ "Quản lý tài khoản"; cài đặt ẩn luuTru/thongBao (xử lý trong trang)
 * quanLy   → không có tab "Cài đặt", không có "Quản lý tài khoản"
 * nhanVien → chỉ: Phòng, Khách thuê (xem), Hóa đơn, Sự cố, Thông báo, Xem Web, Hồ sơ
 */
function buildNavGroups(role: Role): NavGroup[] {
  const isAdmin = role === 'admin';
  const isChuNha = role === 'chuNha';
  const isQuanLy = role === 'quanLy';
  const isNhanVien = role === 'nhanVien';

  if (isNhanVien) {
    return [
      {
        label: 'Quản lý',
        icon: 'bi-building',
        items: [
          { label: 'Phòng', href: '/dashboard/phong' },
          { label: 'Khách thuê', href: '/dashboard/khach-thue' },
        ],
      },
      {
        label: 'Vận hành',
        icon: 'bi-tools',
        items: [
          { label: 'Hóa đơn', href: '/dashboard/hoa-don' },
          { label: 'Sự cố', href: '/dashboard/su-co' },
          { label: 'Thông báo', href: '/dashboard/thong-bao' },
          { label: 'Xem Web', href: '/dashboard/xem-web' },
        ],
      },
      {
        label: 'Cài đặt',
        icon: 'bi-gear',
        items: [{ label: 'Hồ sơ', href: '/dashboard/ho-so' }],
      },
    ];
  }

  const groups: NavGroup[] = [
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
  ];

  // "Quản trị" chỉ admin thấy
  if (isAdmin) {
    groups.push({
      label: 'Quản trị',
      icon: 'bi-shield-lock',
      items: [
        { label: 'Quản lý tài khoản', href: '/dashboard/quan-ly-tai-khoan' },
      ],
    });
  }

  // Tab "Cài đặt": quanLy không có; admin/chuNha có đủ; (chuNha ẩn luuTru trong trang cai-dat)
  if (!isQuanLy) {
    groups.push({
      label: 'Cài đặt',
      icon: 'bi-gear',
      items: [
        { label: 'Hồ sơ', href: '/dashboard/ho-so' },
        ...(isAdmin || isChuNha
          ? [{ label: 'Cài đặt', href: '/dashboard/cai-dat' }]
          : []),
      ],
    });
  } else {
    // quanLy chỉ có hồ sơ (không có tab cài đặt hệ thống)
    groups.push({
      label: 'Tài khoản',
      icon: 'bi-person',
      items: [{ label: 'Hồ sơ', href: '/dashboard/ho-so' }],
    });
  }

  return groups;
}

function roleLabel(role: Role): string {
  switch (role) {
    case 'admin':    return 'Quản trị viên';
    case 'chuNha':   return 'Chủ trọ';
    case 'quanLy':   return 'Người quản lý';
    case 'nhanVien': return 'Nhân viên';
    default:         return 'Người dùng';
  }
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

  const role: Role = session?.user?.role ?? 'nhanVien';
  const navGroups = buildNavGroups(role);

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

          {navGroups.map((group) => (
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
                    <i className={`bi ${getItemIcon(item.label)}`} />
                    <span className="nav-label">{item.label}</span>
                    {item.badge ? (
                      <span className="nav-badge">{item.badge}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div className="bs-sidebar-footer">
          <div className="bs-user-card" onClick={() => signOut({ callbackUrl: '/dang-nhap' })}>
            <div className="bs-user-avatar">{getInitials(userName)}</div>
            <div className="bs-user-info">
              <div className="bs-user-name">{userName}</div>
              <div className="bs-user-role">{roleLabel(role)}</div>
            </div>
            <i className="bi bi-box-arrow-right" style={{ color: 'rgba(139,148,158,0.6)', fontSize: 15 }} />
          </div>
        </div>
      </aside>
    </>
  );
}

function getItemIcon(label: string): string {
  const iconMap: Record<string, string> = {
    'Tòa nhà':            'bi-building',
    'Phòng':              'bi-door-open',
    'Khách thuê':         'bi-people',
    'Hợp đồng':          'bi-file-earmark-text',
    'Hóa đơn':           'bi-receipt-cutoff',
    'Thanh toán':         'bi-credit-card',
    'Sự cố':             'bi-exclamation-triangle',
    'Thông báo':          'bi-bell',
    'Xem Web':            'bi-globe',
    'Quản lý tài khoản': 'bi-person-badge',
    'Hồ sơ':             'bi-person-circle',
    'Cài đặt':           'bi-sliders',
  };
  return iconMap[label] ?? 'bi-dot';
}
