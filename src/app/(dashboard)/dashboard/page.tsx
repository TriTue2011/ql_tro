'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { DashboardStats } from '@/types';
import '@/styles/bs-admin.css';

interface MonthRevenue { month: number; revenue: number; }

interface AdminStats {
  tongToaNha: number;
  tongNguoiDung: number;
  tongChuNha: number;
  tongAdmin: number;
  toaNhaMoiNhat: { id: string; tenToaNha: string; diaChi: string; ngayTao: string }[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState('');

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [revenueData, setRevenueData] = useState<MonthRevenue[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    document.title = 'Tổng quan — Phòng Trọ Pro';
    const d = new Date();
    setNow(
      d.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    );
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/dashboard/admin-stats')
        .then((r) => r.ok ? r.json() : null)
        .then((res) => { if (res?.success) setAdminStats(res.data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch('/api/dashboard/stats')
        .then((r) => r.ok ? r.json() : null)
        .then((res) => { if (res?.success) setStats(res.data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    setRevenueLoading(true);
    fetch(`/api/dashboard/revenue-monthly?year=${selectedYear}`)
      .then((r) => r.ok ? r.json() : null)
      .then((res) => { if (res?.success) setRevenueData(res.months); })
      .catch(() => {})
      .finally(() => setRevenueLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, isAdmin]);

  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    setActivitiesLoading(true);
    fetch('/api/dashboard/activities')
      .then((r) => r.ok ? r.json() : null)
      .then((res) => { if (res?.success) setActivities(res.data); })
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, [isAdmin]);

  const getTimeAgo = (date: string | Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    return `${Math.floor(seconds / 86400)} ngày trước`;
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  const firstName = session?.user?.name?.split(' ').pop() ?? 'bạn';

  // ─── Loading Skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        {/* Hero skeleton */}
        <div
          className="rounded-xl mb-4"
          style={{ height: 130, background: 'linear-gradient(135deg,#818cf8,#a78bfa)', opacity: 0.4 }}
        />
        <div className="row g-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="col-6 col-lg-3">
              <div
                className="rounded-xl"
                style={{ height: 110, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }}
              />
            </div>
          ))}
        </div>
        <div className="row g-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="col-12 col-md-4">
              <div
                className="rounded-xl"
                style={{ height: 220, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Admin Dashboard ────────────────────────────────────────────────────────
  if (isAdmin) {
    if (!adminStats) return null;
    const s = adminStats;
    return (
      <>
        {/* Hero */}
        <div className="bs-hero-banner">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="bs-hero-title">Xin chào, {session?.user?.name?.split(' ').pop() ?? 'Admin'}! 👋</div>
              <div className="bs-hero-sub">{now}</div>
              <div className="bs-hero-stats">
                <div className="bs-hero-stat">
                  <div className="bs-hero-stat-val">{s.tongToaNha}</div>
                  <div className="bs-hero-stat-lbl">Tòa nhà</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.25)', margin: '0 4px' }} />
                <div className="bs-hero-stat">
                  <div className="bs-hero-stat-val">{s.tongNguoiDung}</div>
                  <div className="bs-hero-stat-lbl">Người dùng</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.25)', margin: '0 4px' }} />
                <div className="bs-hero-stat">
                  <div className="bs-hero-stat-val">{s.tongChuNha}</div>
                  <div className="bs-hero-stat-lbl">Chủ trọ</div>
                </div>
              </div>
            </div>
            <div className="d-none d-md-flex align-items-center gap-3">
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 18px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{s.tongAdmin}</div>
                <div style={{ fontSize: 11, opacity: 0.8, color: '#fff' }}>Admin</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 18px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{s.tongNguoiDung}</div>
                <div style={{ fontSize: 11, opacity: 0.8, color: '#fff' }}>Người dùng</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="bs-section-header">
          <h2 className="bs-section-title">Thống kê hệ thống</h2>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            <i className="bi bi-clock me-1" />Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="row g-3 mb-4">
          {[
            { label: 'Tòa nhà', value: s.tongToaNha, icon: 'bi-buildings', color: '#6366f1', bg: 'card-indigo', href: '/dashboard/toa-nha' },
            { label: 'Chủ trọ', value: s.tongChuNha, icon: 'bi-person-fill-gear', color: '#10b981', bg: 'card-emerald', href: '/dashboard/quan-ly-tai-khoan' },
            { label: 'Admin', value: s.tongAdmin, icon: 'bi-shield-lock-fill', color: '#3b82f6', bg: 'card-blue', href: '/dashboard/quan-ly-tai-khoan' },
            { label: 'Người dùng', value: s.tongNguoiDung, icon: 'bi-people-fill', color: '#f59e0b', bg: 'card-amber', href: '/dashboard/quan-ly-tai-khoan' },
          ].map((item) => (
            <div key={item.label} className="col-6 col-sm-6 col-lg-3">
              <Link href={item.href} className="text-decoration-none">
                <div className={`bs-stat-card ${item.bg}`}>
                  <div className="d-flex align-items-start justify-content-between">
                    <div>
                      <div className="bs-stat-label">{item.label}</div>
                      <div className="bs-stat-value">{item.value}</div>
                      {item.href && (
                        <div style={{ fontSize: 11, color: item.color, marginTop: 4 }}>Xem danh sách →</div>
                      )}
                    </div>
                    <div className="bs-stat-icon" style={{ background: `${item.color}18`, color: item.color }}>
                      <i className={`bi ${item.icon}`} />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Row 2: Danh sách tòa nhà mới + Quick actions */}
        <div className="row g-3">
          <div className="col-12 col-lg-8">
            <div className="bs-card">
              <div className="bs-card-header">
                <div>
                  <h5 className="bs-card-title"><i className="bi bi-buildings-fill" /> Tòa nhà mới nhất</h5>
                  <div className="bs-card-subtitle">5 tòa nhà được thêm gần đây</div>
                </div>
                <Link href="/dashboard/toa-nha" className="bs-section-link">
                  Xem tất cả <i className="bi bi-arrow-right" />
                </Link>
              </div>
              <div className="bs-card-body" style={{ padding: '12px 24px' }}>
                {s.toaNhaMoiNhat.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Chưa có tòa nhà nào</p>
                ) : (
                  <ul className="bs-activity-list">
                    {s.toaNhaMoiNhat.map((tn) => (
                      <li key={tn.id} className="bs-activity-item">
                        <div className="bs-activity-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                          <i className="bi bi-building" />
                        </div>
                        <div className="bs-activity-content">
                          <div className="bs-activity-text">{tn.tenToaNha}</div>
                          <div className="bs-activity-meta">{tn.diaChi}</div>
                        </div>
                        <div className="bs-activity-time">
                          {new Date(tn.ngayTao).toLocaleDateString('vi-VN')}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="bs-card h-100">
              <div className="bs-card-header">
                <div>
                  <h5 className="bs-card-title"><i className="bi bi-lightning-charge-fill" /> Thao tác nhanh</h5>
                  <div className="bs-card-subtitle">Truy cập tính năng quản trị</div>
                </div>
              </div>
              <div className="bs-card-body">
                <div className="row g-2">
                  {[
                    { href: '/dashboard/toa-nha', icon: 'bi-buildings', label: 'Quản lý tòa nhà', color: '#6366f1' },
                    { href: '/dashboard/quan-ly-tai-khoan', icon: 'bi-people-fill', label: 'Tài khoản', color: '#10b981' },
                    { href: '/dashboard/cai-dat', icon: 'bi-gear-fill', label: 'Cài đặt', color: '#f59e0b' },
                    { href: '/dashboard/ho-so', icon: 'bi-person-circle', label: 'Hồ sơ', color: '#3b82f6' },
                  ].map((item) => (
                    <div key={item.href} className="col-6">
                      <Link href={item.href} className="bs-quick-btn">
                        <i className={`bi ${item.icon}`} style={{ color: item.color, fontSize: 22 }} />
                        <span style={{ fontSize: 11, lineHeight: 1.3 }}>{item.label}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── chuNha / quanLy Dashboard ──────────────────────────────────────────────
  if (!stats) return null;

  const occupancyRate = stats.tongSoPhong > 0
    ? Math.round((stats.phongDangThue / stats.tongSoPhong) * 100)
    : 0;

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (occupancyRate / 100) * circumference;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="bs-hero-banner">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="bs-hero-title">
              Xin chào, {firstName}! 👋
            </div>
            <div className="bs-hero-sub">{now}</div>
            <div className="bs-hero-stats">
              <div className="bs-hero-stat">
                <div className="bs-hero-stat-val">{stats.phongDangThue}/{stats.tongSoPhong}</div>
                <div className="bs-hero-stat-lbl">Phòng đang thuê</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.25)', margin: '0 4px' }} />
              <div className="bs-hero-stat">
                <div className="bs-hero-stat-val">{occupancyRate}%</div>
                <div className="bs-hero-stat-lbl">Tỉ lệ lấp đầy</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.25)', margin: '0 4px' }} />
              <div className="bs-hero-stat">
                <div className="bs-hero-stat-val">
                  {(stats.doanhThuThang / 1_000_000).toFixed(1)}M
                </div>
                <div className="bs-hero-stat-lbl">Doanh thu tháng</div>
              </div>
            </div>
          </div>
          <div className="d-none d-md-flex align-items-center gap-3">
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: '10px 18px',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                textAlign: 'center',
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
                {stats.suCoCanXuLy}
              </div>
              <div style={{ fontSize: 11, opacity: 0.8, color: '#fff' }}>Sự cố cần xử lý</div>
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: '10px 18px',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                textAlign: 'center',
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
                {stats.hoaDonSapDenHan}
              </div>
              <div style={{ fontSize: 11, opacity: 0.8, color: '#fff' }}>Hóa đơn sắp hạn</div>
            </div>
          </div>
        </div>
      </div>
      {/* ── Quick Actions (Top Horizontal) ────────────────────────────── */}
      <div className="mb-4" style={{ position: 'relative', zIndex: 100 }}>
        <div className="row g-2">
          {[
            { href: '/dashboard/hoa-don/them-moi', icon: 'bi-receipt-cutoff', label: 'Tạo hóa đơn', color: '#6366f1', count: stats?.hoaDonSapDenHan },
            { href: '/dashboard/phong', icon: 'bi-door-open', label: 'Quản lý phòng', color: '#10b981', count: stats?.phongBaoTri },
            { href: '/dashboard/khach-thue', icon: 'bi-people-fill', label: 'Khách thuê', color: '#3b82f6', count: stats?.tongKhachThue },
            { href: '/dashboard/hop-dong', icon: 'bi-file-earmark-text-fill', label: 'Hợp đồng', color: '#f59e0b', count: stats?.hopDongSapHetHan },
            { href: '/dashboard/thanh-toan', icon: 'bi-credit-card-fill', label: 'Thanh toán', color: '#8b5cf6' },
            { href: '/dashboard/su-co', icon: 'bi-tools', label: 'Báo sự cố', color: '#ef4444', count: stats?.suCoCanXuLy },
          ].map((item) => (
            <div key={item.href} className="col-4 col-sm-2">
              <Link 
                href={item.href} 
                className="bs-quick-btn d-flex flex-column align-items-center justify-content-center h-100 position-relative text-decoration-none"
                style={{ 
                  padding: '16px 8px',
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s ease',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  cursor: 'pointer',
                  overflow: 'visible'
                }}
              >
                <i
                  className={`bi ${item.icon}`}
                  style={{ color: item.color, fontSize: 24, marginBottom: 6 }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{item.label}</span>
                
                {item.count ? (
                  <span 
                    className="position-absolute badge rounded-pill bg-danger" 
                    style={{ 
                      top: -5, 
                      right: -5, 
                      fontSize: 10,
                      minWidth: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(220,38,38,0.3)',
                      zIndex: 10
                    }}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="bs-section-header">
        <h2 className="bs-section-title">Tổng quan hệ thống</h2>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          <i className="bi bi-clock me-1" />Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="row g-3 mb-4">
        {/* Tổng phòng */}
        <div className="col-6 col-sm-6 col-lg-3">
          <Link href="/dashboard/phong" className="text-decoration-none">
            <div className="bs-stat-card card-indigo">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="bs-stat-label">Tổng phòng</div>
                  <div className="bs-stat-value">{stats.tongSoPhong}</div>
                  <div className="bs-stat-sub">
                    <span className="bs-pulse-dot dot-blue" style={{ marginRight: 5 }} />
                    {stats.phongDangThue} đang thuê
                  </div>
                </div>
                <div className="bs-stat-icon icon-indigo">
                  <i className="bi bi-building" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Phòng trống */}
        <div className="col-6 col-sm-6 col-lg-3">
          <Link href="/dashboard/phong?status=available" className="text-decoration-none">
            <div className="bs-stat-card card-emerald">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="bs-stat-label">Phòng trống</div>
                  <div className="bs-stat-value" style={{ color: '#059669' }}>{stats.phongTrong}</div>
                  <div className="bs-stat-sub">
                    <span className="bs-pulse-dot dot-green" style={{ marginRight: 5 }} />
                    {stats.tongSoPhong > 0
                      ? ((stats.phongTrong / stats.tongSoPhong) * 100).toFixed(0)
                      : 0}% tổng số
                  </div>
                </div>
                <div className="bs-stat-icon icon-emerald">
                  <i className="bi bi-door-open" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Doanh thu tháng */}
        <div className="col-6 col-sm-6 col-lg-3">
          <Link href="/dashboard/thanh-toan" className="text-decoration-none">
            <div className="bs-stat-card card-blue">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="bs-stat-label">Doanh thu tháng</div>
                  <div className="bs-stat-value" style={{ fontSize: 20 }}>
                    {(stats.doanhThuThang / 1_000_000).toFixed(1)}
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>M₫</span>
                  </div>
                  <div className="bs-stat-sub">
                    <span className="bs-stat-trend-up">
                      <i className="bi bi-arrow-up-right" />+12%
                    </span>
                    <span style={{ marginLeft: 4 }}>tháng trước</span>
                  </div>
                </div>
                <div className="bs-stat-icon icon-blue">
                  <i className="bi bi-graph-up-arrow" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Sự cố */}
        <div className="col-6 col-sm-6 col-lg-3">
          <Link href="/dashboard/su-co" className="text-decoration-none d-block">
            <div className="bs-stat-card card-rose" style={{ cursor: 'pointer' }}>
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="bs-stat-label">Sự cố cần xử lý</div>
                  <div className="bs-stat-value" style={{ color: '#dc2626' }}>{stats.suCoCanXuLy}</div>
                  <div className="bs-stat-sub">
                    <span className="bs-pulse-dot dot-red" style={{ marginRight: 5 }} />
                    Cần xử lý ngay
                  </div>
                </div>
                <div className="bs-stat-icon icon-rose">
                  <i className="bi bi-exclamation-triangle" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Row 2: Secondary stats ───────────────────────────────────────── */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="bs-stat-card card-amber">
            <div className="d-flex align-items-center gap-3">
              <div className="bs-stat-icon icon-amber" style={{ width: 40, height: 40, fontSize: 18 }}>
                <i className="bi bi-calendar-x" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Hóa đơn sắp hạn</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{stats.hoaDonSapDenHan}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="bs-stat-card card-violet">
            <div className="d-flex align-items-center gap-3">
              <div className="bs-stat-icon icon-violet" style={{ width: 40, height: 40, fontSize: 18 }}>
                <i className="bi bi-file-earmark-x" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>HĐ sắp hết hạn</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>{stats.hopDongSapHetHan}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="bs-stat-card card-emerald">
            <div className="d-flex align-items-center gap-3">
              <div className="bs-stat-icon icon-emerald" style={{ width: 40, height: 40, fontSize: 18 }}>
                <i className="bi bi-people" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Phòng bảo trì</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{stats.phongBaoTri}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="bs-stat-card card-indigo">
            <div className="d-flex align-items-center gap-3">
              <div className="bs-stat-icon icon-indigo" style={{ width: 40, height: 40, fontSize: 18 }}>
                <i className="bi bi-cash-stack" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Doanh thu năm</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#4f46e5' }}>
                  {(stats.doanhThuNam / 1_000_000).toFixed(0)}M₫
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nhân sự + Khách thuê (chỉ chuNha/dongChuTro) ───────────────── */}
      {(stats.tongQuanLy !== undefined || stats.tongKhachThue !== undefined) && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <Link href="/dashboard/quan-ly-tai-khoan" className="text-decoration-none">
              <div className="bs-stat-card card-blue">
                <div className="d-flex align-items-center gap-3">
                  <div className="bs-stat-icon icon-blue" style={{ width: 40, height: 40, fontSize: 18 }}>
                    <i className="bi bi-person-badge-fill" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Quản lý</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{stats.tongQuanLy ?? 0}</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href="/dashboard/quan-ly-tai-khoan" className="text-decoration-none">
              <div className="bs-stat-card card-violet">
                <div className="d-flex align-items-center gap-3">
                  <div className="bs-stat-icon icon-violet" style={{ width: 40, height: 40, fontSize: 18 }}>
                    <i className="bi bi-person-workspace" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Nhân viên</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>{stats.tongNhanVien ?? 0}</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href="/dashboard/khach-thue" className="text-decoration-none">
              <div className="bs-stat-card card-amber">
                <div className="d-flex align-items-center gap-3">
                  <div className="bs-stat-icon icon-amber" style={{ width: 40, height: 40, fontSize: 18 }}>
                    <i className="bi bi-people-fill" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Khách thuê</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{stats.tongKhachThue ?? 0}</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href="/dashboard/khach-thue" className="text-decoration-none">
              <div className="bs-stat-card card-emerald">
                <div className="d-flex align-items-center gap-3">
                  <div className="bs-stat-icon icon-emerald" style={{ width: 40, height: 40, fontSize: 18 }}>
                    <i className="bi bi-person-check-fill" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                      Có TK / Chưa có TK
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
                      {stats.khachThueCoTaiKhoan ?? 0}
                      <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 14 }}>
                        {' / '}{(stats.tongKhachThue ?? 0) - (stats.khachThueCoTaiKhoan ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── Row 3: Room Status + Activities ────────────────────────────── */}
      <div className="row g-3 mb-4">
        {/* Tình trạng phòng */}
        <div className="col-12 col-lg-8">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-pie-chart-fill" />
                  Tình trạng phòng
                </h5>
                <div className="bs-card-subtitle">Phân bổ trạng thái phòng hiện tại</div>
              </div>
            </div>
            <div className="bs-card-body d-flex flex-column justify-content-center" style={{ minHeight: 300 }}>
              <div className="text-center mb-4">
                <div className="bs-donut-chart mx-auto">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#f3f4f6" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="url(#donut-grad)"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="donut-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="bs-donut-label">
                    {occupancyRate}%
                    <div className="bs-donut-sub">lấp đầy</div>
                  </div>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-4">
                  <div className="text-center">
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Đang thuê</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>{stats.phongDangThue}</div>
                    <div style={{ height: 4, width: 30, background: '#6366f1', borderRadius: 2, margin: '6px auto' }} />
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-center">
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Phòng trống</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{stats.phongTrong}</div>
                    <div style={{ height: 4, width: 30, background: '#10b981', borderRadius: 2, margin: '6px auto' }} />
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-center">
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Bảo trì</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{stats.phongBaoTri}</div>
                    <div style={{ height: 4, width: 30, background: '#f59e0b', borderRadius: 2, margin: '6px auto' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="col-12 col-lg-4">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-activity" />
                  Hoạt động gần đây
                </h5>
                <div className="bs-card-subtitle">Thao tác mới nhất trong tòa nhà</div>
              </div>
            </div>
            <div className="bs-card-body" style={{ padding: '12px 18px' }}>
              {activitiesLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border spinner-border-sm text-primary" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-5 text-muted" style={{ fontSize: 13 }}>
                  Chưa có hoạt động nào
                </div>
              ) : (
                <ul className="bs-activity-list">
                  {activities.map((item, i) => (
                    <li key={i} className="bs-activity-item">
                      <div
                        className="bs-activity-icon"
                        style={{ background: item.iconBg, color: item.iconColor, width: 32, height: 32, fontSize: 14 }}
                      >
                        <i className={`bi ${item.icon}`} />
                      </div>
                      <div className="bs-activity-content">
                        <div className="bs-activity-text" style={{ fontSize: 12 }}>{item.text}</div>
                        <div className="bs-activity-meta" style={{ fontSize: 11 }}>{item.meta}</div>
                      </div>
                      <div className="bs-activity-time" style={{ fontSize: 10 }}>{getTimeAgo(item.time)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Revenue Full Width ─────────────────────────────────── */}
      <div className="row g-3">
        {/* Revenue overview */}
        <div className="col-12">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-bar-chart-fill" />
                  Doanh thu theo tháng
                </h5>
                <div className="bs-card-subtitle">12 tháng trong năm (triệu đồng)</div>
              </div>
              {/* Year selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setSelectedYear(y => y - 1)}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px', background: 'white', cursor: 'pointer', fontSize: 14 }}
                >‹</button>
                <span style={{ fontSize: 14, fontWeight: 700, minWidth: 44, textAlign: 'center' }}>{selectedYear}</span>
                <button
                  onClick={() => setSelectedYear(y => Math.min(y + 1, currentYear))}
                  disabled={selectedYear >= currentYear}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px', background: 'white', cursor: selectedYear >= currentYear ? 'not-allowed' : 'pointer', fontSize: 14, opacity: selectedYear >= currentYear ? 0.4 : 1 }}
                >›</button>
              </div>
            </div>
            <div className="bs-card-body">
              {revenueLoading ? (
                <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : (() => {
                const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
                const currentMonth = selectedYear === currentYear ? new Date().getMonth() : 11;
                // Show last 6 active months
                const visibleMonths = revenueData;
                const maxVal = Math.max(...visibleMonths.map(m => m.revenue), 1);
                const bestMonth = visibleMonths.reduce((a, b) => b.revenue > a.revenue ? b : a, visibleMonths[0]);
                return (
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 150 }}>
                      {visibleMonths.map((m) => {
                        const h = Math.max((m.revenue / maxVal) * 130, m.revenue > 0 ? 4 : 0);
                        const isBest = m === bestMonth && m.revenue > 0;
                        const valM = (m.revenue / 1_000_000).toFixed(1).replace(/\.0$/, '');
                        return (
                          <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isBest ? '#6366f1' : '#9ca3af' }}>
                              {m.revenue > 0 ? `${valM}M` : '—'}
                            </span>
                            <div
                              style={{
                                width: '100%',
                                height: h || 3,
                                borderRadius: '6px 6px 0 0',
                                background: isBest
                                  ? 'linear-gradient(180deg,#6366f1,#8b5cf6)'
                                  : m.revenue > 0
                                  ? 'linear-gradient(180deg,#e0e7ff,#c7d2fe)'
                                  : '#f3f4f6',
                                transition: 'height 0.4s ease',
                              }}
                            />
                            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{MONTH_LABELS[m.month - 1]}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className="d-flex justify-content-between align-items-center mt-4 pt-3"
                      style={{ borderTop: '1px solid #f3f4f6' }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>Tổng doanh thu {selectedYear === currentYear ? 'năm nay' : `năm ${selectedYear}`}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.5 }}>
                          {fmt(revenueData.reduce((s, m) => s + m.revenue, 0))}
                        </div>
                      </div>
                      <div className="text-end">
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>Tháng cao nhất</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>
                          {bestMonth && bestMonth.revenue > 0
                            ? `${(bestMonth.revenue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M₫`
                            : '—'}
                        </div>
                      </div>
                      <Link
                        href="/dashboard/hoa-don"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'white',
                          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                          padding: '8px 16px',
                          borderRadius: 8,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        Chi tiết <i className="bi bi-arrow-right" />
                      </Link>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
