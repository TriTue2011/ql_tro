'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  'zalo': 'Zalo',
  'quan-ly-tai-khoan': 'Quản lý tài khoản',
  'ho-so': 'Hồ sơ',
  'cai-dat': 'Cài đặt',
  'giao-dien': 'Giao diện',
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
  data?: Record<string, string | number | undefined>;
}

// ─── Notification helpers ──────────────────────────────────────────────────────

function getNotifIcon(type: string): string {
  const map: Record<string, string> = {
    overdue_invoice: 'bi-receipt-cutoff',
    expiring_contract: 'bi-file-earmark-x',
    pending_issue: 'bi-exclamation-triangle',
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
  // Detail modal
  const [detailNotif, setDetailNotif] = useState<AppNotification | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState<'positive' | 'negative' | null>(null);
  const [actionNote, setActionNote] = useState('');

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

  function dismissNotif(n: AppNotification) {
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    setNotifCount(prev => Math.max(0, prev - 1));
    closeModal();
  }

  function closeModal() {
    setDetailNotif(null);
    setConfirmStep(null);
    setActionNote('');
  }

  async function handleMarkRead(n: AppNotification) {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: n.data?.notificationId, type: n.type }),
      });
    } catch { /* ignore */ }
    dismissNotif(n);
  }

  async function handleTiepNhan(n: AppNotification, note: string) {
    setActionLoading(true);
    try {
      await fetch(`/api/su-co/${n.data?.issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trangThai: 'dangXuLy', ghiChuXuLy: note || undefined }),
      });
      dismissNotif(n);
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  async function handleHuySuCo(n: AppNotification, note: string) {
    setActionLoading(true);
    try {
      await fetch(`/api/su-co/${n.data?.issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trangThai: 'daHuy', ghiChuXuLy: note || undefined }),
      });
      dismissNotif(n);
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  async function handleDaThanhToan(n: AppNotification, note: string) {
    setActionLoading(true);
    try {
      await fetch('/api/hoa-don', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.data?.invoiceId, trangThai: 'daThanhToan', ghiChu: note || undefined }),
      });
      dismissNotif(n);
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  function handleBellClick() {
    const next = !showNotif;
    setShowNotif(next);
    if (next) fetchNotifications();
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
                        <div className="notif-item-actions">
                          <button
                            className="notif-action-btn"
                            title="Đánh dấu đã đọc"
                            onClick={() => handleMarkRead(n)}
                          >
                            <i className="bi bi-check2" /> Đã đọc
                          </button>
                          <button
                            className="notif-action-btn notif-action-detail"
                            title="Xem chi tiết"
                            onClick={() => { setDetailNotif(n); setShowNotif(false); }}
                          >
                            <i className="bi bi-eye" /> Xem chi tiết
                          </button>
                        </div>
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

      {/* ── Notification Detail Modal ── */}
      {detailNotif && (
        <div
          className="notif-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="notif-modal">
            <div className="notif-modal-header">
              <div className="notif-modal-title">
                <i className={`bi ${getNotifIcon(detailNotif.type)} me-2`} />
                {confirmStep ? (confirmStep === 'positive' ? 'Xác nhận hoàn thành' : 'Xác nhận hủy') : detailNotif.title}
              </div>
              <button className="notif-modal-close" onClick={closeModal}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Step 1 — detail view */}
            {!confirmStep && (
              <>
                <div className="notif-modal-body">
                  <p className="notif-modal-msg">{detailNotif.message}</p>
                  <span className="notif-modal-time">
                    <i className="bi bi-clock me-1" />
                    {formatRelativeTime(detailNotif.createdAt)}
                  </span>
                </div>
                <div className="notif-modal-footer">
                  {detailNotif.type === 'pending_issue' && (
                    <>
                      <button className="notif-modal-btn notif-modal-btn-positive" onClick={() => setConfirmStep('positive')}>
                        <i className="bi bi-check-circle me-1" />Tiếp nhận
                      </button>
                      <button className="notif-modal-btn notif-modal-btn-negative" onClick={() => setConfirmStep('negative')}>
                        <i className="bi bi-x-circle me-1" />Hủy
                      </button>
                    </>
                  )}
                  {detailNotif.type === 'overdue_invoice' && (
                    <>
                      <button className="notif-modal-btn notif-modal-btn-positive" onClick={() => setConfirmStep('positive')}>
                        <i className="bi bi-cash-coin me-1" />Đã thanh toán
                      </button>
                      <button className="notif-modal-btn notif-modal-btn-negative" onClick={closeModal}>
                        <i className="bi bi-x-circle me-1" />Hủy
                      </button>
                    </>
                  )}
                  {detailNotif.type === 'expiring_contract' && (
                    <>
                      <button
                        className="notif-modal-btn notif-modal-btn-positive"
                        onClick={() => { router.push(`/dashboard/hop-dong/${detailNotif.data?.contractId}`); closeModal(); }}
                      >
                        <i className="bi bi-file-earmark-text me-1" />Xem hợp đồng
                      </button>
                      <button className="notif-modal-btn notif-modal-btn-negative" onClick={closeModal}>
                        <i className="bi bi-x-circle me-1" />Đóng
                      </button>
                    </>
                  )}
                  {(detailNotif.type === 'system' || !['pending_issue', 'overdue_invoice', 'expiring_contract'].includes(detailNotif.type)) && (
                    <>
                      <button className="notif-modal-btn notif-modal-btn-positive" onClick={() => handleMarkRead(detailNotif)}>
                        <i className="bi bi-check-all me-1" />Đã xem
                      </button>
                      <button className="notif-modal-btn notif-modal-btn-negative" onClick={closeModal}>
                        <i className="bi bi-x-circle me-1" />Đóng
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Step 2 — confirm with note */}
            {confirmStep && (
              <>
                <div className="notif-modal-body">
                  <label className="notif-note-label">
                    {confirmStep === 'positive' ? (
                      <><i className="bi bi-journal-text me-1" />Kết quả / Ghi chú (tùy chọn)</>
                    ) : (
                      <><i className="bi bi-chat-left-text me-1" />Lý do hủy (tùy chọn)</>
                    )}
                  </label>
                  <textarea
                    className="notif-note-input"
                    rows={3}
                    placeholder={confirmStep === 'positive' ? 'Mô tả kết quả đã thực hiện...' : 'Nhập lý do hủy...'}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="notif-modal-footer">
                  <button
                    className="notif-modal-btn notif-modal-btn-positive"
                    disabled={actionLoading}
                    onClick={() => {
                      if (detailNotif.type === 'pending_issue') {
                        confirmStep === 'positive'
                          ? handleTiepNhan(detailNotif, actionNote)
                          : handleHuySuCo(detailNotif, actionNote);
                      } else if (detailNotif.type === 'overdue_invoice') {
                        handleDaThanhToan(detailNotif, actionNote);
                      } else {
                        handleMarkRead(detailNotif);
                      }
                    }}
                  >
                    {actionLoading
                      ? <span className="spinner-border spinner-border-sm me-1" />
                      : <i className="bi bi-check2-circle me-1" />}
                    Xác nhận
                  </button>
                  <button
                    className="notif-modal-btn notif-modal-btn-negative"
                    disabled={actionLoading}
                    onClick={() => { setConfirmStep(null); setActionNote(''); }}
                  >
                    <i className="bi bi-arrow-left me-1" />Quay lại
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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

  // Heartbeat: cập nhật hoạt động cuối mỗi 2 phút
  useEffect(() => {
    if (!session) return;
    const ping = () => fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    ping(); // Gửi ngay khi mount
    const interval = setInterval(ping, 30 * 1000); // 30 giây
    return () => clearInterval(interval);
  }, [session]);

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
