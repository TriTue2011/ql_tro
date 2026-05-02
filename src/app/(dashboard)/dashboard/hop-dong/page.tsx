'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  FileText,
  Calendar,
  Download,
  Edit,
  X as CloseIcon,
  RefreshCw,
  Users,
  Building2,
  Home,
  DollarSign,
  Phone,
  Mail,
  Save,
  Loader2,
  Trash2,
} from 'lucide-react';
import { HopDong, Phong, KhachThue, ToaNha } from '@/types';
import { useCanEdit } from '@/hooks/use-can-edit';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';
import ConfirmPopover from '@/components/dashboard/confirm-popover';

// ─── InlineEditHopDong interface ──────────────────────────────────────────────
interface InlineEditHopDong {
  id: string;
  maHopDong: string;
  phong: string;
  phongMa: string;
  toaNhaTen: string;
  nguoiDaiDien: string;
  nguoiDaiDienTen: string;
  khachThueIds: string[];
  ngayBatDau: Date;
  ngayKetThuc: Date;
  giaThue: number;
  tienCoc: number;
  chuKyThanhToan: 'thang' | 'quy' | 'nam';
  ngayThanhToan: number;
  dieuKhoan: string;
  giaDien: number;
  giaNuoc: number;
  chiSoDienBanDau: number;
  chiSoNuocBanDau: number;
  phiDichVu: Array<{ ten: string; gia: number }>;
  trangThai: 'hoatDong' | 'hetHan' | 'daHuy';
  ngayTao: Date;
  ngayCapNhat: Date;
}

// ─── Helper functions ─────────────────────────────────────────────────────────
function getStatusBadge(status: string) {
  switch (status) {
    case 'hoatDong':
      return <Badge variant="default">Hoạt động</Badge>;
    case 'hetHan':
      return <Badge variant="destructive">Hết hạn</Badge>;
    case 'daHuy':
      return <Badge variant="secondary">Đã hủy</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

function isExpiringSoon(ngayKetThuc: Date | string) {
  const today = new Date();
  const endDate = new Date(ngayKetThuc);
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 30 && diffDays > 0;
}

function isExpired(ngayKetThuc: Date | string) {
  const today = new Date();
  const endDate = new Date(ngayKetThuc);
  return endDate < today;
}

export default function HopDongPage() {
  const canEdit = useCanEdit();
  const cache = useCache<{
    hopDongList: HopDong[];
    phongList: Phong[];
    khachThueList: KhachThue[];
    toaNhaList: ToaNha[];
  }>({ key: 'hop-dong-data', duration: 300000 }); // 5 phút

  const [hopDongList, setHopDongList] = useState<HopDong[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toaNhaFilter, setToaNhaFilter] = useState<string>('all');
  const [viewingHopDong, setViewingHopDong] = useState<HopDong | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    maHopDong: '',
    phong: '',
    khachThueId: [] as string[],
    nguoiDaiDien: '',
    ngayBatDau: new Date().toISOString().split('T')[0],
    ngayKetThuc: '',
    giaThue: 0,
    tienCoc: 0,
    chuKyThanhToan: 'thang' as 'thang' | 'quy' | 'nam',
    ngayThanhToan: 15,
    dieuKhoan: `ĐIỀU KHOẢN HỢP ĐỒNG THUÊ PHÒNG

1. BÊN CHO THUÊ (Chủ nhà):
- Cung cấp phòng ở đầy đủ tiện nghi theo thỏa thuận
- Đảm bảo an ninh, an toàn cho khách thuê
- Bảo trì, sửa chữa các hư hỏng do hao mòn tự nhiên

2. BÊN THUÊ (Khách thuê):
- Thanh toán đúng hạn tiền thuê và các chi phí khác
- Sử dụng phòng đúng mục đích, giữ gìn vệ sinh
- Không được cải tạo, sửa chữa phòng mà không có sự đồng ý
- Báo cáo kịp thời các hư hỏng, sự cố

3. ĐIỀU KHOẢN CHUNG:
- Thời hạn hợp đồng: Từ ngày bắt đầu đến ngày kết thúc
- Tiền cọc: Được hoàn trả khi kết thúc hợp đồng (trừ các khoản phát sinh)
- Thanh toán: Hàng tháng vào ngày quy định
- Điện, nước: Tính theo chỉ số đồng hồ và giá quy định
- Phí dịch vụ: Theo thỏa thuận riêng

4. CHẤM DỨT HỢP ĐỒNG:
- Bên thuê có thể chấm dứt hợp đồng trước thời hạn với thông báo trước 30 ngày
- Bên cho thuê có thể chấm dứt hợp đồng nếu vi phạm nghiêm trọng
- Hoàn trả tiền cọc sau khi kiểm tra tình trạng phòng

5. ĐIỀU KHOẢN KHÁC:
- Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận
- Mọi tranh chấp sẽ được giải quyết thông qua thương lượng
- Hợp đồng có hiệu lực kể từ ngày ký`,
    giaDien: 3500,
    giaNuoc: 25000,
    chiSoDienBanDau: 0,
    chiSoNuocBanDau: 0,
    phiDichVu: [] as Array<{ ten: string; gia: number }>,
    trangThai: 'hoatDong' as 'hoatDong' | 'hetHan' | 'daHuy',
  });
  const [newPhiDichVu, setNewPhiDichVu] = useState({ ten: '', gia: 0 });

  // Inline edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InlineEditHopDong | null>(null);

  // Available phong for create (only vacant/daDat)
  const availablePhongForCreate = useMemo(() => {
    return phongList.filter(p => p.trangThai === 'trong' || p.trangThai === 'daDat');
  }, [phongList]);

  useEffect(() => {
    document.title = 'Quản lý Hợp đồng';
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['hop-dong'], (_type, _action) => {
    cache.clearCache();
    fetchData(true);
  });

  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);

      // Thử load từ cache trước (nếu không force refresh)
      if (!forceRefresh) {
        const cachedData = cache.getCache();
        if (cachedData) {
          setHopDongList(cachedData.hopDongList || []);
          setPhongList(cachedData.phongList || []);
          setKhachThueList(cachedData.khachThueList || []);
          setToaNhaList(cachedData.toaNhaList || []);
          setLoading(false);
          return;
        }
      }

      // Fetch hop dong data
      const hopDongResponse = await fetch('/api/hop-dong?limit=100');
      const hopDongData = hopDongResponse.ok ? await hopDongResponse.json() : { data: [] };
      const hopDongs = hopDongData.data || [];
      setHopDongList(hopDongs);

      // Fetch phong data
      const phongResponse = await fetch('/api/phong?limit=100');
      const phongData = phongResponse.ok ? await phongResponse.json() : { data: [] };
      const phongs = phongData.data || [];
      setPhongList(phongs);

      // Fetch khach thue data
      const khachThueResponse = await fetch('/api/khach-thue?limit=100');
      const khachThueData = khachThueResponse.ok ? await khachThueResponse.json() : { data: [] };
      const khachThues = khachThueData.data || [];
      setKhachThueList(khachThues);

      // Fetch toa nha data
      const toaNhaResponse = await fetch('/api/toa-nha?limit=100');
      const toaNhaData = toaNhaResponse.ok ? await toaNhaResponse.json() : { data: [] };
      const toaNhas = toaNhaData.data || [];
      setToaNhaList(toaNhas);

      // Lưu vào cache
      cache.setCache({
        hopDongList: hopDongs,
        phongList: phongs,
        khachThueList: khachThues,
        toaNhaList: toaNhas,
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchData(true);
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  // ─── Helper lookups ─────────────────────────────────────────────────────────
  const getPhongName = (phong: string | { maPhong: string }) => {
    if (typeof phong === 'object' && phong?.maPhong) {
      return phong.maPhong;
    }
    const phongObj = phongList.find(p => p.id === phong);
    return phongObj?.maPhong || 'Không xác định';
  };

  const getPhongInfo = (phong: string | { maPhong: string; toaNha?: { tenToaNha: string } }) => {
    if (typeof phong === 'object' && phong?.maPhong) {
      return {
        maPhong: phong.maPhong,
        toaNha: phong.toaNha?.tenToaNha || 'Không xác định'
      };
    }
    const phongObj = phongList.find(p => p.id === phong);
    if (!phongObj) return { maPhong: 'Không xác định', toaNha: 'Không xác định' };
    const toaNha = toaNhaList.find(t => t.id === phongObj.toaNha);
    return {
      maPhong: phongObj.maPhong,
      toaNha: toaNha?.tenToaNha || 'Không xác định'
    };
  };

  const getKhachThueName = (khachThue: string | { hoTen: string }) => {
    if (typeof khachThue === 'object' && khachThue?.hoTen) {
      return khachThue.hoTen;
    }
    const khachThueObj = khachThueList.find(k => k.id === khachThue);
    return khachThueObj?.hoTen || 'Không xác định';
  };

  const getToaNhaIdFromPhong = (phongId: string): string | null => {
    const phongObj = phongList.find(p => p.id === phongId);
    if (!phongObj) return null;
    if (typeof phongObj.toaNha === 'object' && (phongObj.toaNha as any)?.id) {
      return (phongObj.toaNha as any).id;
    }
    return phongObj.toaNha as string;
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const filteredHopDong = hopDongList.filter(hopDong => {
    const matchesSearch = hopDong.maHopDong.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         hopDong.dieuKhoan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || hopDong.trangThai === statusFilter;

    // Filter by toa nha
    let matchesToaNha = true;
    if (toaNhaFilter !== 'all') {
      if (typeof hopDong.phong === 'object' && (hopDong.phong as { toaNha: { id: string } })?.toaNha) {
        matchesToaNha = ((hopDong.phong as { toaNha: { id: string } }).toaNha).id === toaNhaFilter;
      } else {
        const phong = phongList.find(p => p.id === hopDong.phong);
        matchesToaNha = phong?.toaNha === toaNhaFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesToaNha;
  });

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleView = (hopDong: HopDong) => {
    setViewingHopDong(hopDong);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/hop-dong/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        cache.clearCache();
        setHopDongList(prev => prev.filter(hopDong => hopDong.id !== id));
        toast.success('Đã xóa hợp đồng thành công');
      } else {
        toast.error('Có lỗi xảy ra khi xóa hợp đồng');
      }
    } catch (error) {
      console.error('Error deleting hop dong:', error);
      toast.error('Có lỗi xảy ra khi xóa hợp đồng');
    }
  };

  const handleDownload = async (hopDong: HopDong) => {
    try {
      const phongInfo = getPhongInfo(hopDong.phong);
      const nguoiDaiDien = getKhachThueName(hopDong.nguoiDaiDien);

      const nguoiDaiDienObj = khachThueList.find(kt => {
        const ktId = typeof kt.id === 'object' ? (kt.id as { id: string }).id : kt.id;
        const daiDienId = typeof hopDong.nguoiDaiDien === 'object' ? (hopDong.nguoiDaiDien as { id: string }).id : hopDong.nguoiDaiDien;
        return ktId === daiDienId;
      });

      const ngayBatDau = new Date(hopDong.ngayBatDau);
      const ngayKetThuc = new Date(hopDong.ngayKetThuc);
      const ngayHienTai = new Date();

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                  bold: true,
                  size: 24,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Độc lập - Tự do - Hạnh phúc",
                  bold: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "HỢP ĐỒNG THUÊ PHÒNG TRỌ",
                  bold: true,
                  size: 28,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `(Số: ${hopDong.maHopDong}/HĐTN)`,
                  bold: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Hôm nay, ngày ${ngayHienTai.getDate()} tháng ${ngayHienTai.getMonth() + 1} năm ${ngayHienTai.getFullYear()};`,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Tại địa chỉ: ${phongInfo.toaNha}`,
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Chúng tôi gồm:",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "1. Đại diện bên cho thuê phòng trọ (Bên A):",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Ông/bà: [Tên chủ nhà] Sinh ngày: [Ngày sinh]",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Nơi đăng ký hộ khẩu thường trú: [Địa chỉ thường trú]",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "CMND (CCCD) số: [Số CMND] cấp ngày [Ngày cấp] tại: [Nơi cấp]",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Số điện thoại liên hệ: [Số điện thoại]",
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "2. Bên thuê phòng trọ (Bên B):",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Ông/bà: ${nguoiDaiDienObj?.hoTen || nguoiDaiDien} Sinh ngày: ${nguoiDaiDienObj?.ngaySinh ? new Date(nguoiDaiDienObj.ngaySinh).toLocaleDateString('vi-VN') : '[Ngày sinh]'}`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Nơi đăng ký hộ khẩu thường trú: ${nguoiDaiDienObj?.queQuan || '[Quê quán]'}`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Số CMND (CCCD): ${nguoiDaiDienObj?.cccd || '[Số CCCD]'} cấp ngày [Ngày cấp] tại: [Nơi cấp]`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Số điện thoại liên hệ: ${nguoiDaiDienObj?.soDienThoai || '[Số điện thoại]'}`,
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Sau khi bàn bạc kỹ lưỡng, hai bên cùng thống nhất như sau:",
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Bên A đồng ý cho bên B thuê 01 phòng ở tại địa chỉ: ${phongInfo.maPhong} - ${phongInfo.toaNha}`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Giá thuê: ${formatCurrency(hopDong.giaThue)}/tháng`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Hình thức thanh toán: Hàng ${hopDong.chuKyThanhToan === 'thang' ? 'tháng' : hopDong.chuKyThanhToan === 'quy' ? 'quý' : 'năm'} - ngày ${hopDong.ngayThanhToan}`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Tiền điện: ${formatCurrency(hopDong.giaDien)}/kWh tính theo chỉ số công tơ, thanh toán vào cuối các tháng.`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Tiền nước: ${formatCurrency(hopDong.giaNuoc)}/m³ thanh toán vào cuối các tháng.`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Tiền đặt cọc: ${formatCurrency(hopDong.tienCoc)}`,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Hợp đồng có giá trị kể từ ngày ${ngayBatDau.getDate()} tháng ${ngayBatDau.getMonth() + 1} năm ${ngayBatDau.getFullYear()} đến ngày ${ngayKetThuc.getDate()} tháng ${ngayKetThuc.getMonth() + 1} năm ${ngayKetThuc.getFullYear()}.`,
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "TRÁCH NHIỆM CỦA CÁC BÊN",
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "* Trách nhiệm của bên A:",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Tạo mọi điều kiện thuận lợi để bên B thực hiện theo hợp đồng.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Cung cấp nguồn điện, nước đầy đủ cho bên B sử dụng.",
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "* Trách nhiệm của bên B:",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Thanh toán đầy đủ tiền theo đúng thỏa thuận.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Bảo quản các trang thiết bị và cơ sở vật chất của bên A trang bị cho ban đầu (làm hỏng phải sửa, mất phải đền).",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Không được tự ý sửa chữa, cải tạo cơ sở vật chất khi chưa được sự đồng ý của bên A.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Luôn có ý thức giữ gìn vệ sinh trong và ngoài khu vực phòng trọ.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Bên B phải chấp hành mọi quy định của pháp luật Nhà nước và quy định của địa phương.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Nếu bên B cho khách ở qua đêm thì phải báo trước và được sự đồng ý của bên A, đồng thời phải chịu trách nhiệm về các hành vi vi phạm pháp luật của khách trong thời gian ở lại (nếu có).",
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "TRÁCH NHIỆM CHUNG",
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Hai bên phải tạo điều kiện thuận lợi cho nhau để thực hiện hợp đồng.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Nếu một trong hai bên vi phạm hợp đồng trong thời gian hợp đồng vẫn còn hiệu lực thì bên còn lại có quyền đơn phương chấm dứt hợp đồng thuê nhà trọ. Ngoài ra, nếu hành vi vi phạm đó gây tổn thất cho bên bị vi phạm thì bên vi phạm sẽ phải bồi thường mọi thiệt hại đã gây ra.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Trong trường hợp muốn chấm dứt hợp đồng trước thời hạn, cần phải báo trước cho bên kia ít nhất 30 ngày và hai bên phải có sự thống nhất với nhau.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Kết thúc hợp đồng, Bên A phải trả lại đầy đủ tiền đặt cọc cho bên B.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Bên nào vi phạm các điều khoản chung thì phải chịu trách nhiệm trước pháp luật.",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "- Hợp đồng này được lập thành 02 bản và có giá trị pháp lý như nhau, mỗi bên giữ một bản.",
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            ...(hopDong.phiDichVu.length > 0 ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "PHÍ DỊCH VỤ BỔ SUNG:",
                    bold: true,
                    size: 24,
                  }),
                ],
                spacing: { after: 200 },
              }),
              ...hopDong.phiDichVu.map(phi =>
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `- ${phi.ten}: ${formatCurrency(phi.gia)}`,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "",
                    size: 20,
                  }),
                ],
                spacing: { after: 200 },
              }),
            ] : []),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ĐIỀU KHOẢN BỔ SUNG:",
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: hopDong.dieuKhoan,
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ĐẠI DIỆN BÊN A                ĐẠI DIỆN BÊN B",
                  bold: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "(Ký và ghi họ tên)                (Ký và ghi họ tên)",
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Ngày tạo: ${new Date(hopDong.ngayTao).toLocaleDateString('vi-VN')}`,
                  size: 16,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Trạng thái: ${hopDong.trangThai === 'hoatDong' ? 'Hoạt động' : hopDong.trangThai === 'hetHan' ? 'Hết hạn' : 'Đã hủy'}`,
                  size: 16,
                }),
              ],
              spacing: { after: 200 },
            }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(blob, `hop-dong-${hopDong.maHopDong}.docx`);

      toast.success('Đã tải xuống hợp đồng thành công!');
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Có lỗi xảy ra khi tạo file Word');
    }
  };

  const handleGiaHan = async (hopDong: HopDong) => {
    const newEndDate = prompt('Nhập ngày kết thúc mới (YYYY-MM-DD):');
    if (newEndDate) {
      setActionLoading(`giahan-${hopDong.id}`);
      try {
        const response = await fetch(`/api/hop-dong/${hopDong.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ngayKetThuc: newEndDate }),
        });
        if (response.ok) {
          const result = await response.json();
          cache.clearCache();
          setHopDongList(prev => prev.map(hd => hd.id === hopDong.id ? result.data : hd));
          toast.success('Đã gia hạn hợp đồng thành công');
        } else {
          toast.error('Có lỗi xảy ra khi gia hạn hợp đồng');
        }
      } catch (error) {
        console.error('Error extending contract:', error);
        toast.error('Có lỗi xảy ra khi gia hạn hợp đồng');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleHuy = async (hopDong: HopDong) => {
    if (confirm('Bạn có chắc chắn muốn hủy hợp đồng này?')) {
      setActionLoading(`huy-${hopDong.id}`);
      try {
        const response = await fetch(`/api/hop-dong/${hopDong.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trangThai: 'daHuy' }),
        });
        if (response.ok) {
          const result = await response.json();
          cache.clearCache();
          setHopDongList(prev => prev.map(hd => hd.id === hopDong.id ? result.data : hd));
          toast.success('Đã hủy hợp đồng thành công');
        } else {
          toast.error('Có lỗi xảy ra khi hủy hợp đồng');
        }
      } catch (error) {
        console.error('Error cancelling contract:', error);
        toast.error('Có lỗi xảy ra khi hủy hợp đồng');
      } finally {
        setActionLoading(null);
      }
    }
  };

  // ─── Inline create ──────────────────────────────────────────────────────────
  const resetCreateForm = () => {
    setCreateForm({
      maHopDong: '',
      phong: '',
      khachThueId: [] as string[],
      nguoiDaiDien: '',
      ngayBatDau: new Date().toISOString().split('T')[0],
      ngayKetThuc: '',
      giaThue: 0,
      tienCoc: 0,
      chuKyThanhToan: 'thang' as 'thang' | 'quy' | 'nam',
      ngayThanhToan: 15,
      dieuKhoan: `ĐIỀU KHOẢN HỢP ĐỒNG THUÊ PHÒNG

1. BÊN CHO THUÊ (Chủ nhà):
- Cung cấp phòng ở đầy đủ tiện nghi theo thỏa thuận
- Đảm bảo an ninh, an toàn cho khách thuê
- Bảo trì, sửa chữa các hư hỏng do hao mòn tự nhiên

2. BÊN THUÊ (Khách thuê):
- Thanh toán đúng hạn tiền thuê và các chi phí khác
- Sử dụng phòng đúng mục đích, giữ gìn vệ sinh
- Không được cải tạo, sửa chữa phòng mà không có sự đồng ý
- Báo cáo kịp thời các hư hỏng, sự cố

3. ĐIỀU KHOẢN CHUNG:
- Thời hạn hợp đồng: Từ ngày bắt đầu đến ngày kết thúc
- Tiền cọc: Được hoàn trả khi kết thúc hợp đồng (trừ các khoản phát sinh)
- Thanh toán: Hàng tháng vào ngày quy định
- Điện, nước: Tính theo chỉ số đồng hồ và giá quy định
- Phí dịch vụ: Theo thỏa thuận riêng

4. CHẤM DỨT HỢP ĐỒNG:
- Bên thuê có thể chấm dứt hợp đồng trước thời hạn với thông báo trước 30 ngày
- Bên cho thuê có thể chấm dứt hợp đồng nếu vi phạm nghiêm trọng
- Hoàn trả tiền cọc sau khi kiểm tra tình trạng phòng

5. ĐIỀU KHOẢN KHÁC:
- Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận
- Mọi tranh chấp sẽ được giải quyết thông qua thương lượng
- Hợp đồng có hiệu lực kể từ ngày ký`,
      giaDien: 3500,
      giaNuoc: 25000,
      chiSoDienBanDau: 0,
      chiSoNuocBanDau: 0,
      phiDichVu: [] as Array<{ ten: string; gia: number }>,
      trangThai: 'hoatDong' as 'hoatDong' | 'hetHan' | 'daHuy',
    });
    setNewPhiDichVu({ ten: '', gia: 0 });
  };

  const handleCreateHopDong = async () => {
    if (!createForm.maHopDong || !createForm.phong || !createForm.nguoiDaiDien || !createForm.ngayKetThuc) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/hop-dong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          ngayBatDau: new Date(createForm.ngayBatDau).toISOString(),
          ngayKetThuc: new Date(createForm.ngayKetThuc).toISOString(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        cache.clearCache();
        toast.success(result.message || 'Đã tạo hợp đồng thành công');
        setShowCreateForm(false);
        resetCreateForm();
        await fetchData(true);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating hop dong:', error);
      toast.error('Có lỗi xảy ra khi tạo hợp đồng');
    } finally {
      setSaving(false);
    }
  };

  // ─── Inline edit ────────────────────────────────────────────────────────────
  const handleEditHopDong = useCallback((item: InlineEditHopDong) => {
    setEditForm({ ...item });
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/hop-dong/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maHopDong: editForm.maHopDong,
          ngayBatDau: new Date(editForm.ngayBatDau).toISOString(),
          ngayKetThuc: new Date(editForm.ngayKetThuc).toISOString(),
          giaThue: editForm.giaThue,
          tienCoc: editForm.tienCoc,
          chuKyThanhToan: editForm.chuKyThanhToan,
          ngayThanhToan: editForm.ngayThanhToan,
          dieuKhoan: editForm.dieuKhoan,
          giaDien: editForm.giaDien,
          giaNuoc: editForm.giaNuoc,
          chiSoDienBanDau: editForm.chiSoDienBanDau,
          chiSoNuocBanDau: editForm.chiSoNuocBanDau,
          phiDichVu: editForm.phiDichVu,
          trangThai: editForm.trangThai,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        cache.clearCache();
        setHopDongList(prev => prev.map(hd => hd.id === editForm.id ? result.data : hd));
        toast.success('Đã cập nhật hợp đồng thành công');
        setExpandedId(null);
        setEditForm(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating hop dong:', error);
      toast.error('Có lỗi xảy ra khi cập nhật hợp đồng');
    } finally {
      setSaving(false);
    }
  };

  // ─── Table data ─────────────────────────────────────────────────────────────
  const tableData = useMemo((): InlineEditHopDong[] => {
    return filteredHopDong.map(hd => {
      const phongInfo = getPhongInfo(hd.phong);
      return {
        id: hd.id || hd._id || '',
        maHopDong: hd.maHopDong,
        phong: typeof hd.phong === 'object' ? (hd.phong as any).id || (hd.phong as any)._id || '' : hd.phong,
        phongMa: phongInfo.maPhong,
        toaNhaTen: phongInfo.toaNha,
        nguoiDaiDien: typeof hd.nguoiDaiDien === 'object' ? (hd.nguoiDaiDien as any).id || (hd.nguoiDaiDien as any)._id || '' : hd.nguoiDaiDien,
        nguoiDaiDienTen: getKhachThueName(hd.nguoiDaiDien),
        khachThueIds: hd.khachThueIds.map((kt: any) => typeof kt === 'object' ? kt.id || kt._id || '' : kt),
        ngayBatDau: hd.ngayBatDau,
        ngayKetThuc: hd.ngayKetThuc,
        giaThue: hd.giaThue,
        tienCoc: hd.tienCoc,
        chuKyThanhToan: hd.chuKyThanhToan,
        ngayThanhToan: hd.ngayThanhToan,
        dieuKhoan: hd.dieuKhoan,
        giaDien: hd.giaDien,
        giaNuoc: hd.giaNuoc,
        chiSoDienBanDau: hd.chiSoDienBanDau,
        chiSoNuocBanDau: hd.chiSoNuocBanDau,
        phiDichVu: hd.phiDichVu || [],
        trangThai: hd.trangThai,
        ngayTao: hd.ngayTao,
        ngayCapNhat: hd.ngayCapNhat,
      };
    });
  }, [filteredHopDong, phongList, toaNhaList, khachThueList]);

  // ─── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<InlineEditHopDong>[] = useMemo(() => [
    {
      key: 'maHopDong',
      header: 'Mã hợp đồng',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-medium text-gray-900">{item.maHopDong}</span>
            <div className="text-xs text-gray-500">{item.phongMa} - {item.toaNhaTen}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-1">
          {getStatusBadge(item.trangThai)}
          {item.trangThai === 'hoatDong' && isExpiringSoon(item.ngayKetThuc) && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-600 w-fit">
              Sắp hết hạn
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'nguoiDaiDienTen',
      header: 'Người đại diện',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span>{item.nguoiDaiDienTen}</span>
          {item.khachThueIds.length > 1 && (
            <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50">
              +{item.khachThueIds.length - 1}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'giaThue',
      header: 'Giá thuê',
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-green-600">{formatCurrency(item.giaThue)}</span>
      ),
    },
    {
      key: 'ngayKetThuc',
      header: 'Ngày kết thúc',
      sortable: true,
      render: (item) => {
        const expiring = isExpiringSoon(item.ngayKetThuc);
        const expired = isExpired(item.ngayKetThuc);
        return (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span className={expired ? 'text-red-600 font-medium' : expiring ? 'text-orange-600 font-medium' : ''}>
              {new Date(item.ngayKetThuc).toLocaleDateString('vi-VN')}
            </span>
          </div>
        );
      },
    },
  ], []);

  // ─── Render expanded (inline edit form) ─────────────────────────────────────
  const renderExpanded = useCallback((item: InlineEditHopDong) => {
    if (!editForm || editForm.id !== item.id) return null;

    const addPhiDichVuLocal = () => {
      if (newPhiDichVu.ten && newPhiDichVu.gia > 0) {
        setEditForm(prev => prev ? {
          ...prev,
          phiDichVu: [...prev.phiDichVu, { ...newPhiDichVu }]
        } : null);
        setNewPhiDichVu({ ten: '', gia: 0 });
      }
    };

    const removePhiDichVuLocal = (index: number) => {
      setEditForm(prev => prev ? {
        ...prev,
        phiDichVu: prev.phiDichVu.filter((_, i) => i !== index)
      } : null);
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Mã hợp đồng</Label>
            <Input
              value={editForm.maHopDong}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, maHopDong: e.target.value } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Trạng thái</Label>
            <Select
              value={editForm.trangThai}
              onValueChange={(value: any) => setEditForm(prev => prev ? { ...prev, trangThai: value } : null)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoatDong">Hoạt động</SelectItem>
                <SelectItem value="hetHan">Hết hạn</SelectItem>
                <SelectItem value="daHuy">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Phòng</Label>
            <Input value={item.phongMa} disabled className="text-sm bg-gray-50" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Ngày bắt đầu</Label>
            <Input
              type="date"
              value={new Date(editForm.ngayBatDau).toISOString().split('T')[0]}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngayBatDau: new Date(e.target.value) } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Ngày kết thúc</Label>
            <Input
              type="date"
              value={new Date(editForm.ngayKetThuc).toISOString().split('T')[0]}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngayKetThuc: new Date(e.target.value) } : null)}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Giá thuê</Label>
            <Input
              type="number"
              value={editForm.giaThue}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, giaThue: Number(e.target.value) } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Tiền cọc</Label>
            <Input
              type="number"
              value={editForm.tienCoc}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tienCoc: Number(e.target.value) } : null)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Ngày thanh toán</Label>
            <Input
              type="number"
              min={1} max={31}
              value={editForm.ngayThanhToan}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, ngayThanhToan: Number(e.target.value) } : null)}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Chu kỳ thanh toán</Label>
            <Select
              value={editForm.chuKyThanhToan}
              onValueChange={(value: any) => setEditForm(prev => prev ? { ...prev, chuKyThanhToan: value } : null)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thang">Hàng tháng</SelectItem>
                <SelectItem value="quy">Theo quý</SelectItem>
                <SelectItem value="nam">Hàng năm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Giá điện / nước</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-[10px] text-gray-500">Giá điện</Label>
                <Input type="number" value={editForm.giaDien}
                  onChange={(e) => setEditForm(prev => prev ? { ...prev, giaDien: Number(e.target.value) } : null)}
                  className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-gray-500">Giá nước</Label>
                <Input type="number" value={editForm.giaNuoc}
                  onChange={(e) => setEditForm(prev => prev ? { ...prev, giaNuoc: Number(e.target.value) } : null)}
                  className="text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Chỉ số điện ban đầu</Label>
            <Input type="number" value={editForm.chiSoDienBanDau}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, chiSoDienBanDau: Number(e.target.value) } : null)}
              className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Chỉ số nước ban đầu</Label>
            <Input type="number" value={editForm.chiSoNuocBanDau}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, chiSoNuocBanDau: Number(e.target.value) } : null)}
              className="text-sm" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Điều khoản</Label>
          <Textarea
            value={editForm.dieuKhoan}
            onChange={(e) => setEditForm(prev => prev ? { ...prev, dieuKhoan: e.target.value } : null)}
            className="text-sm min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Phí dịch vụ</Label>
          {editForm.phiDichVu.map((phi, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input value={phi.ten} disabled className="text-sm flex-1 bg-gray-50" />
              <Input value={formatCurrency(phi.gia)} disabled className="text-sm w-32 bg-gray-50" />
              <Button type="button" variant="ghost" size="sm"
                onClick={() => removePhiDichVuLocal(idx)}
                className="h-8 w-8 p-0 text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input placeholder="Tên phí" value={newPhiDichVu.ten}
              onChange={(e) => setNewPhiDichVu(prev => ({ ...prev, ten: e.target.value }))}
              className="text-sm flex-1" />
            <Input type="number" placeholder="Giá" value={newPhiDichVu.gia || ''}
              onChange={(e) => setNewPhiDichVu(prev => ({ ...prev, gia: Number(e.target.value) }))}
              className="text-sm w-32" />
            <Button type="button" variant="outline" size="sm"
              onClick={addPhiDichVuLocal}
              disabled={!newPhiDichVu.ten || newPhiDichVu.gia <= 0}
              className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Thêm
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline"
            onClick={() => { setExpandedId(null); setEditForm(null); }}
            disabled={saving} className="text-sm">
            Hủy
          </Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Lưu thay đổi
          </Button>
        </div>
      </div>
    );
  }, [editForm, newPhiDichVu, saving]);

  // ─── Stats cards ────────────────────────────────────────────────────────────
  const statsCards = useMemo(() => {
    const total = hopDongList.length;
    const active = hopDongList.filter(hd => hd.trangThai === 'hoatDong').length;
    const expired = hopDongList.filter(hd => hd.trangThai === 'hetHan').length;
    const cancelled = hopDongList.filter(hd => hd.trangThai === 'daHuy').length;
    return { total, active, expired, cancelled };
  }, [hopDongList]);

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Quản lý hợp đồng"
        description="Danh sách tất cả hợp đồng trong hệ thống"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => setShowCreateForm(true) : undefined}
        addLabel="Thêm hợp đồng"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 font-medium">Tổng hợp đồng</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{statsCards.total}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 font-medium">Đang hoạt động</p>
              <p className="text-xl md:text-2xl font-bold text-green-600 mt-1">{statsCards.active}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Badge variant="default" className="bg-green-600">HD</Badge>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 font-medium">Hết hạn</p>
              <p className="text-xl md:text-2xl font-bold text-red-600 mt-1">{statsCards.expired}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <Badge variant="destructive">HH</Badge>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 font-medium">Đã hủy</p>
              <p className="text-xl md:text-2xl font-bold text-gray-600 mt-1">{statsCards.cancelled}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center">
              <Badge variant="secondary">Hủy</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            placeholder="Tìm kiếm hợp đồng..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="hoatDong">Hoạt động</SelectItem>
            <SelectItem value="hetHan">Hết hạn</SelectItem>
            <SelectItem value="daHuy">Đã hủy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={toaNhaFilter} onValueChange={setToaNhaFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tòa nhà" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {toaNhaList.map(toaNha => (
              <SelectItem key={toaNha.id!} value={toaNha.id!}>{toaNha.tenToaNha}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Thêm hợp đồng mới"
          description="Điền thông tin để tạo hợp đồng mới"
          onSave={handleCreateHopDong}
          onCancel={() => { setShowCreateForm(false); resetCreateForm(); }}
          saving={saving}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Mã hợp đồng *</Label>
              <Input
                value={createForm.maHopDong}
                onChange={(e) => setCreateForm(prev => ({ ...prev, maHopDong: e.target.value }))}
                placeholder="HD-001"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Phòng *</Label>
              <Select
                value={createForm.phong}
                onValueChange={(value) => {
                  setCreateForm(prev => ({ ...prev, phong: value }));
                  const toaNhaId = getToaNhaIdFromPhong(value);
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn phòng" />
                </SelectTrigger>
                <SelectContent>
                  {availablePhongForCreate.map(phong => (
                    <SelectItem key={phong.id!} value={phong.id!}>
                      {phong.maPhong} - {toaNhaList.find(t => t.id === (typeof phong.toaNha === 'object' ? (phong.toaNha as any).id : phong.toaNha))?.tenToaNha || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Người đại diện *</Label>
              <Select
                value={createForm.nguoiDaiDien}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, nguoiDaiDien: value }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Chọn người đại diện" />
                </SelectTrigger>
                <SelectContent>
                  {khachThueList.map(kt => (
                    <SelectItem key={kt.id!} value={kt.id!}>{kt.hoTen}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Khách thuê</Label>
              <Select
                value={createForm.khachThueId[0] || ''}
                onValueChange={(value) => setCreateForm(prev => ({
                  ...prev,
                  khachThueId: prev.khachThueId.includes(value)
                    ? prev.khachThueId.filter(id => id !== value)
                    : [...prev.khachThueId, value]
                }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={createForm.khachThueId.length > 0 ? `${createForm.khachThueId.length} khách thuê` : 'Chọn khách thuê'} />
                </SelectTrigger>
                <SelectContent>
                  {khachThueList.map(kt => (
                    <SelectItem key={kt.id!} value={kt.id!}>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={createForm.khachThueId.includes(kt.id!)} className="mr-2" />
                        {kt.hoTen}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Ngày bắt đầu</Label>
              <Input
                type="date"
                value={createForm.ngayBatDau}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ngayBatDau: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Ngày kết thúc *</Label>
              <Input
                type="date"
                value={createForm.ngayKetThuc}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ngayKetThuc: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Giá thuê</Label>
              <Input
                type="number"
                value={createForm.giaThue}
                onChange={(e) => setCreateForm(prev => ({ ...prev, giaThue: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tiền cọc</Label>
              <Input
                type="number"
                value={createForm.tienCoc}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tienCoc: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Ngày thanh toán</Label>
              <Input
                type="number" min={1} max={31}
                value={createForm.ngayThanhToan}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ngayThanhToan: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Chu kỳ thanh toán</Label>
              <Select
                value={createForm.chuKyThanhToan}
                onValueChange={(value: any) => setCreateForm(prev => ({ ...prev, chuKyThanhToan: value }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thang">Hàng tháng</SelectItem>
                  <SelectItem value="quy">Theo quý</SelectItem>
                  <SelectItem value="nam">Hàng năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Trạng thái</Label>
              <Select
                value={createForm.trangThai}
                onValueChange={(value: any) => setCreateForm(prev => ({ ...prev, trangThai: value }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoatDong">Hoạt động</SelectItem>
                  <SelectItem value="hetHan">Hết hạn</SelectItem>
                  <SelectItem value="daHuy">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Giá điện</Label>
              <Input
                type="number"
                value={createForm.giaDien}
                onChange={(e) => setCreateForm(prev => ({ ...prev, giaDien: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Giá nước</Label>
              <Input
                type="number"
                value={createForm.giaNuoc}
                onChange={(e) => setCreateForm(prev => ({ ...prev, giaNuoc: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Chỉ số điện ban đầu</Label>
              <Input
                type="number"
                value={createForm.chiSoDienBanDau}
                onChange={(e) => setCreateForm(prev => ({ ...prev, chiSoDienBanDau: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Chỉ số nước ban đầu</Label>
              <Input
                type="number"
                value={createForm.chiSoNuocBanDau}
                onChange={(e) => setCreateForm(prev => ({ ...prev, chiSoNuocBanDau: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Điều khoản</Label>
            <Textarea
              value={createForm.dieuKhoan}
              onChange={(e) => setCreateForm(prev => ({ ...prev, dieuKhoan: e.target.value }))}
              className="text-sm min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Phí dịch vụ</Label>
            {createForm.phiDichVu.map((phi, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={phi.ten} disabled className="text-sm flex-1 bg-gray-50" />
                <Input value={formatCurrency(phi.gia)} disabled className="text-sm w-32 bg-gray-50" />
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setCreateForm(prev => ({ ...prev, phiDichVu: prev.phiDichVu.filter((_, i) => i !== idx) }))}
                  className="h-8 w-8 p-0 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input placeholder="Tên phí" value={newPhiDichVu.ten}
                onChange={(e) => setNewPhiDichVu(prev => ({ ...prev, ten: e.target.value }))}
                className="text-sm flex-1" />
              <Input type="number" placeholder="Giá" value={newPhiDichVu.gia || ''}
                onChange={(e) => setNewPhiDichVu(prev => ({ ...prev, gia: Number(e.target.value) }))}
                className="text-sm w-32" />
              <Button type="button" variant="outline" size="sm"
                onClick={() => {
                  if (newPhiDichVu.ten && newPhiDichVu.gia > 0) {
                    setCreateForm(prev => ({ ...prev, phiDichVu: [...prev.phiDichVu, { ...newPhiDichVu }] }));
                    setNewPhiDichVu({ ten: '', gia: 0 });
                  }
                }}
                disabled={!newPhiDichVu.ten || newPhiDichVu.gia <= 0}
                className="text-xs">
                <Plus className="h-3 w-3 mr-1" /> Thêm
              </Button>
            </div>
          </div>
        </InlineForm>
      )}

      {/* View Modal */}
      {viewingHopDong && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-0 md:p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewingHopDong(null)} />
          <div className="relative w-full h-full md:w-[95vw] md:h-[95vh] md:max-w-6xl bg-white md:rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 md:p-6 border-b bg-white flex-shrink-0">
              <div>
                <h2 className="text-lg md:text-2xl font-semibold">Chi tiết hợp đồng</h2>
                <p className="text-xs md:text-sm text-gray-600">
                  Thông tin chi tiết hợp đồng {viewingHopDong.maHopDong}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingHopDong(null)} className="h-8 w-8 p-0">
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label className="text-xs md:text-sm font-medium text-gray-500">Mã hợp đồng</Label>
                    <p className="text-base md:text-lg font-semibold">{viewingHopDong.maHopDong}</p>
                  </div>
                  <div>
                    <Label className="text-xs md:text-sm font-medium text-gray-500">Trạng thái</Label>
                    <div className="mt-1">{getStatusBadge(viewingHopDong.trangThai)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label className="text-xs md:text-sm font-medium text-gray-500">Phòng</Label>
                    <p className="text-base md:text-lg">{getPhongName(viewingHopDong.phong)}</p>
                  </div>
                  <div>
                    <Label className="text-xs md:text-sm font-medium text-gray-500">Tòa nhà</Label>
                    <p className="text-base md:text-lg">{getPhongInfo(viewingHopDong.phong).toaNha}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Khách thuê</Label>
                  <div className="mt-2 space-y-1">
                    {viewingHopDong.khachThueIds.map((khachThue, index) => {
                      const khachThueId = typeof khachThue === 'object' ? (khachThue as { id: string }).id : khachThue;
                      const nguoiDaiDienId = typeof viewingHopDong.nguoiDaiDien === 'object' ? (viewingHopDong.nguoiDaiDien as { id: string }).id : viewingHopDong.nguoiDaiDien;
                      return (
                        <div key={khachThueId} className="flex items-center gap-2">
                          <span className="text-sm">
                            {index + 1}. {getKhachThueName(khachThue)}
                            {khachThueId === nguoiDaiDienId && (
                              <Badge variant="outline" className="ml-2">Người đại diện</Badge>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ngày bắt đầu</Label>
                    <p className="text-lg">{new Date(viewingHopDong.ngayBatDau).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ngày kết thúc</Label>
                    <p className="text-lg">{new Date(viewingHopDong.ngayKetThuc).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Giá thuê</Label>
                    <p className="text-lg font-semibold">{formatCurrency(viewingHopDong.giaThue)}/tháng</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Tiền cọc</Label>
                    <p className="text-lg font-semibold">{formatCurrency(viewingHopDong.tienCoc)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ngày thanh toán</Label>
                    <p className="text-lg">Hàng {viewingHopDong.chuKyThanhToan} - ngày {viewingHopDong.ngayThanhToan}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Giá điện</Label>
                    <p className="text-lg">{formatCurrency(viewingHopDong.giaDien)}/kWh</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Giá nước</Label>
                    <p className="text-lg">{formatCurrency(viewingHopDong.giaNuoc)}/m³</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Chỉ số điện ban đầu</Label>
                    <p className="text-lg">{viewingHopDong.chiSoDienBanDau} kWh</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Chỉ số nước ban đầu</Label>
                    <p className="text-lg">{viewingHopDong.chiSoNuocBanDau} m³</p>
                  </div>
                </div>

                {viewingHopDong.phiDichVu.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Phí dịch vụ</Label>
                    <div className="mt-2 space-y-2">
                      {viewingHopDong.phiDichVu.map((phi, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{phi.ten}</span>
                          <span className="font-semibold">{formatCurrency(phi.gia)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-500">Điều khoản</Label>
                  <p className="text-sm mt-2 p-3 bg-gray-50 rounded whitespace-pre-wrap">
                    {viewingHopDong.dieuKhoan}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ngày tạo</Label>
                    <p className="text-sm">{new Date(viewingHopDong.ngayTao).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ngày cập nhật</Label>
                    <p className="text-sm">{new Date(viewingHopDong.ngayCapNhat).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 p-4 md:p-6 border-t bg-white flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setViewingHopDong(null)} className="flex-1 sm:flex-none">
                Đóng
              </Button>
              <Button size="sm" onClick={() => handleDownload(viewingHopDong)} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-1" />
                Tải xuống Word
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <InlineEditTable
        data={tableData}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchTerm={searchTerm}
        loading={loading}
        emptyMessage="Không tìm thấy hợp đồng nào"
        onEdit={canEdit ? (item) => handleEditHopDong(item) : undefined}
        onDelete={canEdit ? (item) => handleDelete(item.id) : undefined}
        renderExpanded={renderExpanded}
        expandedId={expandedId}
        onToggleExpand={(id) => {
          setExpandedId(prev => prev === id ? null : id);
          if (expandedId !== id) {
            const item = tableData.find(i => i.id === id);
            if (item) handleEditHopDong(item);
          } else {
            setEditForm(null);
          }
        }}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleView(hopDongList.find(hd => (hd.id || hd._id) === item.id) as HopDong); }}
              className="h-8 w-8 p-0"
              title="Xem chi tiết"
            >
              <FileText className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); const hd = hopDongList.find(h => (h.id || h._id) === item.id); if (hd) handleDownload(hd); }}
              className="h-8 w-8 p-0"
              title="Tải xuống Word"
            >
              <Download className="h-4 w-4 text-green-600" />
            </Button>
            {item.trangThai === 'hoatDong' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); const hd = hopDongList.find(h => (h.id || h._id) === item.id); if (hd) handleGiaHan(hd); }}
                className="h-8 w-8 p-0"
                title="Gia hạn"
                disabled={actionLoading === `giahan-${item.id}`}
              >
                <RefreshCw className={`h-4 w-4 text-orange-600 ${actionLoading === `giahan-${item.id}` ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {item.trangThai === 'hoatDong' && (
              <ConfirmPopover
                title="Xác nhận hủy hợp đồng"
                message={`Bạn có chắc chắn muốn hủy hợp đồng ${item.maHopDong}?`}
                onConfirm={async () => { const hd = hopDongList.find(h => (h.id || h._id) === item.id); if (hd) await handleHuy(hd); }}
                confirmLabel="Hủy hợp đồng"
                cancelLabel="Không"
                variant="danger"
              >
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Hủy hợp đồng">
                  <CloseIcon className="h-4 w-4 text-red-600" />
                </Button>
              </ConfirmPopover>
            )}
          </div>
        )}
      />
    </div>
  );
}