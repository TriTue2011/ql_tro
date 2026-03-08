'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Camera, 
  Receipt, 
  Calendar,
  CreditCard,
  ArrowLeft,
  Loader2,
  QrCode
} from 'lucide-react';
import { HoaDon, ThanhToan, HopDong, Phong, KhachThue } from '@/types';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Helper functions
const getPhongName = (phongId: string | Phong) => {
  if (!phongId) return 'N/A';
  if (typeof phongId === 'object' && phongId.maPhong) {
    return phongId.maPhong;
  }
  return 'N/A';
};

const getKhachThueName = (khachThueId: string | KhachThue) => {
  if (!khachThueId) return 'N/A';
  if (typeof khachThueId === 'object' && khachThueId.hoTen) {
    return khachThueId.hoTen;
  }
  return 'N/A';
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'chuaThanhToan':
      return <Badge variant="destructive">Chưa thanh toán</Badge>;
    case 'daThanhToanMotPhan':
      return <Badge variant="secondary">Thanh toán một phần</Badge>;
    case 'daThanhToan':
      return <Badge variant="default">Đã thanh toán</Badge>;
    case 'quaHan':
      return <Badge variant="outline">Quá hạn</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getMethodBadge = (method: string) => {
  switch (method) {
    case 'tienMat':
      return <Badge variant="default">Tiền mặt</Badge>;
    case 'chuyenKhoan':
      return <Badge variant="secondary">Chuyển khoản</Badge>;
    case 'viDienTu':
      return <Badge variant="outline">Ví điện tử</Badge>;
    default:
      return <Badge variant="outline">{method}</Badge>;
  }
};

export default function PublicInvoicePage() {
  const params = useParams();
  const hoaDonId = params.id as string;
  
  const [hoaDon, setHoaDon] = useState<HoaDon | null>(null);
  const [thanhToanList, setThanhToanList] = useState<ThanhToan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hoaDonId) {
      fetchInvoiceData();
    }
  }, [hoaDonId]);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hoa-don-public/${hoaDonId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setHoaDon(result.data.hoaDon);
          setThanhToanList(result.data.thanhToanList || []);
        } else {
          setError(result.message || 'Không thể tải thông tin hóa đơn');
        }
      } else {
        setError('Không thể tải thông tin hóa đơn');
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError('Có lỗi xảy ra khi tải thông tin hóa đơn');
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshot = async () => {
    if (!hoaDon) return;
    
    try {
      // Tạo element tạm thời để chụp ảnh
      const tempElement = document.createElement('div');
      tempElement.innerHTML = `
        <div style="
          width: 800px; 
          padding: 40px; 
          background: #ffffff; 
          font-family: Arial, sans-serif;
          border: 1px solid #dddddd;
          margin: 20px;
          color: #000000;
        ">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #000;">HÓA ĐƠN THUÊ PHÒNG</h1>
            <p style="font-size: 18px; margin: 10px 0 0 0; color: #333;">${hoaDon.maHoaDon}</p>
          </div>
          
          <!-- Main Info Sections -->
          <div style="display: flex; gap: 30px; margin-bottom: 30px;">
            <div style="flex: 1;">
              <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">Thông tin phòng</h3>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Phòng:</strong> ${getPhongName(hoaDon.phong)}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Khách thuê:</strong> ${getKhachThueName(hoaDon.khachThue)}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Hợp đồng:</strong> N/A</p>
            </div>
            <div style="flex: 1;">
              <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">Thông tin thanh toán</h3>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Tháng/Năm:</strong> ${hoaDon.thang}/${hoaDon.nam}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Hạn thanh toán:</strong> ${new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</p>
              <div style="margin: 10px 0;">
                <span style="
                  background: #000000; 
                  color: #ffffff; 
                  padding: 4px 12px; 
                  border-radius: 4px; 
                  font-size: 12px; 
                  font-weight: bold;
                ">
                  ${hoaDon.trangThai === 'daThanhToan' ? 'Đã thanh toán' : 
                    hoaDon.trangThai === 'daThanhToanMotPhan' ? 'Thanh toán một phần' : 
                    hoaDon.trangThai === 'quaHan' ? 'Quá hạn' : 'Chưa thanh toán'}
                </span>
              </div>
            </div>
          </div>

          <!-- Electricity and Water Readings -->
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">Chỉ số điện nước</h3>
            <div style="display: flex; gap: 20px;">
              <div style="flex: 1;">
                <h4 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #555;">Điện</h4>
                <div style="font-size: 13px; line-height: 1.6;">
                  <div style="display: flex; justify-content: space-between;"><span>Chỉ số ban đầu:</span><span>${hoaDon.chiSoDienBanDau || 0} kWh</span></div>
                  <div style="display: flex; justify-content: space-between;"><span>Chỉ số cuối kỳ:</span><span>${hoaDon.chiSoDienCuoiKy || 0} kWh</span></div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Số điện sử dụng:</span><span>${hoaDon.soDien || 0} kWh</span></div>
                </div>
              </div>
              <div style="flex: 1;">
                <h4 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #555;">Nước</h4>
                <div style="font-size: 13px; line-height: 1.6;">
                  <div style="display: flex; justify-content: space-between;"><span>Chỉ số ban đầu:</span><span>${hoaDon.chiSoNuocBanDau || 0} m³</span></div>
                  <div style="display: flex; justify-content: space-between;"><span>Chỉ số cuối kỳ:</span><span>${hoaDon.chiSoNuocCuoiKy || 0} m³</span></div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Số nước sử dụng:</span><span>${hoaDon.soNuoc || 0} m³</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Invoice Details -->
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">Chi tiết hóa đơn</h3>
            <div style="font-size: 14px; line-height: 1.8;">
              <div style="display: flex; justify-content: space-between;"><span>Tiền phòng</span><span>${formatCurrency(hoaDon.tienPhong)}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>Tiền điện (${hoaDon.soDien} kWh)</span><span>${formatCurrency(hoaDon.tienDien)}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>Tiền nước (${hoaDon.soNuoc} m³)</span><span>${formatCurrency(hoaDon.tienNuoc)}</span></div>
              ${hoaDon.phiDichVu.map(phi => `
                <div style="display: flex; justify-content: space-between;"><span>${phi.ten}</span><span>${formatCurrency(phi.gia)}</span></div>
              `).join('')}
            </div>
          </div>

          <!-- Summary Section -->
          <div style="border-top: 1px solid #000; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
              <span>Tổng tiền:</span>
              <span>${formatCurrency(hoaDon.tongTien)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
              <span>Đã thanh toán:</span>
              <span style="color: #10b981;">${formatCurrency(hoaDon.daThanhToan)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
              <span>Còn lại:</span>
              <span style="color: #10b981; font-weight: bold;">
                ${formatCurrency(hoaDon.conLai)}
              </span>
            </div>
          </div>
        </div>
      `;
      
      tempElement.style.position = 'absolute';
      tempElement.style.left = '-9999px';
      tempElement.style.top = '-9999px';
      document.body.appendChild(tempElement);

      // Chụp ảnh
      const canvas = await html2canvas(tempElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Xóa element tạm thời
      document.body.removeChild(tempElement);

      // Tạo PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Tải xuống PDF
      pdf.save(`hoa-don-${hoaDon.maHoaDon}.pdf`);
      toast.success('Đã xuất hóa đơn thành PDF thành công!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Có lỗi xảy ra khi xuất PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Đang tải thông tin hóa đơn...</p>
        </div>
      </div>
    );
  }

  if (error || !hoaDon) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Lỗi</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error || 'Không tìm thấy hóa đơn'}</p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
       
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Hóa đơn thuê phòng</h1>
              <p className="text-gray-600">Mã hóa đơn: {hoaDon.maHoaDon}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleScreenshot}>
                <Camera className="h-4 w-4 mr-2" />
                Xuất PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hóa đơn chính */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="text-center border-b pb-4">
                  <h2 className="text-2xl font-bold">HÓA ĐƠN THUÊ PHÒNG</h2>
                  <p className="text-lg text-gray-600">{hoaDon.maHoaDon}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Invoice Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Thông tin phòng</h3>
                    <p><strong>Phòng:</strong> {getPhongName(hoaDon.phong)}</p>
                    <p><strong>Khách thuê:</strong> {getKhachThueName(hoaDon.khachThue)}</p>
                    <p><strong>Hợp đồng:</strong> N/A</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Thông tin thanh toán</h3>
                    <p><strong>Tháng/Năm:</strong> {hoaDon.thang}/{hoaDon.nam}</p>
                    <p><strong>Hạn thanh toán:</strong> {new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</p>
                    <p><strong>Trạng thái:</strong> {getStatusBadge(hoaDon.trangThai)}</p>
                  </div>
                </div>

                {/* Chỉ số điện nước */}
                <div>
                  <h3 className="font-semibold mb-3">Chỉ số điện nước</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium mb-2">Điện</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Chỉ số ban đầu:</span>
                          <span>{hoaDon.chiSoDienBanDau || 0} kWh</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chỉ số cuối kỳ:</span>
                          <span>{hoaDon.chiSoDienCuoiKy || 0} kWh</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Số điện sử dụng:</span>
                          <span>{hoaDon.soDien || 0} kWh</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Nước</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Chỉ số ban đầu:</span>
                          <span>{hoaDon.chiSoNuocBanDau || 0} m³</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chỉ số cuối kỳ:</span>
                          <span>{hoaDon.chiSoNuocCuoiKy || 0} m³</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Số nước sử dụng:</span>
                          <span>{hoaDon.soNuoc || 0} m³</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Details */}
                <div>
                  <h3 className="font-semibold mb-3">Chi tiết hóa đơn</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Tiền phòng</span>
                      <span>{formatCurrency(hoaDon.tienPhong)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiền điện ({hoaDon.soDien} kWh)</span>
                      <span>{formatCurrency(hoaDon.tienDien)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiền nước ({hoaDon.soNuoc} m³)</span>
                      <span>{formatCurrency(hoaDon.tienNuoc)}</span>
                    </div>
                    {hoaDon.phiDichVu.map((phi, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{phi.ten}</span>
                        <span>{formatCurrency(phi.gia)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Tổng tiền:</span>
                    <span>{formatCurrency(hoaDon.tongTien)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Đã thanh toán:</span>
                    <span className="text-green-600">{formatCurrency(hoaDon.daThanhToan)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Còn lại:</span>
                    <span className={hoaDon.conLai > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {formatCurrency(hoaDon.conLai)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {hoaDon.ghiChu && (
                  <div>
                    <h3 className="font-semibold mb-2">Ghi chú</h3>
                    <p className="text-gray-600">{hoaDon.ghiChu}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mã QR và Lịch sử thanh toán */}
          <div className="space-y-6">
            {/* Mã QR Chuyển khoản */}
            {hoaDon.conLai > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Quét mã để chuyển khoản
                  </CardTitle>
                  <CardDescription>
                    MB Bank - VietQR
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <img
                        src={`https://img.vietqr.io/image/970422-7320012003-compact2.png?amount=${hoaDon.conLai}&addInfo=Thanh%20toan%20${hoaDon.maHoaDon}&accountName=CHU%20TRO`}
                        alt="VietQR Code"
                        className="w-full max-w-[280px] border-2 border-gray-200 rounded-lg"
                      />
                    </div>
                    
                    {/* Thông tin chuyển khoản */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                      <div className="text-sm">
                        <div className="text-gray-600">Ngân hàng</div>
                        <div className="font-semibold">MB Bank (Quân đội)</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-600">Số tài khoản</div>
                        <div className="font-semibold font-mono">7320012003</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-600">Chủ tài khoản</div>
                        <div className="font-semibold">CHU TRO</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-600">Số tiền</div>
                        <div className="font-bold text-lg text-red-600">
                          {formatCurrency(hoaDon.conLai)}
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-600">Nội dung chuyển khoản</div>
                        <div className="font-semibold text-blue-600">
                          Thanh toan {hoaDon.maHoaDon}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 text-center">
                      💡 Quét mã QR bằng app ngân hàng để thanh toán nhanh
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lịch sử thanh toán */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Lịch sử thanh toán
                </CardTitle>
                <CardDescription>
                  {thanhToanList.length} giao dịch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {thanhToanList.length > 0 ? (
                  <div className="space-y-4">
                    {thanhToanList.map((thanhToan) => (
                      <div key={thanhToan.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {getMethodBadge(thanhToan.phuongThuc)}
                          </div>
                          <span className="font-semibold text-green-600">
                            {formatCurrency(thanhToan.soTien)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {new Date(thanhToan.ngayThanhToan).toLocaleDateString('vi-VN')}
                          </div>
                          {thanhToan.thongTinChuyenKhoan && (
                            <div>
                              <div>{thanhToan.thongTinChuyenKhoan.nganHang}</div>
                              <div className="text-xs text-gray-500">
                                {thanhToan.thongTinChuyenKhoan.soGiaoDich}
                              </div>
                            </div>
                          )}
                          {thanhToan.ghiChu && (
                            <div className="text-xs text-gray-500">
                              {thanhToan.ghiChu}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Chưa có giao dịch thanh toán</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Vui lòng thanh toán đúng số tiền và nội dung để được xác nhận tự động</p>
        </div>
      </div>
    </div>
  );
}
