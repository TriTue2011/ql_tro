'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Users,
  X,
  Settings,
  UserCog,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CHUC_VU_QUAN_LY, CHUC_VU_NHAN_VIEN, getChucVuLabel, getChucVuOptionsForRole } from '@/lib/chuc-vu';
import {
  BuildingSelector,
  PageHeader,
  PermissionLevelSelector,
  PillTabs,
} from '@/components/dashboard';
import type { PermissionLevel } from '@/components/dashboard';

type RoleKey = 'chuNha' | 'dongChuTro' | 'quanLy' | 'nhanVien';
type ChucVuValue = (typeof CHUC_VU_QUAN_LY)[number]['value'] | (typeof CHUC_VU_NHAN_VIEN)[number]['value'];
type LevelKey = 'admin' | 'chuNha' | 'quanLy';
type MucDoKey =
  | 'mucDoHopDong'
  | 'mucDoHoaDon'
  | 'mucDoThanhToan'
  | 'mucDoSuCo'
  | 'mucDoKichHoatTaiKhoan'
  | 'mucDoZalo'
  | 'mucDoZaloMonitor'
  | 'mucDoCongViec'
  | 'mucDoKho'
  | 'mucDoBaoDuong'
  | 'mucDoCaiDatHotline'
  | 'mucDoCaiDatEmail';
type ZaloFeatureKey =
  | 'botServer'
  | 'trucTiep'
  | 'proxy'
  | 'webhook'
  | 'tinTuDong'
  | 'testGui'
  | 'ketBan'
  | 'theoDoiTin'
  | 'zaloMonitor'
  | 'quanLyQuyen';

interface Building {
  id: string;
  tenToaNha: string;
}

interface UserPermissionSet {
  mucDoKichHoatTaiKhoan?: PermissionLevel;
  mucDoHopDong?: PermissionLevel;
  mucDoHoaDon?: PermissionLevel;
  mucDoThanhToan?: PermissionLevel;
  mucDoSuCo?: PermissionLevel;
  mucDoZalo?: PermissionLevel;
  mucDoZaloMonitor?: PermissionLevel;
  mucDoCongViec?: PermissionLevel;
  mucDoKho?: PermissionLevel;
  mucDoBaoDuong?: PermissionLevel;
  mucDoCaiDatHotline?: PermissionLevel;
  mucDoCaiDatEmail?: PermissionLevel;
}

interface User {
  id: string;
  ten?: string;
  email?: string | null;
  soDienThoai?: string | null;
  vaiTro?: string;
  chucVu?: string | null;
  toaNhaIds?: string[];
  zaloViTri?: Record<string, number> | null;
  quyenTheoToaNha?: Record<string, UserPermissionSet>;
  mucDoKichHoatTaiKhoan?: PermissionLevel;
  mucDoHopDong?: PermissionLevel;
  mucDoHoaDon?: PermissionLevel;
  mucDoThanhToan?: PermissionLevel;
  mucDoSuCo?: PermissionLevel;
  mucDoZalo?: PermissionLevel;
  mucDoZaloMonitor?: PermissionLevel;
  mucDoCongViec?: PermissionLevel;
  mucDoKho?: PermissionLevel;
  mucDoBaoDuong?: PermissionLevel;
  mucDoCaiDatHotline?: PermissionLevel;
  mucDoCaiDatEmail?: PermissionLevel;
}

type ZaloPermissionMap = Record<string, Record<ZaloFeatureKey, boolean>>;
type ZaloPermsByLevel = Record<LevelKey, ZaloPermissionMap>;

// Slot key format:
//   For admin level: "chucVu" (e.g., "giamDoc", "keToanTruong")
//   For chuNha/quanLy level: "chucVu" (position ceiling) or "chucVu__userId" (per-person)

const ROLE_LABELS: Record<RoleKey, string> = {
  chuNha: 'Chủ trọ',
  dongChuTro: 'Đồng chủ trọ',
  quanLy: 'Quản lý',
  nhanVien: 'Nhân viên',
};

const DEFAULT_ROLE_LIMITS: Record<RoleKey, number> = {
  chuNha: 1,
  dongChuTro: 2,
  quanLy: 3,
  nhanVien: 5,
};

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  chuNha: 'Chủ sở hữu hoặc người chịu trách nhiệm chính của tòa nhà, thường có quyền quản trị cao nhất trong phạm vi tòa được gán.',
  dongChuTro: 'Người được chủ trọ ủy quyền cùng quản lý tòa nhà, phù hợp cho người đồng vận hành nhưng không phải admin hệ thống.',
  quanLy: 'Người phụ trách vận hành nghiệp vụ hằng ngày như hợp đồng, hóa đơn, thanh toán, sự cố theo các quyền được bật.',
  nhanVien: 'Nhân sự thực hiện công việc được phân công, thường dùng cho lễ tân, kế toán, kỹ thuật, kho hoặc hành chính.',
};

const BUSINESS_PERMISSIONS: Array<{
  key: MucDoKey;
  label: string;
  description: string;
  group: string;
}> = [
  // ── Quản lý cơ bản ──
  {
    key: 'mucDoHopDong',
    label: 'Hợp đồng',
    description: 'Cho phép quản lý thêm, sửa hoặc hủy hợp đồng trong các tòa nhà được gán.',
    group: 'Quản lý cơ bản',
  },
  {
    key: 'mucDoKichHoatTaiKhoan',
    label: 'Đăng nhập khách thuê',
    description: 'Cho phép bật, thu hồi hoặc đặt mật khẩu đăng nhập web cho khách thuê.',
    group: 'Quản lý cơ bản',
  },
  // ── Tài chính ──
  {
    key: 'mucDoHoaDon',
    label: 'Hóa đơn',
    description: 'Cho phép tạo, sửa, xóa hóa đơn và gửi lại hóa đơn trong phạm vi tòa nhà.',
    group: 'Tài chính',
  },
  {
    key: 'mucDoThanhToan',
    label: 'Thanh toán',
    description: 'Cho phép ghi nhận, chỉnh sửa hoặc xóa giao dịch thanh toán của hóa đơn.',
    group: 'Tài chính',
  },
  // ── Vận hành ──
  {
    key: 'mucDoSuCo',
    label: 'Sự cố',
    description: 'Cho phép tiếp nhận, cập nhật trạng thái và xử lý sự cố của khách thuê.',
    group: 'Vận hành',
  },
  {
    key: 'mucDoCongViec',
    label: 'Công việc',
    description: 'Cho phép quản lý công việc, phân công và theo dõi tiến độ.',
    group: 'Vận hành',
  },
  {
    key: 'mucDoBaoDuong',
    label: 'Bảo dưỡng',
    description: 'Cho phép quản lý lịch bảo dưỡng, thiết bị và yêu cầu bảo trì.',
    group: 'Vận hành',
  },
  // ── Kho ──
  {
    key: 'mucDoKho',
    label: 'Kho (Vật tư, Tồn kho, Nhập-Xuất)',
    description: 'Cho phép quản lý vật tư, tồn kho và phiếu nhập-xuất.',
    group: 'Kho',
  },
  // ── Liên lạc ──
  {
    key: 'mucDoZalo',
    label: 'Zalo',
    description: 'Hiện tab Zalo để quản lý tin nhắn, bot, webhook và các tính năng Zalo.',
    group: 'Liên lạc',
  },
  {
    key: 'mucDoZaloMonitor',
    label: 'Zalo Monitor',
    description: 'Hiện tab Zalo Monitor để theo dõi và giám sát hoạt động Zalo.',
    group: 'Liên lạc',
  },
  // ── Cài đặt ──
  {
    key: 'mucDoCaiDatHotline',
    label: 'Cài đặt Hotline',
    description: 'Cho phép cấu hình số hotline Zalo cho tòa nhà.',
    group: 'Cài đặt',
  },
  {
    key: 'mucDoCaiDatEmail',
    label: 'Cài đặt Email',
    description: 'Cho phép cấu hình email SMTP để gửi hóa đơn, thông báo.',
    group: 'Cài đặt',
  },
];

const ZALO_FEATURES: Array<{
  key: ZaloFeatureKey;
  label: string;
  description: string;
}> = [
  { key: 'botServer', label: 'Bot Server', description: 'Cho phép dùng tài khoản Zalo bot đã cấu hình để gửi và nhận tin tự động.' },
  { key: 'trucTiep', label: 'Gửi trực tiếp', description: 'Cho phép gửi tin Zalo trực tiếp bằng tài khoản/slot của vai trò này.' },
  { key: 'proxy', label: 'Proxy', description: 'Cho phép dùng proxy khi kết nối Zalo để ổn định phiên đăng nhập.' },
  { key: 'webhook', label: 'Webhook', description: 'Cho phép nhận sự kiện Zalo webhook cho tin nhắn và trạng thái liên quan.' },
  { key: 'tinTuDong', label: 'Tin tự động', description: 'Cho phép hệ thống tự gửi tin nhắn nhắc nợ, hóa đơn, sự cố hoặc thông báo.' },
  { key: 'testGui', label: 'Test gửi', description: 'Cho phép gửi tin thử nghiệm để kiểm tra bot, token hoặc cấu hình kết nối.' },
  { key: 'ketBan', label: 'Kết bạn', description: 'Cho phép gửi hoặc xử lý lời mời kết bạn Zalo với khách thuê/người quản lý.' },
  { key: 'theoDoiTin', label: 'Theo dõi tin', description: 'Cho phép xem và theo dõi luồng tin nhắn Zalo trong màn vận hành.' },
  { key: 'zaloMonitor', label: 'Zalo Monitor', description: 'Cho phép truy cập màn giám sát trạng thái đăng nhập, QR và sức khỏe Zalo.' },
  { key: 'quanLyQuyen', label: 'Quản lý quyền', description: 'Cho phép vai trò này tiếp tục phân quyền Zalo cho cấp dưới phù hợp.' },
];

const DIRECT_MANAGE_TARGETS: Record<string, RoleKey[]> = {
  admin: ['chuNha'],
  chuNha: ['dongChuTro', 'quanLy'],
};

// All positions that can have Zalo permissions, in display order
const ALL_ZALO_POSITIONS = [
  ...CHUC_VU_QUAN_LY,
  ...CHUC_VU_NHAN_VIEN,
] as const;

// Map position value → role key
const POSITION_TO_ROLE: Record<string, RoleKey> = {};
for (const cv of CHUC_VU_QUAN_LY) POSITION_TO_ROLE[cv.value] = 'quanLy';
for (const cv of CHUC_VU_NHAN_VIEN) POSITION_TO_ROLE[cv.value] = 'nhanVien';

const ROLE_TARGETS_BY_LEVEL: Record<LevelKey, RoleKey[]> = {
  admin: ['chuNha', 'dongChuTro', 'quanLy', 'nhanVien'],
  chuNha: ['dongChuTro', 'quanLy', 'nhanVien'],
  quanLy: ['nhanVien'],
};

const TAB_ITEMS = [
  { value: 'tree', label: 'Cây phân quyền', icon: Shield },
  { value: 'business', label: 'Quyền nghiệp vụ', icon: Shield },
  { value: 'zalo', label: 'Quyền Zalo', icon: Building2 },
  { value: 'limits', label: 'Giới hạn vai trò', icon: SlidersHorizontal },
] as const;

function getUserRole(user: User): string {
  return user.vaiTro ?? 'nhanVien';
}

function getPermissionForBuilding(user: User, buildingId: string): UserPermissionSet {
  return user.quyenTheoToaNha?.[buildingId] ?? {
    mucDoKichHoatTaiKhoan: user.mucDoKichHoatTaiKhoan ?? 'fullAccess',
    mucDoHopDong: user.mucDoHopDong ?? 'fullAccess',
    mucDoHoaDon: user.mucDoHoaDon ?? 'fullAccess',
    mucDoThanhToan: user.mucDoThanhToan ?? 'fullAccess',
    mucDoSuCo: user.mucDoSuCo ?? 'fullAccess',
    mucDoZalo: user.mucDoZalo ?? 'fullAccess',
    mucDoZaloMonitor: user.mucDoZaloMonitor ?? 'fullAccess',
    mucDoCongViec: user.mucDoCongViec ?? 'fullAccess',
    mucDoKho: user.mucDoKho ?? 'fullAccess',
    mucDoBaoDuong: user.mucDoBaoDuong ?? 'fullAccess',
    mucDoCaiDatHotline: user.mucDoCaiDatHotline ?? 'fullAccess',
    mucDoCaiDatEmail: user.mucDoCaiDatEmail ?? 'fullAccess',
  };
}

function defaultFeatureSet(): Record<ZaloFeatureKey, boolean> {
  return Object.fromEntries(ZALO_FEATURES.map(feature => [feature.key, true])) as Record<ZaloFeatureKey, boolean>;
}

/** Small badge showing a user in the tree view */
function TreeUserBadge({
  user,
  buildingId,
  roleLabel,
  roleColor,
  onSelect,
}: {
  user: User;
  buildingId: string;
  roleLabel: string;
  roleColor: string;
  onSelect: () => void;
}) {
  const perms = getPermissionForBuilding(user, buildingId);
  const activePerms = Object.entries(perms).filter(([, v]) => v !== 'hidden');
  const fullAccessCount = Object.entries(perms).filter(([, v]) => v === 'fullAccess').length;
  const totalPerms = Object.keys(perms).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="tree-role-row"
      style={{ cursor: 'pointer', width: '100%' }}
      title={`${user.ten || 'Không tên'} — ${roleLabel}: ${fullAccessCount}/${totalPerms} quyền full access`}
    >
      <div
        className="tree-role-icon"
        style={{ background: `${roleColor}15`, color: roleColor }}
      >
        {(user.ten || '?').charAt(0).toUpperCase()}
      </div>
      <div className="tree-role-info">
        <div className="tree-role-name" style={{ fontSize: '12px' }}>
          {user.ten || 'Không tên'}
        </div>
        <div className="tree-role-desc" style={{ fontSize: '10px' }}>
          {roleLabel}
          {user.email && ` · ${user.email}`}
          {user.soDienThoai && !user.email && ` · ${user.soDienThoai}`}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {activePerms.length === totalPerms ? (
          <span className="admin-tree-perm-badge active" style={{ fontSize: '10px', padding: '2px 8px' }}>
            <CheckCircle2 className="h-2.5 w-2.5" />
            Full
          </span>
        ) : activePerms.length === 0 ? (
          <span className="admin-tree-perm-badge inactive" style={{ fontSize: '10px', padding: '2px 8px' }}>
            <EyeOff className="h-2.5 w-2.5" />
            Ẩn
          </span>
        ) : (
          <span className="admin-tree-perm-badge active" style={{ fontSize: '10px', padding: '2px 8px', background: `${roleColor}10`, borderColor: `${roleColor}30`, color: roleColor }}>
            <Key className="h-2.5 w-2.5" />
            {fullAccessCount}/{totalPerms}
          </span>
        )}
        <UserCog className="h-3.5 w-3.5 text-indigo-400 ml-1" />
      </div>
    </button>
  );
}

export default function PhanQuyenPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role ?? '';
  const isAdmin = role === 'admin';
  const isChuNha = role === 'chuNha';
  const isQuanLy = role === 'quanLy';
  const canAccessPage = isAdmin || isChuNha || isQuanLy;
  const level: LevelKey = isAdmin ? 'admin' : isChuNha ? 'chuNha' : 'quanLy';
  const canEditBusiness = isAdmin || isChuNha;
  const canEditLimits = isAdmin;

  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState<string | null>(null);
  const [savingZalo, setSavingZalo] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedZaloPosition, setSelectedZaloPosition] = useState<string>('');
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [globalLimits, setGlobalLimits] = useState<Record<RoleKey, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Partial<Record<RoleKey, number>>>>({});
  const [zaloPerms, setZaloPerms] = useState<ZaloPermsByLevel>({ admin: {}, chuNha: {}, quanLy: {} });
  const [canManageZaloPerms, setCanManageZaloPerms] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('business');
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [hideBusinessTab, setHideBusinessTab] = useState(false);
  // Building-level permissions (business tab redesign)
  // Key = buildingId, value = Record<MucDoKey, PermissionLevel>
  const [buildingPermissions, setBuildingPermissions] = useState<Record<string, Record<string, PermissionLevel>>>({});
  const [selectedBuildingForPerms, setSelectedBuildingForPerms] = useState<string | null>(null);
  const [buildingPermsLoading, setBuildingPermsLoading] = useState(false);
  const canEditZalo = (isAdmin || isChuNha || isQuanLy) && (isAdmin || canManageZaloPerms[selectedBuildingId] !== false);

  useEffect(() => {
    document.title = 'Phân quyền';
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && canAccessPage) void loadInitialData();
  }, [status, canAccessPage]);

  useEffect(() => {
    if (selectedBuildingId) void loadZaloPerms(selectedBuildingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildingId]);

  useEffect(() => {
    // Reset selected position when level changes
    setSelectedZaloPosition('');
    setExpandedPosition(null);
  }, [level]);

  const selectedBuilding = buildings.find(building => building.id === selectedBuildingId) ?? null;
  const selectedLimits = perBuildingLimits[selectedBuildingId] ?? {};

  const roleCounts = useMemo(() => {
    const counts: Record<RoleKey, number> = { chuNha: 0, dongChuTro: 0, quanLy: 0, nhanVien: 0 };
    for (const user of users) {
      const userRole = getUserRole(user) as RoleKey;
      if (userRole in counts && (user.toaNhaIds ?? []).includes(selectedBuildingId)) {
        counts[userRole] += 1;
      }
    }
    return counts;
  }, [selectedBuildingId, users]);

  // Filter tab items: show hide button when user can't edit, allow manual hide
  const visibleTabs = useMemo(() => {
    let items = [...TAB_ITEMS];
    // Only admin sees the tree tab
    if (!isAdmin) {
      items = items.filter(t => t.value !== 'tree');
    }
    if (!canEditBusiness && hideBusinessTab) {
      items = items.filter(t => t.value !== 'business');
    }
    return items;
  }, [canEditBusiness, hideBusinessTab, isAdmin]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [buildingRes, userRes, limitRes] = await Promise.all([
        fetch('/api/toa-nha?limit=100'),
        fetch('/api/admin/users'),
        fetch('/api/admin/role-limits?all=1'),
      ]);

      if (buildingRes.ok) {
        const buildingData = await buildingRes.json();
        const rows = buildingData.data ?? [];
        setBuildings(rows);
        setSelectedBuildingId((current) => current || rows[0]?.id || '');
      }

      if (userRes.ok) {
        setUsers(await userRes.json());
      }

      if (limitRes.ok) {
        const limitData = await limitRes.json();
        setGlobalLimits({ ...DEFAULT_ROLE_LIMITS, ...(limitData.global ?? {}) });
        setPerBuildingLimits(limitData.perBuilding ?? {});
      }
    } catch {
      toast.error('Không thể tải dữ liệu phân quyền');
    } finally {
      setLoading(false);
    }
  }

  async function loadZaloPerms(toaNhaId: string) {
    try {
      const res = await fetch(`/api/admin/zalo-quyen?toaNhaId=${toaNhaId}`);
      const data = await res.json();
      if (data.ok) {
        setZaloPerms({
          admin: data.admin ?? {},
          chuNha: data.chuNha ?? {},
          quanLy: data.quanLy ?? {},
        });
        setCanManageZaloPerms(prev => ({
          ...prev,
          [toaNhaId]: canCurrentRoleManageZalo(data.effective ?? {}),
        }));
      }
    } catch {
      toast.error('Không thể tải quyền Zalo');
    }
  }

  function canCurrentRoleManageZalo(effective: Record<string, Partial<Record<ZaloFeatureKey, boolean>>>) {
    if (isAdmin) return true;
    if (!role) return false;
    const matchingKeys = Object.keys(effective).filter(key => key === role || key.startsWith(`${role}_`));
    if (matchingKeys.length === 0) return true;
    return matchingKeys.some(key => effective[key]?.quanLyQuyen !== false);
  }

  /** Load building-level permissions from the new API */
  async function loadBuildingPermissions(buildingId: string) {
    setBuildingPermsLoading(true);
    try {
      const res = await fetch(`/api/admin/toa-nha-permissions?toaNhaId=${buildingId}`);
      const data = await res.json();
      if (data.success && data.data?.permissions) {
        setBuildingPermissions(prev => ({
          ...prev,
          [buildingId]: data.data.permissions,
        }));
      } else {
        // No permissions set yet — default all fullAccess
        const defaults: Record<string, PermissionLevel> = {};
        for (const p of BUSINESS_PERMISSIONS) {
          defaults[p.key] = 'fullAccess';
        }
        setBuildingPermissions(prev => ({
          ...prev,
          [buildingId]: defaults,
        }));
      }
    } catch {
      toast.error('Không thể tải quyền nghiệp vụ của tòa nhà');
    } finally {
      setBuildingPermsLoading(false);
    }
  }

  /** Save building-level permissions via the new API */
  async function saveBuildingPermissions(buildingId: string, key: string, value: PermissionLevel) {
    if (!canEditBusiness) return;
    const current = buildingPermissions[buildingId] ?? {};
    const next = { ...current, [key]: value };

    // Optimistic update
    setBuildingPermissions(prev => ({
      ...prev,
      [buildingId]: next,
    }));

    setSavingBusiness(`${buildingId}-${key}`);
    try {
      const res = await fetch('/api/admin/toa-nha-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: buildingId, permissions: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Không thể lưu gói quyền');
        // Reload to get actual state
        await loadBuildingPermissions(buildingId);
      } else {
        toast.success('Đã lưu gói quyền cho tòa nhà');
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
      await loadBuildingPermissions(buildingId);
    } finally {
      setSavingBusiness(null);
    }
  }

  function setLimitValue(toaNhaId: string, roleKey: RoleKey, value: number) {
    setPerBuildingLimits(prev => ({
      ...prev,
      [toaNhaId]: {
        ...(prev[toaNhaId] ?? {}),
        [roleKey]: value,
      },
    }));
  }

  async function saveLimits() {
    if (!canEditLimits || !selectedBuildingId) return;
    setSavingLimits(true);
    try {
      const globalRes = await fetch('/api/admin/role-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalLimits),
      });
      if (!globalRes.ok) {
        const err = await globalRes.json().catch(() => null);
        toast.error(err?.error || 'Không thể lưu giới hạn chung');
        return;
      }

      const buildingLimits = perBuildingLimits[selectedBuildingId] ?? {};
      const buildingRes = await fetch('/api/admin/role-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: selectedBuildingId, ...buildingLimits }),
      });
      if (!buildingRes.ok) {
        const err = await buildingRes.json().catch(() => null);
        toast.error(err?.error || 'Không thể lưu giới hạn tòa nhà');
        return;
      }

      toast.success('Đã lưu giới hạn vai trò');
      await loadInitialData();
    } catch {
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setSavingLimits(false);
    }
  }

  /** Get all positions visible to the current level, grouped by role */
  function getVisiblePositions() {
    const allowedRoles = ROLE_TARGETS_BY_LEVEL[level];
    const positions: Array<{ value: string; label: string; role: RoleKey }> = [];
    for (const cv of ALL_ZALO_POSITIONS) {
      const role = POSITION_TO_ROLE[cv.value];
      if (role && allowedRoles.includes(role)) {
        positions.push({ value: cv.value, label: cv.label, role });
      }
    }
    return positions;
  }

  /** Get users in a given position who are assigned to the selected building */
  function getUsersInPosition(chucVu: string) {
    return users.filter(u => {
      if (u.chucVu !== chucVu) return false;
      if (!(u.toaNhaIds ?? []).includes(selectedBuildingId)) return false;
      const role = getUserRole(u) as RoleKey;
      const allowedRoles = ROLE_TARGETS_BY_LEVEL[level];
      return allowedRoles.includes(role);
    });
  }

  /** Build slot key for a position (admin/chuNha level) or person (chuNha/quanLy level) */
  function buildSlotKey(chucVu: string, userId?: string): string {
    if (userId) return `${chucVu}__${userId}`;
    return chucVu;
  }

  function getSlotLabel(slotKey: string): string {
    // Person-level slot: "chucVu__userId"
    if (slotKey.includes('__')) {
      const [chucVu, userId] = slotKey.split('__');
      const user = users.find(u => u.id === userId);
      const chucVuLabel = getChucVuLabel(chucVu);
      return user ? `${chucVuLabel} - ${user.ten || 'Không tên'}` : chucVuLabel;
    }
    // Position-level slot: just "chucVu"
    return getChucVuLabel(slotKey) || slotKey;
  }

  function toggleZaloPermission(slotKey: string, featureKey: ZaloFeatureKey, value: boolean) {
    setZaloPerms(prev => {
      const currentLevel = prev[level] ?? {};
      const currentSlot = currentLevel[slotKey] ?? defaultFeatureSet();
      return {
        ...prev,
        [level]: {
          ...currentLevel,
          [slotKey]: { ...currentSlot, [featureKey]: value },
        },
      };
    });
  }

  function isZaloFeatureVisible(featureKey: ZaloFeatureKey, slotKey: string) {
    if (featureKey !== 'quanLyQuyen') return true;
    // Only show "Quản lý quyền" for position-level slots (not person-level)
    if (slotKey.includes('__')) return false;
    return (DIRECT_MANAGE_TARGETS[level] ?? []).length > 0;
  }

  function getEffectiveZaloChecked(slotKey: string, featureKey: ZaloFeatureKey) {
    // For person-level slots ("chucVu__userId"), check the parent position ceiling first
    let positionSlot = slotKey;
    if (slotKey.includes('__')) {
      positionSlot = slotKey.split('__')[0];
    }
    
    const adminVal = zaloPerms.admin?.[positionSlot]?.[featureKey] ?? true;
    const chuNhaVal = zaloPerms.chuNha?.[positionSlot]?.[featureKey] ?? true;
    
    if (level === 'admin') {
      // Admin sets position ceiling directly
      const currentVal = zaloPerms.admin?.[slotKey]?.[featureKey] ?? true;
      return currentVal;
    }
    
    if (level === 'chuNha') {
      // ChuNha sets per-person within admin's position ceiling
      if (!adminVal) return false;
      const currentVal = zaloPerms.chuNha?.[slotKey]?.[featureKey] ?? true;
      return currentVal;
    }
    
    // quanLy: sets per-person within admin AND chuNha ceiling
    if (!adminVal || !chuNhaVal) return false;
    const currentVal = zaloPerms.quanLy?.[slotKey]?.[featureKey] ?? true;
    return currentVal;
  }

  function isDisabledByHigherLevel(slotKey: string, featureKey: ZaloFeatureKey) {
    let positionSlot = slotKey;
    if (slotKey.includes('__')) {
      positionSlot = slotKey.split('__')[0];
    }
    const adminVal = zaloPerms.admin?.[positionSlot]?.[featureKey] ?? true;
    const chuNhaVal = zaloPerms.chuNha?.[positionSlot]?.[featureKey] ?? true;
    if (level === 'chuNha') return !adminVal;
    if (level === 'quanLy') return !adminVal || !chuNhaVal;
    return false;
  }

  async function saveZaloPermissions() {
    if (!selectedBuildingId || !canEditZalo) return;
    setSavingZalo(true);
    try {
      const res = await fetch('/api/admin/zalo-quyen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toaNhaId: selectedBuildingId,
          level,
          permissions: zaloPerms[level] ?? {},
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        toast.success('Đã lưu quyền Zalo');
        await loadZaloPerms(selectedBuildingId);
      } else {
        toast.error(data?.error || 'Không thể lưu quyền Zalo');
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setSavingZalo(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!canAccessPage) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Không có quyền truy cập</h1>
          <p className="text-sm text-gray-600">Màn phân quyền chỉ dành cho admin, chủ trọ hoặc quản lý được ủy quyền.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Đang tải dữ liệu phân quyền...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title=""
        description="Một nơi duy nhất để quản lý quyền nghiệp vụ, quyền Zalo và giới hạn vai trò theo tòa nhà."
        descriptionClassName="text-lg rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-1.5"
        onRefresh={() => void loadInitialData()}
      >
        <BuildingSelector
          buildings={buildings.map(b => ({ id: b.id, tenToaNha: b.tenToaNha }))}
          value={selectedBuildingId}
          onChange={setSelectedBuildingId}
        />
      </PageHeader>

      <PillTabs
        tabs={visibleTabs.map(t => ({ value: t.value, label: t.label }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* ───── Tree View Tab (Admin only) ───── */}
      {activeTab === 'tree' && isAdmin && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900">Cây phân quyền — Tổng quan tất cả tòa nhà</p>
                <p className="text-xs text-indigo-500">Xem và quản lý quyền của tất cả tòa nhà trong một giao diện duy nhất</p>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="admin-tree-container">
              {/* Root: Admin */}
              <div className="admin-tree-level">
                <div className="admin-tree-card" style={{ maxWidth: '720px' }}>
                  <div className="admin-tree-card-header">
                    <div className="admin-tree-card-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="admin-tree-card-info">
                      <div className="admin-tree-card-name">Tổng quản (Admin)</div>
                      <div className="admin-tree-card-role">Quản lý toàn bộ hệ thống · {buildings.length} tòa nhà</div>
                    </div>
                    <div className="admin-tree-card-actions">
                      <span className="admin-tree-perm-badge active">
                        <CheckCircle2 className="h-3 w-3" />
                        Full Access
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buildings level */}
              {buildings.length === 0 ? (
                <div className="admin-tree-level">
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-8 text-center text-sm text-indigo-400 w-full max-w-[720px]">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-indigo-300" />
                    Chưa có tòa nhà nào trong hệ thống.
                  </div>
                </div>
              ) : (
                buildings.map((building) => {
                  const buildingUsers = users.filter(u => (u.toaNhaIds ?? []).includes(building.id));
                  const chuTroUsers = buildingUsers.filter(u => getUserRole(u) === 'chuNha');
                  const dongChuTroUsers = buildingUsers.filter(u => getUserRole(u) === 'dongChuTro');
                  const quanLyUsers = buildingUsers.filter(u => getUserRole(u) === 'quanLy');
                  const nhanVienUsers = buildingUsers.filter(u => getUserRole(u) === 'nhanVien');
                  const hasUsers = buildingUsers.length > 0;

                  return (
                    <div key={building.id} className="admin-tree-level">
                      {/* Connector line with chevron */}
                      <div className="tree-connector">
                        <i className="bi bi-chevron-down" />
                      </div>

                      {/* Building card */}
                      <div className="admin-tree-card" style={{ maxWidth: '720px' }}>
                        <div className="admin-tree-card-header">
                          <div className="admin-tree-card-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="admin-tree-card-info">
                            <div className="admin-tree-card-name">{building.tenToaNha}</div>
                            <div className="admin-tree-card-role">
                              {buildingUsers.length} người dùng ·
                              {chuTroUsers.length > 0 && ` ${chuTroUsers.length} chủ trọ`}
                              {dongChuTroUsers.length > 0 && ` · ${dongChuTroUsers.length} đồng chủ trọ`}
                              {quanLyUsers.length > 0 && ` · ${quanLyUsers.length} quản lý`}
                              {nhanVienUsers.length > 0 && ` · ${nhanVienUsers.length} nhân viên`}
                            </div>
                          </div>
                          <div className="admin-tree-card-actions">
                            <a
                              href={`/dashboard/phan-quyen?building=${building.id}`}
                              className="tree-role-action"
                              title="Cấu hình quyền cho tòa nhà này"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedBuildingId(building.id);
                                setActiveTab('business');
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </a>
                          </div>
                        </div>

                        {/* Users grouped by role */}
                        {hasUsers && (
                          <div className="admin-tree-perms" style={{ marginTop: '8px' }}>
                            {/* Chủ trọ */}
                            {chuTroUsers.map(user => (
                              <TreeUserBadge
                                key={user.id}
                                user={user}
                                buildingId={building.id}
                                roleLabel="Chủ trọ"
                                roleColor="#059669"
                                onSelect={() => {
                                  setSelectedBuildingId(building.id);
                                  setExpandedUser(user.id);
                                  setActiveTab('business');
                                }}
                              />
                            ))}
                            {/* Đồng chủ trọ */}
                            {dongChuTroUsers.map(user => (
                              <TreeUserBadge
                                key={user.id}
                                user={user}
                                buildingId={building.id}
                                roleLabel="Đồng chủ trọ"
                                roleColor="#d97706"
                                onSelect={() => {
                                  setSelectedBuildingId(building.id);
                                  setExpandedUser(user.id);
                                  setActiveTab('business');
                                }}
                              />
                            ))}
                            {/* Quản lý */}
                            {quanLyUsers.map(user => (
                              <TreeUserBadge
                                key={user.id}
                                user={user}
                                buildingId={building.id}
                                roleLabel="Quản lý"
                                roleColor="#6366f1"
                                onSelect={() => {
                                  setSelectedBuildingId(building.id);
                                  setExpandedUser(user.id);
                                  setActiveTab('business');
                                }}
                              />
                            ))}
                            {/* Nhân viên */}
                            {nhanVienUsers.map(user => (
                              <TreeUserBadge
                                key={user.id}
                                user={user}
                                buildingId={building.id}
                                roleLabel="Nhân viên"
                                roleColor="#8b5cf6"
                                onSelect={() => {
                                  setSelectedBuildingId(building.id);
                                  setExpandedUser(user.id);
                                  setActiveTab('business');
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {!hasUsers && (
                          <div className="text-xs text-indigo-400 italic px-1" style={{ marginTop: '4px' }}>
                            Chưa có người dùng nào được gán cho tòa nhà này
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───── Business Permissions Tab — Gói tính năng nghiệp vụ (per-building) ───── */}
      {activeTab === 'business' && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900">Gói tính năng nghiệp vụ</p>
                <p className="text-xs text-indigo-500">Admin cấu hình gói quyền cho từng tòa nhà — tất cả người dùng trong tòa nhà kế thừa</p>
              </div>
              {/* Hide business tab toggle — only shown when user can't edit */}
              {!canEditBusiness && (
                <button
                  type="button"
                  onClick={() => setHideBusinessTab(prev => !prev)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    hideBusinessTab
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                      : 'bg-white/70 text-indigo-600 border border-indigo-200 hover:bg-white hover:border-indigo-300'
                  }`}
                  title={hideBusinessTab ? 'Hiện tab quyền nghiệp vụ' : 'Ẩn tab quyền nghiệp vụ'}
                >
                  {hideBusinessTab ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {hideBusinessTab ? 'Đã ẩn' : 'Ẩn tab'}
                </button>
              )}
            </div>
          </div>

          {!canEditBusiness && (
            <div className="mx-4 mt-3 rounded-full border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 backdrop-blur-sm">
              Tài khoản hiện tại chỉ xem gói quyền. Chỉ admin hoặc chủ trọ có thể cấu hình.
            </div>
          )}

          <div className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left column: buildings list */}
              <div className="w-full lg:w-72 shrink-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 px-1">
                  Danh sách tòa nhà
                </p>
                {buildings.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-6 text-center text-sm text-indigo-400">
                    <Building2 className="mx-auto mb-2 h-6 w-6 text-indigo-300" />
                    Chưa có tòa nhà nào.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {buildings.map((building) => {
                      const isSelected = selectedBuildingForPerms === building.id;
                      return (
                        <button
                          key={building.id}
                          type="button"
                          onClick={() => {
                            setSelectedBuildingForPerms(building.id);
                            if (!buildingPermissions[building.id]) {
                              void loadBuildingPermissions(building.id);
                            }
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-sm ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-lg shadow-indigo-200'
                              : 'bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <Building2 className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                          <span className="truncate">{building.tenToaNha}</span>
                          {buildingPermissions[building.id] && (
                            <span className={`text-[10px] ml-auto shrink-0 ${isSelected ? 'text-white/70' : 'text-indigo-400'}`}>
                              {Object.values(buildingPermissions[building.id]).filter(v => v !== 'hidden').length}/{BUSINESS_PERMISSIONS.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column: permission grid for selected building */}
              <div className="flex-1 min-w-0">
                {selectedBuildingForPerms ? (
                  buildingPermsLoading ? (
                    <div className="rounded-xl border-0 bg-white/70 backdrop-blur-sm p-8 shadow-md shadow-indigo-100/30 flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                      <span className="ml-2 text-sm text-indigo-500">Đang tải gói quyền...</span>
                    </div>
                  ) : (
                    <div className="rounded-xl border-0 bg-white/70 backdrop-blur-sm p-4 shadow-md shadow-indigo-100/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-200">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-indigo-900">
                              {buildings.find(b => b.id === selectedBuildingForPerms)?.tenToaNha || 'Tòa nhà'}
                            </p>
                            <p className="text-xs text-indigo-500">
                              Gói tính năng — tất cả người dùng trong tòa nhà kế thừa
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">
                            {canEditBusiness ? 'Có thể chỉnh sửa' : 'Chỉ xem'}
                          </Badge>
                        </div>
                      </div>
                      <PermissionLevelSelector
                        items={BUSINESS_PERMISSIONS}
                        values={buildingPermissions[selectedBuildingForPerms] ?? {}}
                        onChange={(key, value) => {
                          void saveBuildingPermissions(selectedBuildingForPerms, key, value);
                        }}
                        disabled={!canEditBusiness}
                        columns={1}
                        showGroup={true}
                      />
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center text-sm text-indigo-400">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-indigo-300" />
                    Chọn một tòa nhà bên trái để cấu hình gói tính năng
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── Zalo Permissions Tab ───── */}
      {activeTab === 'zalo' && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          {!canEditZalo && (
            <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 backdrop-blur-sm">
              Tài khoản hiện tại chỉ xem quyền Zalo, không thể chỉnh sửa.
            </div>
          )}

          <div className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left column: positions grouped by role */}
              <div className="w-full lg:w-80 shrink-0 space-y-3">
                {(() => {
                  const positions = getVisiblePositions();
                  
                  if (positions.length === 0) {
                    return (
                      <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-6 text-center text-sm text-indigo-400">
                        <Building2 className="mx-auto mb-2 h-6 w-6 text-indigo-300" />
                        Không có chức vụ nào để cấu hình.
                      </div>
                    );
                  }

                  // Group positions by role — only show positions that have users assigned
                  const quanLyPositions = positions.filter(p => p.role === 'quanLy' && getUsersInPosition(p.value).length > 0);
                  const nhanVienPositions = positions.filter(p => p.role === 'nhanVien' && getUsersInPosition(p.value).length > 0);

                  const renderPositionGroup = (roleLabel: string, posList: typeof positions) => {
                    if (posList.length === 0) return null;
                    return (
                      <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-1.5 shadow-sm">
                        <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider px-1">
                          {roleLabel}
                        </p>
                        {posList.map(pos => {
                          const isSelected = expandedSlot === pos.value;
                          const usersInPos = getUsersInPosition(pos.value);
                          return (
                            <div key={pos.value}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (level === 'admin') {
                                    // Admin: select position directly for ceiling
                                    setExpandedSlot(isSelected ? null : pos.value);
                                  } else {
                                    // ChuNha/QuanLy: toggle expanded position to show people
                                    setExpandedPosition(expandedPosition === pos.value ? null : pos.value);
                                    setExpandedSlot(null);
                                  }
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-sm ${
                                  isSelected || expandedPosition === pos.value
                                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-lg shadow-indigo-200'
                                    : 'bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
                                }`}
                              >
                                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isSelected || expandedPosition === pos.value ? 'bg-white shadow-sm' : 'bg-indigo-300'}`} />
                                <span className="truncate">{pos.label}</span>
                                {usersInPos.length > 0 && (
                                  <span className={`text-[10px] ml-auto shrink-0 ${isSelected || expandedPosition === pos.value ? 'text-white/70' : 'text-indigo-400'}`}>
                                    {usersInPos.length} người
                                  </span>
                                )}
                              </button>
                              
                              {/* Expanded people list (for chuNha/quanLy level) */}
                              {expandedPosition === pos.value && level !== 'admin' && (
                                <div className="ml-4 mt-1.5 space-y-1 border-l-2 border-indigo-200 pl-3">
                                  {usersInPos.length === 0 ? (
                                    <p className="text-[11px] text-indigo-400 italic py-1">
                                      Chưa có người trong chức vụ này
                                    </p>
                                  ) : (
                                    usersInPos.map(user => {
                                      const personSlotKey = buildSlotKey(pos.value, user.id);
                                      const isPersonSelected = expandedSlot === personSlotKey;
                                      return (
                                        <button
                                          key={user.id}
                                          type="button"
                                          onClick={() => setExpandedSlot(isPersonSelected ? null : personSlotKey)}
                                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left transition-all duration-200 text-xs ${
                                            isPersonSelected
                                              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-md shadow-indigo-200'
                                              : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'
                                          }`}
                                        >
                                          <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                            isPersonSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                                          }`}>
                                            {(user.ten || '?').charAt(0).toUpperCase()}
                                          </div>
                                          <span className="truncate">{user.ten || 'Không tên'}</span>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  return (
                    <>
                      {renderPositionGroup('Quản lý', quanLyPositions)}
                      {renderPositionGroup('Nhân viên', nhanVienPositions)}
                    </>
                  );
                })()}
              </div>

              {/* Right column: permission grid for selected slot */}
              <div className="flex-1 min-w-0">
                {expandedSlot ? (
                  <div className="rounded-xl border-0 bg-white/70 backdrop-blur-sm p-4 shadow-md shadow-indigo-100/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-indigo-900">{getSlotLabel(expandedSlot)}</p>
                          <p className="text-xs text-indigo-500">
                            {level === 'admin'
                              ? 'Đặt trần quyền Zalo cho chức vụ này'
                              : level === 'chuNha'
                                ? expandedSlot.includes('__')
                                  ? 'Cấu hình quyền Zalo cho người này'
                                  : 'Đặt trần quyền Zalo cho chức vụ này'
                                : 'Cấu hình quyền Zalo cho người này'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50">
                        {level === 'admin'
                          ? 'Đặt trần'
                          : expandedSlot.includes('__')
                            ? 'Cá nhân'
                            : 'Hạn chế'}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {ZALO_FEATURES.filter(feature => isZaloFeatureVisible(feature.key, expandedSlot)).map(feature => {
                        const disabledByHigher = isDisabledByHigherLevel(expandedSlot, feature.key);
                        const checked = getEffectiveZaloChecked(expandedSlot, feature.key);
                        return (
                          <div
                            key={feature.key}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all duration-200 ${
                              disabledByHigher
                                ? 'bg-gray-100 border-gray-200 opacity-70'
                                : checked
                                  ? 'bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border-indigo-200 shadow-sm'
                                  : 'bg-white border-indigo-100 hover:border-indigo-200 hover:shadow-sm'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!canEditZalo || disabledByHigher}
                              onCheckedChange={(value) => toggleZaloPermission(expandedSlot, feature.key, value === true)}
                              className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-semibold ${checked ? 'text-indigo-900' : 'text-gray-900'}`}>{feature.label}</p>
                                {disabledByHigher && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-0">
                                    Bị cấp trên tắt
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-xs ${checked ? 'text-indigo-500' : 'text-gray-500'}`}>{feature.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => void saveZaloPermissions()} disabled={!canEditZalo || savingZalo || !selectedBuildingId} size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {savingZalo ? 'Đang lưu...' : 'Lưu quyền Zalo'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center text-sm text-indigo-400">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-indigo-300" />
                    Chọn một chức vụ bên trái
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── Limits Tab ───── */}
      {activeTab === 'limits' && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <SlidersHorizontal className="h-5 w-5 text-white" />
              </div>
            </div>
            {!canEditLimits && <Badge variant="outline" className="shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">Chỉ admin được chỉnh</Badge>}
          </div>

          <div className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left column: global limits + building tree */}
              <div className="w-full lg:w-72 shrink-0 space-y-2">
                {/* Global limits — compact */}
                <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                    <p className="font-bold text-indigo-900 text-sm">Giới hạn chung</p>
                  </div>
                  <div className="space-y-1.5">
                    {(Object.keys(ROLE_LABELS) as RoleKey[]).map(roleKey => (
                      <div key={roleKey} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-indigo-100">
                        <Label className="text-xs font-semibold text-indigo-800 w-20 shrink-0">{ROLE_LABELS[roleKey]}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={globalLimits[roleKey] ?? 0}
                          disabled={!canEditLimits}
                          className="h-7 w-16 text-xs text-center"
                          onChange={(event) => setGlobalLimits(prev => ({ ...prev, [roleKey]: Math.max(0, Number(event.target.value) || 0) }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Building list — tree-style */}
                <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <p className="font-bold text-indigo-900 text-sm">Chọn tòa nhà</p>
                  </div>
                  <div className="space-y-1">
                    {buildings.length === 0 ? (
                      <p className="text-xs text-indigo-400 italic px-1">Không có tòa nhà</p>
                    ) : (
                      buildings.map(b => {
                        const isSelected = selectedBuildingId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBuildingId(isSelected ? '' : b.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-200 text-xs ${
                              isSelected
                                ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-md shadow-indigo-200'
                                : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                          >
                            <Building2 className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                            <span className="truncate">{b.tenToaNha}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: per-building limits */}
              <div className="flex-1 min-w-0">
                {selectedBuildingId ? (
                  <div className="rounded-xl border-0 bg-white/70 backdrop-blur-sm p-4 shadow-md shadow-indigo-100/30">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-indigo-900">
                          Giới hạn riêng — {buildings.find(b => b.id === selectedBuildingId)?.tenToaNha}
                        </p>
                        <p className="text-xs text-indigo-500">Nhập 0 để dùng giới hạn chung</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(Object.keys(ROLE_LABELS) as RoleKey[]).map(roleKey => {
                        const effectiveLimit = selectedLimits[roleKey] ?? globalLimits[roleKey] ?? 0;
                        return (
                          <div key={roleKey} className="rounded-xl border-2 border-indigo-100 bg-white p-3 grid grid-cols-[1fr_100px] gap-3 items-start hover:border-indigo-300 hover:shadow-sm transition-all duration-200">
                            <div>
                              <Label className="text-sm font-semibold text-indigo-900">{ROLE_LABELS[roleKey]}</Label>
                              <p className="text-[11px] text-indigo-500 leading-tight mt-0.5">{ROLE_DESCRIPTIONS[roleKey]}</p>
                              <p className="text-[11px] text-indigo-400">
                                Đang dùng {roleCounts[roleKey]}/{effectiveLimit || 'không giới hạn'} slot.
                              </p>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={selectedLimits[roleKey] ?? 0}
                              disabled={!canEditLimits || !selectedBuildingId}
                              onChange={(event) => setLimitValue(selectedBuildingId, roleKey, Math.max(0, Number(event.target.value) || 0))}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <Separator className="my-4 bg-indigo-100" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-2 text-sm">
                        {canEditLimits ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                        )}
                        <span className="text-xs text-indigo-600">
                          {canEditLimits
                            ? 'Sau khi lưu, màn tạo/sửa tài khoản sẽ dùng giới hạn mới để chặn vượt số lượng.'
                            : 'Bạn có thể xem giới hạn để hiểu vì sao không thêm được người vào một vai trò.'}
                        </span>
                      </div>
                      <Button onClick={() => void saveLimits()} disabled={!canEditLimits || savingLimits || !selectedBuildingId} size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {savingLimits ? 'Đang lưu...' : 'Lưu giới hạn'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center text-sm text-indigo-400">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-indigo-300" />
                    Chọn một tòa nhà bên trái để xem/cấu hình giới hạn
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
