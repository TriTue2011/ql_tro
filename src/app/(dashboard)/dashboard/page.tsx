'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DashboardStats } from '@/types';
import ZaloHotlineWarning from '@/components/zalo-hotline-warning';
import { PermissionLevelSelector } from '@/components/dashboard';
import type { PermissionLevel } from '@/components/dashboard';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import '@/styles/bs-admin.css';

interface MonthRevenue { month: number; revenue: number; }

interface ChuTroInfo {
  id: string;
  ten: string;
  soDienThoai: string | null;
  email: string | null;
}

interface AdminStats {
  tongToaNha: number;
  danhSachToaNha: { id: string; tenToaNha: string; diaChi: string; ngayTao: string; chuTro: ChuTroInfo | null }[];
}

interface BuildingUser {
  id: string;
  ten?: string;
  email?: string | null;
  soDienThoai?: string | null;
  vaiTro?: string;
  chucVu?: string | null;
  quyenTheoToaNha?: Record<string, Record<string, PermissionLevel>>;
}

const BUSINESS_PERMISSIONS: Array<{
  key: string;
  label: string;
  description: string;
  group: string;
}> = [
  { key: 'mucDoHopDong', label: 'Hợp đồng', description: 'Cho phép quản lý thêm, sửa hoặc hủy hợp đồng.', group: 'Quản lý cơ bản' },
  { key: 'mucDoKichHoatTaiKhoan', label: 'Đăng nhập khách thuê', description: 'Cho phép bật/thu hồi đăng nhập web cho khách thuê.', group: 'Quản lý cơ bản' },
  { key: 'mucDoHoaDon', label: 'Hóa đơn', description: 'Cho phép tạo, sửa, xóa hóa đơn.', group: 'Tài chính' },
  { key: 'mucDoThanhToan', label: 'Thanh toán', description: 'Cho phép ghi nhận, chỉnh sửa giao dịch thanh toán.', group: 'Tài chính' },
  { key: 'mucDoSuCo', label: 'Sự cố', description: 'Cho phép tiếp nhận và xử lý sự cố.', group: 'Vận hành' },
  { key: 'mucDoCongViec', label: 'Công việc', description: 'Cho phép quản lý công việc, phân công.', group: 'Vận hành' },
  { key: 'mucDoBaoDuong', label: 'Bảo dưỡng', description: 'Cho phép quản lý lịch bảo dưỡng.', group: 'Vận hành' },
  { key: 'mucDoKho', label: 'Kho', description: 'Cho phép quản lý vật tư, tồn kho.', group: 'Kho' },
  { key: 'mucDoZalo', label: 'Zalo', description: 'Hiện tab Zalo để quản lý tin nhắn.', group: 'Liên lạc' },
  { key: 'mucDoZaloMonitor', label: 'Zalo Monitor', description: 'Hiện tab Zalo Monitor.', group: 'Liên lạc' },
  { key: 'mucDoCaiDatHotline', label: 'Cài đặt Hotline', description: 'Cấu hình số hotline Zalo.', group: 'Cài đặt' },
  { key: 'mucDoCaiDatEmail', label: 'Cài đặt Email', description: 'Cấu hình email SMTP.', group: 'Cài đặt' },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState('');
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [revenueData, setRevenueData] = useState<MonthRevenue[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const isAdmin = session?.user?.role === 'admin';

  // ── Building list expandable permission state ──
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const [buildingUsers, setBuildingUsers] = useState<BuildingUser[]>([]);
  const [buildingUsersLoading, setBuildingUsersLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Building-level business permissions (new design)
  const [buildingBusinessPerms, setBuildingBusinessPerms] = useState<Record<string, Record<string, PermissionLevel>>>({});
  const [buildingPermsLoading, setBuildingPermsLoading] = useState(false);

  // ── Add Admin dialog state ──
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({
    ten: '',
    soDienThoai: '',
    email: '',
    matKhau: '',
  });
  const [selectedBuildings, setSelectedBuildings] = useState<Record<string, boolean>>({});
  const [buildingPerms, setBuildingPerms] = useState<Record<string, Record<string, string>>>({});
  const [buildings, setBuildings] = useState<{ id: string; tenToaNha: string }[]>([]);
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/toa-nha-settings');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setBuildings(data.data);
      }
    } catch {
      // fallback: try /api/toa-nha
      try {
        const res = await fetch('/api/toa-nha');
        const data = await res.json();
        const list = data.data || data;
        if (Array.isArray(list)) {
          setBuildings(list.map((b: any) => ({ id: b.id, tenToaNha: b.tenToaNha })));
        }
      } catch {}
    }
  }, []);

  const fetchBuildingUsers = useCallback(async (buildingId: string) => {
    setBuildingUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      // API /api/admin/users returns a raw array, not { success, data }
      const usersList: any[] = data?.success ? data.data : (Array.isArray(data) ? data : []);
      if (usersList.length > 0 || !Array.isArray(data)) {
        const users: BuildingUser[] = usersList.map((u: any) => ({
          id: u.id,
          ten: u.ten,
          email: u.email,
          soDienThoai: u.soDienThoai,
          vaiTro: u.vaiTro,
          chucVu: u.chucVu,
          quyenTheoToaNha: u.quyenTheoToaNha ?? {},
        }));
        // Show users assigned to this building (via quyenTheoToaNha) OR the chủ trọ (owner)
        const filtered = users.filter((u: BuildingUser) => {
          // Check if user has permission entries for this building
          if (u.quyenTheoToaNha && u.quyenTheoToaNha[buildingId]) return true;
          // Also include chủ trọ (chuNha) — they are owners, may not have explicit permission entries
          if (u.vaiTro === 'chuNha') {
            // Check if this user is the owner of this building via the stats data
            const building = adminStats?.danhSachToaNha.find(tn => tn.id === buildingId);
            if (building?.chuTro?.id === u.id) return true;
          }
          return false;
        });
        setBuildingUsers(filtered);
      }
    } catch {
      toast.error('Không thể tải danh sách người dùng');
    } finally {
      setBuildingUsersLoading(false);
    }
  }, [adminStats]);

  /** Fetch building-level business permissions from the new API */
  const fetchBuildingPermissions = useCallback(async (buildingId: string) => {
    setBuildingPermsLoading(true);
    try {
      const res = await fetch(`/api/admin/toa-nha-permissions?toaNhaId=${buildingId}`);
      const data = await res.json();
      if (data.success && data.data?.permissions) {
        setBuildingBusinessPerms(prev => ({
          ...prev,
          [buildingId]: data.data.permissions,
        }));
      } else {
        // Default all fullAccess
        const defaults: Record<string, PermissionLevel> = {};
        for (const p of BUSINESS_PERMISSIONS) {
          defaults[p.key] = 'fullAccess';
        }
        setBuildingBusinessPerms(prev => ({
          ...prev,
          [buildingId]: defaults,
        }));
      }
    } catch {
      // Silently fail — permissions will show as loading
    } finally {
      setBuildingPermsLoading(false);
    }
  }, []);

  /** Save building-level permission change via the new API */
  const saveBuildingPermission = useCallback(async (buildingId: string, key: string, value: PermissionLevel) => {
    const current = buildingBusinessPerms[buildingId] ?? {};
    const next = { ...current, [key]: value };
    // Optimistic update
    setBuildingBusinessPerms(prev => ({
      ...prev,
      [buildingId]: next,
    }));
    try {
      const res = await fetch('/api/admin/toa-nha-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: buildingId, permissions: next }),
      });
      if (!res.ok) {
        toast.error('Không thể lưu gói quyền');
        // Reload to get actual state
        await fetchBuildingPermissions(buildingId);
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
      await fetchBuildingPermissions(buildingId);
    }
  }, [buildingBusinessPerms, fetchBuildingPermissions]);

  const handleBuildingClick = useCallback((buildingId: string) => {
    if (expandedBuildingId === buildingId) {
      setExpandedBuildingId(null);
      setBuildingUsers([]);
    } else {
      setExpandedBuildingId(buildingId);
      void fetchBuildingUsers(buildingId);
      void fetchBuildingPermissions(buildingId);
    }
  }, [expandedBuildingId, fetchBuildingUsers, fetchBuildingPermissions]);

  const handleDeleteBuilding = useCallback(async (buildingId: string, tenToaNha: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tòa nhà "${tenToaNha}"? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(buildingId);
    try {
      const res = await fetch(`/api/toa-nha/${buildingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Đã xóa tòa nhà');
        // Refresh stats
        const statsRes = await fetch('/api/dashboard/admin-stats');
        const statsData = await statsRes.json();
        if (statsData?.success) setAdminStats(statsData.data);
      } else {
        toast.error(data?.message || 'Không thể xóa tòa nhà');
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleAddAdmin = useCallback(async () => {
    const { ten, soDienThoai, email, matKhau } = addAdminForm;
    if (!ten || ten.trim().length < 2) {
      toast.error('Vui lòng nhập họ tên (ít nhất 2 ký tự)');
      return;
    }
    if (!soDienThoai && !email) {
      toast.error('Cần ít nhất số điện thoại hoặc email');
      return;
    }
    const buildingIds = Object.entries(selectedBuildings).filter(([, v]) => v).map(([k]) => k);
    if (buildingIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một tòa nhà để gán quyền quản lý');
      return;
    }

    setAddingAdmin(true);
    try {
      // 1. Tạo user với role='admin'
      const body: Record<string, any> = {
        name: ten.trim(),
        role: 'admin',
        toaNhaIds: buildingIds,
      };
      if (soDienThoai.trim()) body.phone = soDienThoai.trim();
      if (email.trim()) body.email = email.trim().toLowerCase();
      if (matKhau.trim()) body.password = matKhau.trim();

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Không thể tạo admin');
        return;
      }

      const newUserId = data.id;

      // 2. Gán quyền cho từng tòa nhà
      for (const tid of buildingIds) {
        const perms = buildingPerms[tid] ?? {};
        const permBody: Record<string, string> = { toaNhaId: tid };
        // Mặc định fullAccess nếu không được chọn
        for (const p of BUSINESS_PERMISSIONS) {
          permBody[p.key] = perms[p.key] || 'fullAccess';
        }
        await fetch(`/api/admin/users/${newUserId}/quyen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(permBody),
        });
      }

      toast.success(`Đã thêm admin "${ten.trim()}" thành công`);
      setShowAddAdmin(false);
      setAddAdminForm({ ten: '', soDienThoai: '', email: '', matKhau: '' });
      setSelectedBuildings({});
      setBuildingPerms({});
    } catch {
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setAddingAdmin(false);
    }
  }, [addAdminForm, selectedBuildings, buildingPerms]);

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
        {/* ── Hero Banner ─────────────────────────────────────────────── */}
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
              </div>
            </div>
            <div className="d-none d-md-flex align-items-center gap-3">
              <button
                type="button"
                className="admin-hero-btn"
                onClick={() => {
                  fetchBuildings();
                  setShowAddAdmin(true);
                }}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <i className="bi bi-shield-plus" />
                Thêm admin
              </button>
            </div>
          </div>
        </div>

        <ZaloHotlineWarning />

        {/* ── Permission Quick-Access (like chuNha style) ──────────────── */}
        <div className="bs-section-header">
          <h2 className="bs-section-title">Tổng quan hệ thống</h2>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            <i className="bi bi-clock me-1" />Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="mb-4">
          <div className="row g-2">
            {[
              { href: '/dashboard/toa-nha', icon: 'bi-buildings-fill', label: 'Tòa nhà', color: '#6366f1', count: s.tongToaNha },
              { href: '/dashboard/quan-ly-tai-khoan', icon: 'bi-people-fill', label: 'Tài khoản', color: '#10b981', count: null },
              { href: '/dashboard/phan-quyen', icon: 'bi-diagram-3-fill', label: 'Phân quyền', color: '#8b5cf6', count: null },
              { href: '/dashboard/ho-so', icon: 'bi-person-circle', label: 'Hồ sơ', color: '#06b6d4', count: null },
            ].map((item) => (
              <div key={item.href} className="col-4 col-sm-2">
                <Link
                  href={item.href}
                  className="d-flex flex-column align-items-center justify-content-center h-100 position-relative text-decoration-none"
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
                  <i className={`bi ${item.icon}`} style={{ color: item.color, fontSize: 24, marginBottom: 6 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{item.label}</span>
                  {item.count !== null && item.count !== undefined ? (
                    <span
                      className="position-absolute badge rounded-pill"
                      style={{
                        top: -5,
                        right: -5,
                        fontSize: 10,
                        minWidth: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(99,102,241,0.3)',
                        zIndex: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff'
                      }}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              </div>
            ))}
            {/* Thêm admin quick action */}
            <div className="col-4 col-sm-2">
              <button
                type="button"
                onClick={() => {
                  fetchBuildings();
                  setShowAddAdmin(true);
                }}
                className="d-flex flex-column align-items-center justify-content-center h-100 w-100 position-relative text-decoration-none"
                style={{
                  padding: '16px 8px',
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s ease',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  cursor: 'pointer',
                  overflow: 'visible',
                  borderColor: '#f59e0b',
                }}
              >
                <i className="bi bi-shield-plus" style={{ color: '#f59e0b', fontSize: 24, marginBottom: 6 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Thêm admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Row 2: Building list with inline edit/delete & expandable permission ── */}
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="bs-card h-100">
              <div className="bs-card-header">
                <div>
                  <h5 className="bs-card-title"><i className="bi bi-buildings-fill" /> Danh sách tòa nhà</h5>
                  <div className="bs-card-subtitle">{s.danhSachToaNha.length} tòa nhà — nhấn để xem/quản lý phân quyền</div>
                </div>
                <Link href="/dashboard/toa-nha" className="bs-section-link">
                  Xem tất cả <i className="bi bi-arrow-right" />
                </Link>
              </div>
              <div className="bs-card-body" style={{ padding: '8px 16px' }}>
                {s.danhSachToaNha.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Chưa có tòa nhà nào</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {s.danhSachToaNha.map((tn, idx) => (
                      <div key={tn.id}>
                        {/* ── Building Row ── */}
                        <div
                          onClick={() => handleBuildingClick(tn.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 8px',
                            cursor: 'pointer',
                            borderBottom: idx < s.danhSachToaNha.length - 1 ? '1px solid #f0f0f0' : 'none',
                            background: expandedBuildingId === tn.id ? '#f8f7ff' : 'transparent',
                            borderRadius: expandedBuildingId === tn.id ? '8px 8px 0 0' : 0,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => { if (expandedBuildingId !== tn.id) (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                          onMouseLeave={(e) => { if (expandedBuildingId !== tn.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: 'rgba(99,102,241,0.1)',
                              color: '#6366f1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            <i className="bi bi-building" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{tn.tenToaNha}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn.diaChi}</div>
                            {tn.chuTro && (
                              <div style={{ fontSize: 11, color: '#10b981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="bi bi-person-fill-gear" style={{ fontSize: 10 }} />
                                <span>{tn.chuTro.ten}</span>
                                <span style={{ color: '#9ca3af' }}>·</span>
                                <span style={{ color: '#6b7280' }}>{tn.chuTro.soDienThoai || tn.chuTro.email || ''}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {new Date(tn.ngayTao).toLocaleDateString('vi-VN')}
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/toa-nha/${tn.id}`)}
                              title="Chỉnh sửa"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                                color: '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: 12,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBuilding(tn.id, tn.tenToaNha)}
                              disabled={deletingId === tn.id}
                              title="Xóa"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: 12,
                                opacity: deletingId === tn.id ? 0.5 : 1,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                            >
                              <i className="bi bi-trash" />
                            </button>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: '1px solid #e5e7eb',
                                background: expandedBuildingId === tn.id ? '#eef2ff' : '#fff',
                                color: expandedBuildingId === tn.id ? '#6366f1' : '#9ca3af',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                transition: 'all 0.15s',
                              }}
                            >
                              <i className={`bi ${expandedBuildingId === tn.id ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                            </div>
                          </div>
                        </div>

                        {/* ── Expanded Permission Section — Gói tính năng nghiệp vụ (per-building) ── */}
                        {expandedBuildingId === tn.id && (
                          <div
                            style={{
                              padding: '16px 16px 20px',
                              background: '#f8f7ff',
                              borderRadius: '0 0 8px 8px',
                              borderBottom: idx < s.danhSachToaNha.length - 1 ? '1px solid #e8e6f7' : 'none',
                            }}
                          >
                            {/* Building-level permissions — editable inline */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="bi bi-shield-check" />
                                Gói tính năng nghiệp vụ — tất cả người dùng kế thừa
                                <Link
                                  href="/dashboard/phan-quyen"
                                  style={{ fontSize: 10, color: '#818cf8', marginLeft: 'auto', textDecoration: 'none' }}
                                >
                                  <i className="bi bi-box-arrow-up-right me-1" />
                                  Chi tiết
                                </Link>
                              </div>
                              {buildingPermsLoading ? (
                                <div style={{ textAlign: 'center', padding: '12px 0', color: '#9ca3af', fontSize: 12 }}>
                                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                                  Đang tải gói quyền...
                                </div>
                              ) : (() => {
                                const perms = buildingBusinessPerms[tn.id];
                                if (!perms) {
                                  return (
                                    <div style={{ textAlign: 'center', padding: '12px 0', color: '#9ca3af', fontSize: 12 }}>
                                      <i className="bi bi-info-circle me-1" />
                                      Chưa có gói quyền.{' '}
                                      <Link href="/dashboard/phan-quyen" style={{ color: '#6366f1' }}>Cấu hình ngay</Link>
                                    </div>
                                  );
                                }
                                return (
                                  <PermissionLevelSelector
                                    items={BUSINESS_PERMISSIONS}
                                    values={perms}
                                    onChange={(key, value) => {
                                      void saveBuildingPermission(tn.id, key, value);
                                    }}
                                    disabled={false}
                                    columns={1}
                                    showGroup={true}
                                  />
                                );
                              })()}
                            </div>

                            {/* Users assigned to this building (read-only list) */}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="bi bi-people" />
                                Người dùng trong tòa nhà
                              </div>
                              {buildingUsersLoading ? (
                                <div style={{ textAlign: 'center', padding: '12px 0', color: '#9ca3af', fontSize: 12 }}>
                                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                                  Đang tải người dùng...
                                </div>
                              ) : buildingUsers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '12px 0', color: '#9ca3af', fontSize: 12 }}>
                                  <i className="bi bi-info-circle me-1" />
                                  Chưa có người dùng nào được gán cho tòa nhà này.{' '}
                                  <Link href="/dashboard/quan-ly-tai-khoan" style={{ color: '#6366f1' }}>Quản lý tài khoản</Link>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {buildingUsers.map(user => {
                                    const roleColor = user.vaiTro === 'chuNha' ? '#10b981' : user.vaiTro === 'dongChuTro' ? '#f59e0b' : user.vaiTro === 'quanLy' ? '#6366f1' : '#6b7280';
                                    const roleLabel = user.vaiTro === 'chuNha' ? 'Chủ trọ' : user.vaiTro === 'dongChuTro' ? 'Đồng chủ trọ' : user.vaiTro === 'quanLy' ? 'Quản lý' : 'Nhân viên';
                                    return (
                                      <div key={user.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '6px 10px', borderRadius: 8,
                                        background: '#fff', border: '1px solid #ede9fe',
                                        fontSize: 12,
                                      }}>
                                        <div style={{
                                          width: 24, height: 24, borderRadius: '50%',
                                          background: roleColor, color: '#fff',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                                        }}>
                                          {(user.ten || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <span style={{ fontWeight: 500, color: '#1f2937' }}>{user.ten || 'Không tên'}</span>
                                          <span style={{ color: roleColor, marginLeft: 6, fontSize: 10 }}>{roleLabel}</span>
                                        </div>
                                        {user.soDienThoai && (
                                          <span style={{ color: '#9ca3af', fontSize: 10, flexShrink: 0 }}>{user.soDienThoai}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Add Admin Dialog ── */}
        <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-700">
                <i className="bi bi-shield-plus" />
                Thêm admin mới
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Họ tên */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-indigo-900">
                  Họ tên <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={addAdminForm.ten}
                  onChange={(e) => setAddAdminForm(p => ({ ...p, ten: e.target.value }))}
                />
              </div>

              {/* Số điện thoại */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-indigo-900">
                  Số điện thoại
                </Label>
                <Input
                  placeholder="0912345678"
                  value={addAdminForm.soDienThoai}
                  onChange={(e) => setAddAdminForm(p => ({ ...p, soDienThoai: e.target.value }))}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-indigo-900">
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={addAdminForm.email}
                  onChange={(e) => setAddAdminForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>

              {/* Mật khẩu */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-indigo-900">
                  Mật khẩu
                </Label>
                <Input
                  type="password"
                  placeholder="Để trống để tạo mật khẩu tự động"
                  value={addAdminForm.matKhau}
                  onChange={(e) => setAddAdminForm(p => ({ ...p, matKhau: e.target.value }))}
                />
              </div>

              {/* Chọn tòa nhà */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-indigo-900">
                  Gán tòa nhà quản lý <span className="text-red-500">*</span>
                </Label>
                {buildings.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Đang tải danh sách tòa nhà...</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-indigo-100 rounded-xl p-2">
                    {buildings.map((b) => (
                      <div key={b.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-indigo-50/50">
                        <Checkbox
                          checked={!!selectedBuildings[b.id]}
                          onCheckedChange={(checked) => {
                            setSelectedBuildings(prev => ({ ...prev, [b.id]: !!checked }));
                            if (checked && !buildingPerms[b.id]) {
                              // Default all permissions to fullAccess
                              const defaults: Record<string, string> = {};
                              BUSINESS_PERMISSIONS.forEach(p => { defaults[p.key] = 'fullAccess'; });
                              setBuildingPerms(prev => ({ ...prev, [b.id]: defaults }));
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <Label className="text-sm font-medium cursor-pointer">{b.tenToaNha}</Label>
                          {selectedBuildings[b.id] && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {BUSINESS_PERMISSIONS.map(p => (
                                <div key={p.key} className="flex items-center gap-1.5">
                                  <select
                                    value={buildingPerms[b.id]?.[p.key] || 'fullAccess'}
                                    onChange={(e) => {
                                      setBuildingPerms(prev => ({
                                        ...prev,
                                        [b.id]: { ...(prev[b.id] ?? {}), [p.key]: e.target.value },
                                      }));
                                    }}
                                    className="text-xs border border-indigo-200 rounded-md px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                    style={{ fontSize: 10 }}
                                  >
                                    <option value="fullAccess">Toàn quyền</option>
                                    <option value="viewOnly">Xem</option>
                                    <option value="hidden">Ẩn</option>
                                  </select>
                                  <span className="text-xs text-gray-500 truncate">{p.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-indigo-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddAdmin(false);
                    setAddAdminForm({ ten: '', soDienThoai: '', email: '', matKhau: '' });
                    setSelectedBuildings({});
                    setBuildingPerms({});
                  }}
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddAdmin}
                  disabled={addingAdmin}
                  className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
                >
                  {addingAdmin ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                      Đang thêm...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-plus me-1" />
                      Thêm admin
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

  return (
    <>
      <div className="bs-hero-banner">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="bs-hero-title">Xin chào, {firstName}! 👋</div>
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
                <div className="bs-hero-stat-val">{(stats.doanhThuThang / 1_000_000).toFixed(1)}M</div>
                <div className="bs-hero-stat-lbl">Doanh thu tháng</div>
              </div>
            </div>
          </div>
          <div className="d-none d-md-flex align-items-center gap-3">
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 18px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{stats.suCoCanXuLy}</div>
              <div style={{ fontSize: 11, opacity: 0.8, color: '#fff' }}>Sự cố cần xử lý</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 18px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{stats.hoaDonSapDenHan}</div>
              <div style={{ fontSize: 11, opacity: 0.8, color: '#fff' }}>Hóa đơn sắp hạn</div>
            </div>
          </div>
        </div>
      </div>

      <ZaloHotlineWarning />

      <div className="mb-4">
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
                <i className={`bi ${item.icon}`} style={{ color: item.color, fontSize: 24, marginBottom: 6 }} />
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

      <div className="bs-section-header">
        <h2 className="bs-section-title">Tổng quan hệ thống</h2>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          <i className="bi bi-clock me-1" />Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="row g-3 mb-4">
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

        <div className="col-6 col-sm-6 col-lg-3">
          <Link href="/dashboard/phong?status=available" className="text-decoration-none">
            <div className="bs-stat-card card-emerald">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="bs-stat-label">Phòng trống</div>
                  <div className="bs-stat-value" style={{ color: '#059669' }}>{stats.phongTrong}</div>
                  <div className="bs-stat-sub">
                    <span className="bs-pulse-dot dot-green" style={{ marginRight: 5 }} />
                    {stats.tongSoPhong > 0 ? ((stats.phongTrong / stats.tongSoPhong) * 100).toFixed(0) : 0}% tổng số
                  </div>
                </div>
                <div className="bs-stat-icon icon-emerald">
                  <i className="bi bi-door-open" />
                </div>
              </div>
            </div>
          </Link>
        </div>

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
                    <span className="bs-stat-trend-up"><i className="bi bi-arrow-up-right" />+12%</span>
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
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Có TK / Chưa có TK</div>
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
