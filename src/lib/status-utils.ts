import HopDong from '@/models/HopDong';
import Phong from '@/models/Phong';
import KhachThue from '@/models/KhachThue';

/**
 * Tính trạng thái phòng dựa trên hợp đồng
 * @param phongId - ID của phòng
 * @returns Trạng thái phòng: 'trong' | 'daDat' | 'dangThue' | 'baoTri'
 */
export async function calculatePhongStatus(phongId: string): Promise<'trong' | 'daDat' | 'dangThue' | 'baoTri'> {
  try {
    // Tìm hợp đồng đang hoạt động của phòng
    const hopDongHoatDong = await HopDong.findOne({
      phong: phongId,
      trangThai: 'hoatDong',
      ngayBatDau: { $lte: new Date() },
      ngayKetThuc: { $gte: new Date() }
    });

    if (hopDongHoatDong) {
      return 'dangThue';
    }

    // Kiểm tra có hợp đồng đã đặt nhưng chưa bắt đầu không
    const hopDongDaDat = await HopDong.findOne({
      phong: phongId,
      trangThai: 'hoatDong',
      ngayBatDau: { $gt: new Date() }
    });

    if (hopDongDaDat) {
      return 'daDat';
    }

    // Mặc định là trống
    return 'trong';
  } catch (error) {
    console.error('Error calculating phong status:', error);
    return 'trong';
  }
}

/**
 * Tính trạng thái khách thuê dựa trên hợp đồng
 * @param khachThueId - ID của khách thuê
 * @returns Trạng thái khách thuê: 'dangThue' | 'daTraPhong' | 'chuaThue'
 */
export async function calculateKhachThueStatus(khachThueId: string): Promise<'dangThue' | 'daTraPhong' | 'chuaThue'> {
  try {
    // Tìm hợp đồng đang hoạt động của khách thuê
    const hopDongHoatDong = await HopDong.findOne({
      $or: [
        { khachThueId: khachThueId },
        { nguoiDaiDien: khachThueId }
      ],
      trangThai: 'hoatDong',
      ngayBatDau: { $lte: new Date() },
      ngayKetThuc: { $gte: new Date() }
    });

    if (hopDongHoatDong) {
      return 'dangThue';
    }

    // Kiểm tra xem khách thuê đã từng có hợp đồng nào chưa
    const hopDongDaCo = await HopDong.findOne({
      $or: [
        { khachThueId: khachThueId },
        { nguoiDaiDien: khachThueId }
      ]
    });

    if (hopDongDaCo) {
      return 'daTraPhong'; // Đã từng có hợp đồng nhưng hiện tại không hoạt động
    }

    return 'chuaThue'; // Chưa từng có hợp đồng nào
  } catch (error) {
    console.error('Error calculating khach thue status:', error);
    return 'chuaThue';
  }
}

/**
 * Cập nhật trạng thái phòng dựa trên hợp đồng
 * @param phongId - ID của phòng
 */
export async function updatePhongStatus(phongId: string): Promise<void> {
  try {
    const newStatus = await calculatePhongStatus(phongId);
    await Phong.findByIdAndUpdate(phongId, { trangThai: newStatus });
  } catch (error) {
    console.error('Error updating phong status:', error);
  }
}

/**
 * Cập nhật trạng thái khách thuê dựa trên hợp đồng
 * @param khachThueId - ID của khách thuê
 */
export async function updateKhachThueStatus(khachThueId: string): Promise<void> {
  try {
    const newStatus = await calculateKhachThueStatus(khachThueId);
    await KhachThue.findByIdAndUpdate(khachThueId, { trangThai: newStatus });
  } catch (error) {
    console.error('Error updating khach thue status:', error);
  }
}

/**
 * Cập nhật trạng thái tất cả phòng khi có thay đổi hợp đồng
 * @param phongId - ID của phòng (optional)
 */
export async function updateAllPhongStatus(phongId?: string): Promise<void> {
  try {
    if (phongId) {
      // Cập nhật trạng thái cho phòng cụ thể
      await updatePhongStatus(phongId);
    } else {
      // Cập nhật trạng thái cho tất cả phòng
      const allPhong = await Phong.find({}, '_id');
      await Promise.all(
        allPhong.map(phong => updatePhongStatus(phong._id.toString()))
      );
    }
  } catch (error) {
    console.error('Error updating all phong status:', error);
  }
}

/**
 * Cập nhật trạng thái tất cả khách thuê khi có thay đổi hợp đồng
 * @param khachThueIds - Danh sách ID khách thuê (optional)
 */
export async function updateAllKhachThueStatus(khachThueIds?: string[]): Promise<void> {
  try {
    if (khachThueIds && khachThueIds.length > 0) {
      // Cập nhật trạng thái cho khách thuê cụ thể
      await Promise.all(
        khachThueIds.map(id => updateKhachThueStatus(id))
      );
    } else {
      // Cập nhật trạng thái cho tất cả khách thuê
      const allKhachThue = await KhachThue.find({}, '_id');
      await Promise.all(
        allKhachThue.map(khach => updateKhachThueStatus(khach._id.toString()))
      );
    }
  } catch (error) {
    console.error('Error updating all khach thue status:', error);
  }
}
