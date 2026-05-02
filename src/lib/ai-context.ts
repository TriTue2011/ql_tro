/**
 * ai-context.ts
 *
 * Xây dựng context từ DB và system prompt theo vai trò người dùng.
 * Mỗi vai trò chỉ nhận dữ liệu trong phạm vi quyền của mình —
 * AI không thể trả lời vượt ngoài scope đó.
 */

import prisma from '@/lib/prisma';

export type UserRole =
  | 'admin'
  | 'chuNha'
  | 'dongChuTro'
  | 'quanLy'
  | 'nhanVien'
  | 'khachThue';

export interface RoleContext {
  systemPrompt: string;
}

const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('vi-VN');

async function buildVietQrUrl(hoaDon: { maHoaDon: string; conLai: number; thang: number; nam: number }): Promise<string | null> {
  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: ['ngan_hang_ten', 'ngan_hang_so_tai_khoan', 'ngan_hang_chu_tai_khoan'] } },
  });
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.khoa] = r.giaTri?.trim() ?? '';
  if (!cfg['ngan_hang_ten'] || !cfg['ngan_hang_so_tai_khoan']) return null;
  const addInfo = encodeURIComponent(`Thanh toan ${hoaDon.maHoaDon} T${hoaDon.thang}/${hoaDon.nam}`);
  const accName = encodeURIComponent(cfg['ngan_hang_chu_tai_khoan'] || '');
  return `https://img.vietqr.io/image/${cfg['ngan_hang_ten']}-${cfg['ngan_hang_so_tai_khoan']}-compact2.png?amount=${Math.round(hoaDon.conLai)}&addInfo=${addInfo}&accountName=${accName}`;
}

// ── KhachThue context ────────────────────────────────────────────────────────

async function buildKhachThueContext(userId: string): Promise<string> {
  const kt = await prisma.khachThue.findUnique({
    where: { id: userId },
    select: {
      hoTen: true,
      soDienThoai: true,
      hopDong: {
        where: { trangThai: 'hoatDong' },
        take: 1,
        orderBy: { ngayBatDau: 'desc' },
        select: {
          maHopDong: true,
          ngayBatDau: true,
          ngayKetThuc: true,
          giaThue: true,
          tienCoc: true,
          giaDien: true,
          giaNuoc: true,
          phiDichVu: true,
          phong: {
            select: {
              maPhong: true,
              tang: true,
              toaNha: {
                select: {
                  tenToaNha: true,
                  lienHePhuTrach: true,
                  moTa: true,
                },
              },
            },
          },
        },
      },
      hoaDon: {
        orderBy: [{ nam: 'desc' }, { thang: 'desc' }],
        take: 4,
        select: {
          maHoaDon: true,
          thang: true,
          nam: true,
          tienPhong: true,
          tienDien: true,
          soDien: true,
          tienNuoc: true,
          soNuoc: true,
          tongTien: true,
          daThanhToan: true,
          conLai: true,
          trangThai: true,
          hanThanhToan: true,
        },
      },
      suCo: {
        where: { trangThai: { in: ['moi', 'dangXuLy'] } },
        take: 5,
        orderBy: { ngayBaoCao: 'desc' },
        select: {
          tieuDe: true,
          loaiSuCo: true,
          trangThai: true,
          mucDoUuTien: true,
          ngayBaoCao: true,
        },
      },
    },
  });

  if (!kt) return '(Không tìm thấy khách thuê)';

  const lines: string[] = [`Khách thuê: ${kt.hoTen}`];
  if (kt.soDienThoai) lines.push(`SĐT: ${kt.soDienThoai}`);

  const hd = kt.hopDong[0];
  if (hd) {
    lines.push(`\nHỢP ĐỒNG ĐANG HIỆU LỰC:`);
    lines.push(`- Mã: ${hd.maHopDong}`);
    lines.push(`- Phòng: ${hd.phong.maPhong} (tầng ${hd.phong.tang}) — ${hd.phong.toaNha.tenToaNha}`);
    lines.push(`- Giá thuê: ${fmtMoney(hd.giaThue)}/tháng`);
    lines.push(`- Tiền cọc: ${fmtMoney(hd.tienCoc)}`);
    lines.push(`- Giá điện: ${fmtMoney(hd.giaDien)}/kWh | Giá nước: ${fmtMoney(hd.giaNuoc)}/m³`);
    lines.push(`- Thời hạn: ${fmtDate(hd.ngayBatDau)} → ${fmtDate(hd.ngayKetThuc)}`);

    const phiDV = (hd.phiDichVu as { ten: string; gia: number }[] | null) ?? [];
    if (phiDV.length > 0) {
      lines.push(`- Phí dịch vụ: ${phiDV.map(f => `${f.ten}: ${fmtMoney(f.gia)}`).join(', ')}`);
    }

    const contacts = hd.phong.toaNha.lienHePhuTrach as
      | { ten: string; soDienThoai: string; vaiTro?: string }[]
      | null;
    if (contacts?.length) {
      lines.push(`\nLIÊN HỆ QUẢN LÝ TÒA NHÀ:`);
      contacts.forEach(c => {
        lines.push(`- ${c.ten}${c.vaiTro ? ` (${c.vaiTro})` : ''}: ${c.soDienThoai}`);
      });
    }
  } else {
    lines.push(`\nHiện chưa có hợp đồng đang hoạt động.`);
  }

  if (kt.hoaDon.length > 0) {
    lines.push(`\nHÓA ĐƠN GẦN ĐÂY:`);
    const qrUrls = await Promise.all(
      kt.hoaDon.map(inv =>
        inv.conLai > 0 ? buildVietQrUrl(inv) : Promise.resolve(null),
      ),
    );
    kt.hoaDon.forEach((inv, i) => {
      const tt =
        {
          chuaThanhToan: 'Chưa thanh toán',
          daThanhToanMotPhan: 'Đã thanh toán 1 phần',
          daThanhToan: 'Đã thanh toán',
          quaHan: 'Quá hạn',
        }[inv.trangThai] ?? inv.trangThai;
      const no = inv.conLai > 0 ? ` | Còn nợ: ${fmtMoney(inv.conLai)}` : '';
      lines.push(
        `- T${inv.thang}/${inv.nam}: ${fmtMoney(inv.tongTien)} (điện ${inv.soDien}kWh, nước ${inv.soNuoc}m³) | ${tt}${no} | Hạn: ${fmtDate(inv.hanThanhToan)}`,
      );
      if (qrUrls[i]) lines.push(`  QR thanh toán: ${qrUrls[i]}`);
    });
  } else {
    lines.push(`\nChưa có hóa đơn nào.`);
  }

  if (kt.suCo.length > 0) {
    lines.push(`\nSỰ CỐ ĐANG XỬ LÝ (${kt.suCo.length}):`);
    kt.suCo.forEach(sc => {
      const tt = sc.trangThai === 'moi' ? 'Mới báo' : 'Đang xử lý';
      const uu =
        sc.mucDoUuTien === 'cao' ? '[Cao]' : sc.mucDoUuTien === 'trungBinh' ? '[TB]' : '[Thấp]';
      lines.push(`- ${uu} ${sc.tieuDe} — ${tt} — ${fmtDate(sc.ngayBaoCao)}`);
    });
  }

  const moTaToaNha = hd?.phong?.toaNha?.moTa;
  if (moTaToaNha) {
    lines.push(`\nTHÔNG TIN TÒA NHÀ & NỘI QUY:`);
    lines.push(moTaToaNha);
  }

  return lines.join('\n');
}

// ── Owner / Manager context ──────────────────────────────────────────────────

async function buildOwnerContext(userId: string, role: UserRole): Promise<string> {
  let buildingIds: string[] = [];
  console.log(`[ai-context] buildOwnerContext: userId=${userId}, role=${role}`);

  if (role === 'admin') {
    const all = await prisma.toaNha.findMany({ select: { id: true }, take: 50 });
    buildingIds = all.map(b => b.id);
  } else {
    // Tìm cả tòa nhà sở hữu và tòa nhà được gán quản lý để chắc chắn không sót
    const [own, managed] = await Promise.all([
      prisma.toaNha.findMany({
        where: { chuSoHuuId: userId },
        select: { id: true },
      }),
      prisma.toaNhaNguoiQuanLy.findMany({
        where: { nguoiDungId: userId },
        select: { toaNhaId: true },
      })
    ]);

    buildingIds = Array.from(new Set([
      ...own.map(b => b.id),
      ...managed.map(m => m.toaNhaId)
    ]));
  }

  console.log(`[ai-context] Found ${buildingIds.length} buildings for user ${userId}`);

  if (buildingIds.length === 0) return '(Bạn chưa có tòa nhà nào trong danh sách quản lý hoặc sở hữu)';

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    buildings, roomStats, unpaidInvoices, expiringContracts,
    openIncidents, activeRooms,
    resolvedIncidentsToday, recentPaidInvoices, recentExpiredContracts,
  ] = await Promise.all([
    prisma.toaNha.findMany({
      where: { id: { in: buildingIds } },
      select: {
        tenToaNha: true,
        tongSoPhong: true,
        chuSoHuu: role === 'admin' ? { select: { ten: true } } : undefined,
      },
      orderBy: { tenToaNha: 'asc' },
    }),

    prisma.phong.groupBy({
      by: ['trangThai'],
      where: { toaNhaId: { in: buildingIds } },
      _count: { _all: true },
    }),

    prisma.hoaDon.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: { in: ['chuaThanhToan', 'daThanhToanMotPhan', 'quaHan'] },
      },
      orderBy: [{ nam: 'asc' }, { thang: 'asc' }],
      take: 30,
      select: {
        maHoaDon: true, thang: true, nam: true,
        conLai: true, trangThai: true, hanThanhToan: true,
        phong: { select: { maPhong: true, tang: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true } },
      }
    }),

    prisma.hopDong.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: 'hoatDong',
        ngayKetThuc: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { ngayKetThuc: 'asc' },
      take: 20,
      select: {
        maHopDong: true, ngayKetThuc: true,
        phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
        nguoiDaiDien: { select: { hoTen: true } },
      },
    }),

    // Sự cố đang mở (mới + đang xử lý)
    prisma.suCo.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: { in: ['moi', 'dangXuLy'] },
      },
      take: 15,
      orderBy: { ngayBaoCao: 'desc' },
      select: {
        tieuDe: true, trangThai: true, mucDoUuTien: true, ngayBaoCao: true,
        phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
      },
    }),

    prisma.phong.findMany({
      where: { toaNhaId: { in: buildingIds }, trangThai: 'dangThue' },
      take: 50,
      select: {
        maPhong: true, tang: true,
        toaNha: { select: { tenToaNha: true } },
        hopDong: {
          where: { trangThai: 'hoatDong' },
          select: { nguoiDaiDien: { select: { hoTen: true } } }
        }
      }
    }),

    // Sự cố đã xử lý xong trong hôm nay
    prisma.suCo.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: 'daXuLy',
        ngayCapNhat: { gte: todayStart },
      },
      take: 20,
      orderBy: { ngayCapNhat: 'desc' },
      select: {
        tieuDe: true, ngayCapNhat: true,
        phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
      },
    }),

    // Hóa đơn đã thanh toán trong 7 ngày gần đây
    prisma.hoaDon.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: 'daThanhToan',
        ngayCapNhat: { gte: sevenDaysAgo },
      },
      take: 20,
      orderBy: { ngayCapNhat: 'desc' },
      select: {
        maHoaDon: true, thang: true, nam: true, tongTien: true, ngayCapNhat: true,
        phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true } },
      },
    }),

    // Hợp đồng đã hết hạn trong 30 ngày gần đây
    prisma.hopDong.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: { in: ['hetHan', 'hoatDong'] },
        ngayKetThuc: { gte: thirtyDaysAgo, lte: new Date() },
      },
      take: 10,
      orderBy: { ngayKetThuc: 'desc' },
      select: {
        maHopDong: true, ngayKetThuc: true,
        phong: { select: { maPhong: true, toaNha: { select: { tenToaNha: true } } } },
        nguoiDaiDien: { select: { hoTen: true } },
      },
    }),
  ]);

  const countByStatus = (s: string) =>
    roomStats.find(r => r.trangThai === s)?._count._all ?? 0;

  const lines: string[] = [];

  lines.push(`DANH SÁCH TÒA NHÀ (${buildings.length} tòa):`);
  buildings.forEach(b => {
    const chu = (b as { chuSoHuu?: { ten: string } }).chuSoHuu;
    lines.push(`- ${b.tenToaNha} (${b.tongSoPhong} phòng)${chu ? ` — Chủ: ${chu.ten}` : ''}`);
  });

  lines.push(`\nTHỐNG KÊ PHÒNG:`);
  lines.push(`- Đang thuê: ${countByStatus('dangThue')} phòng`);
  lines.push(`- Phòng trống: ${countByStatus('trong')} phòng`);
  if (countByStatus('baoTri') > 0) lines.push(`- Bảo trì: ${countByStatus('baoTri')} phòng`);
  if (countByStatus('daDat') > 0) lines.push(`- Đã đặt: ${countByStatus('daDat')} phòng`);

  if (unpaidInvoices.length > 0) {
    const overdueCount = unpaidInvoices.filter(i => new Date(i.hanThanhToan) < new Date()).length;
    lines.push(`\nHÓA ĐƠN CHƯA THANH TOÁN (${unpaidInvoices.length} hóa đơn, quá hạn: ${overdueCount}):`);
    unpaidInvoices.forEach(inv => {
      const khach = inv.khachThue?.hoTen ? ` (${inv.khachThue.hoTen})` : '';
      lines.push(`- T${inv.thang}/${inv.nam} | P.${inv.phong.maPhong} - ${inv.phong.toaNha.tenToaNha}${khach} | Nợ: ${fmtMoney(inv.conLai)} | Hạn: ${fmtDate(inv.hanThanhToan)}`);
    });
  }

  if (expiringContracts.length > 0) {
    lines.push(`\nHỢP ĐỒNG SẮP HẾT HẠN (30 ngày) — ${expiringContracts.length} hợp đồng:`);
    expiringContracts.forEach(hd => {
      const tenKhach = hd.nguoiDaiDien?.hoTen || 'Chưa rõ';
      const soNgay = Math.ceil((new Date(hd.ngayKetThuc).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      lines.push(`- ${hd.maHopDong} | P.${hd.phong.maPhong} - ${hd.phong.toaNha.tenToaNha} | Khách: ${tenKhach} | Hết hạn: ${fmtDate(hd.ngayKetThuc)} (còn ${soNgay} ngày)`);
    });
  }

  if (openIncidents.length > 0) {
    lines.push(`\nSỰ CỐ ĐANG MỞ (${openIncidents.length}):`);
    openIncidents.forEach(sc => {
      const tt = sc.trangThai === 'moi' ? 'Mới' : 'Đang xử lý';
      const uu =
        sc.mucDoUuTien === 'cao' ? '🔴' : sc.mucDoUuTien === 'trungBinh' ? '🟡' : '🟢';
      lines.push(
        `${uu} ${sc.tieuDe} — Phòng ${sc.phong.maPhong} (${sc.phong.toaNha.tenToaNha}) [${tt}]`,
      );
    });
  }

  if (activeRooms.length > 0) {
    lines.push(`\nDANH SÁCH KHÁCH THUÊ HIỆN TẠI:`);
    activeRooms.forEach(r => {
      const nguoiDaiDien = r.hopDong[0]?.nguoiDaiDien?.hoTen || 'Chưa rõ';
      lines.push(`- Tòa: ${r.toaNha.tenToaNha} | Tầng: ${r.tang} | Phòng: ${r.maPhong} | Khách: ${nguoiDaiDien}`);
    });
  }

  if (resolvedIncidentsToday.length > 0) {
    lines.push(`\nSỰ CỐ ĐÃ XỬ LÝ XONG HÔM NAY (${resolvedIncidentsToday.length}):`);
    resolvedIncidentsToday.forEach(sc => {
      const gio = new Date(sc.ngayCapNhat).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      lines.push(`- ${sc.tieuDe} — Phòng ${sc.phong.maPhong} (${sc.phong.toaNha.tenToaNha}) [Xong lúc ${gio}]`);
    });
  } else {
    lines.push(`\nSỰ CỐ ĐÃ XỬ LÝ HÔM NAY: 0 (Hiện chưa có sự cố nào hoàn thành hôm nay).`);
  }

  lines.push(`\nHÓA ĐƠN ĐÃ THANH TOÁN (7 ngày qua): ${recentPaidInvoices.length}`);
  recentPaidInvoices.forEach(inv => {
    lines.push(`- ${inv.maHoaDon} | T${inv.thang}/${inv.nam} | P.${inv.phong.maPhong} | ${fmtMoney(inv.tongTien)} | Xong: ${fmtDate(inv.ngayCapNhat)}`);
  });

  lines.push(`\nHỢP ĐỒNG MỚI HẾT HẠN (30 ngày qua): ${recentExpiredContracts.length}`);
  recentExpiredContracts.forEach(hd => {
    lines.push(`- ${hd.maHopDong} | P.${hd.phong.maPhong} | Khách: ${hd.nguoiDaiDien?.hoTen} | Hết hạn: ${fmtDate(hd.ngayKetThuc)}`);
  });

  return lines.join('\n');
}

// ── Manager permissions context ──────────────────────────────────────────────

async function buildManagerPermissionsContext(userId: string): Promise<string> {
  const perms = await prisma.toaNhaNguoiQuanLy.findMany({
    where: { nguoiDungId: userId },
    select: {
      toaNha: { select: { tenToaNha: true } },
      mucDoHopDong: true,
      mucDoHoaDon: true,
      mucDoThanhToan: true,
      mucDoSuCo: true,
      mucDoKichHoatTaiKhoan: true,
    },
  });

  if (perms.length === 0) return '';

  const lines = perms.map(p => {
    const q: string[] = [];
    if (p.mucDoHopDong !== 'hidden') q.push('hợp đồng');
    if (p.mucDoHoaDon !== 'hidden') q.push('hóa đơn');
    if (p.mucDoThanhToan !== 'hidden') q.push('thanh toán');
    if (p.mucDoSuCo !== 'hidden') q.push('sự cố');
    if (p.mucDoKichHoatTaiKhoan !== 'hidden') q.push('kích hoạt tài khoản KT');
    return `- ${p.toaNha.tenToaNha}: ${q.length > 0 ? q.join(', ') : 'chỉ xem'}`;
  });

  return `\nQUYỀN HẠN ĐƯỢC TRAO:\n${lines.join('\n')}`;
}

// ── Public room context (cho người lạ hỏi thuê) ─────────────────────────────

/** Helper: format danh sách phòng trống thành chuỗi text */
function formatRoomsContext(rooms: Array<{
  maPhong: string;
  tang: number;
  dienTich: number;
  giaThue: number;
  tienCoc: number;
  moTa: string | null;
  tienNghi: unknown;
  soNguoiToiDa: number;
  toaNha: { tenToaNha: string; diaChi: unknown; lienHePhuTrach: unknown };
}>): string {
  if (rooms.length === 0) return '';

  const lines: string[] = [`Tổng số phòng trống: ${rooms.length}`];
  rooms.forEach((r, i) => {
    const addr = r.toaNha.diaChi as {
      soNha?: string; duong?: string; phuong?: string; quan?: string; thanhPho?: string;
    } | null;
    const addrShort = addr
      ? [addr.soNha, addr.duong, addr.phuong, addr.quan].filter(Boolean).join(', ')
      : '';
    const city = addr?.thanhPho ?? '';
    lines.push('');
    lines.push(`[${i + 1}] Phòng ${r.maPhong} — ${r.toaNha.tenToaNha}${addrShort ? ` (${addrShort})` : ''}${city ? ` — ${city}` : ''}`);
    lines.push(`    Tầng ${r.tang} | ${r.dienTich}m² | Tối đa ${r.soNguoiToiDa} người`);
    lines.push(`    Giá thuê: ${fmtMoney(r.giaThue)}/tháng | Tiền cọc: ${fmtMoney(r.tienCoc)}`);
    if ((r.tienNghi as string[]).length > 0)
      lines.push(`    Tiện nghi: ${(r.tienNghi as string[]).join(', ')}`);
    if (r.moTa) lines.push(`    Mô tả: ${r.moTa.slice(0, 120)}`);
  });

  // Thêm liên hệ phụ trách (lấy từ tòa nhà đầu tiên có liên hệ)
  for (const r of rooms) {
    const contacts = r.toaNha.lienHePhuTrach as
      | { ten: string; soDienThoai: string; vaiTro?: string }[]
      | null;
    if (contacts?.length) {
      lines.push('');
      lines.push('LIÊN HỆ TƯ VẤN:');
      contacts.slice(0, 2).forEach(c => {
        lines.push(`- ${c.ten}${c.vaiTro ? ` (${c.vaiTro})` : ''}: ${c.soDienThoai}`);
      });
      break;
    }
  }

  return lines.join('\n');
}

const ROOM_SELECT = {
  maPhong: true,
  tang: true,
  dienTich: true,
  giaThue: true,
  tienCoc: true,
  moTa: true,
  tienNghi: true,
  soNguoiToiDa: true,
  toaNha: {
    select: {
      tenToaNha: true,
      diaChi: true,
      lienHePhuTrach: true,
    },
  },
} as const;

/**
 * Trả về danh sách phòng đang còn trống — chỉ thông tin công khai.
 * Dùng cho AI tư vấn người lạ có nhu cầu thuê.
 * @param managerId Nếu có: chỉ lấy phòng thuộc các tòa nhà mà người này sở hữu hoặc quản lý.
 */
export async function buildPublicRoomContext(managerId?: string): Promise<string> {
  const where: any = { trangThai: 'trong' };

  if (managerId) {
    const [owned, managed] = await Promise.all([
      prisma.toaNha.findMany({ where: { chuSoHuuId: managerId }, select: { id: true } }),
      prisma.toaNhaNguoiQuanLy.findMany({ where: { nguoiDungId: managerId }, select: { toaNhaId: true } }),
    ]);
    const allowedIds = Array.from(new Set([
      ...owned.map(b => b.id),
      ...managed.map(m => m.toaNhaId),
    ]));
    if (allowedIds.length > 0) {
      where.toaNhaId = { in: allowedIds };
    } else {
      return 'Hiện tại chưa có thông tin phòng trống cụ thể.';
    }
  }

  const rooms = await prisma.phong.findMany({
    where,
    take: 20,
    orderBy: [{ toaNhaId: 'asc' }, { tang: 'asc' }],
    select: ROOM_SELECT,
  });
  if (rooms.length === 0) return 'Hiện tại chưa có thông tin phòng trống cụ thể.';
  return formatRoomsContext(rooms as Parameters<typeof formatRoomsContext>[0]);
}

/**
 * Trả về danh sách phòng trống CHỈ TRONG CÙNG TÒA NHÀ / PHƯỜNG XÃ / THÀNH PHỐ
 * với khách thuê hiện tại. Dùng khi tư vấn cho khách thuê đã đăng ký.
 *
 * Ưu tiên 3 tầng:
 *  1. Phòng cùng tòa nhà khách đang ở
 *  2. Phòng cùng phường/xã (phuong) — nếu cùng tòa chưa đủ 5 phòng
 *  3. Phòng cùng thành phố — nếu cùng phường vẫn chưa đủ 5 phòng
 *  → Không bao giờ trả về phòng ở tỉnh/thành phố khác
 */
export async function buildPublicRoomContextForTenant(khachThueId: string): Promise<string> {
  // Lấy thông tin tòa nhà + địa chỉ khách đang ở
  const hopDong = await prisma.hopDong.findFirst({
    where: {
      trangThai: 'hoatDong',
      khachThue: { some: { id: khachThueId } },
    },
    select: {
      phong: {
        select: {
          toaNhaId: true,
          toaNha: { select: { diaChi: true, tenToaNha: true } },
        },
      },
    },
  });

  const toaNhaId = hopDong?.phong?.toaNhaId ?? null;
  const diaChi = hopDong?.phong?.toaNha?.diaChi as
    | { thanhPho?: string; quan?: string; phuong?: string } | null;
  const thanhPhoKhach = diaChi?.thanhPho?.trim().toLowerCase() ?? null;
  const phuongKhach = diaChi?.phuong?.trim().toLowerCase() ?? null;
  const tenToaNhaKhach = hopDong?.phong?.toaNha?.tenToaNha ?? '';

  // ── Tầng 1: cùng tòa nhà ─────────────────────────────────────────────────
  const sameBuildingRooms = toaNhaId
    ? await prisma.phong.findMany({
      where: { trangThai: 'trong', toaNhaId },
      take: 10,
      orderBy: [{ tang: 'asc' }],
      select: ROOM_SELECT,
    })
    : [];

  const usedToaNhaIds = new Set<string>(toaNhaId ? [toaNhaId] : []);
  const combined: Parameters<typeof formatRoomsContext>[0] =
    [...(sameBuildingRooms as Parameters<typeof formatRoomsContext>[0])];

  // ── Tầng 2: cùng phường/xã (nếu chưa đủ 5 phòng) ────────────────────────
  if (thanhPhoKhach && phuongKhach && combined.length < 5) {
    const candidates = await prisma.phong.findMany({
      where: {
        trangThai: 'trong',
        ...(usedToaNhaIds.size > 0 ? { toaNhaId: { notIn: Array.from(usedToaNhaIds) } } : {}),
      },
      take: 30,
      orderBy: [{ toaNhaId: 'asc' }, { tang: 'asc' }],
      select: ROOM_SELECT,
    });
    const wardRooms = (candidates as Parameters<typeof formatRoomsContext>[0]).filter(r => {
      const addr = r.toaNha.diaChi as { thanhPho?: string; phuong?: string } | null;
      return (
        addr?.thanhPho?.trim().toLowerCase() === thanhPhoKhach &&
        addr?.phuong?.trim().toLowerCase() === phuongKhach
      );
    });
    const toAdd = wardRooms.slice(0, 5 - combined.length);
    combined.push(...toAdd);
    for (const r of toAdd) {
      // Ghi nhận toaNhaId đã dùng để tầng 3 không trùng lặp
      const anyR = r as any;
      if (anyR.toaNhaId) usedToaNhaIds.add(anyR.toaNhaId);
    }
  }

  // ── Tầng 3: cùng thành phố (nếu vẫn chưa đủ 5 phòng) ────────────────────
  if (thanhPhoKhach && combined.length < 5) {
    const candidates = await prisma.phong.findMany({
      where: {
        trangThai: 'trong',
        ...(usedToaNhaIds.size > 0 ? { toaNhaId: { notIn: Array.from(usedToaNhaIds) } } : {}),
      },
      take: 30,
      orderBy: [{ toaNhaId: 'asc' }, { tang: 'asc' }],
      select: ROOM_SELECT,
    });
    const cityRooms = (candidates as Parameters<typeof formatRoomsContext>[0]).filter(r => {
      const addr = r.toaNha.diaChi as { thanhPho?: string } | null;
      return addr?.thanhPho?.trim().toLowerCase() === thanhPhoKhach;
    });
    combined.push(...cityRooms.slice(0, 10 - combined.length));
  }

  if (combined.length === 0) return '';

  // Prefix mô tả phạm vi tư vấn
  const locationHint = [
    tenToaNhaKhach,
    phuongKhach ? `P. ${diaChi?.phuong}` : null,
    thanhPhoKhach ? diaChi?.thanhPho : null,
  ].filter(Boolean).join(', ');
  const prefix = locationHint
    ? `(Phòng trống gần bạn — ưu tiên cùng tòa, cùng phường, cùng thành phố: ${locationHint})`
    : '';
  const body = formatRoomsContext(combined);
  return prefix ? `${prefix}\n${body}` : body;
}

// ── Main builder ─────────────────────────────────────────────────────────────

export async function buildContextForRole(
  userId: string,
  role: UserRole,
): Promise<RoleContext> {
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let contextText = '';
  let intro = '';
  let rules: string[] = [];

  switch (role) {
    case 'khachThue': {
      const [ktCtx, publicRooms] = await Promise.all([
        buildKhachThueContext(userId),
        buildPublicRoomContextForTenant(userId),
      ]);
      contextText = ktCtx;
      if (publicRooms) {
        contextText += `\n\n--- DANH SÁCH PHÒNG TRỐNG GẦN BẠN ---\n${publicRooms}`;
      }
      intro = 'Bạn là trợ lý thông minh của khu nhà trọ, hỗ trợ riêng cho khách thuê này. Hãy luôn giữ thái độ lịch sự, chuyên nghiệp, dùng "Dạ/Vâng" và xưng hô Anh/Chị/Bạn phù hợp.';
      rules = [
        'Chỉ trả lời về thông tin của khách thuê này (phòng, hóa đơn, hợp đồng, sự cố) và danh sách phòng trống GẦN KHU VỰC khách đang ở được cung cấp.',
        'TUYỆT ĐỐI KHÔNG cung cấp, rò rỉ thông tin cá nhân hay phòng của khách thuê khác. Bạn chỉ làm việc trong phạm vi thông tin của khách thuê hiện tại.',
        'Khi tư vấn phòng trống: CHỈ giới thiệu các phòng trong DANH SÁCH PHÒNG TRỐNG GẦN BẠN ở trên — là phòng cùng tòa hoặc cùng thành phố/khu vực với khách. KHÔNG giới thiệu phòng ở tỉnh/thành phố khác.',
        'Không thực hiện thao tác sửa/xóa dữ liệu trực tiếp — ngoại trừ TẠO SỰ CỐ bằng mã lệnh.',
        'Khi khách yêu cầu "gửi hóa đơn", trình bày ĐẦY ĐỦ chi tiết hóa đơn từ dữ liệu thực tế (tháng, tổng tiền, từng khoản, hạn, trạng thái, mã hóa đơn) và kèm link QR thanh toán nếu có. KHÔNG nói không thể gửi file PDF — đây là tin nhắn văn bản thay thế.',
        'KHI KHÁCH BÁO SỰ CỐ (CHẨN ĐOÁN CHUYÊN SÂU):',
        '   - Bước 1: Chào khách, xác nhận đã nhận thông tin.',
        '   - Bước 2: Hỏi thêm các câu hỏi chẩn đoán để xác định mức độ (VD: "Bị mất điện cả phòng hay chỉ một khu vực?", "Nước chảy mạnh hay chỉ thấm?").',
        '   - Bước 3: Đưa ra chỉ dẫn an toàn ngay lập tức nếu cần (VD: Khóa van nước tổng, ngắt điện khu vực đó).',
        '   - Bước 4: Lịch sự nhắc khách gửi ảnh/video cận cảnh để quản lý nắm tình hình tốt hơn.',
        '   - Bước 5: Chỉ tạo lệnh [CREATE_INCIDENT] khi đã đủ thông tin văn bản. Tự đánh giá mức độ ưu tiên (cao|trungBinh|thap).',
        'LỆNH TẠO SỰ CỐ: [CREATE_INCIDENT: {"tieuDe": "Tóm tắt ngắn", "moTa": "Chi tiết", "loaiSuCo": "dienNuoc|noiThat|vesinh|anNinh|khac", "mucDoUuTien": "cao|trungBinh|thap"}]',
        'THẤU HIỂU CẢM XÚC: Nếu khách phàn nàn hoặc bức xúc, hãy dùng tông giọng xoa dịu (VD: "Em rất tiếc về sự cố này...", "Em thấu hiểu sự bất tiện của mình...").',
      ];
      break;
    }

    case 'chuNha':
    case 'dongChuTro': {
      contextText = await buildOwnerContext(userId, role);
      intro = `Bạn là trợ lý quản lý nhà trọ thông minh, hỗ trợ ${role === 'chuNha' ? 'chủ trọ' : 'đồng chủ trọ'}. Hãy luôn giữ thái độ lịch sự, dùng "Dạ/Vâng" và từ ngữ nhẹ nhàng.`;
      rules = [
        'Chỉ hiển thị dữ liệu tòa nhà thuộc quyền quản lý của người này.',
        'Hỗ trợ thống kê, phân tích tình trạng phòng, hóa đơn, hợp đồng, sự cố.',
        'Không tiết lộ thông tin nhạy cảm (mật khẩu, token, API key).',
        'Không thực thi thao tác xóa/sửa — chỉ tư vấn và giải thích.',
        role === 'dongChuTro' ? 'Đồng chủ trọ chỉ có quyền xem, nhắc nhở người hỏi khi cần thao tác.' : '',
      ].filter(Boolean);
      break;
    }

    case 'quanLy': {
      contextText = await buildOwnerContext(userId, 'quanLy');
      const permText = await buildManagerPermissionsContext(userId);
      if (permText) contextText += permText;
      intro = 'Bạn là trợ lý quản lý nhà trọ, hỗ trợ người quản lý tòa nhà. Hãy giữ thái độ chuyên nghiệp, dùng "Dạ/Vâng".';
      rules = [
        'Chỉ hiển thị dữ liệu tòa nhà được giao cho quản lý này — không tra cứu hay đề cập tòa nhà khác.',
        'Danh sách QUYỀN HẠN ĐƯỢC TRAO ở trên là giới hạn tuyệt đối. CHỈ tư vấn thao tác trong phạm vi quyền đó.',
        'NẾU người dùng yêu cầu thao tác KHÔNG nằm trong quyền được cấp: TỪ CHỐI NGAY, giải thích rõ đây là thao tác vượt quyền.',
        'TUYỆT ĐỐI KHÔNG gợi ý cách "lách" hoặc thực hiện gián tiếp các thao tác ngoài quyền.',
        'Không tiết lộ thông tin nhạy cảm (mật khẩu, token, API key, dữ liệu hệ thống ngoài phạm vi).',
        'Không thực thi lệnh xóa/sửa dữ liệu — chỉ tư vấn trong phạm vi quyền được giao.',
      ];
      break;
    }

    case 'nhanVien': {
      contextText = await buildOwnerContext(userId, 'nhanVien');
      intro = 'Bạn là trợ lý nhà trọ, hỗ trợ nhân viên tra cứu thông tin.';
      rules = [
        'Nhân viên chỉ có quyền xem, không thêm/sửa/xóa.',
        'Trả lời câu hỏi tra cứu, thống kê đơn giản.',
        'Hướng dẫn nhân viên liên hệ quản lý/chủ trọ khi cần thao tác.',
      ];
      break;
    }

    default: {
      // admin
      contextText = await buildOwnerContext(userId, 'admin');
      intro = 'Bạn là trợ lý thông minh quản trị toàn hệ thống nhà trọ.';
      rules = [
        'Hỗ trợ toàn bộ chức năng quản trị hệ thống.',
        'Không thực thi lệnh xóa/sửa dữ liệu trực tiếp — chỉ tư vấn.',
      ];
      break;
    }
  }

  const systemPrompt = [
    `${intro} Trả lời bằng tiếng Việt tự nhiên, thân thiện, súc tích và chính xác.`,
    'XƯNG HÔ: Luôn xưng là "Em" và gọi người dùng là "Anh/Chị" hoặc "Bạn" (tùy ngữ cảnh). Tuyệt đối không xưng "Con" hoặc "Trợ lý" một cách máy móc.',
    `Hôm nay: ${today}.`,
    '',
    contextText ? `--- DỮ LIỆU HỆ THỐNG THỰC TẾ ---\n${contextText}\n--- HẾT DỮ LIỆU ---` : '',
    '',
    'QUY TẮC QUAN TRỌNG:',
    '1. Bạn có QUYỀN TRUY CẬP TOÀN BỘ dữ liệu được cung cấp ở trên. Nếu một danh mục trong "DỮ LIỆU HỆ THỐNG THỰC TẾ" có giá trị là 0 hoặc không có danh sách, điều đó có nghĩa là TRONG THỰC TẾ KHÔNG CÓ BẢN GHI NÀO, chứ không phải bạn không có quyền xem.',
    '2. Tuyệt đối không trả lời "Tôi không có dữ liệu về..." hoặc "Tôi chỉ quản lý..." đối với những thứ thuộc nghiệp vụ nhà trọ. Hãy dựa vào số liệu 0 để trả lời: "Dạ, hiện tại chưa có...".',
    ...rules.map((r, i) => `${i + 3}. ${r}`),
    '',
    'Luôn dựa trên dữ liệu thực tế ở trên để trả lời một cách tự tin và chuyên nghiệp.',
  ]
    .filter(l => l !== undefined)
    .join('\n');

  return { systemPrompt };
}
