/**
 * Template HTML cho hóa đơn PDF — định dạng song ngữ VN/EN giống mẫu Visaho/Hoàng Thành.
 * Dùng chung cho html2canvas + jsPDF (client) hoặc Puppeteer (server).
 *
 * Khuyến nghị cho PDF chất lượng cao (text-based, tìm kiếm được):
 *   - Server: chạy Puppeteer (`puppeteer-core + @sparticuz/chromium`) render HTML → PDF
 *   - Client (hiện tại): html2canvas → jsPDF (PDF dạng ảnh, kích thước lớn hơn)
 */

const fmtVND = (n: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(n));

/** Chuyển số nguyên (VND) thành chữ tiếng Việt. Ví dụ: 3975700 → "Ba triệu chín trăm bảy mươi lăm nghìn bảy trăm" */
export function numToVietnameseWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return 'Không đồng';

  const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  const readTriple = (num: number, full: boolean): string => {
    const tram = Math.floor(num / 100);
    const chuc = Math.floor((num % 100) / 10);
    const donVi = num % 10;
    const parts: string[] = [];

    if (full || tram > 0) parts.push(chuSo[tram] + ' trăm');
    if (chuc > 1) {
      parts.push(chuSo[chuc] + ' mươi');
      if (donVi === 1) parts.push('mốt');
      else if (donVi === 5) parts.push('lăm');
      else if (donVi > 0) parts.push(chuSo[donVi]);
    } else if (chuc === 1) {
      parts.push('mười');
      if (donVi === 5) parts.push('lăm');
      else if (donVi > 0) parts.push(chuSo[donVi]);
    } else if (chuc === 0 && donVi > 0) {
      if (tram > 0 || full) parts.push('lẻ ' + chuSo[donVi]);
      else parts.push(chuSo[donVi]);
    }
    return parts.join(' ').trim();
  };

  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0 && i > 0) continue;
    const isLeading = i === groups.length - 1;
    const tripleWords = readTriple(g, !isLeading);
    if (tripleWords) words.push(tripleWords + (units[i] ? ' ' + units[i] : ''));
  }

  const result = words.join(' ').replace(/\s+/g, ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

/** Chuyển số thành chữ tiếng Anh. Ví dụ: 3975700 → "Three million nine hundred seventy-five thousand seven hundred" */
export function numToEnglishWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return 'Zero';

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const readTriple = (num: number): string => {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    const parts: string[] = [];
    if (hundred > 0) parts.push(ones[hundred] + ' hundred');
    if (rest >= 20) {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      parts.push(tens[t] + (o > 0 ? '-' + ones[o] : ''));
    } else if (rest > 0) {
      parts.push(ones[rest]);
    }
    return parts.join(' ').trim();
  };

  const scales = ['', 'thousand', 'million', 'billion'];
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const part = readTriple(groups[i]) + (scales[i] ? ' ' + scales[i] : '');
    words.push(part);
  }

  const result = words.join(' ').replace(/\s+/g, ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export interface TierBreakdownItem {
  bac: number;
  tu: number;
  den: number | null;
  soLuong: number;
  donGia: number;
  thanhTien: number;
}

export interface InvoiceTemplateInput {
  hoaDon: {
    maHoaDon: string;
    thang: number;
    nam: number;
    tienPhong: number;
    tienDien: number;
    soDien: number;
    chiSoDienBanDau: number;
    chiSoDienCuoiKy: number;
    chiTietDien?: TierBreakdownItem[] | null;
    tienNuoc: number;
    soNuoc: number;
    chiSoNuocBanDau: number;
    chiSoNuocCuoiKy: number;
    chiTietNuoc?: TierBreakdownItem[] | null;
    phiDichVu: Array<{ ten: string; gia: number }>;
    tongTien: number;
    daThanhToan: number;
    conLai: number;
    hanThanhToan: string | Date;
    ngayTao: string | Date;
    ghiChu?: string;
  };
  phong?: {
    maPhong: string;
    tang?: number;
    dienTich?: number;
    giaThue?: number;
    toaNha?: {
      tenToaNha: string;
      diaChi: any;
      lienHePhuTrach?: any;
    } | null;
  } | null;
  khachThue?: {
    hoTen: string;
    soDienThoai?: string | null;
    email?: string | null;
    cccd?: string | null;
  } | null;
  cauHinh?: {
    tenChuNha?: string;
    soTaiKhoan?: string;
    nganHang?: string;
    chuTaiKhoan?: string;
    logoUrl?: string;
  };
}

/** Định dạng địa chỉ tòa nhà từ JSON { soNha, duong, phuong, quan, thanhPho } */
function formatAddress(diaChi: any): string {
  if (!diaChi) return '';
  if (typeof diaChi === 'string') return diaChi;
  const parts = [diaChi.soNha, diaChi.duong, diaChi.phuong, diaChi.quan, diaChi.thanhPho].filter(Boolean);
  return parts.join(', ');
}

/**
 * Tạo HTML song ngữ (VN/EN) theo mẫu "Thông báo phí" — dùng cho html2canvas → jsPDF.
 * Element trả về có `width: 800px`, cần chèn vào body ẩn trước khi chụp.
 */
export function buildInvoiceHTML(input: InvoiceTemplateInput): string {
  const { hoaDon, phong, khachThue, cauHinh } = input;
  const thangStr = String(hoaDon.thang).padStart(2, '0');
  const namStr = hoaDon.nam;
  const ngayPhatHanh = new Date(hoaDon.ngayTao).toLocaleDateString('vi-VN');
  const diaChi = formatAddress(phong?.toaNha?.diaChi);
  const tenDuAn = phong?.toaNha?.tenToaNha || '';
  const maPhong = phong?.maPhong || '';
  const tenKhach = khachThue?.hoTen || '';

  const soRows: string[] = [];
  let stt = 0;

  // 1. Tiền phòng
  stt++;
  soRows.push(`
    <tr class="row-section">
      <td>${stt}</td>
      <td colspan="1"><b>Tiền phòng / <i>Rent</i></b></td>
      <td class="amt"><b>${fmtVND(hoaDon.tienPhong)}</b></td>
    </tr>`);
  if (phong?.dienTich && phong?.giaThue) {
    soRows.push(`
      <tr>
        <td>${stt}.1</td>
        <td>Thuê phòng Tháng ${thangStr}.${namStr} / <i>Rent for ${thangStr}.${namStr}</i>
            <div class="sub">Đơn giá/<i>Unit price</i>: ${fmtVND(phong.giaThue)} VND · Diện tích/<i>Area</i>: ${phong.dienTich} m²</div>
        </td>
        <td class="amt">${fmtVND(hoaDon.tienPhong)}</td>
      </tr>`);
  }

  // Helper render inner table cho điện/nước
  const renderUsageTable = (
    chiSoCu: number,
    chiSoMoi: number,
    soLuong: number,
    donGiaPhang: number,
    tongTien: number,
    breakdown: TierBreakdownItem[] | null | undefined,
    unit: 'kWh' | 'm³',
  ): string => {
    // Lũy tiến: mỗi bậc 1 dòng
    if (breakdown && breakdown.length > 0) {
      const tierRows = breakdown.map(t => {
        const mucLabel = t.den === null ? `>${t.tu}` : `${t.tu}-${t.den}`;
        return `
          <tr>
            <td>Bậc ${t.bac}</td>
            <td>${mucLabel}</td>
            <td>${t.soLuong}</td>
            <td>${fmtVND(t.donGia)}</td>
            <td>${fmtVND(t.thanhTien)}</td>
          </tr>`;
      }).join('');
      return `
        <table class="inner">
          <thead>
            <tr>
              <th colspan="5">Chỉ số cũ/<i>Old</i>: ${chiSoCu} → Chỉ số mới/<i>New</i>: ${chiSoMoi} · Tiêu thụ/<i>Consumption</i>: ${soLuong} ${unit}</th>
            </tr>
            <tr>
              <th>Bậc/<i>Tier</i></th>
              <th>Mức (${unit})</th>
              <th>Số lượng/<i>Qty</i></th>
              <th>Đơn giá/<i>Unit Price</i></th>
              <th>Thành tiền/<i>Amount</i></th>
            </tr>
          </thead>
          <tbody>
            ${tierRows}
            <tr style="background:#f5f5f5;">
              <td colspan="4" style="text-align:right;"><b>Tổng/<i>Total</i>:</b></td>
              <td><b>${fmtVND(tongTien)}</b></td>
            </tr>
          </tbody>
        </table>`;
    }
    // Giá phẳng
    return `
      <table class="inner">
        <thead>
          <tr>
            <th>Chỉ số cũ/<i>Old Index</i></th>
            <th>Chỉ số mới/<i>New Index</i></th>
            <th>Tiêu thụ/<i>Consumption</i> (${unit})</th>
            <th>Đơn giá/<i>Unit Price</i></th>
            <th>Thành tiền/<i>Amount</i></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${chiSoCu}</td>
            <td>${chiSoMoi}</td>
            <td>${soLuong}</td>
            <td>${fmtVND(donGiaPhang)}</td>
            <td>${fmtVND(tongTien)}</td>
          </tr>
        </tbody>
      </table>`;
  };

  // 2. Điện
  if (hoaDon.tienDien > 0 || hoaDon.soDien > 0) {
    stt++;
    const donGiaDien = hoaDon.soDien > 0 ? hoaDon.tienDien / hoaDon.soDien : 0;
    const innerDien = renderUsageTable(
      hoaDon.chiSoDienBanDau, hoaDon.chiSoDienCuoiKy, hoaDon.soDien,
      donGiaDien, hoaDon.tienDien, hoaDon.chiTietDien, 'kWh',
    );
    soRows.push(`
      <tr class="row-section">
        <td>${stt}</td>
        <td><b>Điện / <i>Electricity</i></b></td>
        <td class="amt"><b>${fmtVND(hoaDon.tienDien)}</b></td>
      </tr>
      <tr>
        <td>${stt}.1</td>
        <td>
          <div>Điện tiêu thụ tháng ${thangStr}.${namStr} / <i>Electricity consumption ${thangStr}.${namStr}</i>${hoaDon.chiTietDien && hoaDon.chiTietDien.length > 0 ? ' <span style="color:#666;font-style:italic;">(giá lũy tiến / <i>tiered</i>)</span>' : ''}</div>
          ${innerDien}
        </td>
        <td class="amt">${fmtVND(hoaDon.tienDien)}</td>
      </tr>`);
  }

  // 3. Nước
  if (hoaDon.tienNuoc > 0 || hoaDon.soNuoc > 0) {
    stt++;
    const donGiaNuoc = hoaDon.soNuoc > 0 ? hoaDon.tienNuoc / hoaDon.soNuoc : 0;
    const innerNuoc = renderUsageTable(
      hoaDon.chiSoNuocBanDau, hoaDon.chiSoNuocCuoiKy, hoaDon.soNuoc,
      donGiaNuoc, hoaDon.tienNuoc, hoaDon.chiTietNuoc, 'm³',
    );
    soRows.push(`
      <tr class="row-section">
        <td>${stt}</td>
        <td><b>Nước / <i>Water</i></b></td>
        <td class="amt"><b>${fmtVND(hoaDon.tienNuoc)}</b></td>
      </tr>
      <tr>
        <td>${stt}.1</td>
        <td>
          <div>Nước tiêu thụ tháng ${thangStr}.${namStr} / <i>Water consumption ${thangStr}.${namStr}</i>${hoaDon.chiTietNuoc && hoaDon.chiTietNuoc.length > 0 ? ' <span style="color:#666;font-style:italic;">(giá lũy tiến / <i>tiered</i>)</span>' : ''}</div>
          ${innerNuoc}
        </td>
        <td class="amt">${fmtVND(hoaDon.tienNuoc)}</td>
      </tr>`);
  }

  // 4+. Phí dịch vụ khác
  const phiDv = hoaDon.phiDichVu || [];
  if (phiDv.length > 0) {
    stt++;
    const totalPhi = phiDv.reduce((s, p) => s + (p.gia || 0), 0);
    soRows.push(`
      <tr class="row-section">
        <td>${stt}</td>
        <td><b>Phí dịch vụ / <i>Service fees</i></b></td>
        <td class="amt"><b>${fmtVND(totalPhi)}</b></td>
      </tr>`);
    phiDv.forEach((p, i) => {
      soRows.push(`
        <tr>
          <td>${stt}.${i + 1}</td>
          <td>${p.ten}</td>
          <td class="amt">${fmtVND(p.gia)}</td>
        </tr>`);
    });
  }

  const bangChuVN = numToVietnameseWords(hoaDon.tongTien);
  const bangChuEN = numToEnglishWords(hoaDon.tongTien);
  const logoUrl = cauHinh?.logoUrl || '';
  const tenChuNha = cauHinh?.tenChuNha || 'Chủ nhà';
  const soTaiKhoan = cauHinh?.soTaiKhoan || '';
  const nganHang = cauHinh?.nganHang || '';
  const chuTaiKhoan = cauHinh?.chuTaiKhoan || tenChuNha;

  return `
    <div style="
      width: 800px;
      padding: 36px 40px;
      background: #ffffff;
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      font-size: 13px;
      line-height: 1.45;
      box-sizing: border-box;
    ">
      <style>
        .main-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .main-table th, .main-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
        .main-table th { background: #f5f5f5; text-align: center; font-weight: bold; }
        .main-table td.amt { text-align: right; white-space: nowrap; }
        .main-table tr.row-section td { background: #fafafa; }
        .main-table tr.row-total td { background: #f5f5f5; font-weight: bold; }
        .main-table .sub { font-size: 11px; color: #555; margin-top: 2px; }
        .main-table table.inner { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .main-table table.inner th,
        .main-table table.inner td { border: 1px solid #999; padding: 4px 6px; font-size: 12px; text-align: center; }
        .main-table table.inner th { background: #f0f0f0; font-weight: 600; }
        .info-grid { width: 100%; margin-top: 18px; }
        .info-grid td { vertical-align: top; padding: 3px 0; font-size: 13px; }
        .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .header-title { text-align: center; flex: 1; }
        .header-title h1 { font-size: 17px; font-weight: bold; margin: 0; line-height: 1.3; }
        .header-title h2 { font-size: 14px; font-style: italic; margin: 4px 0 0 0; font-weight: normal; }
        .logo { max-height: 70px; max-width: 140px; object-fit: contain; }
        .bang-chu { margin-top: 12px; padding: 8px 10px; border: 1px solid #000; background: #f9f9f9; font-size: 12px; }
        .payment-info { margin-top: 16px; font-size: 12px; }
        .payment-info h3 { font-size: 13px; font-weight: bold; margin: 0 0 6px 0; }
        .bank-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .bank-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 12px; }
        .note { margin-top: 10px; font-size: 11px; color: #444; font-style: italic; }
      </style>

      <!-- Top meta -->
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333; margin-bottom: 8px;">
        <span>${new Date().toLocaleString('vi-VN')}</span>
        <span>THÔNG BÁO PHÍ</span>
      </div>

      <!-- Header -->
      <div class="header-row">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="logo" />` : '<div style="width:140px"></div>'}
        <div class="header-title">
          <h1>THÔNG BÁO PHÍ THÁNG ${thangStr}.${namStr}</h1>
          <h2>MONTHLY FEE NOTICE MONTH ${thangStr}.${namStr}</h2>
        </div>
        <div style="width:140px; text-align: right;">
          ${tenDuAn ? `<div style="font-size:12px; font-weight:bold;">${tenDuAn}</div>` : ''}
        </div>
      </div>

      <!-- Info grid -->
      <table class="info-grid">
        <tr>
          <td style="width: 50%;"><b>Mã phòng/</b> <i>Room code</i>: ${maPhong}</td>
          <td style="width: 50%;"><b>Ngày phát hành/</b> <i>Issue date</i>: ${ngayPhatHanh}</td>
        </tr>
        <tr>
          <td><b>Khách hàng/</b> <i>Customer</i>: ${tenKhach}</td>
          <td><b>Tên dự án/</b> <i>Project name</i>: ${tenDuAn}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Địa chỉ/</b> <i>Address</i>: ${diaChi}</td>
        </tr>
      </table>

      <div style="text-align: right; margin-top: 10px; font-weight: bold; font-size: 12px;">
        Đơn vị tính / <i>Unit</i>: VND
      </div>

      <!-- Main Table -->
      <table class="main-table">
        <thead>
          <tr>
            <th style="width: 50px;">STT/<br/><i>NO.</i></th>
            <th>Diễn giải/ <i>Description</i></th>
            <th style="width: 130px;">Thành tiền - <i>Amount</i><br/><span style="font-weight: normal; font-style: italic; font-size: 11px;">(Gồm VAT/ Included VAT)</span></th>
          </tr>
        </thead>
        <tbody>
          ${soRows.join('')}
          <tr class="row-total">
            <td colspan="2"><b>Tổng cộng/ <i>Total</i>:</b></td>
            <td class="amt"><b>${fmtVND(hoaDon.tongTien)}</b></td>
          </tr>
          <tr>
            <td colspan="2">Đã thanh toán/ <i>Paid</i>:</td>
            <td class="amt">${fmtVND(hoaDon.daThanhToan)}</td>
          </tr>
          <tr class="row-total">
            <td colspan="2"><b>Còn phải thanh toán/ <i>Remaining</i>:</b></td>
            <td class="amt"><b>${fmtVND(hoaDon.conLai)}</b></td>
          </tr>
        </tbody>
      </table>

      <div class="bang-chu">
        <b>Bằng chữ/</b> <i>In words</i>: ${bangChuVN} / <i>${bangChuEN}</i>
      </div>

      <!-- Payment Info -->
      <div class="payment-info">
        <h3>Thông tin thanh toán / <i>Payment information</i>:</h3>
        <div>* Thanh toán bằng tiền mặt/ <i>Payment by cash</i>: Liên hệ chủ nhà</div>
        <div style="margin-top: 4px;">* Thanh toán chuyển khoản/ <i>Bank transfer</i>:</div>
        <table class="bank-table">
          <tr>
            <td>
              <div><b>Tài khoản/</b> <i>Account</i>: ${chuTaiKhoan}</div>
              <div><b>Số TK/</b> <i>Account No.</i>: ${soTaiKhoan || '—'}${nganHang ? ` - ${nganHang}` : ''}</div>
            </td>
          </tr>
        </table>
        <div style="margin-top: 6px;">
          * <b>Nội dung/</b> <i>Content</i>: ${maPhong} ${thangStr}.${namStr} — <i>Payment for room ${maPhong}, month ${thangStr}.${namStr}</i>
        </div>
        <div style="margin-top: 6px;">
          Hạn thanh toán/ <i>Due date</i>: <b>${new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}</b>.
          Nếu sau thời gian trên khách hàng chưa thanh toán, chủ nhà có quyền tạm dừng dịch vụ.
          <i>If payment is not received by the due date, services may be suspended.</i>
        </div>
        <div class="note">Trân trọng cảm ơn! / <i>Thanks and best regards.</i></div>
        ${hoaDon.ghiChu ? `<div style="margin-top:8px; padding-top:6px; border-top: 1px dashed #ccc;"><b>Ghi chú/</b> <i>Note</i>: ${hoaDon.ghiChu}</div>` : ''}
      </div>
    </div>
  `;
}
