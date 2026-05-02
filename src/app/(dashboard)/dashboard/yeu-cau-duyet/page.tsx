'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, XCircle, Clock, RefreshCw, User, Calendar } from 'lucide-react';
import PageHeader from '@/components/dashboard/page-header';
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
          <span className="text-indigo-500">{label}: </span>
          {truoc[k] && <span className="line-through text-red-500 mr-1">{truoc[k] || '(trống)'}</span>}
          <span className="text-green-600">{sau[k] || '(trống)'}</span>
        </div>
      ));
    return rows.length > 0 ? <div className="space-y-1">{rows}</div> : <p className="text-xs text-indigo-400">Không có thay đổi</p>;
  }

  if (loai === 'anhCCCD') {
    return (
      <div className="space-y-2 text-xs">
        {sau?.anhCCCD?.matTruoc && (
          <div>
            <p className="text-indigo-500">Mặt trước mới:</p>
            <img src={sau.anhCCCD.matTruoc} alt="CCCD mặt trước" className="h-24 rounded border mt-1" />
          </div>
        )}
        {sau?.anhCCCD?.matSau && (
          <div>
            <p className="text-indigo-500">Mặt sau mới:</p>
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

export default function YeuCauDuyetPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [yeuCaus, setYeuCaus] = useState<YeuCau[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTT, setFilterTT] = useState('choPheduyet');

  const fetchData = (tt: string) => {
    setLoading(true);
    fetch(`/api/yeu-cau-thay-doi?trangThai=${tt}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setYeuCaus(res.data);
        else toast.error('Không thể tải dữ liệu');
      })
      .catch(() => toast.error('Có lỗi xảy ra'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(filterTT); }, [filterTT]);

  const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN');

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Yêu cầu phê duyệt"
        description="Xem xét và phê duyệt thay đổi từ khách thuê"
        onRefresh={() => fetchData(filterTT)}
        loading={loading}
      >
        <Select value={filterTT} onValueChange={v => setFilterTT(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="choPheduyet">Chờ duyệt</SelectItem>
            <SelectItem value="daPheduyet">Đã duyệt</SelectItem>
            <SelectItem value="tuChoi">Từ chối</SelectItem>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : yeuCaus.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 mb-3 mx-auto text-indigo-300" />
          <p className="text-indigo-400">Không có yêu cầu nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {yeuCaus.map(yc => {
            const tt = trangThaiMap[yc.trangThai];
            const phong = yc.khachThue.hopDong?.[0]?.phong;
            return (
              <div key={yc.id} className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-4 cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all" onClick={() => router.push('/dashboard/yeu-cau-duyet/' + yc.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{loaiLabel[yc.loai] ?? yc.loai}</Badge>
                        <Badge className={`${tt?.class} flex items-center gap-1 text-xs`}>{tt?.icon}{tt?.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <User className="h-3.5 w-3.5 text-indigo-400" />
                        {yc.khachThue.hoTen}
                        <span className="text-indigo-400 font-normal text-xs">· {yc.khachThue.soDienThoai}</span>
                        {phong && <span className="text-xs text-indigo-400">· P.{phong.maPhong} — {phong.toaNha.tenToaNha}</span>}
                      </div>
                      <div className="text-xs text-indigo-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {fmtDate(yc.ngayTao)}
                      </div>
                    </div>
                    {canEdit && yc.trangThai === 'choPheduyet' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          onClick={e => { e.stopPropagation(); router.push('/dashboard/yeu-cau-duyet/' + yc.id); }}>
                          Xem xét
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Preview thay đổi */}
                  <div className="mt-3 pt-3 border-t border-indigo-100">
                    {renderChange(yc.noiDung, yc.loai)}
                  </div>

                  {yc.ghiChuPheDuyet && (
                    <p className="mt-2 text-xs text-indigo-400 italic">Ghi chú: {yc.ghiChuPheDuyet}</p>
                  )}
                  {yc.nguoiPheDuyet && (
                    <p className="mt-1 text-xs text-indigo-400">Người duyệt: {yc.nguoiPheDuyet.ten}</p>
                  )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
