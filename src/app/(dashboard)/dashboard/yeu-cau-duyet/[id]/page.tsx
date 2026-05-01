'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, ArrowLeft, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useCanEdit } from '@/hooks/use-can-edit';

interface YeuCau {
  id: string;
  loai: string;
  noiDung: any;
  trangThai: string;
  ghiChuPheDuyet?: string;
  ngayTao: string;
  ngayCapNhat: string;
  khachThue: {
    id: string;
    hoTen: string;
    soDienThoai: string;
    hopDong: { phong: { maPhong: string; toaNha: { tenToaNha: string } } }[];
  };
  nguoiPheDuyet?: { ten: string };
}

const loaiLabel: Record<string, string> = {
  thongTin: 'Thông tin cá nhân',
  anhCCCD: 'Ảnh CCCD',
  nguoiCungPhong: 'Người cùng phòng',
  thongBao: 'Cài đặt thông báo',
};

const trangThaiMap: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
  choPheduyet: { label: 'Chờ duyệt', icon: <Clock className="h-3.5 w-3.5" />, class: 'bg-yellow-100 text-yellow-700' },
  daPheduyet: { label: 'Đã duyệt', icon: <CheckCircle2 className="h-3.5 w-3.5" />, class: 'bg-green-100 text-green-700' },
  tuChoi: { label: 'Từ chối', icon: <XCircle className="h-3.5 w-3.5" />, class: 'bg-red-100 text-red-700' },
};

function renderChange(noiDung: any, loai: string) {
  const truoc = noiDung?.truoc ?? {};
  const sau = noiDung?.sau ?? {};

  if (loai === 'thongTin') {
    const fields: Record<string, string> = {
      hoTen: 'Họ tên', email: 'Email', queQuan: 'Quê quán',
      ngheNghiep: 'Nghề nghiệp', gioiTinh: 'Giới tính',
    };
    const rows = Object.entries(fields)
      .filter(([k]) => truoc[k] !== sau[k])
      .map(([k, label]) => (
        <div key={k} className="text-xs">
          <span className="text-muted-foreground">{label}: </span>
          {truoc[k] && <span className="line-through text-red-500 mr-1">{truoc[k] || '(trống)'}</span>}
          <span className="text-green-600">{sau[k] || '(trống)'}</span>
        </div>
      ));
    return rows.length > 0 ? <div className="space-y-1">{rows}</div> : <p className="text-xs text-muted-foreground">Không có thay đổi</p>;
  }

  if (loai === 'anhCCCD') {
    return (
      <div className="space-y-2 text-xs">
        {sau?.anhCCCD?.matTruoc && (
          <div>
            <p className="text-muted-foreground">Mặt trước mới:</p>
            <img src={sau.anhCCCD.matTruoc} alt="CCCD mặt trước" className="h-24 rounded border mt-1" />
          </div>
        )}
        {sau?.anhCCCD?.matSau && (
          <div>
            <p className="text-muted-foreground">Mặt sau mới:</p>
            <img src={sau.anhCCCD.matSau} alt="CCCD mặt sau" className="h-24 rounded border mt-1" />
          </div>
        )}
      </div>
    );
  }

  if (loai === 'nguoiCungPhong') {
    const action = sau?.action;
    if (action === 'them') {
      const tv = sau.thanhVien;
      return (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-green-700">+ Thêm thành viên mới:</p>
          <p>Họ tên: <strong>{tv?.hoTen}</strong></p>
          <p>Ngày sinh: {tv?.ngaySinh ? new Date(tv.ngaySinh).toLocaleDateString('vi-VN') : '—'}</p>
          <p>Giới tính: {tv?.gioiTinh}</p>
          <p>Quê quán: {tv?.queQuan}</p>
          {tv?.soDienThoai && <p>SĐT: {tv.soDienThoai}</p>}
          {tv?.cccd && <p>CCCD: {tv.cccd}</p>}
          {sau.isUnder18 && <p className="text-orange-600">⚠ Dưới 18 tuổi — không cấp tài khoản</p>}
        </div>
      );
    }
    if (action === 'sua') {
      return (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-blue-700">✏ Sửa thông tin thành viên</p>
          {sau.hoTen && <p>Họ tên: <strong>{sau.hoTen}</strong></p>}
          {sau.gioiTinh && <p>Giới tính: {sau.gioiTinh}</p>}
          {sau.queQuan && <p>Quê quán: {sau.queQuan}</p>}
          {sau.ngheNghiep !== undefined && <p>Nghề nghiệp: {sau.ngheNghiep || '(xóa)'}</p>}
        </div>
      );
    }
  }

  if (loai === 'thongBao') {
    return (
      <p className="text-xs">
        Nhận thông báo Zalo:{' '}
        <span className="line-through text-red-500 mr-1">{truoc?.nhanThongBaoZalo ? 'Bật' : 'Tắt'}</span>
        <span className="text-green-600">{sau?.nhanThongBaoZalo ? 'Bật' : 'Tắt'}</span>
      </p>
    );
  }

  return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(sau, null, 2)}</pre>;
}

export default function ChiTietYeuCauPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const canEdit = useCanEdit();

  const [yeuCau, setYeuCau] = useState<YeuCau | null>(null);
  const [loading, setLoading] = useState(true);
  const [ghiChu, setGhiChu] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    document.title = 'Chi tiết yêu cầu';
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/yeu-cau-thay-doi?id=${id}`);
      const result = await res.json();
      if (result.success && result.data?.length > 0) {
        setYeuCau(result.data[0]);
      } else {
        // Try fetching by id directly
        const res2 = await fetch(`/api/yeu-cau-thay-doi?trangThai=all`);
        const result2 = await res2.json();
        if (result2.success) {
          const found = result2.data.find((yc: YeuCau) => yc.id === id);
          if (found) {
            setYeuCau(found);
          } else {
            toast.error('Không tìm thấy yêu cầu');
            router.push('/dashboard/yeu-cau-duyet');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching yeu cau:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (trangThai: 'daPheduyet' | 'tuChoi') => {
    if (!yeuCau) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/yeu-cau-thay-doi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: yeuCau.id, trangThai, ghiChuPheDuyet: ghiChu }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message);
        router.push('/dashboard/yeu-cau-duyet');
      } else {
        toast.error(result.message || 'Xử lý thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setProcessing(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!yeuCau) {
    return (
      <div className="space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/yeu-cau-duyet')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <XCircle className="h-12 w-12 mb-3 opacity-30" />
            <p>Không tìm thấy yêu cầu</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tt = trangThaiMap[yeuCau.trangThai];
  const phong = yeuCau.khachThue.hopDong?.[0]?.phong;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/yeu-cau-duyet')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Chi tiết yêu cầu</h1>
          <p className="text-sm text-muted-foreground">{loaiLabel[yeuCau.loai] ?? yeuCau.loai}</p>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{loaiLabel[yeuCau.loai] ?? yeuCau.loai}</Badge>
                <Badge className={`${tt?.class} flex items-center gap-1 text-xs`}>{tt?.icon}{tt?.label}</Badge>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <strong>{yeuCau.khachThue.hoTen}</strong>
                <span className="text-muted-foreground">· {yeuCau.khachThue.soDienThoai}</span>
                {phong && <span className="text-xs text-muted-foreground">· P.{phong.maPhong} — {phong.toaNha.tenToaNha}</span>}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> {fmtDate(yeuCau.ngayTao)}
              </p>
            </div>

            <div className="rounded-md bg-gray-50 border p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Chi tiết thay đổi:</p>
              {renderChange(yeuCau.noiDung, yeuCau.loai)}
            </div>

            {yeuCau.ghiChuPheDuyet && (
              <p className="text-xs text-muted-foreground italic">Ghi chú: {yeuCau.ghiChuPheDuyet}</p>
            )}
            {yeuCau.nguoiPheDuyet && (
              <p className="text-xs text-muted-foreground">Người duyệt: {yeuCau.nguoiPheDuyet.ten}</p>
            )}

            {canEdit && yeuCau.trangThai === 'choPheduyet' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ghi chú (tùy chọn)</label>
                  <Textarea
                    value={ghiChu}
                    onChange={e => setGhiChu(e.target.value)}
                    placeholder="Lý do từ chối hoặc ghi chú..."
                    rows={2}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t">
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => handleDecision('tuChoi')}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {processing ? 'Đang xử lý...' : 'Từ chối'}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleDecision('daPheduyet')}
                    disabled={processing}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {processing ? 'Đang xử lý...' : 'Phê duyệt'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
