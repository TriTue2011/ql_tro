'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import '@/styles/bs-admin.css';

interface ChartPoint {
  month: number;
  year: number;
  label: string;
  tongTien: number;
  tienDien: number;
  tienNuoc: number;
  soDien: number;
  soNuoc: number;
}

interface LienHe { ten: string; soDienThoai?: string | null; email?: string | null }

interface DashboardData {
  khachThue: { id: string; hoTen: string; soDienThoai: string; email?: string; trangThai: string; nhanThongBaoZalo: boolean };
  hopDongHienTai: any;
  soHoaDonChuaThanhToan: number;
  soSuCoMoi: number;
  soSuCoDangXuLy: number;
  yeuCauChoDuyet: number;
  daysUntilExpiry: number | null;
  lienHeQuanLy: LienHe | null;
  chartData: ChartPoint[];
  suCoGanNhat: { id: string; tieuDe: string; trangThai: string; loaiSuCo: string; ngayBaoCao: string }[];
  hoaDonGanNhat: { thang: number; nam: number; tongTien: number; tienDien: number; tienNuoc: number; soDien: number; soNuoc: number } | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');

function barHeightPct(val: number, max: number) {
  if (!max) return 0;
  return Math.round((val / max) * 100);
}

const suCoTrangThaiLabel: Record<string, { label: string; cls: string }> = {
  moi:       { label: 'Mới',        cls: 'bg-primary' },
  dangXuLy:  { label: 'Đang xử lý', cls: 'bg-warning text-dark' },
  daXong:    { label: 'Đã xong',    cls: 'bg-success' },
  daHuy:     { label: 'Đã hủy',     cls: 'bg-secondary' },
};

export default function KhachThueDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'Tổng quan — Cổng Khách Thuê';
    fetch('/api/auth/khach-thue/dashboard')
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="rounded-4 mb-4" style={{ height: 130, background: 'var(--brand-gradient)', opacity: 0.4 }} />
        <div className="row g-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="col-6 col-lg-3">
              <div className="rounded-3" style={{ height: 100, background: '#e5e7eb' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bs-card text-center py-5">
        <i className="bi bi-wifi-off fs-1 mb-3 d-block" style={{ color: '#d1d5db' }} />
        <p className="fw-semibold mb-1" style={{ color: '#374151' }}>Không thể tải dữ liệu</p>
        <p className="mb-3" style={{ fontSize: 13, color: '#9ca3af' }}>Vui lòng thử lại sau</p>
        <button className="btn btn-sm btn-primary" onClick={() => { setError(false); setLoading(true); setData(null); fetch('/api/auth/khach-thue/dashboard').then(r => r.json()).then(res => { if (res.success) setData(res.data); else setError(true); }).catch(() => setError(true)).finally(() => setLoading(false)); }}>
          <i className="bi bi-arrow-clockwise me-1" /> Thử lại
        </button>
      </div>
    );
  }

  const { khachThue, hopDongHienTai, soHoaDonChuaThanhToan, soSuCoMoi, soSuCoDangXuLy, yeuCauChoDuyet, daysUntilExpiry, chartData, suCoGanNhat, hoaDonGanNhat, lienHeQuanLy } = data;

  const firstName = khachThue.hoTen.split(' ').pop() ?? khachThue.hoTen;
  const now = new Date();
  const nowStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Chart data — last 6 months for invoice bar, last 6 for consumption
  const last6 = chartData.slice(-6);
  const maxTong = Math.max(...last6.map((d) => d.tongTien), 1);
  const maxDien = Math.max(...last6.map((d) => d.soDien), 1);
  const maxNuoc = Math.max(...last6.map((d) => d.soNuoc), 1);

  return (
    <div>
      {/* ── Contract expiry warning ─────────────────────────────────────── */}
      {daysUntilExpiry !== null && daysUntilExpiry <= 60 && (
        <div
          className={`alert mb-4 d-flex align-items-center gap-2 rounded-3 ${daysUntilExpiry <= 15 ? 'alert-danger' : 'alert-warning'}`}
          style={{ fontSize: 14 }}
        >
          <i className={`bi ${daysUntilExpiry <= 15 ? 'bi-exclamation-octagon-fill' : 'bi-clock-history'} fs-5`} />
          <div>
            <strong>Hợp đồng sắp hết hạn!</strong> Còn <strong>{daysUntilExpiry}</strong> ngày
            {hopDongHienTai?.ngayKetThuc && ` (${fmtDate(hopDongHienTai.ngayKetThuc)})`}.{' '}
            <Link href="/khach-thue/dashboard/hop-dong" style={{ textDecoration: 'underline' }}>Xem chi tiết</Link>
          </div>
        </div>
      )}

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div
        className="rounded-4 mb-4 p-4 d-flex align-items-center justify-content-between"
        style={{
          background: 'var(--brand-gradient)',
          minHeight: 120,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h4 className="fw-bold text-white mb-1" style={{ fontSize: 22 }}>
            Xin chào, {firstName}! 👋
          </h4>
          <p className="text-white mb-0" style={{ opacity: 0.85, fontSize: 13 }}>{nowStr}</p>
          {hopDongHienTai && (
            <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
              <span
                className="badge rounded-pill text-white"
                style={{ background: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '4px 10px' }}
              >
                <i className="bi bi-door-open me-1" />
                Phòng {hopDongHienTai.phong?.maPhong}
              </span>
              <span
                className="badge rounded-pill text-white"
                style={{ background: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '4px 10px' }}
              >
                <i className="bi bi-building me-1" />
                {hopDongHienTai.phong?.toaNha?.tenToaNha}
              </span>
            </div>
          )}
        </div>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', right: -30, top: -30,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
        }} />
        <div style={{
          position: 'absolute', right: 60, bottom: -40,
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {/* Unpaid invoices */}
        <div className="col-6 col-lg-3">
          <div className="bs-stat-card">
            <div className="bs-stat-icon" style={{ background: soHoaDonChuaThanhToan > 0 ? 'rgba(239,68,68,.12)' : 'rgba(99,102,241,.1)' }}>
              <i className="bi bi-receipt" style={{ color: soHoaDonChuaThanhToan > 0 ? '#ef4444' : '#6366f1', fontSize: 22 }} />
            </div>
            <div className="bs-stat-value" style={{ color: soHoaDonChuaThanhToan > 0 ? '#ef4444' : undefined }}>
              {soHoaDonChuaThanhToan}
            </div>
            <div className="bs-stat-label">Hóa đơn chưa thanh toán</div>
            <div className="bs-stat-sub">
              <Link href="/khach-thue/dashboard/hoa-don" className="text-decoration-none" style={{ color: '#6366f1' }}>
                Xem hóa đơn →
              </Link>
            </div>
          </div>
        </div>

        {/* New incidents */}
        <div className="col-6 col-lg-3">
          <div className="bs-stat-card">
            <div className="bs-stat-icon" style={{ background: soSuCoMoi > 0 ? 'rgba(245,158,11,.12)' : 'rgba(99,102,241,.1)' }}>
              <i className="bi bi-exclamation-triangle" style={{ color: soSuCoMoi > 0 ? '#f59e0b' : '#6366f1', fontSize: 22 }} />
            </div>
            <div className="bs-stat-value" style={{ color: soSuCoMoi > 0 ? '#f59e0b' : undefined }}>
              {soSuCoMoi}
            </div>
            <div className="bs-stat-label">Sự cố chưa tiếp nhận</div>
            <div className="bs-stat-sub">
              <Link href="/khach-thue/dashboard/su-co" className="text-decoration-none" style={{ color: '#6366f1' }}>
                Xem sự cố →
              </Link>
            </div>
          </div>
        </div>

        {/* Processing incidents */}
        <div className="col-6 col-lg-3">
          <div className="bs-stat-card">
            <div className="bs-stat-icon" style={{ background: 'rgba(6,182,212,.1)' }}>
              <i className="bi bi-tools" style={{ color: '#06b6d4', fontSize: 22 }} />
            </div>
            <div className="bs-stat-value">{soSuCoDangXuLy}</div>
            <div className="bs-stat-label">Sự cố đang xử lý</div>
            <div className="bs-stat-sub">
              <Link href="/khach-thue/dashboard/su-co" className="text-decoration-none" style={{ color: '#6366f1' }}>
                Theo dõi →
              </Link>
            </div>
          </div>
        </div>

        {/* Pending requests */}
        <div className="col-6 col-lg-3">
          <div className="bs-stat-card">
            <div className="bs-stat-icon" style={{ background: yeuCauChoDuyet > 0 ? 'rgba(139,92,246,.12)' : 'rgba(99,102,241,.1)' }}>
              <i className="bi bi-hourglass-split" style={{ color: '#8b5cf6', fontSize: 22 }} />
            </div>
            <div className="bs-stat-value">{yeuCauChoDuyet}</div>
            <div className="bs-stat-label">Yêu cầu chờ duyệt</div>
            <div className="bs-stat-sub">
              <Link href="/khach-thue/dashboard/cai-dat" className="text-decoration-none" style={{ color: '#6366f1' }}>
                Xem yêu cầu →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Charts + Quick actions ─────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {/* Invoice bar chart */}
        <div className="col-12 col-lg-5">
          <div className="bs-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold mb-0" style={{ fontSize: 14 }}>
                <i className="bi bi-bar-chart-fill me-2" style={{ color: '#6366f1' }} />
                Hóa đơn 6 tháng gần nhất
              </h6>
            </div>
            <div className="d-flex align-items-end gap-2" style={{ height: 120 }}>
              {last6.map((d) => (
                <div key={`${d.month}-${d.year}`} className="flex-fill d-flex flex-column align-items-center gap-1">
                  <div style={{ fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {d.tongTien > 0 ? `${Math.round(d.tongTien / 1000)}k` : ''}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: `${barHeightPct(d.tongTien, maxTong)}%`,
                      minHeight: d.tongTien > 0 ? 4 : 0,
                      background: 'var(--brand-gradient)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height .3s',
                    }}
                    title={fmt(d.tongTien)}
                  />
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{d.label}</div>
                </div>
              ))}
            </div>
            {hoaDonGanNhat && (
              <div className="mt-3 pt-3 border-top d-flex justify-content-between" style={{ fontSize: 12, color: '#6b7280' }}>
                <span>Tháng {hoaDonGanNhat.thang}/{hoaDonGanNhat.nam}</span>
                <span className="fw-semibold" style={{ color: '#111827' }}>{fmt(hoaDonGanNhat.tongTien)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Electricity + water chart */}
        <div className="col-12 col-lg-4">
          <div className="bs-card h-100">
            <h6 className="fw-bold mb-3" style={{ fontSize: 14 }}>
              <i className="bi bi-lightning-charge-fill me-2" style={{ color: '#f59e0b' }} />
              Tiêu thụ điện &amp; nước
            </h6>
            {/* Electricity */}
            <div className="mb-3">
              <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>Điện (kWh)</span>
              </div>
              <div className="d-flex align-items-end gap-1" style={{ height: 50 }}>
                {last6.map((d) => (
                  <div key={`d-${d.month}-${d.year}`} className="flex-fill d-flex flex-column align-items-center gap-1">
                    <div
                      style={{
                        width: '100%',
                        height: `${barHeightPct(d.soDien, maxDien)}%`,
                        minHeight: d.soDien > 0 ? 3 : 0,
                        background: '#f59e0b',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.85,
                      }}
                      title={`${d.soDien} kWh`}
                    />
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Water */}
            <div>
              <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>Nước (m³)</span>
              </div>
              <div className="d-flex align-items-end gap-1" style={{ height: 50 }}>
                {last6.map((d) => (
                  <div key={`n-${d.month}-${d.year}`} className="flex-fill d-flex flex-column align-items-center gap-1">
                    <div
                      style={{
                        width: '100%',
                        height: `${barHeightPct(d.soNuoc, maxNuoc)}%`,
                        minHeight: d.soNuoc > 0 ? 3 : 0,
                        background: '#06b6d4',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.85,
                      }}
                      title={`${d.soNuoc} m³`}
                    />
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="col-12 col-lg-3">
          <div className="bs-card h-100">
            <h6 className="fw-bold mb-3" style={{ fontSize: 14 }}>
              <i className="bi bi-lightning-fill me-2" style={{ color: '#6366f1' }} />
              Thao tác nhanh
            </h6>
            <div className="row g-2">
              {[
                { href: '/khach-thue/dashboard/hoa-don',    icon: 'bi-receipt',               label: 'Hóa đơn',  color: '#6366f1' },
                { href: '/khach-thue/dashboard/su-co',      icon: 'bi-exclamation-triangle',  label: 'Sự cố',    color: '#f59e0b' },
                { href: '/khach-thue/dashboard/hop-dong',   icon: 'bi-file-earmark-text',     label: 'Hợp đồng', color: '#10b981' },
                { href: '/khach-thue/dashboard/thong-bao',  icon: 'bi-bell',                  label: 'Thông báo', color: '#06b6d4' },
                { href: '/khach-thue/dashboard/nguoi-cung-phong', icon: 'bi-people',          label: 'Cùng phòng', color: '#8b5cf6' },
                { href: '/khach-thue/dashboard/cai-dat',    icon: 'bi-gear',                  label: 'Cài đặt', color: '#6b7280' },
              ].map(item => (
                <div key={item.href} className="col-4">
                  <Link
                    href={item.href}
                    className="d-flex flex-column align-items-center justify-content-center gap-1 rounded-3 text-decoration-none p-2"
                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb', minHeight: 72, transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ede9fe')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
                  >
                    <i className={`bi ${item.icon}`} style={{ fontSize: 20, color: item.color }} />
                    <span style={{ fontSize: 10, color: '#374151', textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Contract info + Recent incidents ───────────────────────── */}
      <div className="row g-3 mb-4">
        {/* Contract info */}
        {hopDongHienTai && (
          <div className="col-12 col-md-5">
            <div className="bs-card h-100">
              <h6 className="fw-bold mb-3" style={{ fontSize: 14 }}>
                <i className="bi bi-file-earmark-check-fill me-2" style={{ color: '#6366f1' }} />
                Hợp đồng hiện tại
              </h6>
              <div className="d-flex flex-column gap-2" style={{ fontSize: 13 }}>
                <div className="d-flex justify-content-between">
                  <span style={{ color: '#6b7280' }}>Mã HĐ</span>
                  <span className="fw-medium">{hopDongHienTai.maHopDong}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span style={{ color: '#6b7280' }}>Phòng</span>
                  <span className="fw-medium">{hopDongHienTai.phong?.maPhong}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span style={{ color: '#6b7280' }}>Giá thuê</span>
                  <span className="fw-medium text-success">{fmt(hopDongHienTai.phong?.giaThue ?? 0)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span style={{ color: '#6b7280' }}>Tiền cọc</span>
                  <span className="fw-medium" style={{ color: '#f59e0b' }}>{fmt(hopDongHienTai.tienCoc ?? 0)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span style={{ color: '#6b7280' }}>Hết hạn</span>
                  <span className="fw-medium">{fmtDate(hopDongHienTai.ngayKetThuc)}</span>
                </div>
                {daysUntilExpiry !== null && (
                  <div className="d-flex justify-content-between">
                    <span style={{ color: '#6b7280' }}>Còn lại</span>
                    <span
                      className="fw-semibold"
                      style={{ color: daysUntilExpiry <= 30 ? '#ef4444' : daysUntilExpiry <= 60 ? '#f59e0b' : '#10b981' }}
                    >
                      {daysUntilExpiry} ngày
                    </span>
                  </div>
                )}
                {hopDongHienTai.nguoiDaiDien && (
                  <div className="d-flex justify-content-between">
                    <span style={{ color: '#6b7280' }}>Đại diện HĐ</span>
                    <span className="fw-medium">{hopDongHienTai.nguoiDaiDien.hoTen}</span>
                  </div>
                )}
                {lienHeQuanLy && (lienHeQuanLy.soDienThoai || lienHeQuanLy.email) && (
                  <>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: '#6b7280' }}>Quản lý</span>
                      <span className="fw-medium">{lienHeQuanLy.ten}</span>
                    </div>
                    {lienHeQuanLy.soDienThoai && (
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#6b7280' }}>Hotline</span>
                        <a href={`tel:${lienHeQuanLy.soDienThoai}`} className="fw-medium text-decoration-none" style={{ color: '#6366f1' }}>
                          {lienHeQuanLy.soDienThoai}
                        </a>
                      </div>
                    )}
                    {lienHeQuanLy.email && (
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#6b7280' }}>Email</span>
                        <a href={`mailto:${lienHeQuanLy.email}`} className="fw-medium text-decoration-none" style={{ color: '#6366f1', wordBreak: 'break-all' }}>
                          {lienHeQuanLy.email}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent incidents */}
        <div className={`col-12 ${hopDongHienTai ? 'col-md-7' : ''}`}>
          <div className="bs-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold mb-0" style={{ fontSize: 14 }}>
                <i className="bi bi-exclamation-triangle-fill me-2" style={{ color: '#f59e0b' }} />
                Sự cố gần đây
              </h6>
              <Link href="/khach-thue/dashboard/su-co" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>
                Xem tất cả →
              </Link>
            </div>
            {suCoGanNhat.length === 0 ? (
              <div className="text-center py-3" style={{ color: '#9ca3af', fontSize: 13 }}>
                <i className="bi bi-check-circle fs-4 d-block mb-1" />
                Không có sự cố nào
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {suCoGanNhat.map((sc) => {
                  const st = suCoTrangThaiLabel[sc.trangThai] ?? { label: sc.trangThai, cls: 'bg-secondary' };
                  return (
                    <div
                      key={sc.id}
                      className="d-flex align-items-center justify-content-between gap-2 p-2 rounded-3"
                      style={{ background: '#f9fafb', fontSize: 13 }}
                    >
                      <div className="flex-fill" style={{ minWidth: 0 }}>
                        <div className="fw-medium text-truncate">{sc.tieuDe}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          {sc.ngayBaoCao ? fmtDate(sc.ngayBaoCao) : ''}
                        </div>
                      </div>
                      <span className={`badge rounded-pill ${st.cls}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
