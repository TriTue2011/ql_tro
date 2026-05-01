/**
 * zalo-hotline-router.ts
 *
 * Bộ định tuyến Zalo Hotline — triển khai 8 kịch bản A/B
 * dựa trên 3 công tắc quyền hạn gốc (batHotline, uyQuyenQL, uyQuyenHotline).
 *
 * ## 3 công tắc quyền hạn gốc (Section 4.1)
 * | Công tắc | Bật | Tắt |
 * | batHotline | Khách nhận tin từ Hotline | Khách nhận tin từ Zalo cá nhân người xử lý |
 * | uyQuyenQL | Chuyển thông báo cho Quản lý | Thông báo đổ về máy Chủ trọ |
 * | uyQuyenHotline | Quản lý chịu trách nhiệm bảo trì/quét QR | Chủ trọ chịu trách nhiệm |
 *
 * ## 8 kịch bản (Section 4.3)
 * Nhánh A (uyQuyenHotline = true): Quản lý lo Kỹ thuật
 *   A.1: Giao phó toàn diện     — batHotline=true,  uyQuyenQL=true
 *   A.2: Ủy quyền qua Zalo CN   — batHotline=false, uyQuyenQL=true
 *   A.3: Chủ trực Hotline, QL sửa — batHotline=true,  uyQuyenQL=false
 *   A.4: Chủ tự làm tất cả       — batHotline=false, uyQuyenQL=false
 * Nhánh B (uyQuyenHotline = false): Chủ trọ lo Kỹ thuật
 *   B.1: QL làm việc, chủ sửa Hotline — batHotline=true,  uyQuyenQL=true
 *   B.2: QL quản khách qua Zalo CN    — batHotline=false, uyQuyenQL=true
 *   B.3: Chủ làm tất cả qua Hotline   — batHotline=true,  uyQuyenQL=false
 *   B.4: Mô hình truyền thống          — batHotline=false, uyQuyenQL=false
 */

import prisma from '@/lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotifCategory = 'SuCo' | 'HoaDon' | 'TinKhach' | 'NguoiLa' | 'NhacNho' | 'HopDong' | 'ThanhToan';

export interface NotifTarget {
  chatId: string;
  /** Loại người nhận: 'chuTro' | 'quanLy' | 'nhanVien' */
  loai?: string;
}

export interface HotlineSwitchState {
  batHotline: boolean;
  uyQuyenQL: boolean;
  uyQuyenHotline: boolean;
}

export interface HotlineScenario {
  /** Tên kịch bản: A.1, A.2, ..., B.4 */
  id: string;
  /** Mô tả ngắn */
  label: string;
  /** Trạng thái công tắc */
  switches: HotlineSwitchState;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Đọc 3 công tắc từ CaiDatToaNha.
 * Nếu chưa có record → dùng default (batHotline=true, uyQuyenQL=false, uyQuyenHotline=false).
 */
export async function getHotlineSwitches(toaNhaId: string): Promise<HotlineSwitchState> {
  const settings = await prisma.caiDatToaNha.findUnique({
    where: { toaNhaId },
    select: { batHotline: true, uyQuyenQL: true, uyQuyenHotline: true },
  });
  return {
    batHotline: settings?.batHotline ?? true,
    uyQuyenQL: settings?.uyQuyenQL ?? false,
    uyQuyenHotline: settings?.uyQuyenHotline ?? false,
  };
}

/**
 * Xác định kịch bản hiện tại dựa trên 3 công tắc.
 */
export function identifyScenario(sw: HotlineSwitchState): HotlineScenario {
  const { batHotline, uyQuyenQL, uyQuyenHotline } = sw;

  if (uyQuyenHotline) {
    // Nhánh A: Quản lý lo Kỹ thuật
    if (batHotline && uyQuyenQL) return { id: 'A.1', label: 'Giao phó toàn diện', switches: sw };
    if (!batHotline && uyQuyenQL) return { id: 'A.2', label: 'Ủy quyền qua Zalo cá nhân', switches: sw };
    if (batHotline && !uyQuyenQL) return { id: 'A.3', label: 'Chủ trực qua Hotline, quản lý sửa lỗi', switches: sw };
    return { id: 'A.4', label: 'Chủ tự làm tất cả', switches: sw };
  } else {
    // Nhánh B: Chủ trọ lo Kỹ thuật
    if (batHotline && uyQuyenQL) return { id: 'B.1', label: 'Quản lý làm việc, chủ sửa Hotline', switches: sw };
    if (!batHotline && uyQuyenQL) return { id: 'B.2', label: 'Quản lý quản khách qua Zalo cá nhân', switches: sw };
    if (batHotline && !uyQuyenQL) return { id: 'B.3', label: 'Chủ làm tất cả qua Hotline', switches: sw };
    return { id: 'B.4', label: 'Mô hình truyền thống', switches: sw };
  }
}

/**
 * Kiểm tra quản lý có đủ 4 nhóm quyền bắt buộc khi bật ủy quyền QL không.
 * Section 4.2: Sự cố, Hóa đơn, Thông báo, Phê duyệt Yêu cầu.
 */
export async function checkRequiredPermissions(toaNhaId: string): Promise<{
  ok: boolean;
  missing: string[];
}> {
  const managers = await prisma.toaNhaNguoiQuanLy.findMany({
    where: { toaNhaId },
    select: {
      nguoiDungId: true,
      quyenSuCo: true,
      quyenHoaDon: true,
      quyenThanhToan: true,
      quyenHopDong: true,
    },
  });

  if (managers.length === 0) {
    return { ok: false, missing: ['Không có quản lý nào được gán cho tòa nhà này'] };
  }

  const allMissing = new Set<string>();

  for (const ql of managers) {
    if (!ql.quyenSuCo) allMissing.add('quyenSuCo (Sự cố)');
    if (!ql.quyenHoaDon) allMissing.add('quyenHoaDon (Hóa đơn)');
    if (!ql.quyenThanhToan) allMissing.add('quyenThanhToan (Thanh toán/Thông báo)');
    if (!ql.quyenHopDong) allMissing.add('quyenHopDong (Phê duyệt Yêu cầu)');
  }

  // Nếu có ít nhất 1 quản lý đủ quyền → ok
  const anyFull = managers.some(
    ql => ql.quyenSuCo && ql.quyenHoaDon && ql.quyenThanhToan && ql.quyenHopDong
  );

  return {
    ok: anyFull,
    missing: anyFull ? [] : [...new Set(allMissing)],
  };
}

// ─── Routing Logic ─────────────────────────────────────────────────────────────

/**
 * Xác định người nhận thông báo nội bộ (đối nội) dựa trên kịch bản hiện tại.
 *
 * @param toaNhaId - ID tòa nhà
 * @param category - Loại thông báo (SuCo, HoaDon, TinKhach, NguoiLa, NhacNho)
 * @returns Danh sách chatId người nhận
 */
export async function routeInternalNotification(
  toaNhaId: string,
  category: NotifCategory
): Promise<NotifTarget[]> {
  const sw = await getHotlineSwitches(toaNhaId);
  const scenario = identifyScenario(sw);

  // Lấy thông tin chủ trọ và quản lý
  const toaNha = await prisma.toaNha.findUnique({
    where: { id: toaNhaId },
    select: {
      chuSoHuu: { select: { id: true, zaloChatId: true } },
      nguoiQuanLy: {
        select: {
          nguoiDung: { select: { id: true, zaloChatId: true } },
        },
      },
    },
  });
  if (!toaNha) return [];

  const chu = toaNha.chuSoHuu;
  const quanLys = toaNha.nguoiQuanLy.map(q => q.nguoiDung).filter(q => q.zaloChatId);

  // Lấy settings ZaloThongBaoCaiDat cho chủ trọ
  const chuSettings = await prisma.zaloThongBaoCaiDat.findFirst({
    where: { nguoiDungId: chu.id, toaNhaId },
  });

  const nhanKey = `nhan${category}` as keyof typeof chuSettings;
  const chuyenKey = `chuyen${category}ChoQL` as keyof typeof chuSettings;

  const chuNhan: boolean = chuSettings ? !!(chuSettings as any)[nhanKey] : true;
  const chuyenChoQL: boolean = chuSettings ? !!(chuSettings as any)[chuyenKey] : false;

  // ─── Áp dụng logic 8 kịch bản ────────────────────────────────────────────
  //
  // uyQuyenQL (công tắc mới) ≠ chuyen...ChoQL (cài đặt cũ).
  // - uyQuyenQL = true  → ưu tiên route cho quản lý (nếu có quyền)
  // - uyQuyenQL = false → route về chủ trọ
  // - chuyen...ChoQL vẫn giữ vai trò là "cá nhân chủ trọ có muốn chuyển loại này không"
  //
  // Kết hợp: uyQuyenQL && chuyen...ChoQL && quản lý có quyền → route cho QL
  //          uyQuyenQL && chuyen...ChoQL && không QL nào nhận → fallback chủ trọ
  //          !uyQuyenQL → chủ trọ (bất kể chuyen...ChoQL)

  const shouldDelegateToQL = sw.uyQuyenQL && chuyenChoQL && quanLys.length > 0;

  if (shouldDelegateToQL) {
    // Lấy settings của từng quản lý
    const qlTargets: NotifTarget[] = [];
    for (const ql of quanLys) {
      if (!ql.zaloChatId) continue;
      const qlSettings = await prisma.zaloThongBaoCaiDat.findFirst({
        where: { nguoiDungId: ql.id, toaNhaId },
      });
      const qlNhan: boolean = qlSettings ? !!(qlSettings as any)[nhanKey] : true;
      if (qlNhan) {
        qlTargets.push({ chatId: ql.zaloChatId, loai: 'quanLy' });
      }
    }

    if (qlTargets.length > 0) {
      return qlTargets;
    }
    // Fallback: không có QL nào nhận → gửi chủ trọ nếu chủ trọ bật nhận
  }

  // Route về chủ trọ
  if (chuNhan && chu.zaloChatId) {
    return [{ chatId: chu.zaloChatId, loai: 'chuTro' }];
  }

  return [];
}

/**
 * Xác định ai chịu trách nhiệm bảo trì Hotline / quét QR.
 * Dựa trên công tắc uyQuyenHotline.
 *
 * @returns 'quanLy' | 'chuTro'
 */
export async function getHotlineResponsible(toaNhaId: string): Promise<'quanLy' | 'chuTro'> {
  const sw = await getHotlineSwitches(toaNhaId);
  return sw.uyQuyenHotline ? 'quanLy' : 'chuTro';
}

/**
 * Kiểm tra xem khách thuê có nên nhận tin từ Hotline hay không.
 * batHotline = true  → khách nhận từ Hotline
 * batHotline = false → khách nhận từ Zalo cá nhân người xử lý
 */
export async function shouldUseHotlineForTenant(toaNhaId: string): Promise<boolean> {
  const sw = await getHotlineSwitches(toaNhaId);
  return sw.batHotline;
}
