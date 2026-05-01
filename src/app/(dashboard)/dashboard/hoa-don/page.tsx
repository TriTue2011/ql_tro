'use client';

import { useState, useEffect } from 'react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCache } from '@/hooks/use-cache';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { Textarea } from '@/components/ui/textarea';
import { HoaDonDataTable } from './table';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
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

export default function HoaDonPage() {
  const router = useRouter();
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


  // Debug hopDongList state
  useEffect(() => {
    console.log('hopDongList state updated:', hopDongList);
  }, [hopDongList]);

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
        console.log('Form data loaded:', formData.data);
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

  const handleEdit = (hoaDon: HoaDon) => {
    console.log('Editing hoa don:', hoaDon);
    router.push(`/dashboard/hoa-don/${hoaDon.id}`);
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
        onRefresh={handleRefresh}
        loading={cache.isRefreshing}
        onAdd={canEdit ? () => router.push('/dashboard/hoa-don/them-moi') : undefined}
        addLabel="Tạo hóa đơn"
      />


      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4 lg:gap-6">
        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Tổng hóa đơn</p>
              <p className="text-base md:text-2xl font-bold">{hoaDonList.length}</p>
            </div>
            <Receipt className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Chưa thanh toán</p>
              <p className="text-base md:text-2xl font-bold text-red-600">
                {hoaDonList.filter(h => h.trangThai === 'chuaThanhToan').length}
              </p>
            </div>
            <Receipt className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Quá hạn</p>
              <p className="text-base md:text-2xl font-bold text-orange-600">
                {hoaDonList.filter(h => new Date(h.hanThanhToan) < new Date()).length}
              </p>
            </div>
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-orange-600" />
          </div>
        </Card>

        <Card className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-medium text-gray-600">Doanh thu</p>
              <p className="text-xs md:text-2xl font-bold text-green-600 truncate">
                {formatCurrency(hoaDonList.reduce((sum, h) => sum + h.daThanhToan, 0))}
              </p>
            </div>
            <Receipt className="h-3 w-3 md:h-4 md:w-4 text-green-600 flex-shrink-0" />
          </div>
        </Card>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Danh sách hóa đơn</CardTitle>
          <CardDescription>
            {filteredHoaDon.length} hóa đơn được tìm thấy
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <HoaDonDataTable
            data={filteredHoaDon}
            phongList={phongList}
            khachThueList={khachThueList}
            onView={handleView}
            onDownload={handleDownload}
            onScreenshot={handleScreenshot}
            onShare={handleCopyLink}
            onSend={handleSend}
            onEdit={handleEdit}
            onCancel={handleCancelInvoiceClick}
            onDeleteMultiple={handleDeleteMultiple}
            onPayment={handlePayment}
            canEdit={canEdit}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            monthFilter={monthFilter}
            onMonthChange={setMonthFilter}
            yearFilter={yearFilter}
            onYearChange={setYearFilter}
            getMonthOptions={getMonthOptions}
            getYearOptions={getYearOptions}
          />
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Danh sách hóa đơn</h2>
          <span className="text-sm text-gray-500">{filteredHoaDon.length} hóa đơn</span>
        </div>
        
        {/* Mobile Filters */}
        <div className="space-y-2 mb-4">
          <SearchInput
            placeholder="Tìm kiếm hóa đơn..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <div className="grid grid-cols-3 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                <SelectItem value="chuaThanhToan" className="text-sm">Chưa thanh toán</SelectItem>
                <SelectItem value="daThanhToan" className="text-sm">Đã thanh toán</SelectItem>
                <SelectItem value="thanhToanMotPhan" className="text-sm">Thanh toán 1 phần</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Tháng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                {getMonthOptions().map(month => (
                  <SelectItem key={month} value={month.toString()} className="text-sm">
                    Tháng {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Năm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Tất cả</SelectItem>
                {getYearOptions().map(year => (
                  <SelectItem key={year} value={year.toString()} className="text-sm">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile Card List */}
        <div className="space-y-3">
          {filteredHoaDon.map((hoaDon) => {
            const isOverdue = new Date(hoaDon.hanThanhToan) < new Date() && hoaDon.trangThai !== 'daThanhToan';
            
            return (
              <Card key={hoaDon.id} className="p-4">
                <div className="space-y-3">
                  {/* Header with invoice code and status */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{hoaDon.maHoaDon}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Home className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-600">{getPhongName(hoaDon.phong, phongList)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(hoaDon.trangThai)}
                      {isOverdue && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                          Quá hạn
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Customer and period info */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">{getKhachThueName(hoaDon.khachThue, khachThueList)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>Tháng {hoaDon.thang}/{hoaDon.nam}</span>
                      <span className="mx-1">•</span>
                      <span>Hạn: {new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Amount info */}
                  <div className="border-t pt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Tổng tiền:</span>
                        <p className="font-semibold text-blue-600">{formatCurrency(hoaDon.tongTien)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Đã thanh toán:</span>
                        <p className="font-semibold text-green-600">{formatCurrency(hoaDon.daThanhToan)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Còn lại:</span>
                        <p className="font-semibold text-red-600">{formatCurrency(hoaDon.conLai)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(hoaDon)}
                      className="flex-1"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Xem
                    </Button>
                    {hoaDon.conLai > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePayment(hoaDon)}
                        className="flex-1 text-green-600 hover:bg-green-50"
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        Thanh toán
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(hoaDon)}
                      className="flex-1"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSend(hoaDon)}
                      className="flex-1 text-blue-600 hover:bg-blue-50"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Gửi
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredHoaDon.length === 0 && (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không có hóa đơn nào</p>
          </div>
        )}
      </div>

      {/* View Invoice Detail */}
      {isViewDialogOpen && viewingHoaDon && (
        <Card className="border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between p-4 md:p-6 border-b">
            <div>
              <h3 className="text-base md:text-lg font-semibold">Chi tiết hóa đơn</h3>
              <p className="text-xs md:text-sm text-gray-600">
                Thông tin chi tiết hóa đơn {viewingHoaDon.maHoaDon}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsViewDialogOpen(false)} className="h-8 w-8 p-0">
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            {/* Invoice Header */}
            <div className="text-center border-b pb-3 md:pb-4">
              <h2 className="text-lg md:text-2xl font-bold">HÓA ĐƠN THUÊ PHÒNG</h2>
              <p className="text-base md:text-lg text-gray-600">{viewingHoaDon.maHoaDon}</p>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-2">Thông tin phòng</h3>
                <p className="text-xs md:text-sm"><strong>Phòng:</strong> {getPhongName(viewingHoaDon.phong, phongList)}</p>
                <p className="text-xs md:text-sm"><strong>Khách thuê:</strong> {getKhachThueName(viewingHoaDon.khachThue, khachThueList)}</p>
                <p className="text-xs md:text-sm"><strong>Hợp đồng:</strong> {
                  hopDongList.find(hd => hd.id === viewingHoaDon.hopDong)?.maHopDong || 'N/A'
                }</p>
              </div>
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-2">Thông tin thanh toán</h3>
                <p className="text-xs md:text-sm"><strong>Tháng/Năm:</strong> {viewingHoaDon.thang}/{viewingHoaDon.nam}</p>
                <p className="text-xs md:text-sm"><strong>Hạn thanh toán:</strong> {new Date(viewingHoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</p>
                <p className="text-xs md:text-sm"><strong>Trạng thái:</strong> {getStatusBadge(viewingHoaDon.trangThai)}</p>
              </div>
            </div>

            {/* Chỉ số điện nước */}
            <div>
              <h3 className="text-sm md:text-base font-semibold mb-3">Chỉ số điện nước</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                <div>
                  <h4 className="font-medium mb-2">Điện</h4>
                  <div className="space-y-1 text-sm">
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
                <div>
                  <h4 className="font-medium mb-2">Nước</h4>
                  <div className="space-y-1 text-sm">
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
            <div>
              <h3 className="text-sm md:text-base font-semibold mb-3">Chi tiết hóa đơn</h3>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span>Tiền phòng</span>
                  <span>{formatCurrency(viewingHoaDon.tienPhong)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tiền điện ({viewingHoaDon.soDien} kWh)</span>
                  <span>{formatCurrency(viewingHoaDon.tienDien)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tiền nước ({viewingHoaDon.soNuoc} m³)</span>
                  <span>{formatCurrency(viewingHoaDon.tienNuoc)}</span>
                </div>
                {viewingHoaDon.phiDichVu.map((phi, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{phi.ten}</span>
                    <span>{formatCurrency(phi.gia)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="border-t pt-3 md:pt-4">
              <div className="flex justify-between text-base md:text-lg font-semibold">
                <span>Tổng tiền:</span>
                <span>{formatCurrency(viewingHoaDon.tongTien)}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span>Đã thanh toán:</span>
                <span className="text-green-600">{formatCurrency(viewingHoaDon.daThanhToan)}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span>Còn lại:</span>
                <span className={viewingHoaDon.conLai > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                  {formatCurrency(viewingHoaDon.conLai)}
                </span>
              </div>
            </div>

            {/* QR Thanh toán */}
            {viewingHoaDon.conLai > 0 && bankSettings.soTaiKhoan && bankSettings.tenNganHang && (
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <h3 className="text-sm md:text-base font-semibold mb-3 text-blue-800 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
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
                    className="w-48 h-48 rounded-lg border border-blue-200 bg-white"
                  />
                  <div className="space-y-1 text-xs md:text-sm">
                    <div><span className="text-gray-600">Ngân hàng:</span> <strong>{bankSettings.tenNganHang}</strong></div>
                    <div><span className="text-gray-600">Số tài khoản:</span> <strong>{bankSettings.soTaiKhoan}</strong></div>
                    {bankSettings.chuTaiKhoan && (
                      <div><span className="text-gray-600">Chủ tài khoản:</span> <strong>{bankSettings.chuTaiKhoan}</strong></div>
                    )}
                    <div><span className="text-gray-600">Số tiền:</span> <strong className="text-red-600">{formatCurrency(viewingHoaDon.conLai)}</strong></div>
                    <div><span className="text-gray-600">Nội dung:</span> <strong className="font-mono text-xs">{buildTransferDesc(viewingHoaDon, phongList)}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {viewingHoaDon.ghiChu && (
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-2">Ghi chú</h3>
                <p className="text-xs md:text-sm text-gray-600">{viewingHoaDon.ghiChu}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 md:pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsViewDialogOpen(false)} className="w-full sm:w-auto">
                Đóng
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCopyLink(viewingHoaDon)} className="w-full sm:w-auto">
                <Copy className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                Copy link
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload(viewingHoaDon)} className="w-full sm:w-auto">
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                Tải HTML
              </Button>
              <Button size="sm" onClick={() => handleScreenshot(viewingHoaDon)} className="w-full sm:w-auto">
                <Camera className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                Xuất PDF
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Send Notification - Inline Card */}
      {isSendDialogOpen && sendingHoaDon && (() => {
        const { phone, zaloChatId } = getKhachThueContact(sendingHoaDon);
        const canZalo = !!(phone || zaloChatId);
        const message = generateBillingMessage(sendingHoaDon, sendBankInfo);
        const encodedMessage = encodeURIComponent(message);

        const buildZaloBody = (extra?: Record<string, string>) => ({
          ...(zaloChatId ? { chatId: zaloChatId } : { phone }),
          message,
          ...extra,
        });

        const handleSendViaZaloBot = async () => {
          if (!canZalo) {
            toast.error('Khách thuê chưa có số điện thoại hoặc chưa liên kết Zalo');
            return;
          }
          setIsSendingZalo(true);
          try {
            const res = await fetch('/api/gui-zalo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buildZaloBody()),
            });
            const data = await res.json();
            if (data.success) {
              toast.success('Đã gửi tin nhắn Zalo thành công!');
              setIsSendDialogOpen(false);
            } else {
              toast.error(data.message || data.error || 'Gửi Zalo thất bại');
            }
          } catch {
            toast.error('Không kết nối được Zalo Bot server');
          } finally {
            setIsSendingZalo(false);
          }
        };

        const handleSendWithPdf = async () => {
          if (!canZalo) {
            toast.error('Khách thuê chưa có số điện thoại hoặc chưa liên kết Zalo');
            return;
          }
          setIsSendingZaloPdf(true);
          try {
            const r1 = await fetch('/api/gui-zalo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buildZaloBody()),
            });
            const d1 = await r1.json();
            if (!d1.success) {
              toast.error(d1.message || d1.error || 'Gửi tin nhắn thất bại');
              return;
            }
            const r2 = await fetch(`/api/hoa-don/${sendingHoaDon.id}/send-zalo-pdf`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...(zaloChatId ? { chatId: zaloChatId } : { phone }),
                message: `Hóa đơn tháng ${sendingHoaDon.thang}/${sendingHoaDon.nam} - ${sendingHoaDon.maHoaDon}`,
              }),
            });
            const d2 = await r2.json();
            if (d2.success) {
              toast.success('Đã gửi tin nhắn + PDF Zalo thành công!');
              setIsSendDialogOpen(false);
            } else {
              toast.warning('Tin nhắn đã gửi nhưng PDF thất bại: ' + (d2.message || d2.error || ''));
            }
          } catch {
            toast.error('Không kết nối được Zalo Bot server');
          } finally {
            setIsSendingZaloPdf(false);
          }
        };

        return (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold">Gửi thông báo tiền phòng</h3>
                  <p className="text-xs md:text-sm text-gray-500">
                    Gửi thông tin hóa đơn tháng {sendingHoaDon.thang}/{sendingHoaDon.nam} cho khách thuê
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsSendDialogOpen(false)}>
                  <CloseIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Preview message */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nội dung tin nhắn</label>
                  <pre className="text-xs bg-white border rounded p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                    {message}
                  </pre>
                </div>

                {canZalo ? (
                  <div className="text-sm text-gray-600">
                    Gửi đến:{' '}
                    <span className="font-semibold text-gray-900">
                      {phone || `Chat ID: ${zaloChatId}`}
                    </span>
                    {zaloChatId && <span className="ml-1 text-xs text-green-600">(đã liên kết Zalo)</span>}
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
                    Khách thuê chưa có số điện thoại hoặc chưa liên kết Zalo Chat ID
                  </div>
                )}

                {/* Zalo Bot auto send */}
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!canZalo || isSendingZalo || isSendingZaloPdf}
                  onClick={handleSendViaZaloBot}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isSendingZalo ? 'Đang gửi...' : 'Gửi Zalo tự động (Zalo Bot)'}
                </Button>

                {/* Gửi kèm PDF */}
                <Button
                  variant="outline"
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                  disabled={!canZalo || isSendingZalo || isSendingZaloPdf}
                  onClick={handleSendWithPdf}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isSendingZaloPdf ? 'Đang gửi...' : 'Gửi Zalo kèm PDF hóa đơn'}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400">hoặc thủ công</span>
                  </div>
                </div>

                {/* Manual fallback buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(message).then(() => {
                        toast.success('Đã sao chép tin nhắn');
                      });
                    }}
                    className="w-full text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>

                  <Button
                    variant="outline"
                    disabled={!phone}
                    onClick={() => {
                      window.location.href = `sms:${phone}?body=${encodedMessage}`;
                    }}
                    className="w-full text-xs text-green-600 hover:bg-green-50 border-green-200"
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    SMS
                  </Button>

                  <Button
                    variant="outline"
                    disabled={!phone}
                    onClick={() => {
                      window.location.href = `tel:${phone}`;
                    }}
                    className="w-full text-xs"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1" />
                    Gọi
                  </Button>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => setIsSendDialogOpen(false)}>
                    Đóng
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Payment - Inline Card */}
      {isPaymentDialogOpen && paymentHoaDon && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">Xác nhận thanh toán</h3>
                <p className="text-xs md:text-sm text-gray-500">
                  Tạo thanh toán cho hóa đơn {paymentHoaDon.maHoaDon}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsPaymentDialogOpen(false)}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <PaymentForm
              hoaDon={paymentHoaDon}
              onClose={() => setIsPaymentDialogOpen(false)}
              onSuccess={(updatedHoaDon) => {
                setIsPaymentDialogOpen(false);
                if (updatedHoaDon) {
                  setHoaDonList(prev => prev.map(hd =>
                    hd.id === updatedHoaDon.id ? updatedHoaDon : hd
                  ));
                  cache.clearCache();
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Cancel Invoice - Inline Card */}
      {isCancelDialogOpen && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">Hủy hóa đơn</h3>
                <p className="text-sm text-gray-500">
                  Bạn đang thực hiện hủy hóa đơn <span className="font-semibold">{cancelHoaDon?.maHoaDon}</span>. Hành động này không thể hoàn tác.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsCancelDialogOpen(false)}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason" className="text-sm">Lý do hủy (bắt buộc) <span className="text-red-500">*</span></Label>
                <Textarea
                  id="cancelReason"
                  placeholder="Nhập lý do hủy hóa đơn..."
                  value={cancelReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCancelReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Lưu ý: Tổng tiền còn lại sẽ được đưa về 0. Khách thuê sẽ nhận được thông báo Zalo hóa đơn đã bị hủy (nếu đã cấu hình).
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} disabled={isCanceling} className="w-full sm:w-auto">
                  Đóng
                </Button>
                <Button variant="destructive" onClick={handleConfirmCancel} disabled={!cancelReason.trim() || isCanceling} className="w-full sm:w-auto">
                  {isCanceling ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Xác nhận hủy hóa đơn
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Payment Form Component
function PaymentForm({ 
  hoaDon, 
  onClose, 
  onSuccess 
}: { 
  hoaDon: HoaDon;
  onClose: () => void;
  onSuccess: (updatedHoaDon?: HoaDon) => void;
}) {
  const [formData, setFormData] = useState({
    soTien: hoaDon.conLai, // Mặc định thanh toán toàn bộ số tiền còn lại
    phuongThuc: 'tienMat' as 'tienMat' | 'chuyenKhoan' | 'viDienTu',
    nganHang: '',
    soGiaoDich: '',
    ngayThanhToan: new Date().toISOString().split('T')[0],
    ghiChu: '',
    anhBienLai: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const requestData = {
        hoaDonId: hoaDon.id,
        soTien: formData.soTien,
        phuongThuc: formData.phuongThuc,
        thongTinChuyenKhoan: formData.phuongThuc === 'chuyenKhoan' ? {
          nganHang: formData.nganHang,
          soGiaoDich: formData.soGiaoDich
        } : undefined,
        ngayThanhToan: formData.ngayThanhToan,
        ghiChu: formData.ghiChu,
        anhBienLai: formData.anhBienLai
      };
      
      console.log('Submitting payment:', requestData);
      
      const response = await fetch('/api/thanh-toan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        // Xóa cache và trả về dữ liệu hóa đơn đã cập nhật
        sessionStorage.removeItem('hoa-don-data');
        toast.success(result.message || 'Thanh toán đã được tạo thành công');
        onSuccess(result.data?.hoaDon); // Truyền hóa đơn đã cập nhật
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Có lỗi xảy ra khi tạo thanh toán');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Thông tin hóa đơn */}
      <div className="bg-gray-50 p-3 md:p-4 rounded-lg">
        <h3 className="text-sm md:text-base font-semibold mb-3">Thông tin hóa đơn</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
          <div>
            <span className="text-gray-600">Mã hóa đơn:</span>
            <div className="font-medium">{hoaDon.maHoaDon}</div>
          </div>
          <div>
            <span className="text-gray-600">Tháng/Năm:</span>
            <div className="font-medium">{hoaDon.thang}/{hoaDon.nam}</div>
          </div>
          <div>
            <span className="text-gray-600">Tổng tiền:</span>
            <div className="font-medium">{formatCurrency(hoaDon.tongTien)}</div>
          </div>
          <div>
            <span className="text-gray-600">Đã thanh toán:</span>
            <div className="font-medium text-green-600">{formatCurrency(hoaDon.daThanhToan)}</div>
          </div>
          <div className="col-span-2">
            <span className="text-gray-600">Còn lại:</span>
            <div className="font-medium text-red-600 text-lg">{formatCurrency(hoaDon.conLai)}</div>
          </div>
        </div>
      </div>

      {/* Form thanh toán */}
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div className="space-y-2">
          <Label htmlFor="soTien" className="text-xs md:text-sm">Số tiền thanh toán (VNĐ) *</Label>
          <Input
            id="soTien"
            type="number"
            min="1"
            max={hoaDon.conLai}
            value={formData.soTien}
            onChange={(e) => setFormData(prev => ({ ...prev, soTien: parseInt(e.target.value) || 0 }))}
            required
            className="text-base md:text-lg"
          />
          <div className="text-[10px] md:text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md">
            💰 Tối đa có thể thanh toán: <span className="font-semibold">{formatCurrency(hoaDon.conLai)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phuongThuc" className="text-xs md:text-sm">Phương thức thanh toán *</Label>
          <Select value={formData.phuongThuc} onValueChange={(value) => setFormData(prev => ({ ...prev, phuongThuc: value as 'tienMat' | 'chuyenKhoan' | 'viDienTu' }))}>
            <SelectTrigger className="h-10 md:h-12 text-sm">
              <SelectValue placeholder="Chọn phương thức thanh toán" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tienMat" className="text-sm">💵 Tiền mặt</SelectItem>
              <SelectItem value="chuyenKhoan" className="text-sm">🏦 Chuyển khoản</SelectItem>
              <SelectItem value="viDienTu" className="text-sm">📱 Ví điện tử</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.phuongThuc === 'chuyenKhoan' && (
          <div className="space-y-3 md:space-y-4 p-3 md:p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="text-xs md:text-sm font-semibold text-green-800 flex items-center gap-2">
              🏦 Thông tin chuyển khoản
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="nganHang" className="text-xs md:text-sm">Ngân hàng</Label>
                <Input
                  id="nganHang"
                  value={formData.nganHang}
                  onChange={(e) => setFormData(prev => ({ ...prev, nganHang: e.target.value }))}
                  placeholder="Ví dụ: Vietcombank, BIDV..."
                  className="text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="soGiaoDich" className="text-xs md:text-sm">Số giao dịch/Mã tham chiếu</Label>
                <Input
                  id="soGiaoDich"
                  value={formData.soGiaoDich}
                  onChange={(e) => setFormData(prev => ({ ...prev, soGiaoDich: e.target.value }))}
                  placeholder="Mã giao dịch từ ngân hàng"
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="ngayThanhToan" className="text-xs md:text-sm">Ngày thanh toán *</Label>
            <Input
              id="ngayThanhToan"
              type="date"
              value={formData.ngayThanhToan}
              onChange={(e) => setFormData(prev => ({ ...prev, ngayThanhToan: e.target.value }))}
              required
              className="h-10 md:h-12 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ghiChu" className="text-xs md:text-sm">Ghi chú</Label>
            <Input
              id="ghiChu"
              value={formData.ghiChu}
              onChange={(e) => setFormData(prev => ({ ...prev, ghiChu: e.target.value }))}
              placeholder="Ghi chú về giao dịch..."
              className="h-10 md:h-12 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Ảnh biên lai thanh toán</Label>
          <ImageUpload
            imageUrl={formData.anhBienLai}
            onImageChange={(url) => setFormData(prev => ({ ...prev, anhBienLai: url }))}
            placeholder="Chọn ảnh biên lai thanh toán"
          />
          <div className="text-[10px] md:text-xs text-gray-500">
            📷 Tải lên ảnh biên lai để xác nhận giao dịch (tùy chọn)
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-4 md:pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto sm:min-w-[100px]"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            className="w-full sm:w-auto sm:min-w-[160px]"
          >
            <CreditCard className="h-3 w-3 md:h-4 md:w-4 mr-2" />
            {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </Button>
        </div>
      </form>
    </div>
  );
}

