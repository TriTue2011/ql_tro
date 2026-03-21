import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHoaDonRepo, getHopDongRepo } from '@/lib/repositories';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { parsePage, parseLimit } from '@/lib/parse-query';
import { notifyKhachThue } from '@/lib/send-zalo';
import { PhiDichVu } from '@/types';

// GET - Lấy danh sách hóa đơn
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role === 'admin') {
      return NextResponse.json({ message: 'Admin không quản lý hóa đơn' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const hopDongId = searchParams.get('hopDongId');
    const trangThai = searchParams.get('trangThai');

    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    const repo = await getHoaDonRepo();

    // Nếu có ID, lấy hóa đơn cụ thể
    if (id) {
      const hoaDon = await repo.findById(id);

      if (!hoaDon) {
        return NextResponse.json(
          { message: 'Hóa đơn không tồn tại' },
          { status: 404 }
        );
      }

      // Xử lý dữ liệu cũ không có chỉ số điện nước
      const hoaDonObj = { ...hoaDon };
      if (hoaDonObj.chiSoDienBanDau === undefined) {
        hoaDonObj.chiSoDienBanDau = 0;
      }
      if (hoaDonObj.chiSoDienCuoiKy === undefined) {
        hoaDonObj.chiSoDienCuoiKy = hoaDonObj.chiSoDienBanDau;
      }
      if (hoaDonObj.chiSoNuocBanDau === undefined) {
        hoaDonObj.chiSoNuocBanDau = 0;
      }
      if (hoaDonObj.chiSoNuocCuoiKy === undefined) {
        hoaDonObj.chiSoNuocCuoiKy = hoaDonObj.chiSoNuocBanDau;
      }

      return NextResponse.json({
        success: true,
        data: hoaDonObj
      });
    }

    const result = await repo.findMany({
      page,
      limit,
      hopDongId: hopDongId || undefined,
      trangThai: ['chuaThanhToan','daThanhToanMotPhan','daThanhToan','quaHan'].includes(trangThai ?? '') ? trangThai as import('@/lib/repositories/types').TrangThaiHoaDon : undefined,
      toaNhaIds: !hopDongId ? toaNhaIds : undefined,
    });

    // Xử lý dữ liệu cũ không có chỉ số điện nước
    const processedHoaDons = result.data.map(hoaDon => {
      const hoaDonObj = { ...hoaDon };
      if (hoaDonObj.chiSoDienBanDau === undefined) {
        hoaDonObj.chiSoDienBanDau = 0;
      }
      if (hoaDonObj.chiSoDienCuoiKy === undefined) {
        hoaDonObj.chiSoDienCuoiKy = hoaDonObj.chiSoDienBanDau;
      }
      if (hoaDonObj.chiSoNuocBanDau === undefined) {
        hoaDonObj.chiSoNuocBanDau = 0;
      }
      if (hoaDonObj.chiSoNuocCuoiKy === undefined) {
        hoaDonObj.chiSoNuocCuoiKy = hoaDonObj.chiSoNuocBanDau;
      }
      return hoaDonObj;
    });

    return NextResponse.json({
      success: true,
      data: processedHoaDons,
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        pages: result.pagination.totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching hoa don:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Tạo hóa đơn mới
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      maHoaDon,
      hopDong,
      thang,
      nam,
      tienPhong,
      chiSoDienBanDau,
      chiSoDienCuoiKy,
      chiSoNuocBanDau,
      chiSoNuocCuoiKy,
      phiDichVu,
      ghiChu,
      anhChiSoDien,
      anhChiSoNuoc,
    } = body;

    // Validate required fields
    if (!hopDong) {
      return NextResponse.json(
        { message: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }

    const hopDongRepo = await getHopDongRepo();
    const hoaDonRepo = await getHoaDonRepo();

    // Kiểm tra hợp đồng tồn tại
    const hopDongData = await hopDongRepo.findById(hopDong);

    if (!hopDongData) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    // Tạo mã hóa đơn (sử dụng mã từ frontend hoặc tự sinh)
    let finalMaHoaDon = maHoaDon;

    if (!finalMaHoaDon || finalMaHoaDon.trim() === '') {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

      finalMaHoaDon = `HD${year}${month}${day}${randomNum}`;
    }

    // Kiểm tra mã hóa đơn đã tồn tại chưa
    const existingResult = await hoaDonRepo.findMany({ search: finalMaHoaDon, limit: 1 });
    if (existingResult.data.some(hd => hd.maHoaDon === finalMaHoaDon)) {
      // Nếu mã từ frontend bị trùng, tự sinh mã mới
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

      finalMaHoaDon = `HD${year}${month}${day}${randomNum}`;
    }

    // Hóa đơn hàng tháng
    if (!thang || !nam || tienPhong === undefined) {
      return NextResponse.json(
        { message: 'Thiếu thông tin cho hóa đơn hàng tháng' },
        { status: 400 }
      );
    }

    // Kiểm tra hóa đơn tháng này đã tồn tại chưa
    const existingMonthly = await hoaDonRepo.findMany({
      hopDongId: hopDong,
      thang,
      nam,
      limit: 1,
    });

    if (existingMonthly.data.length > 0) {
      return NextResponse.json(
        { message: `Hóa đơn tháng ${thang}/${nam} đã tồn tại` },
        { status: 400 }
      );
    }

    // Tự động tính chỉ số điện nước
    let chiSoDienBanDauValue = chiSoDienBanDau;
    let chiSoDienCuoiKyValue = chiSoDienCuoiKy;
    let chiSoNuocBanDauValue = chiSoNuocBanDau;
    let chiSoNuocCuoiKyValue = chiSoNuocCuoiKy;

    // Tìm hóa đơn gần nhất để lấy chỉ số cuối kỳ
    const prevResult = await hoaDonRepo.findMany({
      hopDongId: hopDong,
      limit: 100,
    });

    const lastHoaDon = prevResult.data
      .filter(hd => hd.nam < nam || (hd.nam === nam && hd.thang < thang))
      .sort((a, b) => b.nam !== a.nam ? b.nam - a.nam : b.thang - a.thang)[0];

    if (lastHoaDon) {
      chiSoDienBanDauValue = lastHoaDon.chiSoDienCuoiKy;
      chiSoNuocBanDauValue = lastHoaDon.chiSoNuocCuoiKy;
    } else {
      chiSoDienBanDauValue = hopDongData.chiSoDienBanDau;
      chiSoNuocBanDauValue = hopDongData.chiSoNuocBanDau;
    }

    if (!chiSoDienCuoiKyValue) {
      chiSoDienCuoiKyValue = chiSoDienBanDauValue;
    }
    if (!chiSoNuocCuoiKyValue) {
      chiSoNuocCuoiKyValue = chiSoNuocBanDauValue;
    }

    // Tính số điện nước
    const soDien = chiSoDienCuoiKyValue - chiSoDienBanDauValue;
    const soNuoc = chiSoNuocCuoiKyValue - chiSoNuocBanDauValue;

    // Tính tiền điện nước
    const tienDienTinh = soDien * hopDongData.giaDien;
    const tienNuocTinh = soNuoc * hopDongData.giaNuoc;

    const tongTien = tienPhong + tienDienTinh + tienNuocTinh + (phiDichVu?.reduce((sum: number, phi: PhiDichVu) => sum + phi.gia, 0) || 0);

    const hoaDon = await hoaDonRepo.create({
      maHoaDon: finalMaHoaDon,
      hopDongId: hopDong,
      phongId: hopDongData.phongId,
      khachThueId: hopDongData.nguoiDaiDienId,
      thang,
      nam,
      tienPhong,
      tienDien: tienDienTinh,
      chiSoDienBanDau: chiSoDienBanDauValue,
      chiSoDienCuoiKy: chiSoDienCuoiKyValue,
      tienNuoc: tienNuocTinh,
      chiSoNuocBanDau: chiSoNuocBanDauValue,
      chiSoNuocCuoiKy: chiSoNuocCuoiKyValue,
      phiDichVu: phiDichVu || [],
      tongTien,
      hanThanhToan: (() => {
        // Clamp ngayThanhToan to the last valid day of the month
        // (e.g. day 31 in Feb → Feb 28/29)
        const lastDay = new Date(nam, thang, 0).getDate();
        return new Date(nam, thang - 1, Math.min(hopDongData.ngayThanhToan, lastDay));
      })(),
      ghiChu,
      anhChiSoDien: anhChiSoDien || undefined,
      anhChiSoNuoc: anhChiSoNuoc || undefined,
    });

    // Thông báo Zalo cho khách thuê về hóa đơn mới
    if (hopDongData.nguoiDaiDienId) {
      const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
      const msg = `📄 Hóa đơn tháng ${thang}/${nam} đã được tạo!\nTổng tiền: ${fmt(tongTien)}\nHạn thanh toán: ${new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}\nVui lòng đăng nhập để xem chi tiết.`;
      notifyKhachThue(hopDongData.nguoiDaiDienId, msg).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: hoaDon,
      message: 'Tạo hóa đơn thành công'
    });
  } catch (error) {
    console.error('Error creating hoa don:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Cập nhật hóa đơn
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      maHoaDon,
      hopDong,
      thang,
      nam,
      tienPhong,
      chiSoDienBanDau,
      chiSoDienCuoiKy,
      chiSoNuocBanDau,
      chiSoNuocCuoiKy,
      phiDichVu,
      daThanhToan,
      trangThai,
      hanThanhToan,
      ghiChu,
      anhChiSoDien,
      anhChiSoNuoc,
    } = body;

    // Validate required fields
    if (!id) {
      console.log('Missing ID');
      return NextResponse.json(
        { message: 'Thiếu ID hóa đơn' },
        { status: 400 }
      );
    }

    const hoaDonRepo = await getHoaDonRepo();
    const hopDongRepo = await getHopDongRepo();

    // Kiểm tra hóa đơn tồn tại
    const existingHoaDon = await hoaDonRepo.findById(id);
    if (!existingHoaDon) {
      return NextResponse.json(
        { message: 'Hóa đơn không tồn tại' },
        { status: 404 }
      );
    }

    // Kiểm tra hợp đồng tồn tại
    const hopDongData = await hopDongRepo.findById(hopDong);
    if (!hopDongData) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    // Tính số điện nước
    const soDien = chiSoDienCuoiKy - chiSoDienBanDau;
    const soNuoc = chiSoNuocCuoiKy - chiSoNuocBanDau;

    // Tính tiền điện nước
    const tienDienTinh = soDien * hopDongData.giaDien;
    const tienNuocTinh = soNuoc * hopDongData.giaNuoc;

    const tongTien = tienPhong + tienDienTinh + tienNuocTinh + (phiDichVu?.reduce((sum: number, phi: PhiDichVu) => sum + phi.gia, 0) || 0);
    const conLai = tongTien - daThanhToan;

    // Cập nhật hóa đơn
    const updatedHoaDon = await hoaDonRepo.update(id, {
      tienPhong,
      tienDien: tienDienTinh,
      tienNuoc: tienNuocTinh,
      phiDichVu: phiDichVu || [],
      tongTien,
      daThanhToan,
      conLai,
      trangThai,
      hanThanhToan: new Date(hanThanhToan),
      ghiChu,
      anhChiSoDien: anhChiSoDien || undefined,
      anhChiSoNuoc: anhChiSoNuoc || undefined,
    });

    return NextResponse.json({
      success: true,
      data: updatedHoaDon,
      message: 'Cập nhật hóa đơn thành công'
    });
  } catch (error) {
    console.error('Error updating hoa don:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Cập nhật nhanh trạng thái hóa đơn (dùng từ notification dropdown)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id, trangThai, ghiChu } = await request.json();
    if (!id || !trangThai) {
      return NextResponse.json({ message: 'Thiếu id hoặc trangThai' }, { status: 400 });
    }

    const hoaDonRepo = await getHoaDonRepo();
    const existing = await hoaDonRepo.findById(id);
    if (!existing) {
      return NextResponse.json({ message: 'Hóa đơn không tồn tại' }, { status: 404 });
    }

    const updated = await hoaDonRepo.update(id, {
      trangThai,
      daThanhToan: trangThai === 'daThanhToan' ? existing.tongTien : existing.daThanhToan,
      ...(ghiChu !== undefined && { ghiChu }),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error patching hoa-don:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Xóa hóa đơn
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID hóa đơn' },
        { status: 400 }
      );
    }

    const repo = await getHoaDonRepo();
    const hoaDon = await repo.findById(id);
    if (!hoaDon) {
      return NextResponse.json(
        { message: 'Hóa đơn không tồn tại' },
        { status: 404 }
      );
    }

    await repo.delete(id);

    return NextResponse.json({
      success: true,
      message: 'Xóa hóa đơn thành công'
    });
  } catch (error) {
    console.error('Error deleting hoa don:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
