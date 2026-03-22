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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { CCCDUpload } from '@/components/ui/cccd-upload';
import {
  User, Users, Lock, Bell, Plus, Edit, Phone, AlertCircle,
  Clock, CheckCircle2, XCircle, Upload, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── types ─────────────────────────────────────── */
interface KhachThue {
  id: string;
  hoTen: string;
  soDienThoai: string;
  email?: string;
  cccd: string;
  ngaySinh: string;
  gioiTinh: string;
  queQuan: string;
  ngheNghiep?: string;
  anhCCCD?: { matTruoc: string; matSau: string } | null;
  nhanThongBaoZalo: boolean;
}

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
}

interface YeuCau {
  id: string;
  loai: string;
  noiDung: any;
  trangThai: string;
  ghiChuPheDuyet?: string;
  ngayTao: string;
  nguoiPheDuyet?: { ten: string };
}

function calcAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000));
}

const yeuCauTrangThaiMap: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
  choPheduyet: { label: 'Chờ duyệt', icon: <Clock className="h-3 w-3" />, class: 'bg-yellow-100 text-yellow-700' },
  daPheduyet: { label: 'Đã duyệt', icon: <CheckCircle2 className="h-3 w-3" />, class: 'bg-green-100 text-green-700' },
  tuChoi: { label: 'Từ chối', icon: <XCircle className="h-3 w-3" />, class: 'bg-red-100 text-red-700' },
};

const loaiLabel: Record<string, string> = {
  thongTin: 'Thông tin cá nhân', anhCCCD: 'Ảnh CCCD',
  nguoiCungPhong: 'Người cùng phòng', thongBao: 'Cài đặt thông báo',
};

/* ─── helpers ────────────────────────────────────── */
function DiffRow({ label, truoc, sau }: { label: string; truoc?: string; sau?: string }) {
  if (!truoc && !sau) return null;
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      {truoc && <span className="line-through text-red-500 mr-1">{truoc}</span>}
      {sau && <span className="text-green-600">{sau}</span>}
    </div>
  );
}

/* ─── main component ─────────────────────────────── */
export default function CaiDatPage() {
  const [loading, setLoading] = useState(true);
  const [kt, setKt] = useState<KhachThue | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isDaiDien, setIsDaiDien] = useState(false);
  const [hopDongId, setHopDongId] = useState<string | null>(null);
  const [yeuCaus, setYeuCaus] = useState<YeuCau[]>([]);

  // forms
  const [infoForm, setInfoForm] = useState({ hoTen: '', soDienThoai: '', email: '', cccd: '', queQuan: '', ngheNghiep: '', gioiTinh: 'nam' });
  const [anhCCCD, setAnhCCCD] = useState({ matTruoc: '', matSau: '' });
  const [pwForm, setPwForm] = useState({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
  const [zaloOn, setZaloOn] = useState(false);
  const [zaloHoaDon, setZaloHoaDon] = useState(true);
  const [zaloSuCo, setZaloSuCo] = useState(true);
  const [zaloHopDong, setZaloHopDong] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // dialog thêm/sửa thành viên
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const emptyAdd = { hoTen: '', soDienThoai: '', cccd: '', ngaySinh: '', gioiTinh: 'nam', queQuan: '', ngheNghiep: '' };
  const [addForm, setAddForm] = useState(emptyAdd);
  const [addCCCD, setAddCCCD] = useState({ matTruoc: '', matSau: '' });
  const [uploadingCCCD, setUploadingCCCD] = useState<'truoc' | 'sau' | null>(null);
  const [editForm, setEditForm] = useState({ hoTen: '', queQuan: '', ngheNghiep: '', gioiTinh: 'nam' });

  /* fetch all data */
  const fetchAll = async () => {
    const [meRes, membersRes, yeuCauRes] = await Promise.all([
      fetch('/api/auth/khach-thue/me').then(r => r.json()),
      fetch('/api/auth/khach-thue/nguoi-cung-phong').then(r => r.json()),
      fetch('/api/auth/khach-thue/yeu-cau').then(r => r.json()),
    ]);

    if (meRes.success) {
      const d = meRes.data.khachThue;
      setKt(d);
      setInfoForm({ hoTen: d.hoTen, soDienThoai: d.soDienThoai || '', email: d.email || '', cccd: d.cccd || '', queQuan: d.queQuan, ngheNghiep: d.ngheNghiep || '', gioiTinh: d.gioiTinh });
      const cccd = d.anhCCCD as { matTruoc?: string; matSau?: string } | null;
      setAnhCCCD({ matTruoc: cccd?.matTruoc || '', matSau: cccd?.matSau || '' });
      setZaloOn(d.nhanThongBaoZalo);
      const cfg = d.thongBaoConfig as { hoaDon?: boolean; suCo?: boolean; hopDong?: boolean } | null;
      if (cfg) {
        setZaloHoaDon(cfg.hoaDon !== false);
        setZaloSuCo(cfg.suCo !== false);
        setZaloHopDong(cfg.hopDong !== false);
      }
    }
    if (membersRes.success) {
      setMembers(membersRes.data.members);
      setIsDaiDien(membersRes.data.isDaiDien);
      setHopDongId(membersRes.data.hopDongId);
    }
    if (yeuCauRes.success) setYeuCaus(yeuCauRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  /* tạo yêu cầu thay đổi */
  const submitYeuCau = async (loai: string, sau: object, truoc?: object) => {
    setSaving(loai);
    try {
      const res = await fetch('/api/auth/khach-thue/yeu-cau', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loai, noiDung: { truoc: truoc ?? {}, sau, moTa: '' } }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || 'Đã gửi yêu cầu. Đang chờ duyệt.');
        await fetchAll();
      } else {
        toast.error(result.message || 'Gửi yêu cầu thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSaving(null);
    }
  };

  /* Đổi mật khẩu — áp dụng ngay, không cần duyệt */
  const handleChangePassword = async () => {
    if (!pwForm.matKhauMoi) { toast.error('Vui lòng nhập mật khẩu mới'); return; }
    if (pwForm.matKhauMoi.length < 6) { toast.error('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    if (pwForm.matKhauMoi !== pwForm.xacNhan) { toast.error('Mật khẩu xác nhận không khớp'); return; }
    setSaving('matkhau');
    try {
      const res = await fetch('/api/auth/khach-thue/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matKhauCu: pwForm.matKhauCu, matKhauMoi: pwForm.matKhauMoi }),
      });
      const r = await res.json();
      if (r.success) { toast.success(r.message); setPwForm({ matKhauCu: '', matKhauMoi: '', xacNhan: '' }); }
      else toast.error(r.message || 'Đổi mật khẩu thất bại');
    } catch { toast.error('Có lỗi xảy ra'); }
    finally { setSaving(null); }
  };

  /* Upload ảnh CCCD cho thành viên mới */
  const handleUploadMemberCCCD = async (file: File, side: 'truoc' | 'sau') => {
    setUploadingCCCD(side);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const result = await res.json();
      const url = result.data?.secure_url;
      if (url) {
        setAddCCCD(prev => side === 'truoc' ? { ...prev, matTruoc: url } : { ...prev, matSau: url });
        toast.success(`Upload ảnh CCCD ${side === 'truoc' ? 'mặt trước' : 'mặt sau'} thành công`);
      } else {
        toast.error(result.message || 'Upload ảnh thất bại');
      }
    } catch {
      toast.error('Lỗi upload ảnh');
    } finally {
      setUploadingCCCD(null);
    }
  };

  /* Thêm thành viên */
  const handleAddMember = async () => {
    if (!addForm.hoTen || !addForm.ngaySinh || !addForm.queQuan) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc'); return;
    }
    const age = calcAge(addForm.ngaySinh);
    await submitYeuCau('nguoiCungPhong', {
      action: 'them',
      hopDongId,
      thanhVien: {
        ...addForm,
        anhCCCD: (addCCCD.matTruoc || addCCCD.matSau)
          ? { matTruoc: addCCCD.matTruoc || null, matSau: addCCCD.matSau || null }
          : undefined,
      },
      isUnder18: age < 18,
    });
    setShowAdd(false);
    setAddForm(emptyAdd);
    setAddCCCD({ matTruoc: '', matSau: '' });
  };

  /* Sửa thành viên */
  const handleEditMember = async () => {
    if (!editTarget) return;
    await submitYeuCau('nguoiCungPhong', {
      action: 'sua',
      thanhVienId: editTarget.id,
      ...editForm,
    });
    setShowEdit(false);
  };

  const openEdit = (m: Member) => {
    setEditTarget(m);
    setEditForm({ hoTen: m.hoTen, queQuan: m.queQuan, ngheNghiep: m.ngheNghiep || '', gioiTinh: m.gioiTinh });
    setShowEdit(true);
  };

  const pendingByLoai = (loai: string) => yeuCaus.find(y => y.loai === loai && y.trangThai === 'choPheduyet');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-gray-600 text-sm">Quản lý thông tin, bảo mật và thông báo</p>
      </div>

      {/* Yêu cầu đang chờ */}
      {yeuCaus.filter(y => y.trangThai === 'choPheduyet').length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800 flex items-start gap-2">
          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Bạn có {yeuCaus.filter(y => y.trangThai === 'choPheduyet').length} yêu cầu thay đổi đang chờ quản lý phê duyệt.</span>
        </div>
      )}

      <Tabs defaultValue="thongtin">
        <TabsList className={`grid w-full ${isDaiDien ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="thongtin" className="flex items-center gap-1 text-xs sm:text-sm">
            <User className="h-3.5 w-3.5" /><span className="hidden sm:inline">Thông tin</span>
            {pendingByLoai('thongTin') && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />}
          </TabsTrigger>
          {isDaiDien && (
            <TabsTrigger value="nguoiphong" className="flex items-center gap-1 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5" /><span className="hidden sm:inline">Cùng phòng</span>
              {pendingByLoai('nguoiCungPhong') && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />}
            </TabsTrigger>
          )}
          <TabsTrigger value="baomat" className="flex items-center gap-1 text-xs sm:text-sm">
            <Lock className="h-3.5 w-3.5" /><span className="hidden sm:inline">Bảo mật</span>
          </TabsTrigger>
          <TabsTrigger value="thongbao" className="flex items-center gap-1 text-xs sm:text-sm">
            <Bell className="h-3.5 w-3.5" /><span className="hidden sm:inline">Thông báo</span>
            {pendingByLoai('thongBao') && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Thông tin ── */}
        <TabsContent value="thongtin" className="space-y-4">
          {pendingByLoai('thongTin') && (
            <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Có yêu cầu thay đổi thông tin đang chờ duyệt
            </div>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Thông tin cá nhân</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Họ tên</Label>
                  <Input value={infoForm.hoTen} onChange={e => setInfoForm(f => ({ ...f, hoTen: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    Số điện thoại
                    <span className="text-xs text-blue-500 font-normal">(= tài khoản đăng nhập)</span>
                  </Label>
                  <Input
                    type="tel"
                    value={infoForm.soDienThoai}
                    onChange={e => setInfoForm(f => ({ ...f, soDienThoai: e.target.value }))}
                    placeholder="0912345678"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>CCCD</Label>
                  <Input
                    value={infoForm.cccd}
                    onChange={e => setInfoForm(f => ({ ...f, cccd: e.target.value }))}
                    placeholder="012345678901"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày sinh</Label>
                  <Input value={kt?.ngaySinh ? new Date(kt.ngaySinh).toLocaleDateString('vi-VN') : ''} disabled className="bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <Label>Giới tính</Label>
                  <Select value={infoForm.gioiTinh} onValueChange={v => setInfoForm(f => ({ ...f, gioiTinh: v }))}>
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
                  <Input value={infoForm.queQuan} onChange={e => setInfoForm(f => ({ ...f, queQuan: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nghề nghiệp</Label>
                  <Input value={infoForm.ngheNghiep} onChange={e => setInfoForm(f => ({ ...f, ngheNghiep: e.target.value }))} placeholder="Sinh viên, Kỹ sư..." />
                </div>
              </div>
              {(infoForm.soDienThoai !== kt?.soDienThoai || infoForm.email !== (kt?.email || '')) && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-700 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    {infoForm.soDienThoai !== kt?.soDienThoai
                      ? 'Thay đổi số điện thoại sẽ cập nhật tài khoản đăng nhập của bạn.'
                      : 'Thay đổi email sẽ được cập nhật vào hồ sơ của bạn.'}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">* Thay đổi sẽ được gửi cho quản lý/chủ trọ xem xét trước khi áp dụng.</p>
              <div className="flex justify-end">
                <Button
                  onClick={() => submitYeuCau('thongTin', infoForm, {
                    hoTen: kt?.hoTen, soDienThoai: kt?.soDienThoai, email: kt?.email,
                    cccd: kt?.cccd, queQuan: kt?.queQuan, ngheNghiep: kt?.ngheNghiep, gioiTinh: kt?.gioiTinh,
                  })}
                  disabled={saving === 'thongTin'}
                >
                  {saving === 'thongTin' ? 'Đang gửi...' : 'Gửi yêu cầu thay đổi'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ảnh CCCD */}
          <Card>
            <CardHeader><CardTitle className="text-base">Ảnh CCCD</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {pendingByLoai('anhCCCD') && (
                <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Ảnh CCCD mới đang chờ quản lý phê duyệt
                </div>
              )}
              <CCCDUpload anhCCCD={anhCCCD} onCCCDChange={setAnhCCCD} />
              <div className="flex justify-end">
                <Button
                  onClick={() => submitYeuCau('anhCCCD', { anhCCCD }, { anhCCCD: kt?.anhCCCD })}
                  disabled={saving === 'anhCCCD'}
                >
                  {saving === 'anhCCCD' ? 'Đang gửi...' : 'Gửi yêu cầu cập nhật CCCD'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lịch sử yêu cầu thông tin */}
          {yeuCaus.filter(y => ['thongTin', 'anhCCCD'].includes(y.loai)).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Lịch sử yêu cầu</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {yeuCaus.filter(y => ['thongTin', 'anhCCCD'].includes(y.loai)).map(y => {
                  const tt = yeuCauTrangThaiMap[y.trangThai];
                  return (
                    <div key={y.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2">
                      <div>
                        <p className="text-xs font-medium">{loaiLabel[y.loai]}</p>
                        <p className="text-xs text-muted-foreground">{new Date(y.ngayTao).toLocaleDateString('vi-VN')}</p>
                        {y.ghiChuPheDuyet && <p className="text-xs text-red-600">{y.ghiChuPheDuyet}</p>}
                      </div>
                      <Badge className={`${tt?.class} flex items-center gap-1 text-xs shrink-0`}>{tt?.icon}{tt?.label}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab Người cùng phòng ── */}
        <TabsContent value="nguoiphong" className="space-y-4">
          {!hopDongId ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p>Bạn chưa có hợp đồng đang hoạt động</p>
            </CardContent></Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {isDaiDien ? 'Bạn là người đứng tên hợp đồng — có thể thêm/sửa thành viên.' : 'Bạn chỉ có thể xem danh sách thành viên.'}
                </p>
                {isDaiDien && (
                  <Button size="sm" onClick={() => setShowAdd(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Thêm
                  </Button>
                )}
              </div>

              {pendingByLoai('nguoiCungPhong') && (
                <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Có yêu cầu thay đổi người cùng phòng đang chờ duyệt
                </div>
              )}

              <div className="space-y-3">
                {members.map(m => {
                  const age = calcAge(m.ngaySinh);
                  return (
                    <Card key={m.id}>
                      <CardContent className="pt-4 flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{m.hoTen}</p>
                            {age < 18 && <Badge variant="outline" className="text-xs">Trẻ em</Badge>}
                            {m.coTaiKhoan
                              ? <Badge className="bg-green-100 text-green-700 text-xs">Có TK</Badge>
                              : age < 18
                                ? <Badge variant="secondary" className="text-xs">Không cấp TK</Badge>
                                : <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Chờ cấp TK</Badge>
                            }
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {m.soDienThoai.startsWith('PENDING_') ? 'Chưa có SĐT' : m.soDienThoai}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(m.ngaySinh).toLocaleDateString('vi-VN')} ({age} tuổi) · {m.gioiTinh === 'nam' ? 'Nam' : m.gioiTinh === 'nu' ? 'Nữ' : 'Khác'}
                          </p>
                        </div>
                        {isDaiDien && (
                          <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {isDaiDien && (
                <p className="text-xs text-muted-foreground">
                  * Việc thêm/sửa thành viên sẽ gửi thông báo cho quản lý/chủ trọ phê duyệt trước khi áp dụng.
                  Trẻ em dưới 18 tuổi không được cấp tài khoản.
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Tab Bảo mật ── */}
        <TabsContent value="baomat">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" /> Đổi mật khẩu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Mật khẩu hiện tại</Label>
                <Input type="password" value={pwForm.matKhauCu} onChange={e => setPwForm(f => ({ ...f, matKhauCu: e.target.value }))} placeholder="Nhập mật khẩu hiện tại" />
              </div>
              <div className="space-y-1.5">
                <Label>Mật khẩu mới</Label>
                <Input type="password" value={pwForm.matKhauMoi} onChange={e => setPwForm(f => ({ ...f, matKhauMoi: e.target.value }))} placeholder="Ít nhất 6 ký tự" />
              </div>
              <div className="space-y-1.5">
                <Label>Xác nhận mật khẩu mới</Label>
                <Input type="password" value={pwForm.xacNhan} onChange={e => setPwForm(f => ({ ...f, xacNhan: e.target.value }))} placeholder="Nhập lại mật khẩu mới" />
              </div>
              {pwForm.matKhauMoi && pwForm.xacNhan && pwForm.matKhauMoi !== pwForm.xacNhan && (
                <p className="text-sm text-red-500">Mật khẩu xác nhận không khớp</p>
              )}
              <p className="text-xs text-muted-foreground">Đổi mật khẩu có hiệu lực ngay, không cần chờ phê duyệt.</p>
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={saving === 'matkhau'}>
                  {saving === 'matkhau' ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Thông báo ── */}
        <TabsContent value="thongbao" className="space-y-4">
          {pendingByLoai('thongBao') && (
            <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Thay đổi cài đặt thông báo đang chờ duyệt
            </div>
          )}

          {/* Thông báo trong ứng dụng */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" /> Thông báo trong ứng dụng
              </CardTitle>
              <p className="text-xs text-muted-foreground">Luôn bật — bạn sẽ thấy thông báo khi đăng nhập</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Hóa đơn mới / đến hạn', desc: 'Khi có hóa đơn được tạo hoặc sắp đến hạn' },
                { label: 'Cập nhật sự cố', desc: 'Khi sự cố bạn báo được xử lý' },
                { label: 'Hợp đồng & yêu cầu', desc: 'Khi có thay đổi hợp đồng hoặc yêu cầu được duyệt' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked onCheckedChange={() => {}} disabled />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Thông báo qua Zalo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded text-white text-xs font-bold" style={{ background: '#0068ff' }}>Z</span>
                Thông báo qua Zalo
              </CardTitle>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Bật/tắt toàn bộ thông báo Zalo</p>
                <Switch checked={zaloOn} onCheckedChange={v => {
                  setZaloOn(v);
                  if (!v) { setZaloHoaDon(false); setZaloSuCo(false); setZaloHopDong(false); }
                  else { setZaloHoaDon(true); setZaloSuCo(true); setZaloHopDong(true); }
                }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'hoaDon', label: 'Hóa đơn', desc: 'Nhắc thanh toán, hóa đơn mới', val: zaloHoaDon, set: setZaloHoaDon },
                { key: 'suCo', label: 'Sự cố', desc: 'Cập nhật tiến độ xử lý sự cố', val: zaloSuCo, set: setZaloSuCo },
                { key: 'hopDong', label: 'Hợp đồng & yêu cầu', desc: 'Phê duyệt yêu cầu, hết hạn hợp đồng', val: zaloHopDong, set: setZaloHopDong },
              ].map(item => (
                <div key={item.key} className={`flex items-center justify-between py-1 ${!zaloOn ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={item.val && zaloOn}
                    disabled={!zaloOn}
                    onCheckedChange={v => {
                      item.set(v);
                      if (v && !zaloOn) setZaloOn(true);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">* Thay đổi sẽ gửi cho quản lý/chủ trọ xem xét trước khi áp dụng.</p>
          <div className="flex justify-end">
            <Button
              onClick={() => submitYeuCau('thongBao',
                { nhanThongBaoZalo: zaloOn, thongBaoConfig: { hoaDon: zaloHoaDon, suCo: zaloSuCo, hopDong: zaloHopDong } },
                { nhanThongBaoZalo: kt?.nhanThongBaoZalo }
              )}
              disabled={saving === 'thongBao'}
            >
              {saving === 'thongBao' ? 'Đang gửi...' : 'Lưu cài đặt'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog thêm thành viên */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Thêm người cùng phòng</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Họ tên *</Label>
              <Input value={addForm.hoTen} onChange={e => setAddForm(f => ({ ...f, hoTen: e.target.value }))} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Ngày sinh *</Label>
                <Input type="date" value={addForm.ngaySinh} onChange={e => setAddForm(f => ({ ...f, ngaySinh: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>Giới tính *</Label>
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
                <AlertCircle className="h-3 w-3" /> Trẻ em dưới 18 tuổi không được cấp tài khoản đăng nhập.
              </p>
            )}
            <div className="space-y-1.5"><Label>Quê quán *</Label>
              <Input value={addForm.queQuan} onChange={e => setAddForm(f => ({ ...f, queQuan: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Số điện thoại</Label>
                <Input value={addForm.soDienThoai} onChange={e => setAddForm(f => ({ ...f, soDienThoai: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>CCCD</Label>
                <Input value={addForm.cccd} onChange={e => setAddForm(f => ({ ...f, cccd: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Nghề nghiệp</Label>
              <Input value={addForm.ngheNghiep} onChange={e => setAddForm(f => ({ ...f, ngheNghiep: e.target.value }))} />
            </div>

            {/* CCCD upload */}
            <div className="space-y-2 pt-1 border-t">
              <Label className="text-xs font-medium text-muted-foreground">Ảnh CCCD (tùy chọn)</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['truoc', 'sau'] as const).map(side => {
                  const url = side === 'truoc' ? addCCCD.matTruoc : addCCCD.matSau;
                  const label = side === 'truoc' ? 'Mặt trước' : 'Mặt sau';
                  return (
                    <div key={side} className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${url ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-indigo-300 bg-gray-50'}`} style={{ minHeight: 80 }}>
                        {uploadingCCCD === side ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : url ? (
                          <img src={url} alt={label} className="w-full h-20 object-cover rounded-lg" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 p-2">
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                            <span className="text-xs text-gray-400">Tải lên</span>
                          </div>
                        )}
                        <input
                          type="file" accept="image/*" className="hidden"
                          disabled={!!uploadingCCCD}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadMemberCCCD(f, side); e.target.value = ''; }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">* Yêu cầu sẽ được gửi cho quản lý/chủ trọ phê duyệt trước khi thêm vào hệ thống.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Hủy</Button>
            <Button onClick={handleAddMember} disabled={!!saving}>
              {saving === 'nguoiCungPhong' ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa thành viên */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sửa thông tin — {editTarget?.hoTen}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Họ tên</Label>
              <Input value={editForm.hoTen} onChange={e => setEditForm(f => ({ ...f, hoTen: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Giới tính</Label>
              <Select value={editForm.gioiTinh} onValueChange={v => setEditForm(f => ({ ...f, gioiTinh: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nam">Nam</SelectItem>
                  <SelectItem value="nu">Nữ</SelectItem>
                  <SelectItem value="khac">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Quê quán</Label>
              <Input value={editForm.queQuan} onChange={e => setEditForm(f => ({ ...f, queQuan: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Nghề nghiệp</Label>
              <Input value={editForm.ngheNghiep} onChange={e => setEditForm(f => ({ ...f, ngheNghiep: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">* Yêu cầu sẽ gửi quản lý/chủ trọ phê duyệt.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Hủy</Button>
            <Button onClick={handleEditMember} disabled={!!saving}>
              {saving === 'nguoiCungPhong' ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
