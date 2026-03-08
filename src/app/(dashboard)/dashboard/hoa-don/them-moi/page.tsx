'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Save,
  FileText,
  Zap,
  Droplets,
  Wrench,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { HopDong, Phong, KhachThue } from '@/types';
import { toast } from 'sonner';

// Helper functions
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

export default function ThemMoiHoaDonPage() {
  const router = useRouter();
  const [hopDongList, setHopDongList] = useState<HopDong[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
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

  // Tự động sinh mã hóa đơn
  const generateInvoiceCode = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `HD${year}${month}${day}${randomNum}`;
  };

  const [newPhiDichVu, setNewPhiDichVu] = useState({ ten: '', gia: 0 });
  const [readingSource, setReadingSource] = useState<{
    chiSoDienBanDau: number;
    chiSoNuocBanDau: number;
    isFirstInvoice: boolean;
    lastInvoiceMonth: string | null;
  } | null>(null);

  useEffect(() => {
    fetchFormData();
    // Tự động sinh mã hóa đơn khi trang load
    setFormData(prev => ({ ...prev, maHoaDon: generateInvoiceCode() }));
  }, []);

  const fetchFormData = async () => {
    try {
      const formDataResponse = await fetch('/api/hoa-don/form-data');
      if (formDataResponse.ok) {
        const formData = await formDataResponse.json();
        console.log('Form data loaded:', formData.data);
        setHopDongList(formData.data.hopDongList || []);
        setPhongList(formData.data.phongList || []);
        setKhachThueList(formData.data.khachThueList || []);
      } else {
        console.error('Failed to load form data:', formDataResponse.status);
      }
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestElectricityReading = async (hopDongId: string, thang: number, nam: number) => {
    try {
      const response = await fetch(`/api/hoa-don/latest-reading?hopDong=${hopDongId}&thang=${thang}&nam=${nam}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Latest electricity reading:', data.data);
          setFormData(prev => ({
            ...prev,
            chiSoDienBanDau: data.data.chiSoDienBanDau || 0,
            chiSoNuocBanDau: data.data.chiSoNuocBanDau || 0,
          }));
          setReadingSource(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching latest electricity reading:', error);
    }
  };

  // Auto-fill form data when contract is selected
  useEffect(() => {
    if (formData.hopDong) {
      const selectedHopDong = hopDongList.find(hd => hd.id === formData.hopDong);
      if (selectedHopDong) {
        console.log('Auto-filling form data from contract:', selectedHopDong);
        
        setFormData(prev => ({
          ...prev,
          phong: selectedHopDong.phong as string,
          khachThue: selectedHopDong.nguoiDaiDien as string,
          tienPhong: selectedHopDong.giaThue,
          phiDichVu: selectedHopDong.phiDichVu || [],
          chiSoDienBanDau: 0,
          chiSoNuocBanDau: 0,
        }));
        
        fetchLatestElectricityReading(formData.hopDong, formData.thang, formData.nam);
      }
    }
  }, [formData.hopDong, hopDongList, formData.thang, formData.nam]);

  // Tự động cập nhật chỉ số khi thay đổi tháng/năm
  useEffect(() => {
    if (formData.hopDong && (formData.thang || formData.nam)) {
      fetchLatestElectricityReading(formData.hopDong, formData.thang, formData.nam);
    }
  }, [formData.thang, formData.nam]);

  const calculateTotal = () => {
    const totalPhiDichVu = formData.phiDichVu.reduce((sum: number, phi) => sum + phi.gia, 0);
    
    const soDien = formData.chiSoDienCuoiKy - formData.chiSoDienBanDau;
    const soNuoc = formData.chiSoNuocCuoiKy - formData.chiSoNuocBanDau;
    
    const selectedHopDong = hopDongList.find(hd => hd.id === formData.hopDong);
    const giaDien = selectedHopDong?.giaDien || 0;
    const giaNuoc = selectedHopDong?.giaNuoc || 0;
    
    const tienDienTinh = soDien * giaDien;
    const tienNuocTinh = soNuoc * giaNuoc;
    
    const total = formData.tienPhong + tienDienTinh + tienNuocTinh + totalPhiDichVu;
    const conLai = total - formData.daThanhToan;
    
    setFormData(prev => ({
      ...prev,
      soDien: Math.max(0, soDien),
      soNuoc: Math.max(0, soNuoc),
      tienDien: tienDienTinh,
      tienNuoc: tienNuocTinh,
      tongTien: total,
      conLai: conLai
    }));
  };

  useEffect(() => {
    calculateTotal();
  }, [formData.tienPhong, formData.chiSoDienBanDau, formData.chiSoDienCuoiKy, formData.chiSoNuocBanDau, formData.chiSoNuocCuoiKy, formData.phiDichVu, formData.daThanhToan, formData.hopDong, hopDongList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Kiểm tra validation trước khi submit
    if (formData.chiSoDienBanDau < 0 || formData.chiSoDienCuoiKy < 0) {
      toast.error('Chỉ số điện không được âm');
      return;
    }
    
    if (formData.chiSoNuocBanDau < 0 || formData.chiSoNuocCuoiKy < 0) {
      toast.error('Chỉ số nước không được âm');
      return;
    }
    
    if (formData.chiSoDienCuoiKy < formData.chiSoDienBanDau) {
      toast.error('Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng chỉ số ban đầu');
      return;
    }
    
    if (formData.chiSoNuocCuoiKy < formData.chiSoNuocBanDau) {
      toast.error('Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng chỉ số ban đầu');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Chuẩn bị dữ liệu gửi, loại bỏ maHoaDon nếu trống để backend tự sinh
      const requestData = {
        ...formData,
        // Nếu maHoaDon trống, không gửi để backend tự sinh
        ...(formData.maHoaDon.trim() ? {} : { maHoaDon: undefined }),
      };
      
      console.log('Submitting form data:', requestData);
      
      const response = await fetch('/api/hoa-don', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        // Xóa cache
        sessionStorage.removeItem('hoa-don-data');
        toast.success(result.message || 'Hóa đơn đã được tạo thành công');
        router.replace('/dashboard/hoa-don');
        router.refresh();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi dữ liệu');
    } finally {
      setSubmitting(false);
    }
  };

  const addPhiDichVu = () => {
    if (newPhiDichVu.ten && newPhiDichVu.gia > 0) {
      setFormData(prev => ({
        ...prev,
        phiDichVu: [...prev.phiDichVu, { ...newPhiDichVu }]
      }));
      setNewPhiDichVu({ ten: '', gia: 0 });
    }
  };

  const removePhiDichVu = (index: number) => {
    setFormData(prev => ({
      ...prev,
      phiDichVu: prev.phiDichVu.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 md:gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => router.push('/dashboard/hoa-don')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Tạo hóa đơn mới</h1>
          <p className="text-xs md:text-sm text-gray-600">Nhập thông tin hóa đơn mới</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Thông tin hóa đơn</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Điền đầy đủ thông tin để tạo hóa đơn mới
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="thong-tin" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="thong-tin" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <FileText className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Thông tin</span>
                  <span className="sm:hidden">Info</span>
                </TabsTrigger>
                <TabsTrigger value="dien-nuoc" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <Zap className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Điện & Nước</span>
                  <span className="sm:hidden">Đ&N</span>
                </TabsTrigger>
                <TabsTrigger value="dich-vu" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <Wrench className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Dịch vụ</span>
                  <span className="sm:hidden">DV</span>
                </TabsTrigger>
                <TabsTrigger value="tong-ket" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <Calculator className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Tổng kết</span>
                  <span className="sm:hidden">TK</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="thong-tin" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="maHoaDon" className="text-xs md:text-sm">Mã hóa đơn</Label>
                    <div className="flex gap-2">
                      <Input
                        id="maHoaDon"
                        value={formData.maHoaDon}
                        onChange={(e) => setFormData(prev => ({ ...prev, maHoaDon: e.target.value.toUpperCase() }))}
                        placeholder="HD202401001"
                        required
                        className="h-10 flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, maHoaDon: generateInvoiceCode() }))}
                        className="h-10 px-3"
                        title="Tự động sinh mã hóa đơn"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.maHoaDon && (
                      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        💡 Mã hóa đơn sẽ được tự động sinh nếu để trống
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="hopDong" className="text-xs md:text-sm">Hợp đồng *</Label>
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1">
                      {hopDongList.filter(hd => hd.trangThai === 'hoatDong').length} hợp đồng hoạt động
                    </div>
                    <Select value={formData.hopDong} onValueChange={(value) => setFormData(prev => ({ ...prev, hopDong: value }))}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Chọn hợp đồng" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[500px]">
                        {hopDongList.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">Đang tải hợp đồng...</div>
                        ) : (
                          hopDongList
                            .filter(hd => hd.trangThai === 'hoatDong')
                            .map((hopDong) => {
                              const phongObj = typeof hopDong.phong === 'object' ? (hopDong.phong as Phong) : null;
                              const phongName = phongObj?.maPhong || getPhongName(hopDong.phong as string, phongList);
                              const toaNhaName = phongObj?.toaNha && typeof phongObj.toaNha === 'object' 
                                ? (phongObj.toaNha as any).tenToaNha 
                                : 'N/A';
                              const nguoiDaiDienName = getKhachThueName(hopDong.nguoiDaiDien, khachThueList);
                              
                              // Xử lý ngày tháng an toàn
                              const formatDate = (date: any) => {
                                try {
                                  if (!date) return 'N/A';
                                  const dateObj = new Date(date);
                                  if (isNaN(dateObj.getTime())) return 'N/A';
                                  return dateObj.toLocaleDateString('vi-VN');
                                } catch (error) {
                                  return 'N/A';
                                }
                              };
                              
                              const ngayBatDau = formatDate(hopDong.ngayBatDau);
                              const ngayKetThuc = formatDate(hopDong.ngayKetThuc);
                              
                              return (
                                <SelectItem 
                                  key={hopDong.id} 
                                  value={hopDong.id!}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col gap-1 py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-blue-700">{hopDong.maHopDong}</span>
                                      <span className="text-gray-400">•</span>
                                      <span className="text-sm font-medium text-gray-700">Phòng {phongName}</span>
                                      {toaNhaName !== 'N/A' && (
                                        <>
                                          <span className="text-gray-400">•</span>
                                          <span className="text-sm text-gray-600">{toaNhaName}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                      <span>👤 {nguoiDaiDienName}</span>
                                      <span className="text-gray-400">•</span>
                                      <span>📅 {ngayBatDau !== 'N/A' && ngayKetThuc !== 'N/A' ? `${ngayBatDau} → ${ngayKetThuc}` : 'Chưa có thông tin ngày'}</span>
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="phong" className="text-sm">Phòng</Label>
                    <Input
                      id="phong"
                      value={getPhongName(formData.phong, phongList)}
                      disabled
                      className="bg-gray-50 h-10"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="khachThue" className="text-sm">Khách thuê</Label>
                    <Input
                      id="khachThue"
                      value={getKhachThueName(formData.khachThue, khachThueList)}
                      disabled
                      className="bg-gray-50 h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="thang" className="text-sm">Tháng</Label>
                    <Input
                      id="thang"
                      type="number"
                      min="1"
                      max="12"
                      value={formData.thang}
                      onChange={(e) => setFormData(prev => ({ ...prev, thang: parseInt(e.target.value) || 1 }))}
                      required
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="nam" className="text-sm">Năm</Label>
                    <Input
                      id="nam"
                      type="number"
                      min="2020"
                      value={formData.nam}
                      onChange={(e) => setFormData(prev => ({ ...prev, nam: parseInt(e.target.value) || new Date().getFullYear() }))}
                      required
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="hanThanhToan" className="text-sm">Hạn thanh toán</Label>
                    <Input
                      id="hanThanhToan"
                      type="date"
                      value={formData.hanThanhToan}
                      onChange={(e) => setFormData(prev => ({ ...prev, hanThanhToan: e.target.value }))}
                      required
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="tienPhong" className="text-sm">Tiền phòng (VNĐ)</Label>
                    <Input
                      id="tienPhong"
                      type="number"
                      min="0"
                      value={formData.tienPhong}
                      onChange={(e) => setFormData(prev => ({ ...prev, tienPhong: parseInt(e.target.value) || 0 }))}
                      required
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="daThanhToan" className="text-sm">Đã thanh toán (VNĐ)</Label>
                    <Input
                      id="daThanhToan"
                      type="number"
                      min="0"
                      value={formData.daThanhToan}
                      onChange={(e) => setFormData(prev => ({ ...prev, daThanhToan: parseInt(e.target.value) || 0 }))}
                      required
                      className="h-10"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="dien-nuoc" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">⚡💧 Chỉ số điện & nước</h3>
                  {readingSource && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {readingSource.isFirstInvoice 
                        ? "📋 Từ hợp đồng"
                        : `📄 Từ hóa đơn ${readingSource.lastInvoiceMonth}`
                      }
                    </div>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">Loại</th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">Chỉ số ban đầu</th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">Chỉ số cuối kỳ</th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">Số sử dụng</th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">Đơn giá</th>
                        <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Điện */}
                      <tr>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium">Điện</span>
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={formData.chiSoDienBanDau}
                            onChange={(e) => {
                              const value = Math.max(0, parseInt(e.target.value) || 0);
                              setFormData(prev => {
                                // Nếu chỉ số ban đầu > chỉ số cuối kỳ, cập nhật chỉ số cuối kỳ
                                const newChiSoCuoiKy = Math.max(prev.chiSoDienCuoiKy, value);
                                return { 
                                  ...prev, 
                                  chiSoDienBanDau: value,
                                  chiSoDienCuoiKy: newChiSoCuoiKy
                                };
                              });
                            }}
                            className="h-8 w-20 text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500 ml-1">kWh</span>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={formData.chiSoDienCuoiKy}
                            onChange={(e) => {
                              const value = Math.max(0, parseInt(e.target.value) || 0);
                              // Đảm bảo chỉ số cuối >= chỉ số đầu
                              const finalValue = Math.max(value, formData.chiSoDienBanDau);
                              setFormData(prev => ({ ...prev, chiSoDienCuoiKy: finalValue }));
                            }}
                            className="h-8 w-20 text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500 ml-1">kWh</span>
                          {formData.chiSoDienCuoiKy < formData.chiSoDienBanDau && (
                            <div className="text-xs text-red-500 mt-1">⚠️ Phải ≥ chỉ số đầu</div>
                          )}
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${
                              formData.soDien < 0 ? 'text-red-600' : 
                              formData.soDien === 0 ? 'text-gray-500' : 
                              'text-blue-600'
                            }`}>
                              {formData.soDien}
                            </span>
                            <span className="text-xs text-gray-500">kWh</span>
                            {formData.soDien < 0 && (
                              <span className="text-xs text-red-500 ml-1">⚠️</span>
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">
                              {hopDongList.find(hd => hd.id === formData.hopDong)?.giaDien || 0}
                            </span>
                            <span className="text-xs text-gray-500">VNĐ/kWh</span>
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-green-600">{formData.tienDien.toLocaleString('vi-VN')}</span>
                            <span className="text-xs text-gray-500">VNĐ</span>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Nước */}
                      <tr>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Nước</span>
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={formData.chiSoNuocBanDau}
                            onChange={(e) => {
                              const value = Math.max(0, parseInt(e.target.value) || 0);
                              setFormData(prev => {
                                // Nếu chỉ số ban đầu > chỉ số cuối kỳ, cập nhật chỉ số cuối kỳ
                                const newChiSoCuoiKy = Math.max(prev.chiSoNuocCuoiKy, value);
                                return { 
                                  ...prev, 
                                  chiSoNuocBanDau: value,
                                  chiSoNuocCuoiKy: newChiSoCuoiKy
                                };
                              });
                            }}
                            className="h-8 w-20 text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500 ml-1">m³</span>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={formData.chiSoNuocCuoiKy}
                            onChange={(e) => {
                              const value = Math.max(0, parseInt(e.target.value) || 0);
                              // Đảm bảo chỉ số cuối >= chỉ số đầu
                              const finalValue = Math.max(value, formData.chiSoNuocBanDau);
                              setFormData(prev => ({ ...prev, chiSoNuocCuoiKy: finalValue }));
                            }}
                            className="h-8 w-20 text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500 ml-1">m³</span>
                          {formData.chiSoNuocCuoiKy < formData.chiSoNuocBanDau && (
                            <div className="text-xs text-red-500 mt-1">⚠️ Phải ≥ chỉ số đầu</div>
                          )}
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${
                              formData.soNuoc < 0 ? 'text-red-600' : 
                              formData.soNuoc === 0 ? 'text-gray-500' : 
                              'text-blue-600'
                            }`}>
                              {formData.soNuoc}
                            </span>
                            <span className="text-xs text-gray-500">m³</span>
                            {formData.soNuoc < 0 && (
                              <span className="text-xs text-red-500 ml-1">⚠️</span>
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">
                              {hopDongList.find(hd => hd.id === formData.hopDong)?.giaNuoc || 0}
                            </span>
                            <span className="text-xs text-gray-500">VNĐ/m³</span>
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-green-600">{formData.tienNuoc.toLocaleString('vi-VN')}</span>
                            <span className="text-xs text-gray-500">VNĐ</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Tổng kết điện nước */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Tổng tiền điện</div>
                    <div className="text-lg font-bold text-yellow-600">{formData.tienDien.toLocaleString('vi-VN')} VNĐ</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Tổng tiền nước</div>
                    <div className="text-lg font-bold text-blue-600">{formData.tienNuoc.toLocaleString('vi-VN')} VNĐ</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="dich-vu" className="space-y-4 mt-6">
                <h3 className="text-base font-semibold">🔧 Phí dịch vụ</h3>
                
                {formData.phiDichVu.length > 0 && (
                  <div className="space-y-2">
                    {formData.phiDichVu.map((phi, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <span className="text-sm font-medium">{phi.ten}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-600 font-medium">{phi.gia.toLocaleString('vi-VN')} VNĐ</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePhiDichVu(index)}
                            className="h-7 px-2 text-xs"
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-sm">Thêm phí dịch vụ</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Tên dịch vụ"
                      value={newPhiDichVu.ten}
                      onChange={(e) => setNewPhiDichVu(prev => ({ ...prev, ten: e.target.value }))}
                      className="flex-1 h-9"
                    />
                    <Input
                      placeholder="Giá"
                      type="number"
                      min="0"
                      value={newPhiDichVu.gia}
                      onChange={(e) => setNewPhiDichVu(prev => ({ ...prev, gia: parseInt(e.target.value) || 0 }))}
                      className="w-24 h-9"
                    />
                    <Button 
                      type="button" 
                      onClick={addPhiDichVu}
                      disabled={!newPhiDichVu.ten || newPhiDichVu.gia <= 0}
                      className="h-9 px-3 text-sm"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tong-ket" className="space-y-4 mt-6">
                <h3 className="text-base font-semibold">💰 Tổng kết</h3>
                <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Tổng tiền</div>
                    <div className="text-lg font-bold text-gray-900">{formData.tongTien.toLocaleString('vi-VN')} VNĐ</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Đã thanh toán</div>
                    <div className="text-lg font-bold text-green-600">{formData.daThanhToan.toLocaleString('vi-VN')} VNĐ</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Còn lại</div>
                    <div className={`text-lg font-bold ${formData.conLai > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formData.conLai.toLocaleString('vi-VN')} VNĐ
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trangThai" className="text-sm">Trạng thái</Label>
                    <Select value={formData.trangThai} onValueChange={(value) => setFormData(prev => ({ ...prev, trangThai: value as 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan' }))}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chuaThanhToan">Chưa thanh toán</SelectItem>
                        <SelectItem value="daThanhToanMotPhan">Thanh toán một phần</SelectItem>
                        <SelectItem value="daThanhToan">Đã thanh toán</SelectItem>
                        <SelectItem value="quaHan">Quá hạn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ghiChu" className="text-sm">Ghi chú</Label>
                    <Input
                      id="ghiChu"
                      value={formData.ghiChu}
                      onChange={(e) => setFormData(prev => ({ ...prev, ghiChu: e.target.value }))}
                      placeholder="Ghi chú về hóa đơn..."
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 md:gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/hoa-don')}
                    disabled={submitting}
                    className="w-full sm:w-auto sm:min-w-[80px]"
                  >
                    Hủy
                  </Button>
                  <Button 
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="w-full sm:w-auto sm:min-w-[120px]"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {submitting ? 'Đang tạo...' : 'Tạo hóa đơn'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}