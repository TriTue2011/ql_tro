'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  RefreshCw,
  Save,
  Search,
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getChucVuLabel } from '@/lib/chuc-vu';

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
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân quyền</h1>
          <p className="text-sm text-gray-600">
            Một nơi duy nhất để quản lý quyền nghiệp vụ, quyền Zalo và giới hạn vai trò theo tòa nhà.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadInitialData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tải mới
        </Button>
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,360px)_1fr] md:items-end">
          <div className="space-y-2">
            <Label>Tòa nhà áp dụng</Label>
            <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn tòa nhà" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map(building => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.tenToaNha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {selectedBuilding
              ? `Đang cấu hình quyền cho ${selectedBuilding.tenToaNha}. Các quyền được lưu riêng theo tòa nhà.`
              : 'Chưa có tòa nhà để cấu hình quyền.'}
          </div>
        </div>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 md:w-fit md:grid-cols-3">
          <TabsTrigger value="business">Quyền nghiệp vụ</TabsTrigger>
          <TabsTrigger value="zalo">Quyền Zalo</TabsTrigger>
          <TabsTrigger value="limits">Giới hạn vai trò</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <div className="rounded-md border bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quyền nghiệp vụ của quản lý</h2>
                <p className="text-sm text-gray-600">
                  Các quyền này đang được backend kiểm tra khi quản lý thêm, sửa hoặc xóa dữ liệu nghiệp vụ.
                </p>
              </div>
              <div className="relative md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Tìm tên, email, SĐT, chức vụ"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>

            {!canEditBusiness && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Tài khoản hiện tại chỉ xem quyền nghiệp vụ. Chỉ admin hoặc chủ trọ có thể bật/tắt nhóm quyền này.
              </div>
            )}

            <div className="space-y-3">
              {businessUsers.map(user => {
                const permissions = getPermissionForBuilding(user, selectedBuildingId);
                return (
                  <div key={user.id} className="rounded-md border p-3">
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{user.ten || 'Không có tên'}</span>
                          {user.chucVu && <Badge variant="outline">{getChucVuLabel(user.chucVu)}</Badge>}
                        </div>
                        <p className="text-xs text-gray-500">{user.email || user.soDienThoai || 'Chưa có liên hệ'}</p>
                      </div>
                      <Badge variant="secondary">Quản lý</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {BUSINESS_PERMISSIONS.map(permission => (
                        <div key={permission.key} className="flex gap-3 rounded-md border bg-gray-50 p-3">
                          <Switch
                            checked={permissions[permission.key] === true}
                            disabled={!canEditBusiness || savingBusiness === `${user.id}-${permission.key}`}
                            onCheckedChange={(checked) => void saveBusinessPermission(user, permission.key, checked)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{permission.label}</p>
                            <p className="text-xs leading-5 text-gray-600">{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {businessUsers.length === 0 && (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
                  <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  Không có quản lý nào trong tòa nhà này hoặc không khớp từ khóa tìm kiếm.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="zalo" className="space-y-4">
          <div className="rounded-md border bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quyền tính năng Zalo</h2>
                <p className="text-sm text-gray-600">
                  Quyền Zalo có 3 tầng: admin đặt trần, chủ trọ hạn chế thêm, quản lý chỉ được hạn chế cấp nhân viên.
                </p>
              </div>
              <div className="space-y-2 md:w-72">
                <Label>Vai trò/slot cần cấu hình</Label>
                <Select value={selectedZaloRole} onValueChange={(value) => setSelectedZaloRole(value as RoleKey)}>
                  <SelectTrigger>
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
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Tài khoản hiện tại chỉ xem quyền Zalo, không thể chỉnh sửa.
              </div>
            )}

            <div className="space-y-4">
              {getSlotKeys(selectedZaloRole).map(slotKey => (
                <div key={slotKey} className="rounded-md border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{getSlotLabel(slotKey)}</p>
                      <p className="text-xs text-gray-500">Slot key: {slotKey}</p>
                    </div>
                    <Badge variant="outline">{level === 'admin' ? 'Tầng admin' : level === 'chuNha' ? 'Tầng chủ trọ' : 'Tầng quản lý'}</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {ZALO_FEATURES.filter(feature => isZaloFeatureVisible(feature.key)).map(feature => {
                      const disabledByHigher = isDisabledByHigherLevel(slotKey, feature.key);
                      const checked = getEffectiveZaloChecked(slotKey, feature.key);
                      return (
                        <div key={feature.key} className={`flex gap-3 rounded-md border p-3 ${disabledByHigher ? 'bg-gray-100 opacity-70' : 'bg-gray-50'}`}>
                          <Switch
                            checked={checked}
                            disabled={!canEditZalo || disabledByHigher}
                            onCheckedChange={(value) => toggleZaloPermission(slotKey, feature.key, value)}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{feature.label}</p>
                              {disabledByHigher && <Badge variant="secondary">Bị cấp trên tắt</Badge>}
                            </div>
                            <p className="text-xs leading-5 text-gray-600">{feature.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => void saveZaloPermissions()} disabled={!canEditZalo || savingZalo || !selectedBuildingId}>
                <Save className="mr-2 h-4 w-4" />
                {savingZalo ? 'Đang lưu...' : 'Lưu quyền Zalo'}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <div className="rounded-md border bg-white p-4">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Giới hạn vai trò theo tòa nhà</h2>
                <p className="text-sm text-gray-600">
                  Giới hạn này chặn việc gán quá số lượng chủ trọ, đồng chủ trọ, quản lý hoặc nhân viên trong một tòa nhà.
                </p>
              </div>
              {!canEditLimits && <Badge variant="secondary">Chỉ admin được chỉnh</Badge>}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="mb-3 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-gray-900">Giới hạn chung</p>
                </div>
                <div className="space-y-3">
                  {(Object.keys(ROLE_LABELS) as RoleKey[]).map(roleKey => (
                    <div key={roleKey} className="grid grid-cols-[1fr_96px] gap-3">
                      <div>
                        <Label>{ROLE_LABELS[roleKey]}</Label>
                        <p className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[roleKey]}</p>
                        <p className="text-xs text-gray-500">Mặc định dùng khi tòa nhà không đặt giới hạn riêng.</p>
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

              <div className="rounded-md border p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-gray-900">Giới hạn riêng của tòa đang chọn</p>
                </div>
                <div className="space-y-3">
                  {(Object.keys(ROLE_LABELS) as RoleKey[]).map(roleKey => {
                    const effectiveLimit = selectedLimits[roleKey] ?? globalLimits[roleKey] ?? 0;
                    return (
                      <div key={roleKey} className="grid grid-cols-[1fr_96px] gap-3">
                        <div>
                          <Label>{ROLE_LABELS[roleKey]}</Label>
                          <p className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[roleKey]}</p>
                          <p className="text-xs text-gray-500">
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                {canEditLimits ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />}
                <span>
                  {canEditLimits
                    ? 'Sau khi lưu, màn tạo/sửa tài khoản sẽ dùng giới hạn mới để chặn vượt số lượng.'
                    : 'Bạn có thể xem giới hạn để hiểu vì sao không thêm được người vào một vai trò.'}
                </span>
              </div>
              <Button onClick={() => void saveLimits()} disabled={!canEditLimits || savingLimits || !selectedBuildingId}>
                <Save className="mr-2 h-4 w-4" />
                {savingLimits ? 'Đang lưu...' : 'Lưu giới hạn'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
