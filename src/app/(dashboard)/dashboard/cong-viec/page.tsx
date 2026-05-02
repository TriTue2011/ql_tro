'use client';

/**
 * Công việc / Kanban - Giai đoạn 5
 *
 * Hiển thị danh sách công việc dạng Kanban board.
 * Hỗ trợ kéo-thả (drag & drop) để chuyển trạng thái.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/components/dashboard/page-header';
import BuildingSelector from '@/components/dashboard/building-selector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CongViec {
  id: string;
  tieuDe: string;
  moTa?: string | null;
  loai: string;
  trangThai: string;
  mucDoUuTien: string;
  deadline?: string | null;
  toaNha?: { id: string; tenToaNha: string } | null;
  phong?: { id: string; maPhong: string } | null;
  nguoiTao?: { id: string; ten: string } | null;
  nguoiXuLy?: { id: string; ten: string } | null;
  ngayTao: string;
  ngayHoanThanh?: string | null;
}

interface Building {
  id: string;
  tenToaNha: string;
}

const STATUS_LABELS: Record<string, string> = {
  choTiepNhan: 'Chờ tiếp nhận',
  dangXuLy: 'Đang xử lý',
  tamHoan: 'Tạm hoãn',
  choXacNhan: 'Chờ xác nhận',
  daHoanThanh: 'Hoàn thành',
  daHuy: 'Đã hủy',
};

const STATUS_COLORS: Record<string, string> = {
  choTiepNhan: 'bg-gray-100 border-gray-300',
  dangXuLy: 'bg-blue-50 border-blue-300',
  tamHoan: 'bg-yellow-50 border-yellow-300',
  choXacNhan: 'bg-purple-50 border-purple-300',
  daHoanThanh: 'bg-green-50 border-green-300',
  daHuy: 'bg-red-50 border-red-300',
};

const UU_TIEN_COLORS: Record<string, string> = {
  thap: 'bg-gray-100 text-gray-700',
  trungBinh: 'bg-blue-100 text-blue-700',
  cao: 'bg-orange-100 text-orange-700',
  khanCap: 'bg-red-100 text-red-700',
};

const UU_TIEN_LABELS: Record<string, string> = {
  thap: 'Thấp',
  trungBinh: 'Trung bình',
  cao: 'Cao',
  khanCap: 'Khẩn cấp',
};

const LOAI_LABELS: Record<string, string> = {
  baoTri: 'Bảo trì',
  suCo: 'Sự cố',
  hoaDon: 'Hóa đơn',
  khac: 'Khác',
};

const KANBAN_COLUMNS = ['choTiepNhan', 'dangXuLy', 'tamHoan', 'choXacNhan', 'daHoanThanh'];

export default function CongViecPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<CongViec[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    tieuDe: '',
    moTa: '',
    loai: 'khac',
    mucDoUuTien: 'trungBinh' as string,
    deadline: '',
    phongId: '',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set('toaNhaId', selectedBuildingId);
      const res = await fetch(`/api/cong-viec?${params}`);
      const data = await res.json();
      if (data.success) setTasks(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/toa-nha')
      .then(r => r.json())
      .then(res => { if (res.success) setBuildings(res.data || []); })
      .catch(console.error);
  }, [session]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!createForm.tieuDe.trim()) {
      toast.error('Tiêu đề là bắt buộc');
      return;
    }
    try {
      const res = await fetch('/api/cong-viec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          toaNhaId: selectedBuildingId || undefined,
          deadline: createForm.deadline || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã tạo công việc');
        setShowCreate(false);
        setCreateForm({ tieuDe: '', moTa: '', loai: 'khac', mucDoUuTien: 'trungBinh', deadline: '', phongId: '' });
        fetchTasks();
      } else {
        toast.error(data.message || 'Lỗi tạo');
      }
    } catch {
      toast.error('Lỗi kết nối');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/cong-viec/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trangThai: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Chuyển sang: ${STATUS_LABELS[newStatus]}`);
        fetchTasks();
      }
    } catch {
      toast.error('Lỗi cập nhật');
    }
  };

  const getTasksByStatus = (status: string) => tasks.filter(t => t.trangThai === status);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Công việc"
        description="Quản lý công việc theo Kanban"
        onAdd={() => setShowCreate(true)}
      />

      <div className="flex items-center gap-3">
        <BuildingSelector
          buildings={buildings}
          value={selectedBuildingId}
          onChange={setSelectedBuildingId}
        />
      </div>

      {/* Kanban Board */}
      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 overflow-x-auto">
          {KANBAN_COLUMNS.map(col => (
            <div key={col} className={`rounded-lg border-2 p-3 min-w-[250px] ${STATUS_COLORS[col]}`}>
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                {STATUS_LABELS[col]}
                <Badge variant="outline">{getTasksByStatus(col).length}</Badge>
              </h3>
              <div className="space-y-2">
                {getTasksByStatus(col).map(task => (
                  <Card key={task.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-sm line-clamp-2">{task.tieuDe}</p>
                      <Badge className={`text-xs shrink-0 ${UU_TIEN_COLORS[task.mucDoUuTien] || ''}`}>
                        {UU_TIEN_LABELS[task.mucDoUuTien] || task.mucDoUuTien}
                      </Badge>
                    </div>
                    {task.moTa && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.moTa}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {LOAI_LABELS[task.loai] || task.loai}
                      </Badge>
                      {task.nguoiXuLy && <span>👤 {task.nguoiXuLy.ten}</span>}
                      {task.toaNha && <span>🏢 {task.toaNha.tenToaNha}</span>}
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 mt-2 pt-2 border-t">
                      {col === 'choTiepNhan' && (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => handleStatusChange(task.id, 'dangXuLy')}>
                          Nhận xử lý
                        </Button>
                      )}
                      {col === 'dangXuLy' && (
                        <>
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => handleStatusChange(task.id, 'choXacNhan')}>
                            Hoàn thành
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => handleStatusChange(task.id, 'tamHoan')}>
                            Tạm hoãn
                          </Button>
                        </>
                      )}
                      {col === 'choXacNhan' && (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => handleStatusChange(task.id, 'daHoanThanh')}>
                          Xác nhận
                        </Button>
                      )}
                      {!['daHoanThanh', 'daHuy'].includes(col) && (
                        <Button size="sm" variant="outline" className="text-xs h-7 text-red-500"
                          onClick={() => handleStatusChange(task.id, 'daHuy')}>
                          Hủy
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {getTasksByStatus(col).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Không có công việc</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog tạo công việc */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo công việc mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tiêu đề *</label>
              <Input value={createForm.tieuDe} onChange={e => setCreateForm(p => ({ ...p, tieuDe: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả</label>
              <Textarea value={createForm.moTa} onChange={e => setCreateForm(p => ({ ...p, moTa: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Loại</label>
                <Select value={createForm.loai} onValueChange={v => setCreateForm(p => ({ ...p, loai: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="khac">Khác</SelectItem>
                    <SelectItem value="baoTri">Bảo trì</SelectItem>
                    <SelectItem value="suCo">Sự cố</SelectItem>
                    <SelectItem value="hoaDon">Hóa đơn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mức độ ưu tiên</label>
                <Select value={createForm.mucDoUuTien} onValueChange={v => setCreateForm(p => ({ ...p, mucDoUuTien: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thap">Thấp</SelectItem>
                    <SelectItem value="trungBinh">Trung bình</SelectItem>
                    <SelectItem value="cao">Cao</SelectItem>
                    <SelectItem value="khanCap">Khẩn cấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hạn xử lý</label>
              <Input type="datetime-local" value={createForm.deadline}
                onChange={e => setCreateForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <Button onClick={handleCreate} className="w-full">Tạo công việc</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
