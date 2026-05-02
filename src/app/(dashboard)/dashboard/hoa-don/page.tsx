'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Receipt,
  AlertCircle,
  Zap,
  Download,
  CreditCard,
  Camera,
  FileText,
  Copy,
  RefreshCw,
  Calendar,
  Users,
  Home,
  Edit,
  Trash2,
  Send,
  Phone,
  MessageSquare,
  X as CloseIcon,
} from 'lucide-react';
import { HoaDon, HopDong, Phong, KhachThue } from '@/types';
import { useCanEdit } from '@/hooks/use-can-edit';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/page-header';
import SearchInput from '@/components/dashboard/search-input';
import InlineForm from '@/components/dashboard/inline-form';
import InlineEditTable, { ColumnDef } from '@/components/dashboard/inline-edit-table';

// Xóa dấu tiếng Việt, giữ chữ + số + khoảng trắng
function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Tạo nội dung chuyển khoản: "PHONG P101 [TOA NHA] HDXXX"
function buildTransferDesc(hoaDon: HoaDon, phongList: Phong[]): string {
  const phong = phongList.find(p => p.id === hoaDon.phong || (p as any).id === (hoaDon.phong as any)?.id);
  const maPhong = phong?.maPhong ? removeAccents(phong.maPhong) : '';

  // Lấy tên tòa nhà nếu có nhiều tòa (hoặc luôn đính kèm nếu có)
  const toaNha = (phong as any)?.toaNha;
  const tenToaNha = toaNha?.tenToaNha ? removeAccents(toaNha.tenToaNha) : '';

  // Đếm số tòa nhà khác nhau trong danh sách phòng
  const distinctBuildings = new Set(phongList.map((p: any) => p.toaNha?.id || p.toaNhaId).filter(Boolean));
  const includeBuilding = distinctBuildings.size > 1 && tenToaNha;

  const maHD = removeAccents(hoaDon.maHoaDon);
  const parts = ['THANH TOAN'];
  if (maPhong) parts.push(`PHONG ${maPhong}`);
  if (includeBuilding) parts.push(tenToaNha);
  parts.push(maHD);
  return parts.join(' ');
}

// Tạo URL QR VietQR (SePay)
function buildVietQRUrl(soTaiKhoan: string, bank: string, amount: number, des: string): string {
  const params = new URLSearchParams({
    acc: soTaiKhoan,
    bank,
    amount: String(Math.round(amount)),
    des,
    template: 'compact',
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

// Helper functions for form and dialogs
const getPhongName = (phongId: string | Phong, phongList: Phong[]) => {
  if (!phongId) return 'N/A';
  if (typeof phongId === 'object' && phongId.maPhong) {
    return phongId.maPhong;
  }
  if (typeof phongId === 'string') {
    const phong = phongList.find(p => p.id === phongId);
    return phong?.maPhong || 'N/A';
  }
  return 'N/A';
};

const getKhachThueName = (khachThueId: string | KhachThue, khachThueList: KhachThue[]) => {
  if (!khachThueId) return 'N/A';
  if (typeof khachThueId === 'object' && khachThueId.hoTen) {
    return khachThueId.hoTen;
  }
  if (typeof khachThueId === 'string') {
    const khachThue = khachThueList.find(k => k.id === khachThueId);
    return khachThue?.hoTen || 'N/A';
  }
  return 'N/A';
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

interface InlineEditHoaDon {
  id: string;
  maHoaDon: string;
  phong: string;
  khachThue: string;
  thang: number;
  nam: number;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  trangThai: string;
  hanThanhToan: Date;
  hopDong: string;
  tienPhong: number;
  tienDien: number;
  soDien: number;
  chiSoDienBanDau: number;
  chiSoDienCuoiKy: number;
  tienNuoc: number;
  soNuoc: number;
  chiSoNuocBanDau: number;
  chiSoNuocCuoiKy: number;
  phiDichVu: Array<{ten: string, gia: number}>;
  ghiChu?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export default function HoaDonPage() {
  const canEdit = useCanEdit();
  const cache = useCache<{
    hoaDonList: HoaDon[];
    hopDongList: HopDong[];
    phongList: Phong[];
    khachThueList: KhachThue[];
  }>({ key: 'hoa-don-data', duration: 30000 }); // 30 giây — tránh cache stale khi quyền thay đổi
  
  const [hoaDonList, setHoaDonList] = useState<HoaDon[]>([]);
  const [hopDongList, setHopDongList] = useState<HopDong[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [viewingHoaDon, setViewingHoaDon] = useState<HoaDon | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // States for Cancel Invoice
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelHoaDon, setCancelHoaDon] = useState<HoaDon | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  
  const [paymentHoaDon, setPaymentHoaDon] = useState<HoaDon | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [sendingHoaDon, setSendingHoaDon] = useState<HoaDon | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSendingZalo, setIsSendingZalo] = useState(false);
  const [bankSettings, setBankSettings] = useState({ tenNganHang: '', soTaiKhoan: '', chuTaiKhoan: '' });
  const [sendBankInfo, setSendBankInfo] = useState<{ soTaiKhoan: string; nganHang: string; chuTaiKhoan: string } | null>(null);
  const [isSendingZaloPdf, setIsSendingZaloPdf] = useState(false);

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    maHoaDon: '',
    hopDong: '',
    phong: '',
    khachThue: '',
    thang: new Date().getMonth() + 1,
    nam: new Date().getFullYear(),
    tienPhong: 0,
    tienDien: 0,
    soDien: 0,
    chiSoDienBanDau: 0,
    chiSoDienCuoiKy: 0,
    tienNuoc: 0,
    soNuoc: 0,
    chiSoNuocBanDau: 0,
    chiSoNuocCuoiKy: 0,
    phiDichVu: [] as Array<{ten: string, gia: number}>,
    tongTien: 0,
    daThanhToan: 0,
    conLai: 0,
    trangThai: 'chuaThanhToan' as 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan',
    hanThanhToan: '',
    ghiChu: '',
  });
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InlineEditHoaDon | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Quản lý Hóa đơn';
  }, []);

  useEffect(() => {
    fetchData();
    // Lấy thông tin ngân hàng từ cài đặt
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (data.success && Array.isArray(data.data)) {
        const get = (khoa: string) => data.data.find((s: any) => s.khoa === khoa)?.giaTri || '';
        setBankSettings({
          tenNganHang: get('ngan_hang_ten'),
          soTaiKhoan: get('ngan_hang_so_tai_khoan'),
          chuTaiKhoan: get('ngan_hang_chu_tai_khoan'),
        });
      }
    }).catch(() => {});
  }, []);

  // Re-fetch khi tab được focus lại — tránh data stale khi admin thay đổi quyền
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cache.clearCache();
        fetchData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Real-time: tự động refresh khi có thay đổi từ người dùng khác
  useRealtimeEvents(['hoa-don', 'thanh-toan'], (_type, _action) => {
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
          setHoaDonList(cachedData.hoaDonList || []);
          setHopDongList(cachedData.hopDongList || []);
          setPhongList(cachedData.phongList || []);
          setKhachThueList(cachedData.khachThueList || []);
          setLoading(false);
          return;
        }
      }
      
      // Fetch hóa đơn từ API
      const hoaDonResponse = await fetch('/api/hoa-don');
      const hoaDonData = hoaDonResponse.ok ? await hoaDonResponse.json() : { data: [] };
      const hoaDons = hoaDonData.data || [];
      setHoaDonList(hoaDons);

      // Fetch form data (hop dong, phong, khach thue) từ API
      const formDataResponse = await fetch('/api/hoa-don/form-data');
      if (formDataResponse.ok) {
        const formData = await formDataResponse.json();
        const hopDongs = formData.data.hopDongList || [];
        const phongs = formData.data.phongList || [];
        const khachThues = formData.data.khachThueList || [];
        
        setHopDongList(hopDongs);
        setPhongList(phongs);
        setKhachThueList(khachThues);
        
        // Lưu vào cache
        cache.setCache({
          hoaDonList: hoaDons,
          hopDongList: hopDongs,
          phongList: phongs,
          khachThueList: khachThues,
        });
      } else {
        console.error('Failed to load form data:', formDataResponse.status);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    cache.setIsRefreshing(true);
    await fetchData(true); // Force refresh
    cache.setIsRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  const filteredHoaDon = hoaDonList.filter(hoaDon => {
    const matchesSearch = hoaDon.maHoaDon.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         hoaDon.ghiChu?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || hoaDon.trangThai === statusFilter;
    const matchesMonth = monthFilter === 'all' || hoaDon.thang.toString() === monthFilter;
    const matchesYear = yearFilter === 'all' || hoaDon.nam.toString() === yearFilter;
    
    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'chuaThanhToan':
        return <Badge variant="destructive">Chưa thanh toán</Badge>;
      case 'daThanhToanMotPhan':
        return <Badge variant="secondary">Thanh toán một phần</Badge>;
      case 'daThanhToan':
        return <Badge variant="default">Đã thanh toán</Badge>;
      case 'daHuy':
        return <Badge variant="secondary" className="bg-gray-500 text-white">Đã hủy</Badge>;
      case 'quaHan':
        return <Badge variant="outline">Quá hạn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  };

  const handleCancelInvoiceClick = (hoaDon: HoaDon) => {
    setCancelHoaDon(hoaDon);
    setCancelReason('');
    setIsCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelHoaDon || !cancelReason.trim()) return;
    
    setIsCanceling(true);
    try {
      // Đảm bảo lấy ID của hopDong nếu nó là object
      const hopDongId = typeof cancelHoaDon.hopDong === 'object' 
        ? (cancelHoaDon.hopDong as any)?.id || (cancelHoaDon.hopDong as any)?._id 
        : cancelHoaDon.hopDong;

      const response = await fetch(`/api/hoa-don`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...cancelHoaDon,
          hopDong: hopDongId,
          trangThai: 'daHuy',
          ghiChu: cancelHoaDon.ghiChu ? `${cancelHoaDon.ghiChu}\nLý do hủy: ${cancelReason}` : `Lý do hủy: ${cancelReason}`
        }),
      });

      if (response.ok) {
        const result = await response.json();
        cache.clearCache();
        setHoaDonList(prev => prev.map(hd => hd.id === cancelHoaDon.id ? result.data : hd));
        toast.success('Hóa đơn đã được hủy thành công');
        setIsCancelDialogOpen(false);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra khi hủy hóa đơn');
      }
    } catch (error) {
      console.error('Error canceling hoa don:', error);
      toast.error('Có lỗi xảy ra khi hủy hóa đơn');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleDeleteMultiple = async (ids: string[]) => {
    if (ids.length === 0) return;
    
    try {
      // Xóa từng hóa đơn (có thể cải thiện bằng batch delete API)
      const deletePromises = ids.map(id => 
        fetch(`/api/hoa-don?id=${id}`, { method: 'DELETE' })
      );
      
      const results = await Promise.all(deletePromises);
      const failedDeletes = results.filter(result => !result.ok);
      
      if (failedDeletes.length === 0) {
        cache.clearCache();
        setHoaDonList(prev => prev.filter(hoaDon => !ids.includes(hoaDon.id!)));
        toast.success(`Đã xóa thành công ${ids.length} hóa đơn`);
      } else {
        toast.error(`Có ${failedDeletes.length} hóa đơn không thể xóa`);
      }
    } catch (error) {
      console.error('Error deleting multiple hoa don:', error);
      toast.error('Có lỗi xảy ra khi xóa hóa đơn');
    }
  };

  const handleView = (hoaDon: HoaDon) => {
    setViewingHoaDon(hoaDon);
    setIsViewDialogOpen(true);
  };

  const handlePayment = (hoaDon: HoaDon) => {
    setPaymentHoaDon(hoaDon);
    setIsPaymentDialogOpen(true);
  };

  const handleCopyLink = (hoaDon: HoaDon) => {
    const publicUrl = `${window.location.origin}/hoa-don/${hoaDon.id}`;
    
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast.success('Đã sao chép link hóa đơn vào clipboard!');
    }).catch(() => {
      // Fallback: hiển thị modal với link
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
          <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">Link hóa đơn công khai</h3>
            <p style="margin: 0 0 10px 0; color: #666;">Gửi link này cho khách hàng để họ có thể xem hóa đơn:</p>
            <input type="text" value="${publicUrl}" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px;" />
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button onclick="this.closest('div').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Đóng</button>
              <button onclick="navigator.clipboard.writeText('${publicUrl}').then(() => alert('Đã sao chép!')).catch(() => alert('Không thể sao chép')); this.closest('div').remove();" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Sao chép</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    });
  };

  const generateBillingMessage = (hoaDon: HoaDon, bankOverride?: typeof sendBankInfo) => {
    const phongName = getPhongName(hoaDon.phong, phongList);
    const khachThueName = getKhachThueName(hoaDon.khachThue, khachThueList);
    const hanTT = new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN');
    const phiDVText = hoaDon.phiDichVu.length > 0
      ? hoaDon.phiDichVu.map(p => `  - ${p.ten}: ${formatCurrency(p.gia)}`).join('\n')
      : '  (không có)';

    // Ưu tiên per-invoice bank (theo người tạo), fallback global CaiDat
    const bank = bankOverride ?? (bankSettings.soTaiKhoan ? { soTaiKhoan: bankSettings.soTaiKhoan, nganHang: bankSettings.tenNganHang, chuTaiKhoan: bankSettings.chuTaiKhoan } : null);
    const bankBlock = hoaDon.conLai > 0 && bank?.soTaiKhoan && bank?.nganHang
      ? `\n━━━━━━━━━━━━━━━━━━━━\n🏦 CHUYỂN KHOẢN\nNgân hàng: ${bank.nganHang}\nSố TK: ${bank.soTaiKhoan}${bank.chuTaiKhoan ? `\nChủ TK: ${bank.chuTaiKhoan}` : ''}\nSố tiền: ${formatCurrency(hoaDon.conLai)}\nNội dung: ${buildTransferDesc(hoaDon, phongList)}`
      : '';

    const isPaid = hoaDon.conLai <= 0;
    const footer = isPaid
      ? `Hạn thanh toán: ${hanTT}\n✅ Đã thanh toán đầy đủ. Cảm ơn bạn!`
      : `Hạn thanh toán: ${hanTT}\nVui lòng thanh toán đúng hạn.`;

    return `THÔNG BÁO TIỀN PHÒNG THÁNG ${hoaDon.thang}/${hoaDon.nam}
━━━━━━━━━━━━━━━━━━━━
Phòng: ${phongName}
Khách thuê: ${khachThueName}
━━━━━━━━━━━━━━━━━━━━
Tiền phòng: ${formatCurrency(hoaDon.tienPhong)}
Tiền điện (${hoaDon.soDien} kWh): ${formatCurrency(hoaDon.tienDien)}
Tiền nước (${hoaDon.soNuoc} m³): ${formatCurrency(hoaDon.tienNuoc)}
Phí dịch vụ:
${phiDVText}
━━━━━━━━━━━━━━━━━━━━
TỔNG TIỀN: ${formatCurrency(hoaDon.tongTien)}
Đã thanh toán: ${formatCurrency(hoaDon.daThanhToan)}
CÒN LẠI: ${formatCurrency(hoaDon.conLai)}${bankBlock}
━━━━━━━━━━━━━━━━━━━━
${footer}`;
  };

  const getKhachThueContact = (hoaDon: HoaDon): { phone: string; zaloChatId: string } => {
    let phone = '';
    let zaloChatId = '';
    if (typeof hoaDon.khachThue === 'object' && hoaDon.khachThue !== null) {
      phone = (hoaDon.khachThue as any)?.soDienThoai || '';
      zaloChatId = (hoaDon.khachThue as any)?.zaloChatId || '';
    }
    const ktId = typeof hoaDon.khachThue === 'string' ? hoaDon.khachThue
      : (hoaDon.khachThue as any)?.id || (hoaDon as any).khachThueId || '';
    if (ktId) {
      const kt = khachThueList.find(k => k.id === ktId);
      if (kt) {
        if (!phone) phone = kt.soDienThoai || '';
        if (!zaloChatId) zaloChatId = (kt as any).zaloChatId || '';
      }
    }
    return { phone, zaloChatId };
  };

  const handleSend = (hoaDon: HoaDon) => {
    setSendingHoaDon(hoaDon);
    setSendBankInfo(null);
    setIsSendDialogOpen(true);
    // Fetch per-invoice bank info (respects per-creator bank when flag is on)
    fetch(`/api/hoa-don-public/${hoaDon.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.cauHinh) {
          const c = d.data.cauHinh;
          setSendBankInfo({ soTaiKhoan: c.soTaiKhoan || '', nganHang: c.nganHang || '', chuTaiKhoan: c.chuTaiKhoan || '' });
        }
      })
      .catch(() => {});
  };

  const handleDownload = async (hoaDon: HoaDon) => {
    try {
      toast.info('Đang tạo PDF...');
      const res = await fetch(`/api/hoa-don/${hoaDon.id}/pdf`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoa-don-${hoaDon.maHoaDon}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất hóa đơn thành PDF!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Có lỗi xảy ra khi xuất PDF');
    }
  };

  const handleScreenshot = handleDownload;

  const handleAutoCreateInvoices = async () => {
    if (!confirm('Bạn có chắc chắn muốn tạo hóa đơn tự động cho tất cả hợp đồng đang hoạt động?')) {
      return;
    }

    setIsAutoCreating(true);
    try {
      const response = await fetch('/api/auto-invoice', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Đã tạo ${result.data.createdInvoices} hóa đơn tự động`);
        if (result.data.errors.length > 0) {
          toast.warning(`Một số lỗi xảy ra: ${result.data.errors.length} lỗi`);
          console.warn('Chi tiết lỗi:', result.data.errors);
        }
        fetchData(); // Refresh data
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra khi tạo hóa đơn tự động');
      }
    } catch (error) {
      console.error('Error auto creating invoices:', error);
      toast.error('Có lỗi xảy ra khi tạo hóa đơn tự động');
    } finally {
      setIsAutoCreating(false);
    }
  };

  // --- Inline Create ---
  const generateInvoiceCode = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `HD${year}${month}${day}${randomNum}`;
  };

  const resetCreateForm = () => {
    setCreateForm({
      maHoaDon: generateInvoiceCode(),
      hopDong: '',
      phong: '',
      khachThue: '',
      thang: new Date().getMonth() + 1,
      nam: new Date().getFullYear(),
      tienPhong: 0,
      tienDien: 0,
      soDien: 0,
      chiSoDienBanDau: 0,
      chiSoDienCuoiKy: 0,
      tienNuoc: 0,
      soNuoc: 0,
      chiSoNuocBanDau: 0,
      chiSoNuocCuoiKy: 0,
      phiDichVu: [],
      tongTien: 0,
      daThanhToan: 0,
      conLai: 0,
      trangThai: 'chuaThanhToan',
      hanThanhToan: '',
      ghiChu: '',
    });
  };

  const handleCreateHoaDon = async () => {
    if (!createForm.maHoaDon || !createForm.hopDong || !createForm.phong || !createForm.khachThue) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/hoa-don', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success('Tạo hóa đơn thành công');
        setShowCreateForm(false);
        cache.clearCache();
        fetchData(true);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating hoa don:', error);
      toast.error('Có lỗi xảy ra khi tạo hóa đơn');
    } finally {
      setCreating(false);
    }
  };

  // --- Inline Edit ---
  const handleEditHoaDon = useCallback((item: InlineEditHoaDon) => {
    setEditForm({ ...item });
    setExpandedId(item.id);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/hoa-don`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success('Cập nhật hóa đơn thành công');
        setExpandedId(null);
        setEditForm(null);
        cache.clearCache();
        fetchData(true);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating hoa don:', error);
      toast.error('Có lỗi xảy ra khi cập nhật hóa đơn');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InlineEditHoaDon) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa hóa đơn ${item.maHoaDon}?`)) return;
    try {
      const response = await fetch(`/api/hoa-don?id=${item.id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Xóa hóa đơn thành công');
        cache.clearCache();
        setHoaDonList(prev => prev.filter(hd => hd.id !== item.id));
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error deleting hoa don:', error);
      toast.error('Có lỗi xảy ra khi xóa hóa đơn');
    }
  };

  // --- Table Data ---
  const tableData = useMemo((): InlineEditHoaDon[] => {
    return filteredHoaDon.map(hd => ({
      id: hd.id || hd._id || '',
      maHoaDon: hd.maHoaDon,
      phong: hd.phong,
      khachThue: hd.khachThue,
      thang: hd.thang,
      nam: hd.nam,
      tongTien: hd.tongTien,
      daThanhToan: hd.daThanhToan,
      conLai: hd.conLai,
      trangThai: hd.trangThai,
      hanThanhToan: hd.hanThanhToan,
      hopDong: hd.hopDong,
      tienPhong: hd.tienPhong,
      tienDien: hd.tienDien,
      soDien: hd.soDien,
      chiSoDienBanDau: hd.chiSoDienBanDau,
      chiSoDienCuoiKy: hd.chiSoDienCuoiKy,
      tienNuoc: hd.tienNuoc,
      soNuoc: hd.soNuoc,
      chiSoNuocBanDau: hd.chiSoNuocBanDau,
      chiSoNuocCuoiKy: hd.chiSoNuocCuoiKy,
      phiDichVu: hd.phiDichVu,
      ghiChu: hd.ghiChu,
      ngayTao: hd.ngayTao,
      ngayCapNhat: hd.ngayCapNhat,
    }));
  }, [filteredHoaDon]);

  const columns: ColumnDef<InlineEditHoaDon>[] = useMemo(() => [
    {
      key: 'maHoaDon',
      header: 'Mã hóa đơn',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
          <div>
            <span className="font-medium text-gray-900">{item.maHoaDon}</span>
            <div className="text-xs text-gray-500">
              {getPhongName(item.phong, phongList)} - Tháng {item.thang}/{item.nam}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          {getStatusBadge(item.trangThai)}
          {new Date(item.hanThanhToan) < new Date() && item.trangThai !== 'daThanhToan' && item.trangThai !== 'daHuy' && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">Quá hạn</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'khachThue',
      header: 'Khách thuê',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>{getKhachThueName(item.khachThue, khachThueList)}</span>
        </div>
      ),
    },
    {
      key: 'tongTien',
      header: 'Tổng tiền',
      sortable: true,
      className: 'text-right',
      render: (item) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">{formatCurrency(item.tongTien)}</div>
          <div className="text-xs text-gray-500">
            Đã thanh toán: <span className="text-green-600">{formatCurrency(item.daThanhToan)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'conLai',
      header: 'Còn lại',
      sortable: true,
      className: 'text-right',
      render: (item) => (
        <div className="text-right">
          <span className={item.conLai > 0 ? 'font-semibold text-red-600' : 'font-medium text-green-600'}>
            {formatCurrency(item.conLai)}
          </span>
        </div>
      ),
    },
  ], [phongList, khachThueList]);

  const renderExpanded = useCallback((item: InlineEditHoaDon) => {
    if (!editForm || editForm.id !== item.id) return null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Mã hóa đơn</Label>
            <Input
              value={editForm.maHoaDon}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, maHoaDon: e.target.value } : null)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Trạng thái</Label>
            <Select
              value={editForm.trangThai}
              onValueChange={(value) => setEditForm(prev => prev ? { ...prev, trangThai: value } : null)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chuaThanhToan">Chưa thanh toán</SelectItem>
                <SelectItem value="daThanhToanMotPhan">Thanh toán một phần</SelectItem>
                <SelectItem value="daThanhToan">Đã thanh toán</SelectItem>
                <SelectItem value="quaHan">Quá hạn</SelectItem>
                <SelectItem value="daHuy">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Tiền phòng</Label>
            <Input
              type="number"
              value={editForm.tienPhong}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tienPhong: Number(e.target.value) } : null)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Tiền điện</Label>
            <Input
              type="number"
              value={editForm.tienDien}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tienDien: Number(e.target.value) } : null)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Tiền nước</Label>
            <Input
              type="number"
              value={editForm.tienNuoc}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, tienNuoc: Number(e.target.value) } : null)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Số điện (kWh)</Label>
            <Input
              type="number"
              value={editForm.soDien}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, soDien: Number(e.target.value) } : null)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Số nước (m³)</Label>
            <Input
              type="number"
              value={editForm.soNuoc}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, soNuoc: Number(e.target.value) } : null)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Hạn thanh toán</Label>
            <Input
              type="date"
              value={new Date(editForm.hanThanhToan).toISOString().split('T')[0]}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, hanThanhToan: new Date(e.target.value) } : null)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-700">Ghi chú</Label>
          <Textarea
            value={editForm.ghiChu || ''}
            onChange={(e) => setEditForm(prev => prev ? { ...prev, ghiChu: e.target.value } : null)}
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => { setExpandedId(null); setEditForm(null); }}>
            Hủy
          </Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="text-sm">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>
    );
  }, [editForm, saving, handleSaveEdit]);

  // Stats cards
  const statsCards = useMemo(() => {
    const total = hoaDonList.length;
    const unpaid = hoaDonList.filter(h => h.trangThai === 'chuaThanhToan').length;
    const overdue = hoaDonList.filter(h => new Date(h.hanThanhToan) < new Date() && h.trangThai !== 'daThanhToan' && h.trangThai !== 'daHuy').length;
    const revenue = hoaDonList.reduce((sum, h) => sum + h.daThanhToan, 0);
    return { total, unpaid, overdue, revenue };
  }, [hoaDonList]);

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
        title="Quản lý hóa đơn"
        description="Danh sách tất cả hóa đơn trong hệ thống"
        descriptionClassName="text-lg rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-1.5"
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => {
          resetCreateForm();
          setShowCreateForm(true);
        } : undefined}
        addLabel="Tạo hóa đơn"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Tổng hóa đơn</p>
              <p className="text-base md:text-2xl font-bold text-indigo-900">{statsCards.total}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Receipt className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Chưa thanh toán</p>
              <p className="text-base md:text-2xl font-bold text-red-600">{statsCards.unpaid}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Receipt className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Quá hạn</p>
              <p className="text-base md:text-2xl font-bold text-orange-600">{statsCards.overdue}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <AlertCircle className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-medium text-indigo-600">Doanh thu</p>
              <p className="text-xs md:text-2xl font-bold text-green-600 truncate">
                {formatCurrency(statsCards.revenue)}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Receipt className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            placeholder="Tìm kiếm hóa đơn..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="chuaThanhToan">Chưa thanh toán</SelectItem>
            <SelectItem value="daThanhToan">Đã thanh toán</SelectItem>
            <SelectItem value="daThanhToanMotPhan">Thanh toán 1 phần</SelectItem>
            <SelectItem value="quaHan">Quá hạn</SelectItem>
            <SelectItem value="daHuy">Đã hủy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Tháng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {getMonthOptions().map(month => (
              <SelectItem key={month} value={month.toString()}>Tháng {month}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Năm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {getYearOptions().map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoCreateInvoices}
            disabled={isAutoCreating}
            className="whitespace-nowrap border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Zap className="h-4 w-4 mr-1.5" />
            {isAutoCreating ? 'Đang tạo...' : 'Tạo tự động'}
          </Button>
        )}
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <InlineForm
          title="Tạo hóa đơn mới"
          description="Nhập thông tin hóa đơn"
          onSave={handleCreateHoaDon}
          onCancel={() => setShowCreateForm(false)}
          saving={creating}
          saveLabel="Tạo hóa đơn"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Mã hóa đơn</Label>
              <Input
                value={createForm.maHoaDon}
                onChange={(e) => setCreateForm(prev => ({ ...prev, maHoaDon: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Hợp đồng</Label>
              <Select
                value={createForm.hopDong}
                onValueChange={(value) => {
                  const hd = hopDongList.find(h => h.id === value);
                  setCreateForm(prev => ({
                    ...prev,
                    hopDong: value,
                    phong: typeof hd?.phong === 'string' ? hd?.phong : (hd?.phong as any)?._id || (hd?.phong as any)?.id || '',
                    khachThue: hd?.khachThueIds?.[0] || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn hợp đồng" />
                </SelectTrigger>
                <SelectContent>
                  {hopDongList.filter(h => h.trangThai === 'hoatDong').map(hd => (
                    <SelectItem key={hd.id} value={hd.id!}>
                      {hd.maHopDong}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Tháng</Label>
              <Select
                value={createForm.thang.toString()}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, thang: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(m => (
                    <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Năm</Label>
              <Select
                value={createForm.nam.toString()}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, nam: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Trạng thái</Label>
              <Select
                value={createForm.trangThai}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, trangThai: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chuaThanhToan">Chưa thanh toán</SelectItem>
                  <SelectItem value="daThanhToanMotPhan">Thanh toán một phần</SelectItem>
                  <SelectItem value="daThanhToan">Đã thanh toán</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Tiền phòng</Label>
              <Input
                type="number"
                value={createForm.tienPhong}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tienPhong: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Tiền điện</Label>
              <Input
                type="number"
                value={createForm.tienDien}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tienDien: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Tiền nước</Label>
              <Input
                type="number"
                value={createForm.tienNuoc}
                onChange={(e) => setCreateForm(prev => ({ ...prev, tienNuoc: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Số điện (kWh)</Label>
              <Input
                type="number"
                value={createForm.soDien}
                onChange={(e) => setCreateForm(prev => ({ ...prev, soDien: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Số nước (m³)</Label>
              <Input
                type="number"
                value={createForm.soNuoc}
                onChange={(e) => setCreateForm(prev => ({ ...prev, soNuoc: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Hạn thanh toán</Label>
              <Input
                type="date"
                value={createForm.hanThanhToan}
                onChange={(e) => setCreateForm(prev => ({ ...prev, hanThanhToan: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Ghi chú</Label>
            <Textarea
              value={createForm.ghiChu}
              onChange={(e) => setCreateForm(prev => ({ ...prev, ghiChu: e.target.value }))}
              rows={2}
            />
          </div>
        </InlineForm>
      )}

      {/* InlineEditTable */}
      <InlineEditTable
        data={tableData}
        columns={columns}
        keyExtractor={(item) => item.id}
        onEdit={canEdit ? handleEditHoaDon : undefined}
        onDelete={canEdit ? (item) => handleDelete(item) : undefined}
        renderExpanded={renderExpanded}
        expandedId={expandedId}
        onToggleExpand={(id) => {
          if (id === null) {
            setExpandedId(null);
            setEditForm(null);
          } else {
            const item = tableData.find(d => d.id === id);
            if (item) {
              setEditForm({ ...item });
              setExpandedId(id);
            }
          }
        }}
        renderActions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
              onClick={() => handleView(hoaDonList.find(h => (h.id || h._id) === item.id)!)}
              title="Xem chi tiết"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
              onClick={() => handleDownload(hoaDonList.find(h => (h.id || h._id) === item.id)!)}
              title="Tải PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
            {item.conLai > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                onClick={() => handlePayment(hoaDonList.find(h => (h.id || h._id) === item.id)!)}
                title="Thanh toán"
              >
                <CreditCard className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-orange-600 hover:text-orange-800 hover:bg-orange-50"
              onClick={() => handleSend(hoaDonList.find(h => (h.id || h._id) === item.id)!)}
              title="Gửi Zalo"
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              onClick={() => handleCopyLink(hoaDonList.find(h => (h.id || h._id) === item.id)!)}
              title="Sao chép link"
            >
              <Copy className="h-4 w-4" />
            </Button>
            {item.trangThai !== 'daHuy' && item.trangThai !== 'daThanhToan' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                onClick={() => handleCancelInvoiceClick(hoaDonList.find(h => (h.id || h._id) === item.id)!)}
                title="Hủy hóa đơn"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      {/* View Invoice Detail */}
      {isViewDialogOpen && viewingHoaDon && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-indigo-100">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-indigo-900">Chi tiết hóa đơn</h3>
              <p className="text-xs md:text-sm text-indigo-500/70">
                Thông tin chi tiết hóa đơn {viewingHoaDon.maHoaDon}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsViewDialogOpen(false)} className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50">
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            {/* Invoice Header */}
            <div className="text-center border-b border-indigo-100 pb-3 md:pb-4">
              <h2 className="text-lg md:text-2xl font-bold text-indigo-900">HÓA ĐƠN THUÊ PHÒNG</h2>
              <p className="text-base md:text-lg text-indigo-500">{viewingHoaDon.maHoaDon}</p>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                <h3 className="text-sm md:text-base font-semibold text-indigo-900 mb-2">Thông tin phòng</h3>
                <p className="text-xs md:text-sm text-indigo-700"><strong>Phòng:</strong> {getPhongName(viewingHoaDon.phong, phongList)}</p>
                <p className="text-xs md:text-sm text-indigo-700"><strong>Khách thuê:</strong> {getKhachThueName(viewingHoaDon.khachThue, khachThueList)}</p>
                <p className="text-xs md:text-sm text-indigo-700"><strong>Hợp đồng:</strong> {
                  hopDongList.find(hd => hd.id === viewingHoaDon.hopDong)?.maHopDong || 'N/A'
                }</p>
              </div>
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                <h3 className="text-sm md:text-base font-semibold text-indigo-900 mb-2">Thông tin thanh toán</h3>
                <p className="text-xs md:text-sm text-indigo-700"><strong>Tháng/Năm:</strong> {viewingHoaDon.thang}/{viewingHoaDon.nam}</p>
                <p className="text-xs md:text-sm text-indigo-700"><strong>Hạn thanh toán:</strong> {new Date(viewingHoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</p>
                <p className="text-xs md:text-sm text-indigo-700"><strong>Trạng thái:</strong> {getStatusBadge(viewingHoaDon.trangThai)}</p>
              </div>
            </div>

            {/* Chi so dien nuoc */}
            <div>
              <h3 className="text-sm md:text-base font-semibold text-indigo-900 mb-3">Chỉ số điện nước</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                  <h4 className="font-medium text-indigo-900 mb-2">Điện</h4>
                  <div className="space-y-1 text-sm text-indigo-700">
                    <div className="flex justify-between">
                      <span>Chỉ số ban đầu:</span>
                      <span>{viewingHoaDon.chiSoDienBanDau || 0} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chỉ số cuối kỳ:</span>
                      <span>{viewingHoaDon.chiSoDienCuoiKy || 0} kWh</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Số điện sử dụng:</span>
                      <span>{viewingHoaDon.soDien || 0} kWh</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                  <h4 className="font-medium text-indigo-900 mb-2">Nước</h4>
                  <div className="space-y-1 text-sm text-indigo-700">
                    <div className="flex justify-between">
                      <span>Chỉ số ban đầu:</span>
                      <span>{viewingHoaDon.chiSoNuocBanDau || 0} m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chỉ số cuối kỳ:</span>
                      <span>{viewingHoaDon.chiSoNuocCuoiKy || 0} m³</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Số nước sử dụng:</span>
                      <span>{viewingHoaDon.soNuoc || 0} m³</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
              <h3 className="text-sm md:text-base font-semibold text-indigo-900 mb-3">Chi tiết hóa đơn</h3>
              <div className="space-y-2 text-xs md:text-sm text-indigo-700">
                <div className="flex justify-between">
                  <span>Tiền phòng</span>
                  <span className="font-medium text-indigo-900">{formatCurrency(viewingHoaDon.tienPhong)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tiền điện ({viewingHoaDon.soDien} kWh)</span>
                  <span className="font-medium text-indigo-900">{formatCurrency(viewingHoaDon.tienDien)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tiền nước ({viewingHoaDon.soNuoc} m³)</span>
                  <span className="font-medium text-indigo-900">{formatCurrency(viewingHoaDon.tienNuoc)}</span>
                </div>
                {viewingHoaDon.phiDichVu.map((phi, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{phi.ten}</span>
                    <span className="font-medium text-indigo-900">{formatCurrency(phi.gia)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
              <div className="flex justify-between text-base md:text-lg font-semibold">
                <span className="text-indigo-900">Tổng tiền:</span>
                <span className="text-indigo-900">{formatCurrency(viewingHoaDon.tongTien)}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm mt-1">
                <span className="text-indigo-500">Đã thanh toán:</span>
                <span className="text-green-600">{formatCurrency(viewingHoaDon.daThanhToan)}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm mt-1">
                <span className="text-indigo-500">Còn lại:</span>
                <span className={viewingHoaDon.conLai > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                  {formatCurrency(viewingHoaDon.conLai)}
                </span>
              </div>
            </div>

            {/* QR Thanh toan */}
            {viewingHoaDon.conLai > 0 && bankSettings.soTaiKhoan && bankSettings.tenNganHang && (
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 md:p-4 shadow-sm">
                <h3 className="text-sm md:text-base font-semibold mb-3 text-indigo-900 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                    <CreditCard className="h-3.5 w-3.5 text-white" />
                  </div>
                  Thanh toán chuyển khoản
                </h3>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <img
                    src={buildVietQRUrl(
                      bankSettings.soTaiKhoan,
                      bankSettings.tenNganHang,
                      viewingHoaDon.conLai,
                      buildTransferDesc(viewingHoaDon, phongList)
                    )}
                    alt="QR Chuyển khoản"
                    className="w-48 h-48 rounded-xl border border-indigo-200 bg-white"
                  />
                  <div className="space-y-1 text-xs md:text-sm text-indigo-700">
                    <div><span className="text-indigo-500">Ngân hàng:</span> <strong className="text-indigo-900">{bankSettings.tenNganHang}</strong></div>
                    <div><span className="text-indigo-500">Số tài khoản:</span> <strong className="text-indigo-900">{bankSettings.soTaiKhoan}</strong></div>
                    {bankSettings.chuTaiKhoan && (
                      <div><span className="text-indigo-500">Chủ tài khoản:</span> <strong className="text-indigo-900">{bankSettings.chuTaiKhoan}</strong></div>
                    )}
                    <div><span className="text-indigo-500">Số tiền:</span> <strong className="text-red-600">{formatCurrency(viewingHoaDon.conLai)}</strong></div>
                    <div><span className="text-indigo-500">Nội dung:</span> <strong className="font-mono text-xs text-indigo-900">{buildTransferDesc(viewingHoaDon, phongList)}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {viewingHoaDon.ghiChu && (
              <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
                <h3 className="text-sm md:text-base font-semibold text-indigo-900 mb-2">Ghi chú</h3>
                <p className="text-xs md:text-sm text-indigo-700">{viewingHoaDon.ghiChu}</p>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Send Dialog */}
      {isSendDialogOpen && sendingHoaDon && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-indigo-100">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-indigo-900">Gửi hóa đơn</h3>
              <p className="text-xs md:text-sm text-indigo-500/70">
                Gửi thông báo hóa đơn {sendingHoaDon.maHoaDon} đến khách thuê
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsSendDialogOpen(false)} className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50">
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                onClick={async () => {
                  if (!sendingHoaDon) return;
                  setIsSendingZalo(true);
                  try {
                    const { phone, zaloChatId } = getKhachThueContact(sendingHoaDon);
                    const message = generateBillingMessage(sendingHoaDon, sendBankInfo);
                    const res = await fetch('/api/zalo/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        phone,
                        zaloChatId,
                        message,
                        hoaDonId: sendingHoaDon.id,
                      }),
                    });
                    if (res.ok) {
                      toast.success('Đã gửi Zalo thành công!');
                      setIsSendDialogOpen(false);
                    } else {
                      const err = await res.json();
                      toast.error(err.message || 'Gửi Zalo thất bại');
                    }
                  } catch (error) {
                    toast.error('Lỗi khi gửi Zalo');
                  } finally {
                    setIsSendingZalo(false);
                  }
                }}
                disabled={isSendingZalo}
              >
                <MessageSquare className="h-6 w-6 text-blue-500" />
                <span className="text-sm font-medium text-indigo-900">Gửi Zalo</span>
                <span className="text-xs text-indigo-500">Gửi qua Zalo OA</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                onClick={async () => {
                  if (!sendingHoaDon) return;
                  setIsSendingZaloPdf(true);
                  try {
                    const { phone, zaloChatId } = getKhachThueContact(sendingHoaDon);
                    const res = await fetch('/api/zalo/send-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        phone,
                        zaloChatId,
                        hoaDonId: sendingHoaDon.id,
                      }),
                    });
                    if (res.ok) {
                      toast.success('Đã gửi PDF qua Zalo thành công!');
                      setIsSendDialogOpen(false);
                    } else {
                      const err = await res.json();
                      toast.error(err.message || 'Gửi PDF thất bại');
                    }
                  } catch (error) {
                    toast.error('Lỗi khi gửi PDF');
                  } finally {
                    setIsSendingZaloPdf(false);
                  }
                }}
                disabled={isSendingZaloPdf}
              >
                <FileText className="h-6 w-6 text-orange-500" />
                <span className="text-sm font-medium text-indigo-900">Gửi PDF</span>
                <span className="text-xs text-indigo-500">Gửi file PDF qua Zalo</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                onClick={() => {
                  if (!sendingHoaDon) return;
                  const { phone } = getKhachThueContact(sendingHoaDon);
                  if (phone) {
                    window.open(`tel:${phone}`, '_blank');
                  } else {
                    toast.error('Không tìm thấy số điện thoại khách thuê');
                  }
                }}
              >
                <Phone className="h-6 w-6 text-green-500" />
                <span className="text-sm font-medium text-indigo-900">Gọi điện</span>
                <span className="text-xs text-indigo-500">Gọi trực tiếp cho khách</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                onClick={() => {
                  if (!sendingHoaDon) return;
                  const message = generateBillingMessage(sendingHoaDon, sendBankInfo);
                  navigator.clipboard.writeText(message).then(() => {
                    toast.success('Đã sao chép nội dung tin nhắn!');
                  }).catch(() => {
                    toast.error('Không thể sao chép');
                  });
                }}
              >
                <Copy className="h-6 w-6 text-gray-500" />
                <span className="text-sm font-medium text-indigo-900">Sao chép</span>
                <span className="text-xs text-indigo-500">Sao chép nội dung thông báo</span>
              </Button>
            </div>

            {/* Preview message */}
            <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
              <h4 className="text-sm font-semibold text-indigo-900 mb-2">Nội dung thông báo</h4>
              <pre className="text-xs text-indigo-700 whitespace-pre-wrap font-sans">
                {generateBillingMessage(sendingHoaDon, sendBankInfo)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form */}
      {isPaymentDialogOpen && paymentHoaDon && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-indigo-100">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-indigo-900">Thanh toán hóa đơn</h3>
              <p className="text-xs md:text-sm text-indigo-500/70">
                Thanh toán cho hóa đơn {paymentHoaDon.maHoaDon}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsPaymentDialogOpen(false)} className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50">
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 md:p-6">
            <PaymentForm
              hoaDon={paymentHoaDon}
              onSuccess={() => {
                setIsPaymentDialogOpen(false);
                setPaymentHoaDon(null);
                cache.clearCache();
                fetchData(true);
              }}
              onCancel={() => setIsPaymentDialogOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {isCancelDialogOpen && cancelHoaDon && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-indigo-100">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-red-600">Hủy hóa đơn</h3>
              <p className="text-xs md:text-sm text-indigo-500/70">
                Xác nhận hủy hóa đơn {cancelHoaDon.maHoaDon}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsCancelDialogOpen(false)} className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50">
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div className="rounded-xl border-2 border-red-100 bg-red-50/60 backdrop-blur-sm p-3 shadow-sm">
              <p className="text-sm text-red-700">
                Bạn có chắc chắn muốn hủy hóa đơn <strong>{cancelHoaDon.maHoaDon}</strong>?
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Lý do hủy</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy hóa đơn..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                Không hủy
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={isCanceling || !cancelReason.trim()}
              >
                {isCanceling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ===== PaymentForm Component =====
interface PaymentFormProps {
  hoaDon: HoaDon;
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({ hoaDon, onSuccess, onCancel }: PaymentFormProps) {
  const [soTien, setSoTien] = useState(hoaDon.conLai);
  const [phuongThuc, setPhuongThuc] = useState('tienMat');
  const [noiDung, setNoiDung] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soTien <= 0) {
      toast.error('Số tiền thanh toán phải lớn hơn 0');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/thanh-toan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoaDon: hoaDon.id || hoaDon._id,
          soTien,
          phuongThuc,
          noiDung: noiDung || `Thanh toán hóa đơn ${hoaDon.maHoaDon}`,
          ngayThanhToan: new Date().toISOString(),
        }),
      });
      if (response.ok) {
        toast.success('Thanh toán thành công!');
        onSuccess();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Có lỗi xảy ra khi thanh toán');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm">
        <div className="space-y-1 text-sm text-indigo-700">
          <div className="flex justify-between">
            <span>Mã hóa đơn:</span>
            <span className="font-medium text-indigo-900">{hoaDon.maHoaDon}</span>
          </div>
          <div className="flex justify-between">
            <span>Tổng tiền:</span>
            <span className="font-medium text-indigo-900">{formatCurrency(hoaDon.tongTien)}</span>
          </div>
          <div className="flex justify-between">
            <span>Đã thanh toán:</span>
            <span className="font-medium text-green-600">{formatCurrency(hoaDon.daThanhToan)}</span>
          </div>
          <div className="flex justify-between">
            <span>Còn lại:</span>
            <span className="font-medium text-red-600">{formatCurrency(hoaDon.conLai)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-gray-700">Số tiền thanh toán</Label>
        <Input
          type="number"
          value={soTien}
          onChange={(e) => setSoTien(Number(e.target.value))}
          max={hoaDon.conLai}
          min={0}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-gray-700">Phương thức</Label>
        <Select value={phuongThuc} onValueChange={setPhuongThuc}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tienMat">Tiền mặt</SelectItem>
            <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
            <SelectItem value="the">Thẻ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-gray-700">Nội dung</Label>
        <Input
          value={noiDung}
          onChange={(e) => setNoiDung(e.target.value)}
          placeholder={`Thanh toán hóa đơn ${hoaDon.maHoaDon}`}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={submitting || soTien <= 0}>
          {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
        </Button>
      </div>
    </form>
  );
}
