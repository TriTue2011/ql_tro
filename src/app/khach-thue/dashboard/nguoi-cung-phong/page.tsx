'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Users, Plus, Edit, User, Phone, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: string;
  hoTen: string;
  soDienThoai: string;
  ngaySinh: string;
  gioiTinh: string;
  cccd: string;
  queQuan: string;
  ngheNghiep?: string;
  trangThai: string;
  coTaiKhoan: boolean;
  thieuAnhCCCD: boolean;
}

interface Data {
  members: Member[];
  isDaiDien: boolean;
  hopDongId: string | null;
}

const emptyForm = {
  hoTen: '', soDienThoai: '', cccd: '', ngaySinh: '',
  gioiTinh: 'nam', queQuan: '', ngheNghiep: '',
  anhCCCDMatTruoc: '', anhCCCDMatSau: '',
};

function calcAge(ngaySinh: string) {
  return Math.floor((Date.now() - new Date(ngaySinh).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function NguoiCungPhongPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCCCD, setUploadingCCCD] = useState<'truoc' | 'sau' | null>(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ hoTen: '', queQuan: '', ngheNghiep: '', gioiTinh: 'nam' });

  const fetchData = () => {
    fetch('/api/auth/khach-thue/nguoi-cung-phong')
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
        else toast.error('Không thể tải dữ liệu');
      })
      .catch(() => toast.error('Có lỗi xảy ra'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const uploadCCCD = async (file: File, side: 'truoc' | 'sau') => {
    setUploadingCCCD(side);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const result = await res.json();
      if (result.secure_url) {
        setAddForm(f => side === 'truoc'
          ? { ...f, anhCCCDMatTruoc: result.secure_url }
          : { ...f, anhCCCDMatSau: result.secure_url }
        );
      } else {
        toast.error('Upload ảnh thất bại');
      }
    } catch {
      toast.error('Lỗi upload ảnh');
    } finally {
      setUploadingCCCD(null);
    }
  };

  const handleAdd = async () => {
    if (!addForm.hoTen.trim() || !addForm.ngaySinh || !addForm.gioiTinh || !addForm.queQuan.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const age = calcAge(addForm.ngaySinh);
    if (age < 0 || age > 120) {
      toast.error('Ngày sinh không hợp lệ');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/khach-thue/nguoi-cung-phong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          anhCCCD: (addForm.anhCCCDMatTruoc || addForm.anhCCCDMatSau)
            ? { matTruoc: addForm.anhCCCDMatTruoc || null, matSau: addForm.anhCCCDMatSau || null }
            : undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || 'Thêm thành viên thành công');
        setShowAdd(false);
        setAddForm(emptyForm);
        fetchData();
      } else {
        toast.error(result.message || 'Không thể thêm thành viên');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (m: Member) => {
    setEditTarget(m);
    setEditForm({ hoTen: m.hoTen, queQuan: m.queQuan, ngheNghiep: m.ngheNghiep || '', gioiTinh: m.gioiTinh });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/khach-thue/nguoi-cung-phong', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id, ...editForm }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Cập nhật thành công');
        setShowEdit(false);
        fetchData();
      } else {
        toast.error(result.message || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Người cùng phòng</h1>
          <p className="text-gray-600 text-sm">Danh sách thành viên trong hợp đồng thuê</p>
        </div>
        {data?.isDaiDien && data.hopDongId && (
          <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Thêm thành viên
          </Button>
        )}
      </div>

      {!data?.hopDongId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users className="h-12 w-12 mb-3 opacity-30" />
            <p>Bạn chưa có hợp đồng đang hoạt động</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {!data.isDaiDien && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Chỉ người đứng hợp đồng mới có thể thêm hoặc sửa thông tin thành viên.</span>
            </div>
          )}

          <div className="grid gap-4">
            {data.members.map(m => {
              const age = calcAge(m.ngaySinh);
              const isUnder18 = age < 18;
              return (
                <Card key={m.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{m.hoTen}</p>
                            {isUnder18 && (
                              <Badge variant="outline" className="text-xs">Trẻ em</Badge>
                            )}
                            {m.coTaiKhoan ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">Có tài khoản</Badge>
                            ) : isUnder18 ? (
                              <Badge variant="secondary" className="text-xs">Không cấp TK</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Chờ phê duyệt TK</Badge>
                            )}
                            {m.thieuAnhCCCD && (
                              <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                Thiếu ảnh CCCD
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {m.soDienThoai.startsWith('PENDING_') ? 'Chưa có SĐT' : m.soDienThoai}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {fmtDate(m.ngaySinh)} ({age} tuổi) · {m.gioiTinh === 'nam' ? 'Nam' : m.gioiTinh === 'nu' ? 'Nữ' : 'Khác'}
                          </p>
                          {m.queQuan && <p className="text-sm text-muted-foreground">Quê quán: {m.queQuan}</p>}
                          {m.ngheNghiep && <p className="text-sm text-muted-foreground">Nghề nghiệp: {m.ngheNghiep}</p>}
                        </div>
                      </div>
                      {data.isDaiDien && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Sửa
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {data.isDaiDien && (
            <p className="text-xs text-muted-foreground">
              * Việc cấp tài khoản đăng nhập cho thành viên 18+ cần được quản lý hoặc chủ trọ phê duyệt.
              Trẻ em dưới 18 tuổi không được cấp tài khoản kể cả có số điện thoại.
            </p>
          )}
        </>
      )}

      {/* Dialog thêm thành viên */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm người cùng phòng</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Họ tên *</Label>
              <Input value={addForm.hoTen} onChange={e => setAddForm(f => ({ ...f, hoTen: e.target.value }))} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ngày sinh *</Label>
                <Input type="date" value={addForm.ngaySinh} onChange={e => setAddForm(f => ({ ...f, ngaySinh: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Giới tính *</Label>
                <Select value={addForm.gioiTinh} onValueChange={v => setAddForm(f => ({ ...f, gioiTinh: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nam">Nam</SelectItem>
                    <SelectItem value="nu">Nữ</SelectItem>
                    <SelectItem value="khac">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {addForm.ngaySinh && calcAge(addForm.ngaySinh) < 18 && (
              <p className="text-xs text-orange-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Trẻ em dưới 18 tuổi sẽ không được cấp tài khoản đăng nhập.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Quê quán *</Label>
              <Input value={addForm.queQuan} onChange={e => setAddForm(f => ({ ...f, queQuan: e.target.value }))} placeholder="Hà Nội" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Số điện thoại</Label>
                <Input value={addForm.soDienThoai} onChange={e => setAddForm(f => ({ ...f, soDienThoai: e.target.value }))} placeholder="0912..." />
              </div>
              <div className="space-y-1.5">
                <Label>CCCD</Label>
                <Input value={addForm.cccd} onChange={e => setAddForm(f => ({ ...f, cccd: e.target.value }))} placeholder="0123..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nghề nghiệp</Label>
              <Input value={addForm.ngheNghiep} onChange={e => setAddForm(f => ({ ...f, ngheNghiep: e.target.value }))} placeholder="Sinh viên..." />
            </div>
            <div className="space-y-1.5">
              <Label>Ảnh CCCD mặt trước</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" disabled={uploadingCCCD === 'truoc'} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCCCD(f, 'truoc'); }} className="flex-1" />
                {uploadingCCCD === 'truoc' && <span className="text-xs text-gray-400">Đang tải...</span>}
                {addForm.anhCCCDMatTruoc && <span className="text-xs text-green-600">✓ Đã tải</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ảnh CCCD mặt sau</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" disabled={uploadingCCCD === 'sau'} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCCCD(f, 'sau'); }} className="flex-1" />
                {uploadingCCCD === 'sau' && <span className="text-xs text-gray-400">Đang tải...</span>}
                {addForm.anhCCCDMatSau && <span className="text-xs text-green-600">✓ Đã tải</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Hủy</Button>
            <Button onClick={handleAdd} disabled={submitting || uploadingCCCD !== null}>
              {submitting ? 'Đang thêm...' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa thành viên */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin — {editTarget?.hoTen}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Họ tên</Label>
              <Input value={editForm.hoTen} onChange={e => setEditForm(f => ({ ...f, hoTen: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Giới tính</Label>
              <Select value={editForm.gioiTinh} onValueChange={v => setEditForm(f => ({ ...f, gioiTinh: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nam">Nam</SelectItem>
                  <SelectItem value="nu">Nữ</SelectItem>
                  <SelectItem value="khac">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quê quán</Label>
              <Input value={editForm.queQuan} onChange={e => setEditForm(f => ({ ...f, queQuan: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nghề nghiệp</Label>
              <Input value={editForm.ngheNghiep} onChange={e => setEditForm(f => ({ ...f, ngheNghiep: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Hủy</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
