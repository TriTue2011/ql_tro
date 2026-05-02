'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useCanEdit } from '@/hooks/use-can-edit';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Sunrise,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShiftType = 'C1' | 'C2' | 'C3' | 'HC';

export interface ShiftRecord {
  id: string;
  nguoiDungId: string;
  toaNhaId: string;
  ngay: string;
  ca: ShiftType;
  ghiChu?: string | null;
  nguoiTaoId?: string | null;
  nguoiDung: {
    id: string;
    ten: string;
    chucVu?: string | null;
    vaiTro?: string;
  };
  nguoiTao?: { id: string; ten: string } | null;
}

export interface ShiftUser {
  id: string;
  ten: string;
  chucVu?: string | null;
  vaiTro?: string;
  soDienThoai?: string | null;
  email?: string | null;
}

export interface BuildingOption {
  id: string;
  tenToaNha: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_TYPES: ShiftType[] = ['C1', 'C2', 'C3', 'HC'];

const SHIFT_CONFIG: Record<ShiftType, { label: string; shortLabel: string; time: string; color: string; bgColor: string; borderColor: string; icon: typeof Sun }> = {
  C1: {
    label: 'Sáng',
    shortLabel: 'S',
    time: '06:00-14:00',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    icon: Sunrise,
  },
  C2: {
    label: 'Chiều',
    shortLabel: 'C',
    time: '14:00-22:00',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    icon: Sun,
  },
  C3: {
    label: 'Đêm',
    shortLabel: 'Đ',
    time: '22:00-06:00',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    icon: Moon,
  },
  HC: {
    label: 'Hành chính',
    shortLabel: 'HC',
    time: '08:00-17:00',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    icon: Clock,
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShiftScheduleProps {
  buildings: BuildingOption[];
  selectedBuildingId: string;
  onBuildingChange: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftSchedule({
  buildings,
  selectedBuildingId,
  onBuildingChange,
}: ShiftScheduleProps) {
  const { data: session } = useSession();
  const canEdit = useCanEdit();
  const role = session?.user?.role ?? '';

  // Date state
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  // Data state
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [users, setUsers] = useState<ShiftUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state — lưu các thay đổi cục bộ trước khi save
  const [pendingChanges, setPendingChanges] = useState<Map<string, { nguoiDungId: string; ca: ShiftType; ghiChu?: string }>>(new Map());
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<ShiftType>('C1');

  // Real-time updates
  useRealtimeEvents(['lich-truc-ca'], useCallback(() => {
    fetchShifts();
  }, [currentMonth, currentYear, selectedBuildingId]));

  // ─── Fetch shifts ───────────────────────────────────────────────────────────

  const fetchShifts = useCallback(async () => {
    if (!selectedBuildingId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        thang: String(currentMonth),
        nam: String(currentYear),
        toaNhaId: selectedBuildingId,
      });
      const res = await fetch(`/api/lich-truc-ca?${params}`);
      const json = await res.json();
      if (json.success) {
        setShifts(json.data ?? []);
        setUsers(json.users ?? []);
      } else {
        toast.error(json.message ?? 'Không thể tải lịch trực ca');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear, selectedBuildingId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // ─── Month navigation ───────────────────────────────────────────────────────

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setPendingChanges(new Map());
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setPendingChanges(new Map());
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth() + 1);
    setCurrentYear(today.getFullYear());
    setPendingChanges(new Map());
  };

  // ─── Days in month ──────────────────────────────────────────────────────────

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate();
  }, [currentMonth, currentYear]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth - 1, 1).getDay(); // 0=Sun
  }, [currentMonth, currentYear]);

  const monthLabel = useMemo(() => {
    const months = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
    ];
    return `${months[currentMonth - 1]} ${currentYear}`;
  }, [currentMonth, currentYear]);

  // ─── Get shift for a specific user + day ────────────────────────────────────

  const getShiftForDay = (userId: string, day: number): ShiftRecord | undefined => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.find((s) => {
      const sDate = s.ngay.slice(0, 10);
      return s.nguoiDungId === userId && sDate === dateStr;
    });
  };

  // ─── Get pending change for a day ───────────────────────────────────────────

  const getPendingForDay = (day: number): { nguoiDungId: string; ca: ShiftType; ghiChu?: string } | undefined => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return pendingChanges.get(dateStr);
  };

  // ─── Assign shift to a day ──────────────────────────────────────────────────

  const assignShift = (day: number) => {
    if (!selectedUser || !selectedShift) return;
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const newPending = new Map(pendingChanges);
    newPending.set(dateStr, { nguoiDungId: selectedUser, ca: selectedShift });
    setPendingChanges(newPending);
  };

  // ─── Remove shift from a day ────────────────────────────────────────────────

  const removeShift = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existingShift = shifts.find((s) => {
      const sDate = s.ngay.slice(0, 10);
      return sDate === dateStr && s.nguoiDungId === selectedUser;
    });

    if (existingShift) {
      // Delete from server
      fetch(`/api/lich-truc-ca/${existingShift.id}`, { method: 'DELETE' })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            toast.success('Đã xóa lịch trực ca');
            fetchShifts();
          } else {
            toast.error(json.message ?? 'Không thể xóa');
          }
        })
        .catch(() => toast.error('Lỗi kết nối server'));
    } else {
      // Remove from pending
      const newPending = new Map(pendingChanges);
      newPending.delete(dateStr);
      setPendingChanges(newPending);
    }
  };

  // ─── Save all pending changes ───────────────────────────────────────────────

  const saveAllChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info('Không có thay đổi nào để lưu');
      return;
    }

    setSaving(true);
    try {
      const shiftsToSave = Array.from(pendingChanges.entries()).map(([dateStr, change]) => ({
        nguoiDungId: change.nguoiDungId,
        ngay: dateStr,
        ca: change.ca,
        ghiChu: change.ghiChu,
      }));

      const res = await fetch('/api/lich-truc-ca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toaNhaId: selectedBuildingId, shifts: shiftsToSave }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message ?? 'Đã lưu thành công');
        setPendingChanges(new Map());
        fetchShifts();
      } else {
        toast.error(json.message ?? 'Không thể lưu');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  // ─── Get user's shifts for a specific day ───────────────────────────────────

  const getUserShiftForDay = (userId: string, day: number): ShiftRecord | undefined => {
    return getShiftForDay(userId, day);
  };

  // ─── Check if a day has a pending change ────────────────────────────────────

  const isDayPending = (day: number): boolean => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return pendingChanges.has(dateStr);
  };

  // ─── Render shift badge ─────────────────────────────────────────────────────

  const renderShiftBadge = (ca: ShiftType, compact = false) => {
    const config = SHIFT_CONFIG[ca];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
          config.bgColor,
          config.borderColor,
          config.color,
        )}
      >
        <Icon className="h-3 w-3" />
        {compact ? config.shortLabel : config.label}
      </span>
    );
  };

  // ─── Day cell ───────────────────────────────────────────────────────────────

  const renderDayCell = (day: number) => {
    const date = new Date(currentYear, currentMonth - 1, day);
    const isToday = date.toDateString() === now.toDateString();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Get shifts for this day (grouped by user)
    const dayShifts = shifts.filter((s) => {
      const sDate = s.ngay.slice(0, 10);
      const targetDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return sDate === targetDate;
    });

    const pending = getPendingForDay(day);

    return (
      <div
        key={day}
        className={cn(
          'relative min-h-[100px] rounded-lg border p-2 transition-all duration-150',
          isToday ? 'border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-200' : 'border-gray-200 bg-white',
          isWeekend && !isToday ? 'bg-gray-50' : '',
          pending ? 'border-dashed border-amber-400 bg-amber-50/50' : '',
        )}
      >
        {/* Day number */}
        <div className="flex items-center justify-between mb-1">
          <span
            className={cn(
              'text-sm font-semibold',
              isToday ? 'text-indigo-600' : isWeekend ? 'text-red-400' : 'text-gray-700',
            )}
          >
            {day}
          </span>
          {pending && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
              Mới
            </span>
          )}
        </div>

        {/* Shifts */}
        <div className="space-y-1">
          {dayShifts.map((shift) => (
            <div
              key={shift.id}
              className="flex items-center gap-1 text-xs"
            >
              {renderShiftBadge(shift.ca as ShiftType, true)}
              <span className="truncate text-gray-600 flex-1 min-w-0">
                {shift.nguoiDung.ten}
              </span>
              {canEdit && (
                <button
                  onClick={() => {
                    setSelectedUser(shift.nguoiDungId);
                    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const newPending = new Map(pendingChanges);
                    newPending.delete(dateStr);
                    setPendingChanges(newPending);
                    fetch(`/api/lich-truc-ca/${shift.id}`, { method: 'DELETE' })
                      .then((r) => r.json())
                      .then((j) => {
                        if (j.success) {
                          toast.success('Đã xóa');
                          fetchShifts();
                        }
                      });
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Xóa ca trực"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Pending shift */}
          {pending && (
            <div className="flex items-center gap-1 text-xs opacity-70">
              {renderShiftBadge(pending.ca, true)}
              <span className="truncate text-amber-700 flex-1 min-w-0">
                {users.find((u) => u.id === pending.nguoiDungId)?.ten ?? '???'}
              </span>
            </div>
          )}
        </div>

        {/* Add shift button (only if canEdit and user selected) */}
        {canEdit && selectedUser && (
          <button
            onClick={() => assignShift(day)}
            className={cn(
              'mt-1 w-full rounded py-0.5 text-[10px] font-medium transition-all',
              isDayPending(day)
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-gray-100 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600',
            )}
          >
            {isDayPending(day) ? 'Sửa' : `+ ${SHIFT_CONFIG[selectedShift]?.shortLabel ?? selectedShift}`}
          </button>
        )}
      </div>
    );
  };

  // ─── Calendar grid ──────────────────────────────────────────────────────────

  const renderCalendar = () => {
    const cells: React.ReactNode[] = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(
        <div key={`empty-${i}`} className="min-h-[100px] rounded-lg border border-dashed border-gray-100 bg-gray-50/50" />
      );
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(renderDayCell(day));
    }

    return cells;
  };

  // ─── Can manage shifts ──────────────────────────────────────────────────────

  const canManageShifts = useMemo(() => {
    if (role === 'admin') return false;
    if (role === 'chuNha' || role === 'dongChuTro') return true;
    if (role === 'quanLy') return canEdit;
    return false;
  }, [role, canEdit]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white/70 backdrop-blur-sm p-3 shadow-sm border border-gray-100">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={prevMonth}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={goToToday}
            className="h-8 px-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            {monthLabel}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Building selector */}
          <Select value={selectedBuildingId} onValueChange={onBuildingChange}>
            <SelectTrigger className="w-44 h-8 text-sm rounded-lg bg-white">
              <SelectValue placeholder="Chọn tòa nhà" />
            </SelectTrigger>
            <SelectContent>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.tenToaNha}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User selector (only when canManageShifts) */}
          {canManageShifts && (
            <>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-40 h-8 text-sm rounded-lg bg-white">
                  <Users className="h-3.5 w-3.5 mr-1 text-gray-400" />
                  <SelectValue placeholder="Chọn người" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.ten}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Shift type selector */}
              <Select value={selectedShift} onValueChange={(v) => setSelectedShift(v as ShiftType)}>
                <SelectTrigger className="w-32 h-8 text-sm rounded-lg bg-white">
                  <SelectValue placeholder="Chọn ca" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((ca) => {
                    const config = SHIFT_CONFIG[ca];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={ca} value={ca}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Save button */}
              <Button
                onClick={() => void saveAllChanges()}
                disabled={saving || pendingChanges.size === 0}
                size="sm"
                className="h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Lưu{pendingChanges.size > 0 ? ` (${pendingChanges.size})` : ''}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Sunrise className="h-3 w-3 text-amber-600" />
          Sáng (06-14)
        </span>
        <span className="flex items-center gap-1">
          <Sun className="h-3 w-3 text-orange-600" />
          Chiều (14-22)
        </span>
        <span className="flex items-center gap-1">
          <Moon className="h-3 w-3 text-indigo-600" />
          Đêm (22-06)
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-emerald-600" />
          HC (08-17)
        </span>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="ml-2 text-gray-500">Đang tải lịch trực ca...</span>
        </div>
      ) : !selectedBuildingId ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <CalendarDays className="h-12 w-12 mb-3" />
          <p>Vui lòng chọn tòa nhà để xem lịch trực ca</p>
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-1">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
              <div
                key={d}
                className={cn(
                  'text-center text-xs font-semibold py-1 rounded',
                  i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500',
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {renderCalendar()}
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4 text-indigo-500" />
              <span className="font-medium">Tổng quan tháng:</span>
              {SHIFT_TYPES.map((ca) => {
                const count = shifts.filter((s) => s.ca === ca).length;
                const config = SHIFT_CONFIG[ca];
                const Icon = config.icon;
                return (
                  <span key={ca} className="flex items-center gap-1 ml-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span>
                      {config.label}: <strong>{count}</strong>
                    </span>
                  </span>
                );
              })}
              <span className="ml-2 text-gray-400">
                | Tổng: <strong>{shifts.length}</strong> ca
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
