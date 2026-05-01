'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getChucVuLabel } from '@/lib/chuc-vu';
import {
  BuildingSelector,
  PageHeader,
  PermissionGrid,
  PermissionToggle,
  PillTabs,
  SearchInput,
} from '@/components/dashboard';

type RoleKey = 'chuNha' | 'dongChuTro' | 'quanLy' | 'nhanVien';
type LevelKey = 'admin' | 'chuNha' | 'quanLy';
type BusinessPermissionKey =
  | 'quyenHopDong'
  | 'quyenHoaDon'
  | 'quyenThanhToan'
  | 'quyenSuCo'
  | 'quyenKichHoatTaiKhoan';
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
  quyenKichHoatTaiKhoan?: boolean;
  quyenHopDong?: boolean;
  quyenHoaDon?: boolean;
  quyenThanhToan?: boolean;
  quyenSuCo?: boolean;
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
  quyenKichHoatTaiKhoan?: boolean;
  quyenHopDong?: boolean;
  quyenHoaDon?: boolean;
  quyenThanhToan?: boolean;
  quyenSuCo?: boolean;
}

type ZaloPermissionMap = Record<string, Record<ZaloFeatureKey, boolean>>;
type ZaloPermsByLevel = Record<LevelKey, ZaloPermissionMap>;

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
  key: BusinessPermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'quyenHopDong',
    label: 'Hợp đồng',
    description: 'Cho phép quản lý thêm, sửa hoặc hủy hợp đồng trong các tòa nhà được gán.',
  },
  {
    key: 'quyenHoaDon',
    label: 'Hóa đơn',
    description: 'Cho phép tạo, sửa, xóa hóa đơn và gửi lại hóa đơn trong phạm vi tòa nhà.',
  },
  {
    key: 'quyenThanhToan',
    label: 'Thanh toán',
    description: 'Cho phép ghi nhận, chỉnh sửa hoặc xóa giao dịch thanh toán của hóa đơn.',
  },
  {
    key: 'quyenSuCo',
    label: 'Sự cố',
    description: 'Cho phép tiếp nhận, cập nhật trạng thái và xử lý sự cố của khách thuê.',
  },
  {
    key: 'quyenKichHoatTaiKhoan',
    label: 'Đăng nhập khách thuê',
    description: 'Cho phép bật, thu hồi hoặc đặt mật khẩu đăng nhập web cho khách thuê.',
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

const ROLE_TARGETS_BY_LEVEL: Record<LevelKey, RoleKey[]> = {
  admin: ['chuNha', 'dongChuTro', 'quanLy', 'nhanVien'],
  chuNha: ['dongChuTro', 'quanLy', 'nhanVien'],
  quanLy: ['nhanVien'],
};

const TAB_ITEMS = [
  { value: 'business', label: 'Quyền nghiệp vụ', icon: Shield },
  { value: 'zalo', label: 'Quyền Zalo', icon: Building2 },
  { value: 'limits', label: 'Giới hạn vai trò', icon: SlidersHorizontal },
] as const;

function getUserRole(user: User): string {
  return user.vaiTro ?? 'nhanVien';
}

function getPermissionForBuilding(user: User, buildingId: string): UserPermissionSet {
  return user.quyenTheoToaNha?.[buildingId] ?? {
    quyenKichHoatTaiKhoan: user.quyenKichHoatTaiKhoan ?? false,
    quyenHopDong: user.quyenHopDong ?? false,
    quyenHoaDon: user.quyenHoaDon ?? false,
    quyenThanhToan: user.quyenThanhToan ?? false,
    quyenSuCo: user.quyenSuCo ?? false,
  };
}

function defaultFeatureSet(): Record<ZaloFeatureKey, boolean> {
  return Object.fromEntries(ZALO_FEATURES.map(feature => [feature.key, true])) as Record<ZaloFeatureKey, boolean>;
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
  const [selectedZaloRole, setSelectedZaloRole] = useState<RoleKey>('quanLy');
  const [searchTerm, setSearchTerm] = useState('');
  const [globalLimits, setGlobalLimits] = useState<Record<RoleKey, number>>(DEFAULT_ROLE_LIMITS);
  const [perBuildingLimits, setPerBuildingLimits] = useState<Record<string, Partial<Record<RoleKey, number>>>>({});
  const [zaloPerms, setZaloPerms] = useState<ZaloPermsByLevel>({ admin: {}, chuNha: {}, quanLy: {} });
  const [canManageZaloPerms, setCanManageZaloPerms] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('business');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [hideBusinessTab, setHideBusinessTab] = useState(false);
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
    const allowedTargets = ROLE_TARGETS_BY_LEVEL[level];
    if (!allowedTargets.includes(selectedZaloRole)) {
      const firstTarget = allowedTargets[0];
      if (firstTarget) setSelectedZaloRole(firstTarget);
    }
  }, [level, selectedZaloRole]);

  const selectedBuilding = buildings.find(building => building.id === selectedBuildingId) ?? null;
  const selectedLimits = perBuildingLimits[selectedBuildingId] ?? {};

  const businessUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return users
      .filter(user => getUserRole(user) === 'quanLy')
      .filter(user => (user.toaNhaIds ?? []).includes(selectedBuildingId))
      .filter(user => {
        if (!keyword) return true;
        const chucVu = getChucVuLabel(user.chucVu).toLowerCase();
        return (
          (user.ten ?? '').toLowerCase().includes(keyword) ||
          (user.email ?? '').toLowerCase().includes(keyword) ||
          (user.soDienThoai ?? '').toLowerCase().includes(keyword) ||
          chucVu.includes(keyword)
        );
      });
  }, [searchTerm, selectedBuildingId, users]);

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

  // Filter tab items: hide business tab when toggled or user can't edit
  const visibleTabs = useMemo(() => {
    if (hideBusinessTab || !canEditBusiness) {
      return TAB_ITEMS.filter(t => t.value !== 'business');
    }
    return [...TAB_ITEMS];
  }, [hideBusinessTab, canEditBusiness]);

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

  async function saveBusinessPermission(user: User, key: BusinessPermissionKey, value: boolean) {
    if (!selectedBuildingId || !canEditBusiness) return;
    const current = getPermissionForBuilding(user, selectedBuildingId);
    const next = { ...current, [key]: value };
    setSavingBusiness(`${user.id}-${key}`);

    setUsers(prev => prev.map(item => {
      if (item.id !== user.id) return item;
      return {
        ...item,
        quyenTheoToaNha: {
          ...(item.quyenTheoToaNha ?? {}),
          [selectedBuildingId]: next,
        },
      };
    }));

    try {
      const res = await fetch(`/api/admin/users/${user.id}/quyen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: selectedBuildingId, ...next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Không thể lưu quyền nghiệp vụ');
        await loadInitialData();
      } else {
        toast.success('Đã lưu quyền nghiệp vụ');
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
      await loadInitialData();
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

  function getSlotKeys(targetRole: RoleKey) {
    const limit = selectedLimits[targetRole] ?? globalLimits[targetRole] ?? 0;
    if (limit <= 1) return [targetRole];
    return Array.from({ length: limit }, (_, i) => `${targetRole}_${i + 1}`);
  }

  function getSlotLabel(slotKey: string) {
    const [roleKey, slot] = slotKey.split('_') as [RoleKey, string | undefined];
    if (!slot) return ROLE_LABELS[roleKey] ?? slotKey;
    const assigned = users.find(user => {
      if (getUserRole(user) !== roleKey) return false;
      if (!(user.toaNhaIds ?? []).includes(selectedBuildingId)) return false;
      return user.zaloViTri?.[selectedBuildingId] === Number(slot);
    });
    return `${ROLE_LABELS[roleKey] ?? roleKey} ${slot}${assigned?.ten ? ` - ${assigned.ten}` : ''}`;
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

  function isZaloFeatureVisible(featureKey: ZaloFeatureKey) {
    if (featureKey !== 'quanLyQuyen') return true;
    return (DIRECT_MANAGE_TARGETS[level] ?? []).includes(selectedZaloRole);
  }

  function getEffectiveZaloChecked(slotKey: string, featureKey: ZaloFeatureKey) {
    const adminVal = zaloPerms.admin?.[slotKey]?.[featureKey] ?? true;
    const chuNhaVal = zaloPerms.chuNha?.[slotKey]?.[featureKey] ?? true;
    const currentVal = zaloPerms[level]?.[slotKey]?.[featureKey] ?? true;
    if (level === 'admin') return currentVal;
    if (level === 'chuNha') return adminVal ? currentVal : false;
    return adminVal && chuNhaVal ? currentVal : false;
  }

  function isDisabledByHigherLevel(slotKey: string, featureKey: ZaloFeatureKey) {
    const adminVal = zaloPerms.admin?.[slotKey]?.[featureKey] ?? true;
    const chuNhaVal = zaloPerms.chuNha?.[slotKey]?.[featureKey] ?? true;
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
        title="Phân quyền"
        description="Một nơi duy nhất để quản lý quyền nghiệp vụ, quyền Zalo và giới hạn vai trò theo tòa nhà."
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

      {/* ───── Business Permissions Tab ───── */}
      {activeTab === 'business' && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Quyền nghiệp vụ của quản lý</h2>
                <p className="text-xs text-gray-500">
                  Các quyền này được backend kiểm tra khi quản lý thêm, sửa hoặc xóa dữ liệu nghiệp vụ.
                </p>
              </div>
              {/* Hide business tab toggle */}
              {canEditBusiness && (
                <button
                  type="button"
                  onClick={() => setHideBusinessTab(prev => !prev)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    hideBusinessTab
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
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
            <SearchInput
              placeholder="Tìm tên, email, SĐT, chức vụ..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>

          {!canEditBusiness && (
            <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Tài khoản hiện tại chỉ xem quyền nghiệp vụ. Chỉ admin hoặc chủ trọ có thể bật/tắt nhóm quyền này.
            </div>
          )}

          <div className="p-4 space-y-2">
            {businessUsers.map(user => {
              const permissions = getPermissionForBuilding(user, selectedBuildingId);
              const isExpanded = expandedUser === user.id;
              return (
                <div key={user.id} className="rounded-lg border border-gray-200 overflow-hidden transition-all">
                  {/* User row — clickable to expand */}
                  <button
                    type="button"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <ChevronRight
                      className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-blue-700">
                          {(user.ten || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {user.ten || 'Không có tên'}
                          </span>
                          {user.chucVu && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                              {getChucVuLabel(user.chucVu)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{user.email || user.soDienThoai || 'Chưa có liên hệ'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">Quản lý</Badge>
                  </button>

                  {/* Expanded permission panel */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50/50 px-4 py-3 space-y-2">
                      {BUSINESS_PERMISSIONS.map(permission => (
                        <div
                          key={permission.key}
                          className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 border border-gray-100"
                        >
                          <PermissionToggle
                            checked={permissions[permission.key] === true}
                            disabled={!canEditBusiness || savingBusiness === `${user.id}-${permission.key}`}
                            onChange={(checked) => void saveBusinessPermission(user, permission.key, checked)}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{permission.label}</p>
                            <p className="text-xs text-gray-500">{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {businessUsers.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
                <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                Không có quản lý nào trong tòa nhà này hoặc không khớp từ khóa tìm kiếm.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───── Zalo Permissions Tab ───── */}
      {activeTab === 'zalo' && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Quyền tính năng Zalo</h2>
              <p className="text-xs text-gray-500">
                Quyền Zalo có 3 tầng: admin đặt trần, chủ trọ hạn chế thêm, quản lý chỉ được hạn chế cấp nhân viên.
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Select value={selectedZaloRole} onValueChange={(value) => setSelectedZaloRole(value as RoleKey)}>
                <SelectTrigger className="rounded-full border-2 border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 data-[state=open]:border-blue-400 data-[state=open]:shadow-md">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_TARGETS_BY_LEVEL[level].map(target => (
                    <SelectItem key={target} value={target}>
                      {ROLE_LABELS[target]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!canEditZalo && (
            <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Tài khoản hiện tại chỉ xem quyền Zalo, không thể chỉnh sửa.
            </div>
          )}

          <div className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left column: slot list */}
              <div className="w-full lg:w-80 shrink-0 space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                  Chọn slot để cấu hình
                </p>
                {getSlotKeys(selectedZaloRole).map(slotKey => {
                  const isSelected = expandedSlot === slotKey;
                  return (
                    <button
                      key={slotKey}
                      type="button"
                      onClick={() => setExpandedSlot(isSelected ? null : slotKey)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-full text-left transition-all duration-200 text-sm ${
                        isSelected
                          ? 'bg-blue-50 border-2 border-blue-300 text-blue-800 font-medium shadow-md'
                          : 'bg-gray-50 border-2 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-500 shadow-sm' : 'bg-gray-300'}`} />
                      <span className="truncate">{getSlotLabel(slotKey)}</span>
                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">{slotKey}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right column: permission grid for selected slot */}
              <div className="flex-1 min-w-0">
                {expandedSlot ? (
                  <div className="rounded-lg border bg-gray-50/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{getSlotLabel(expandedSlot)}</p>
                        <p className="text-xs text-gray-500">
                          {level === 'admin' ? 'Tầng admin' : level === 'chuNha' ? 'Tầng chủ trọ' : 'Tầng quản lý'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {level === 'admin' ? 'Đặt trần' : level === 'chuNha' ? 'Hạn chế' : 'Chi tiết'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {ZALO_FEATURES.filter(feature => isZaloFeatureVisible(feature.key)).map(feature => {
                        const disabledByHigher = isDisabledByHigherLevel(expandedSlot, feature.key);
                        const checked = getEffectiveZaloChecked(expandedSlot, feature.key);
                        return (
                          <div
                            key={feature.key}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                              disabledByHigher
                                ? 'bg-gray-100 border-gray-200 opacity-70'
                                : 'bg-white border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <PermissionToggle
                              checked={checked}
                              disabled={!canEditZalo || disabledByHigher}
                              onChange={(value) => toggleZaloPermission(expandedSlot, feature.key, value)}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{feature.label}</p>
                                {disabledByHigher && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                    Bị cấp trên tắt
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{feature.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => void saveZaloPermissions()} disabled={!canEditZalo || savingZalo || !selectedBuildingId} size="sm">
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {savingZalo ? 'Đang lưu...' : 'Lưu quyền Zalo'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    Chọn một slot bên trái để cấu hình quyền Zalo.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── Limits Tab ───── */}
      {activeTab === 'limits' && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between border-b">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Giới hạn vai trò theo tòa nhà</h2>
              <p className="text-xs text-gray-500">
                Giới hạn này chặn việc gán quá số lượng chủ trọ, đồng chủ trọ, quản lý hoặc nhân viên trong một tòa nhà.
              </p>
            </div>
            {!canEditLimits && <Badge variant="secondary" className="shrink-0">Chỉ admin được chỉnh</Badge>}
          </div>

          <div className="p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Global limits */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-gray-900 text-sm">Giới hạn chung</p>
                </div>
                <div className="space-y-3">
                  {(Object.keys(ROLE_LABELS) as RoleKey[]).map(roleKey => (
                    <div key={roleKey} className="grid grid-cols-[1fr_80px] gap-3 items-start">
                      <div>
                        <Label className="text-sm">{ROLE_LABELS[roleKey]}</Label>
                        <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{ROLE_DESCRIPTIONS[roleKey]}</p>
                        <p className="text-[11px] text-gray-400">Mặc định dùng khi tòa nhà không đặt giới hạn riêng.</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={globalLimits[roleKey] ?? 0}
                        disabled={!canEditLimits}
                        onChange={(event) => setGlobalLimits(prev => ({ ...prev, [roleKey]: Math.max(0, Number(event.target.value) || 0) }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-building limits */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-gray-900 text-sm">Giới hạn riêng của tòa đang chọn</p>
                </div>
                <div className="space-y-3">
                  {(Object.keys(ROLE_LABELS) as RoleKey[]).map(roleKey => {
                    const effectiveLimit = selectedLimits[roleKey] ?? globalLimits[roleKey] ?? 0;
                    return (
                      <div key={roleKey} className="grid grid-cols-[1fr_80px] gap-3 items-start">
                        <div>
                          <Label className="text-sm">{ROLE_LABELS[roleKey]}</Label>
                          <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{ROLE_DESCRIPTIONS[roleKey]}</p>
                          <p className="text-[11px] text-gray-400">
                            Đang dùng {roleCounts[roleKey]}/{effectiveLimit || 'không giới hạn'} slot. Nhập 0 để quay về giới hạn chung.
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
              </div>
            </div>

            <Separator className="my-4" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                {canEditLimits ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span className="text-xs">
                  {canEditLimits
                    ? 'Sau khi lưu, màn tạo/sửa tài khoản sẽ dùng giới hạn mới để chặn vượt số lượng.'
                    : 'Bạn có thể xem giới hạn để hiểu vì sao không thêm được người vào một vai trò.'}
                </span>
              </div>
              <Button onClick={() => void saveLimits()} disabled={!canEditLimits || savingLimits || !selectedBuildingId} size="sm">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {savingLimits ? 'Đang lưu...' : 'Lưu giới hạn'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
