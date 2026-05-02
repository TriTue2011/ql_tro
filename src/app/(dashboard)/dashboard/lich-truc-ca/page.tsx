'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useCanEdit } from '@/hooks/use-can-edit';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Loader2,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/page-header';
import ShiftSchedule from '@/components/dashboard/shift-schedule';
import type { BuildingOption } from '@/components/dashboard/shift-schedule';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Building {
  id: string;
  tenToaNha: string;
}

// ─── Import Preview Types ─────────────────────────────────────────────────────

interface ImportRow {
  row: number;
  nguoiDung?: { id: string; ten: string } | null;
  error?: string;
  shifts: Array<{ ngay: number; ca: string }>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LichTrucCaPage() {
  const { data: session } = useSession();
  const canEdit = useCanEdit();
  const role = session?.user?.role ?? '';

  // Building state
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [loadingBuildings, setLoadingBuildings] = useState(true);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  // ─── Load buildings ─────────────────────────────────────────────────────────

  useEffect(() => {
    document.title = 'Lịch trực ca';
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      setLoadingBuildings(true);
      const res = await fetch('/api/toa-nha');
      const json = await res.json();
      const list = (json.data ?? json ?? []) as Building[];
      setBuildings(list);
      if (list.length > 0) {
        setSelectedBuildingId(list[0].id);
      }
    } catch {
      toast.error('Không thể tải danh sách tòa nhà');
    } finally {
      setLoadingBuildings(false);
    }
  };

  // ─── Building options for ShiftSchedule ─────────────────────────────────────

  const buildingOptions: BuildingOption[] = buildings.map((b) => ({
    id: b.id,
    tenToaNha: b.tenToaNha,
  }));

  // ─── Handle building change ─────────────────────────────────────────────────

  const handleBuildingChange = useCallback((id: string) => {
    setSelectedBuildingId(id);
  }, []);

  // ─── Import handlers ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      previewImport(file);
    }
  };

  const previewImport = async (file: File) => {
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('toaNhaId', selectedBuildingId);

      const res = await fetch('/api/lich-truc-ca/import?preview=true', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setImportData(json.data ?? []);
        if (json.errors && json.errors.length > 0) {
          toast.warning(`${json.errors.length} lỗi trong file import`);
        }
      } else {
        toast.error(json.message ?? 'Không thể đọc file');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setImportLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!importFile) return;
    setImportSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('toaNhaId', selectedBuildingId);

      const res = await fetch('/api/lich-truc-ca/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message ?? 'Đã import thành công');
        setShowImport(false);
        setImportData([]);
        setImportFile(null);
      } else {
        toast.error(json.message ?? 'Import thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setImportSaving(false);
    }
  };

  // ─── Can manage shifts ──────────────────────────────────────────────────────

  const canManageShifts = useCallback(() => {
    if (role === 'admin') return false;
    if (role === 'chuNha' || role === 'dongChuTro') return true;
    if (role === 'quanLy') return canEdit;
    return false;
  }, [role, canEdit]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Lịch trực ca"
        description="Quản lý lịch trực ca cho nhân sự theo tòa nhà"
      >
        {canManageShifts() && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(!showImport)}
              className="rounded-lg border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <Upload className="h-4 w-4 mr-1" />
              Import Excel
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Import panel */}
      {showImport && (
        <div className="rounded-xl border border-indigo-100 bg-white/80 backdrop-blur-sm p-4 shadow-md shadow-indigo-100/20">
          <h3 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import lịch trực ca từ Excel
          </h3>

          <div className="space-y-3">
            {/* File input */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {importLoading && (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500 flex-shrink-0" />
              )}
            </div>

            {/* Format guide */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <p className="font-medium mb-1 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Định dạng file:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Cột định danh: <strong>SĐT</strong> hoặc <strong>Email</strong></li>
                <li>Cột ngày: <strong>1</strong> đến <strong>31</strong></li>
                <li>Giá trị: <strong>C1</strong> (Sáng), <strong>C2</strong> (Chiều), <strong>C3</strong> (Đêm), <strong>HC</strong> (Hành chính), hoặc để trống</li>
                <li>Không tạo tài khoản mới nếu không tìm thấy SĐT/email</li>
              </ul>
            </div>

            {/* Preview */}
            {importData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Xem trước: {importData.length} nhân sự
                  </span>
                  <Button
                    onClick={() => void confirmImport()}
                    disabled={importSaving}
                    size="sm"
                    className="h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 shadow-md shadow-emerald-200"
                  >
                    {importSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    Xác nhận import
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">#</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Nhân sự</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Trạng thái</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Số ca</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.map((row, i) => (
                        <tr key={i} className={row.error ? 'bg-red-50' : 'border-t border-gray-100'}>
                          <td className="px-2 py-1.5 text-gray-400">{row.row}</td>
                          <td className="px-2 py-1.5">
                            {row.nguoiDung ? (
                              <span className="font-medium text-gray-700">{row.nguoiDung.ten}</span>
                            ) : (
                              <span className="text-red-500 flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                {row.error ?? 'Không tìm thấy'}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {row.error ? (
                              <span className="text-red-500">{row.error}</span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Hợp lệ
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-gray-600">{row.shifts.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shift Schedule Component */}
      {loadingBuildings ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="ml-2 text-gray-500">Đang tải dữ liệu...</span>
        </div>
      ) : buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Building2 className="h-12 w-12 mb-3" />
          <p>Chưa có tòa nhà nào. Vui lòng tạo tòa nhà trước.</p>
        </div>
      ) : (
        <ShiftSchedule
          buildings={buildingOptions}
          selectedBuildingId={selectedBuildingId}
          onBuildingChange={handleBuildingChange}
        />
      )}
    </div>
  );
}
