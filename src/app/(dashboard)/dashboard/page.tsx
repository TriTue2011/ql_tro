'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { DashboardStats } from '@/types';
import '@/styles/bs-admin.css';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState('');

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
    fetch('/api/dashboard/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((res) => { if (res?.success) setStats(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        </div>

        {/* Phòng trống */}
        <div className="col-6 col-sm-6 col-lg-3">
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
        </div>

        {/* Doanh thu tháng */}
        <div className="col-6 col-sm-6 col-lg-3">
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
        </div>

        {/* Sự cố */}
        <div className="col-6 col-sm-6 col-lg-3">
          <div className="bs-stat-card card-rose">
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

      {/* ── Row 3: Charts + Activities ──────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {/* Room status chart */}
        <div className="col-12 col-md-5 col-lg-4">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-pie-chart" />
                  Tình trạng phòng
                </h5>
                <div className="bs-card-subtitle">Tổng {stats.tongSoPhong} phòng</div>
              </div>
            </div>
            <div className="bs-card-body">
              <div className="d-flex align-items-center justify-content-center gap-4 mb-4">
                {/* Donut chart */}
                <div className="bs-donut">
                  <svg viewBox="0 0 100 100">
                    <circle className="bs-donut-track" cx="50" cy="50" r="40" />
                    <circle
                      className="bs-donut-fill"
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="url(#donut-grad)"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
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

              {/* Progress bars */}
              <div className="bs-progress-item">
                <div className="bs-progress-header">
                  <span className="bs-progress-name">
                    <span className="bs-progress-dot" style={{ background: '#6366f1' }} />
                    Đang thuê
                  </span>
                  <span className="bs-progress-count">{stats.phongDangThue}</span>
                </div>
                <div className="bs-progress-bar-wrap">
                  <div
                    className="bs-progress-fill"
                    style={{
                      width: `${stats.tongSoPhong > 0 ? (stats.phongDangThue / stats.tongSoPhong) * 100 : 0}%`,
                      background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                    }}
                  />
                </div>
              </div>

              <div className="bs-progress-item">
                <div className="bs-progress-header">
                  <span className="bs-progress-name">
                    <span className="bs-progress-dot" style={{ background: '#10b981' }} />
                    Phòng trống
                  </span>
                  <span className="bs-progress-count">{stats.phongTrong}</span>
                </div>
                <div className="bs-progress-bar-wrap">
                  <div
                    className="bs-progress-fill"
                    style={{
                      width: `${stats.tongSoPhong > 0 ? (stats.phongTrong / stats.tongSoPhong) * 100 : 0}%`,
                      background: 'linear-gradient(90deg,#10b981,#06b6d4)',
                    }}
                  />
                </div>
              </div>

              <div className="bs-progress-item">
                <div className="bs-progress-header">
                  <span className="bs-progress-name">
                    <span className="bs-progress-dot" style={{ background: '#f59e0b' }} />
                    Bảo trì
                  </span>
                  <span className="bs-progress-count">{stats.phongBaoTri}</span>
                </div>
                <div className="bs-progress-bar-wrap">
                  <div
                    className="bs-progress-fill"
                    style={{
                      width: `${stats.tongSoPhong > 0 ? (stats.phongBaoTri / stats.tongSoPhong) * 100 : 0}%`,
                      background: 'linear-gradient(90deg,#f59e0b,#f97316)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="col-12 col-md-7 col-lg-4">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-bell-fill" />
                  Cảnh báo & Nhắc nhở
                </h5>
                <div className="bs-card-subtitle">Cần chú ý ngay</div>
              </div>
            </div>
            <div className="bs-card-body">
              <div
                className="bs-alert-item alert-danger"
                style={{ cursor: 'pointer' }}
                onClick={() => (window.location.href = '/dashboard/su-co')}
              >
                <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: 18 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Sự cố chờ xử lý</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>Cần giải quyết sớm</div>
                </div>
                <span className="bs-alert-count">{stats.suCoCanXuLy}</span>
              </div>

              <div
                className="bs-alert-item alert-warning"
                style={{ cursor: 'pointer' }}
                onClick={() => (window.location.href = '/dashboard/hoa-don')}
              >
                <i className="bi bi-calendar-event-fill" style={{ fontSize: 18 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Hóa đơn sắp đến hạn</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>Trong 7 ngày tới</div>
                </div>
                <span className="bs-alert-count">{stats.hoaDonSapDenHan}</span>
              </div>

              <div
                className="bs-alert-item alert-info"
                style={{ cursor: 'pointer' }}
                onClick={() => (window.location.href = '/dashboard/hop-dong')}
              >
                <i className="bi bi-file-earmark-break-fill" style={{ fontSize: 18 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Hợp đồng sắp hết hạn</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>Cần gia hạn hoặc kết thúc</div>
                </div>
                <span className="bs-alert-count">{stats.hopDongSapHetHan}</span>
              </div>

              <div className="bs-alert-item alert-warning">
                <i className="bi bi-door-closed-fill" style={{ fontSize: 18 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Phòng đang bảo trì</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>Chưa sẵn sàng cho thuê</div>
                </div>
                <span className="bs-alert-count">{stats.phongBaoTri}</span>
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="bs-pulse-dot dot-green" />
                  Hệ thống đang hoạt động bình thường
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-12 col-lg-4">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-lightning-charge-fill" />
                  Thao tác nhanh
                </h5>
                <div className="bs-card-subtitle">Truy cập tính năng thường dùng</div>
              </div>
            </div>
            <div className="bs-card-body">
              <div className="row g-2">
                {[
                  { href: '/dashboard/hoa-don/them-moi', icon: 'bi-receipt-cutoff', label: 'Tạo hóa đơn', color: '#6366f1' },
                  { href: '/dashboard/phong', icon: 'bi-door-open', label: 'Quản lý phòng', color: '#10b981' },
                  { href: '/dashboard/khach-thue', icon: 'bi-people-fill', label: 'Khách thuê', color: '#3b82f6' },
                  { href: '/dashboard/hop-dong', icon: 'bi-file-earmark-text-fill', label: 'Hợp đồng', color: '#f59e0b' },
                  { href: '/dashboard/thanh-toan', icon: 'bi-credit-card-fill', label: 'Thanh toán', color: '#8b5cf6' },
                  { href: '/dashboard/su-co', icon: 'bi-tools', label: 'Báo sự cố', color: '#ef4444' },
                ].map((item) => (
                  <div key={item.href} className="col-4">
                    <Link href={item.href} className="bs-quick-btn">
                      <i
                        className={`bi ${item.icon}`}
                        style={{ color: item.color, fontSize: 22 }}
                      />
                      <span style={{ fontSize: 11, lineHeight: 1.3 }}>{item.label}</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Activity + Revenue table ─────────────────────────────── */}
      <div className="row g-3">
        {/* Recent activity */}
        <div className="col-12 col-lg-6">
          <div className="bs-card">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-activity" />
                  Hoạt động gần đây
                </h5>
                <div className="bs-card-subtitle">Các thao tác mới nhất trong hệ thống</div>
              </div>
              <Link href="/dashboard/thong-bao" className="bs-section-link">
                Xem tất cả <i className="bi bi-arrow-right" />
              </Link>
            </div>
            <div className="bs-card-body" style={{ padding: '12px 24px' }}>
              <ul className="bs-activity-list">
                {[
                  {
                    icon: 'bi-person-plus-fill',
                    iconBg: 'rgba(99,102,241,0.1)',
                    iconColor: '#6366f1',
                    text: 'Khách thuê mới đăng ký',
                    meta: 'Nguyễn Văn A — Phòng P101',
                    time: '2 phút trước',
                    badge: { label: 'Mới', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                  },
                  {
                    icon: 'bi-check-circle-fill',
                    iconBg: 'rgba(16,185,129,0.1)',
                    iconColor: '#10b981',
                    text: 'Thanh toán thành công',
                    meta: 'Phòng P102 — 2.500.000₫',
                    time: '15 phút trước',
                    badge: { label: 'Hoàn thành', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                  },
                  {
                    icon: 'bi-exclamation-circle-fill',
                    iconBg: 'rgba(239,68,68,0.1)',
                    iconColor: '#ef4444',
                    text: 'Báo cáo sự cố',
                    meta: 'Phòng P105 — Hỏng điều hòa',
                    time: '1 giờ trước',
                    badge: { label: 'Cần xử lý', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                  },
                  {
                    icon: 'bi-file-earmark-check-fill',
                    iconBg: 'rgba(245,158,11,0.1)',
                    iconColor: '#f59e0b',
                    text: 'Hợp đồng mới được ký',
                    meta: 'Trần Thị B — Phòng P106',
                    time: '3 giờ trước',
                    badge: { label: 'Đang thuê', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                  },
                  {
                    icon: 'bi-receipt-cutoff',
                    iconBg: 'rgba(59,130,246,0.1)',
                    iconColor: '#3b82f6',
                    text: 'Hóa đơn tháng 3 đã tạo',
                    meta: 'Tổng 24 hóa đơn — Phòng A-D',
                    time: 'Hôm nay, 08:00',
                    badge: { label: 'Hóa đơn', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                  },
                ].map((item, i) => (
                  <li key={i} className="bs-activity-item">
                    <div
                      className="bs-activity-icon"
                      style={{ background: item.iconBg, color: item.iconColor }}
                    >
                      <i className={`bi ${item.icon}`} />
                    </div>
                    <div className="bs-activity-content">
                      <div className="bs-activity-text">{item.text}</div>
                      <div className="bs-activity-meta">{item.meta}</div>
                    </div>
                    <div className="d-flex flex-column align-items-end gap-1">
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: item.badge.bg,
                          color: item.badge.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.badge.label}
                      </span>
                      <div className="bs-activity-time">{item.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Revenue overview */}
        <div className="col-12 col-lg-6">
          <div className="bs-card h-100">
            <div className="bs-card-header">
              <div>
                <h5 className="bs-card-title">
                  <i className="bi bi-bar-chart-fill" />
                  Doanh thu theo tháng
                </h5>
                <div className="bs-card-subtitle">6 tháng gần nhất (triệu đồng)</div>
              </div>
            </div>
            <div className="bs-card-body">
              {/* Simple CSS bar chart */}
              {(() => {
                const months = [
                  { label: 'T10', value: 68 },
                  { label: 'T11', value: 74 },
                  { label: 'T12', value: 80 },
                  { label: 'T1', value: 72 },
                  { label: 'T2', value: 85 },
                  { label: 'T3', value: 92 },
                ];
                const max = Math.max(...months.map((m) => m.value));
                return (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 150 }}>
                    {months.map((m, i) => {
                      const h = (m.value / max) * 130;
                      const isLast = i === months.length - 1;
                      return (
                        <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isLast ? '#6366f1' : '#9ca3af' }}>
                            {m.value}M
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: h,
                              borderRadius: '6px 6px 0 0',
                              background: isLast
                                ? 'linear-gradient(180deg,#6366f1,#8b5cf6)'
                                : 'linear-gradient(180deg,#e0e7ff,#c7d2fe)',
                              transition: 'height 0.6s ease',
                              position: 'relative',
                            }}
                          />
                          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div
                className="d-flex justify-content-between align-items-center mt-4 pt-3"
                style={{ borderTop: '1px solid #f3f4f6' }}
              >
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Tổng doanh thu năm</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.5 }}>
                    {fmt(stats.doanhThuNam)}
                  </div>
                </div>
                <div className="text-end">
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Tháng cao nhất</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>92M₫</div>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
