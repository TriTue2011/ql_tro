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
type Role = 'admin' | 'chuNha' | 'dongChuTro' | 'quanLy' | 'nhanVien' | string;

/**
 * Trả về danh sách NavGroup dựa vào role hiện tại.
 *
 * admin      → toàn quyền: đủ tất cả tab + section "Quản trị" riêng
 * chuNha     → quản lý bất động sản đầy đủ; KHÔNG có "Quản trị"
 * dongChuTro → chỉ xem, không Zalo/Monitor/Cài đặt/Quản lý TK, có Giao diện
 * quanLy     → như chuNha nhưng không có cài đặt hệ thống
 * nhanVien   → chỉ: Zalo + Hồ sơ
 */
function buildNavGroups(role: Role): NavGroup[] {
  const isAdmin = role === 'admin';
  const isDongChuTro = role === 'dongChuTro';
  const isChuNha = role === 'chuNha';
  const isQuanLy = role === 'quanLy';
  const isNhanVien = role === 'nhanVien';

  // ── Nhân viên: chỉ Zalo + Hồ sơ ──────────────────────────────────────────
  if (isNhanVien) {
    return [
      {
        label: 'Liên lạc',
        icon: 'bi-chat-dots',
        items: [
          { label: 'Zalo', href: '/dashboard/zalo' },
          { label: 'Zalo Monitor', href: '/dashboard/zalo-monitor' },
        ],
      },
      {
        label: 'Tài khoản',
        icon: 'bi-person',
        items: [{ label: 'Hồ sơ', href: '/dashboard/ho-so' }],
      },
    ];
  }

  // ── Admin: chỉ quản trị hệ thống, Zalo, Cài đặt ──────────────────────────
  if (isAdmin) {
    return [
      {
        label: 'Hệ thống',
        icon: 'bi-building',
        items: [
          { label: 'Tòa nhà', href: '/dashboard/toa-nha' },
        ],
      },
      {
        label: 'Quản trị',
        icon: 'bi-shield-lock',
        items: [
          { label: 'Quản lý tài khoản', href: '/dashboard/quan-ly-tai-khoan' },
          { label: 'Phân quyền', href: '/dashboard/phan-quyen' },
          { label: 'Lưu trữ MinIO', href: '/dashboard/luu-tru' },
        ],
      },
      {
        label: 'Liên lạc',
        icon: 'bi-chat-dots',
        items: [
          { label: 'Zalo', href: '/dashboard/zalo' },
          { label: 'Zalo Monitor', href: '/dashboard/zalo-monitor' },
        ],
      },
      {
        label: 'Cài đặt',
        icon: 'bi-gear',
        items: [
          { label: 'Hồ sơ', href: '/dashboard/ho-so' },
          { label: 'Cài đặt', href: '/dashboard/cai-dat' },
        ],
      },
    ];
  }

  // ── Đồng chủ trọ: chỉ xem — có Zalo (giới hạn), không Cài đặt/Quản lý TK ──
  if (isDongChuTro) {
    return [
      {
        label: 'Quản lý cơ bản',
        icon: 'bi-building',
        items: [
          { label: 'Tòa nhà', href: '/dashboard/toa-nha' },
          { label: 'Phòng', href: '/dashboard/phong' },
          { label: 'Khách thuê', href: '/dashboard/khach-thue' },
          { label: 'Quản lý tài khoản', href: '/dashboard/quan-ly-tai-khoan' },
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
          { label: 'Yêu cầu duyệt', href: '/dashboard/yeu-cau-duyet' },
          { label: 'Thông báo', href: '/dashboard/thong-bao' },
        ],
      },
      {
        label: 'Liên lạc',
        icon: 'bi-chat-dots',
        items: [
          { label: 'Zalo', href: '/dashboard/zalo' },
          { label: 'Zalo Monitor', href: '/dashboard/zalo-monitor' },
        ],
      },
      {
        label: 'Tài khoản',
        icon: 'bi-person',
        items: [
          { label: 'Hồ sơ', href: '/dashboard/ho-so' },
          { label: 'Giao diện', href: '/dashboard/giao-dien' },
        ],
      },
    ];
  }

  // ── Chủ trọ, Quản lý: đầy đủ tab quản lý bất động sản ───────────────────
  const groups: NavGroup[] = [
    {
      label: 'Quản lý cơ bản',
      icon: 'bi-building',
      items: [
        { label: 'Tòa nhà', href: '/dashboard/toa-nha' },
        { label: 'Phòng', href: '/dashboard/phong' },
        { label: 'Khách thuê', href: '/dashboard/khach-thue' },
        ...((isChuNha || isDongChuTro || isQuanLy) ? [{ label: 'Quản lý tài khoản', href: '/dashboard/quan-ly-tai-khoan' }] : []),
        ...((isChuNha || isQuanLy) ? [{ label: 'Phân quyền', href: '/dashboard/phan-quyen' }] : []),
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
        { label: 'Yêu cầu duyệt', href: '/dashboard/yeu-cau-duyet' },
        { label: 'Thông báo', href: '/dashboard/thong-bao' },
        { label: 'Zalo', href: '/dashboard/zalo' },
        { label: 'Zalo Monitor', href: '/dashboard/zalo-monitor' },
      ],
    },
  ];

  if (isQuanLy) {
    groups.push({
      label: 'Tài khoản',
      icon: 'bi-person',
      items: [{ label: 'Hồ sơ', href: '/dashboard/ho-so' }],
    });
  } else {
    // Chủ trọ: có cài đặt
    groups.push({
      label: 'Cài đặt',
      icon: 'bi-gear',
      items: [
        { label: 'Hồ sơ', href: '/dashboard/ho-so' },
        { label: 'Cài đặt', href: '/dashboard/cai-dat' },
      ],
    });
  }

  return groups;
}

function roleLabel(role: Role): string {
  switch (role) {
    case 'admin':       return 'Quản trị viên';
    case 'chuNha':      return 'Chủ trọ';
    case 'dongChuTro':  return 'Đồng chủ trọ';
    case 'quanLy':      return 'Người quản lý';
    case 'nhanVien':    return 'Nhân viên';
    default:            return 'Người dùng';
  }
}

export function BsSidebar({
  collapsed,
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

  const role: Role = session?.user?.role ?? 'nhanVien';
  const [hiddenPaths, setHiddenPaths] = useState<Set<string>>(new Set());

  // Check permissions — ẩn khỏi sidebar nếu bị tắt
  useEffect(() => {
    if (role === 'admin') return;
    (async () => {
      try {
        const bRes = await fetch('/api/toa-nha?limit=100');
        if (!bRes.ok) return;
        const bData = await bRes.json();
        const buildings = bData.data || [];
        if (buildings.length === 0) return;
        const pRes = await fetch(`/api/admin/zalo-quyen?toaNhaId=${buildings[0].id}`);
        const pData = await pRes.json();
        if (pData.ok && pData.effective) {
          const matchingKeys = Object.keys(pData.effective).filter(k => k === role || k.startsWith(`${role}_`));
          if (matchingKeys.length > 0) {
            const hidden = new Set<string>();
            // Ẩn Zalo Monitor nếu bị tắt
            const monitorAllowed = matchingKeys.some(k => pData.effective[k]?.zaloMonitor !== false);
            if (!monitorAllowed) hidden.add('/dashboard/zalo-monitor');
            // dongChuTro: ẩn Quản lý tài khoản nếu không được cấp quanLyQuyen
            // quanLy: luôn thấy nhưng read-only (xử lý ở page)
            if (role === 'dongChuTro') {
              const canManage = matchingKeys.some(k => pData.effective[k]?.quanLyQuyen === true);
              if (!canManage) hidden.add('/dashboard/quan-ly-tai-khoan');
            }
            if (hidden.size > 0) setHiddenPaths(prev => new Set([...prev, ...hidden]));
          }
        }
      } catch {}
    })();
  }, [role]);

  const navGroups = buildNavGroups(role).map(g => ({
    ...g,
    items: g.items.filter(it => !hiddenPaths.has(it.href)),
  })).filter(g => g.items.length > 0);

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
    'Zalo':               'bi-chat-dots',
    'Quản lý tài khoản': 'bi-person-badge',
    'Phân quyền':        'bi-shield-check',
    'Yêu cầu duyệt':    'bi-check2-circle',
    'Hồ sơ':             'bi-person-circle',
    'Cài đặt':           'bi-sliders',
    'Giao diện':         'bi-palette',
  };
  return iconMap[label] ?? 'bi-dot';
}
