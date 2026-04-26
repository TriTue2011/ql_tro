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

  return lines.join('\n');
}

// ── Owner / Manager context ──────────────────────────────────────────────────

async function buildOwnerContext(userId: string, role: UserRole): Promise<string> {
  let buildingIds: string[] = [];

  if (role === 'admin') {
    const all = await prisma.toaNha.findMany({ select: { id: true }, take: 50 });
    buildingIds = all.map(b => b.id);
  } else if (role === 'chuNha' || role === 'dongChuTro') {
    const own = await prisma.toaNha.findMany({
      where: { chuSoHuuId: userId },
      select: { id: true },
    });
    buildingIds = own.map(b => b.id);
  } else {
    const managed = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { nguoiDungId: userId },
      select: { toaNhaId: true },
    });
    buildingIds = managed.map(m => m.toaNhaId);
  }

  if (buildingIds.length === 0) return '(Chưa được gán tòa nhà nào)';

  const [buildings, roomStats, unpaidInvoices, expiringCount, openIncidents, activeRooms] = await Promise.all([
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
        maHoaDon: true,
        thang: true,
        nam: true,
        conLai: true,
        trangThai: true,
        hanThanhToan: true,
        phong: { select: { maPhong: true, tang: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true } },
      }
    }),

    prisma.hopDong.count({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: 'hoatDong',
        ngayKetThuc: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),

    prisma.suCo.findMany({
      where: {
        phong: { toaNhaId: { in: buildingIds } },
        trangThai: { in: ['moi', 'dangXuLy'] },
      },
      take: 8,
      orderBy: { ngayBaoCao: 'desc' },
      select: {
        tieuDe: true,
        trangThai: true,
        mucDoUuTien: true,
        phong: {
          select: {
            maPhong: true,
            toaNha: { select: { tenToaNha: true } },
          },
        },
      },
    }),

    prisma.phong.findMany({
      where: { toaNhaId: { in: buildingIds }, trangThai: 'dangThue' },
      take: 50,
      select: {
        maPhong: true,
        tang: true,
        toaNha: { select: { tenToaNha: true } },
        hopDong: {
          where: { trangThai: 'hoatDong' },
          select: {
            nguoiDaiDien: { select: { hoTen: true } },
          }
        }
      }
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

  if (expiringCount > 0)
    lines.push(`HỢP ĐỒNG SẮP HẾT HẠN (30 ngày): ${expiringCount} hợp đồng`);

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

  return lines.join('\n');
}

// ── Manager permissions context ──────────────────────────────────────────────

async function buildManagerPermissionsContext(userId: string): Promise<string> {
  const perms = await prisma.toaNhaNguoiQuanLy.findMany({
    where: { nguoiDungId: userId },
    select: {
      toaNha: { select: { tenToaNha: true } },
      quyenHopDong: true,
      quyenHoaDon: true,
      quyenThanhToan: true,
      quyenSuCo: true,
      quyenKichHoatTaiKhoan: true,
    },
  });

  if (perms.length === 0) return '';

  const lines = perms.map(p => {
    const q: string[] = [];
    if (p.quyenHopDong) q.push('hợp đồng');
    if (p.quyenHoaDon) q.push('hóa đơn');
    if (p.quyenThanhToan) q.push('thanh toán');
    if (p.quyenSuCo) q.push('sự cố');
    if (p.quyenKichHoatTaiKhoan) q.push('kích hoạt tài khoản KT');
    return `- ${p.toaNha.tenToaNha}: ${q.length > 0 ? q.join(', ') : 'chỉ xem'}`;
  });

  return `\nQUYỀN HẠN ĐƯỢC TRAO:\n${lines.join('\n')}`;
}

// ── Public room context (cho người lạ hỏi thuê) ─────────────────────────────

/**
 * Trả về danh sách phòng đang còn trống — chỉ thông tin công khai.
 * Dùng cho AI tư vấn người lạ có nhu cầu thuê.
 */
export async function buildPublicRoomContext(): Promise<string> {
  const rooms = await prisma.phong.findMany({
    where: { trangThai: 'trong' },
    take: 20,
    orderBy: [{ toaNhaId: 'asc' }, { tang: 'asc' }],
    select: {
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
    },
  });

  if (rooms.length === 0) return '';

  const lines: string[] = [`Tổng số phòng trống: ${rooms.length}`];
  rooms.forEach((r, i) => {
    const addr = r.toaNha.diaChi as {
      soNha?: string; duong?: string; phuong?: string; quan?: string; thanhPho?: string;
    } | null;
    const addrShort = addr
      ? [addr.soNha, addr.duong, addr.phuong, addr.quan].filter(Boolean).join(', ')
      : '';
    lines.push('');
    lines.push(`[${i + 1}] Phòng ${r.maPhong} — ${r.toaNha.tenToaNha}${addrShort ? ` (${addrShort})` : ''}`);
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
      contextText = await buildKhachThueContext(userId);
      intro = 'Bạn là trợ lý thông minh của khu nhà trọ, hỗ trợ riêng cho khách thuê này.';
      rules = [
        'Chỉ trả lời về thông tin của khách thuê này: phòng, hóa đơn, hợp đồng, sự cố.',
        'TUYỆT ĐỐI không cung cấp thông tin của khách thuê khác.',
        'Không thực hiện thao tác sửa/xóa dữ liệu — chỉ tra cứu và giải thích.',
        'Nếu không có dữ liệu cụ thể, nói thật và hướng dẫn liên hệ quản lý.',
        'Không bịa số tiền, ngày tháng hay trạng thái.',
        'Khi khách yêu cầu "gửi hóa đơn", "xem chi tiết hóa đơn", "gửi pdf" hoặc tương tự: trình bày ĐẦY ĐỦ chi tiết hóa đơn từ dữ liệu thực tế (tháng, tổng tiền, từng khoản điện/nước/phòng, hạn thanh toán, trạng thái, mã hóa đơn) và kèm link QR thanh toán nếu có. KHÔNG nói không thể gửi file PDF — đây là tin nhắn văn bản thay thế cho PDF.',
        'Khi khách báo sự cố hoặc yêu cầu sửa chữa: ghi nhận thông tin đầy đủ và hướng dẫn cách báo cáo chính thức qua hệ thống hoặc liên hệ quản lý.',
      ];
      break;
    }

    case 'chuNha':
    case 'dongChuTro': {
      contextText = await buildOwnerContext(userId, role);
      intro = `Bạn là trợ lý quản lý nhà trọ thông minh, hỗ trợ ${role === 'chuNha' ? 'chủ trọ' : 'đồng chủ trọ'}.`;
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
      intro = 'Bạn là trợ lý quản lý nhà trọ, hỗ trợ người quản lý tòa nhà.';
      rules = [
        'Chỉ hiển thị dữ liệu tòa nhà được giao cho quản lý này.',
        'Chỉ tư vấn thao tác phù hợp với quyền đã được cấp (theo danh sách quyền hạn).',
        'Nếu người dùng hỏi về thao tác ngoài quyền, nhắc nhở cần xin phép chủ trọ.',
        'Không tiết lộ thông tin toàn bộ hệ thống ngoài phạm vi được giao.',
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
    `${intro} Trả lời bằng tiếng Việt tự nhiên, thân thiện, ngắn gọn và chính xác.`,
    `Hôm nay: ${today}.`,
    '',
    contextText ? `--- DỮ LIỆU THỰC TẾ ---\n${contextText}\n--- HẾT DỮ LIỆU ---` : '',
    '',
    'QUY TẮC TRẢ LỜI:',
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Luôn dựa trên dữ liệu thực tế ở trên. Nếu không có thông tin, thành thật nói không rõ.',
  ]
    .filter(l => l !== undefined)
    .join('\n');

  return { systemPrompt };
}
