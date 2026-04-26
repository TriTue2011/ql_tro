/**
 * zalo-notify.ts
 *
 * Dịch vụ thông báo Zalo tập trung cho toàn hệ thống.
 *
 * Nguyên tắc định tuyến (routing):
 *  - Hóa đơn mới        → cá nhân khách thuê (luôn)
 *  - Hóa đơn quá hạn    → chủ trọ/QL theo ZaloThongBaoCaiDat (KHÔNG gửi nhóm)
 *  - Xác nhận thanh toán→ chủ trọ (luôn, dù có ủy quyền)
 *  - Sự cố mới          → chủ trọ/QL theo ZaloThongBaoCaiDat (KHÔNG gửi nhóm)
 *  - Sự cố leo thang    → chủ trọ/QL theo ZaloThongBaoCaiDat (KHÔNG gửi nhóm)
 *  - Sự cố cập nhật     → khách thuê cá nhân
 *  - Nhắc điện nước     → chủ trọ/QL + nhóm chat
 *
 * Khi chủ trọ bật "Chuyển QL":
 *  → gửi cho tất cả quản lý tòa nhà có bật nhận mục đó
 *  → fallback về chủ trọ nếu không có QL nào nhận
 *  → với sự cố/hóa đơn hoàn tất: luôn báo lại chủ trọ dù đang ủy quyền
 */

import prisma from '@/lib/prisma';
import { sendMessageViaBotServer, getBotConfig, BotConfig } from '@/lib/zalo-bot-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSetting(khoa: string): Promise<string> {
  const row = await prisma.caiDat.findFirst({ where: { khoa } });
  return row?.giaTri?.trim() ?? '';
}

async function isAutoEnabled(khoa: string): Promise<boolean> {
  const val = await getSetting(khoa);
  return val === 'true' || val === '1';
}

/** Lấy bot config riêng từ chủ sở hữu tòa nhà, fallback sang global */
async function getBotConfigForToaNha(toaNhaId: string): Promise<BotConfig | null> {
  try {
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      include: {
        chuSoHuu: {
          select: { zaloBotServerUrl: true, zaloBotUsername: true, zaloBotPassword: true, zaloBotTtl: true, zaloAccountId: true },
        },
      },
    });
    const owner = toaNha?.chuSoHuu;
    if (owner?.zaloBotServerUrl) {
      return {
        serverUrl: owner.zaloBotServerUrl.replace(/\/$/, ''),
        username: owner.zaloBotUsername || 'admin',
        password: owner.zaloBotPassword || 'admin',
        accountId: owner.zaloAccountId || '',
        ttl: owner.zaloBotTtl ?? 0,
      };
    }
  } catch { /* ignore */ }
  return getBotConfig();
}

async function sendZalo(chatId: string, text: string, toaNhaId?: string): Promise<void> {
  try {
    const botConfig = toaNhaId ? await getBotConfigForToaNha(toaNhaId) : await getBotConfig();
    const { getActiveMode } = await import('@/lib/zalo-bot-client');
    const activeMode = await getActiveMode();
    if (activeMode === 'direct') {
      const { sendMessage: directSendMessage } = await import('@/lib/zalo-direct/service');
      await directSendMessage(chatId, text, 0, botConfig?.ttl ?? 0, null, undefined);
    } else {
      await sendMessageViaBotServer(chatId, text, 0, undefined, botConfig);
    }
  } catch (e) { 
    console.error('[zalo-notify] sendZalo error:', e);
  }
}

/** Tạo VietQR URL cho hóa đơn */
async function buildQrUrl(hoaDon: {
  maHoaDon: string; conLai: number; thang: number; nam: number;
}): Promise<string | null> {
  const [bank, soTk, chuTk] = await Promise.all([
    getSetting('ngan_hang_ten'),
    getSetting('ngan_hang_so_tai_khoan'),
    getSetting('ngan_hang_chu_tai_khoan'),
  ]);
  if (!bank || !soTk) return null;
  const addInfo = encodeURIComponent(`Thanh toan ${hoaDon.maHoaDon} T${hoaDon.thang}/${hoaDon.nam}`);
  const accName = encodeURIComponent(chuTk || '');
  return `https://img.vietqr.io/image/${bank}-${soTk}-compact2.png?amount=${Math.round(hoaDon.conLai)}&addInfo=${addInfo}&accountName=${accName}`;
}

/** Format tiền tệ VN (vd: 2.500.000 ₫) */
function fmtVND(v: number | null | undefined): string {
  return `${Number(v ?? 0).toLocaleString('vi-VN')} ₫`;
}

interface InvoiceForMessage {
  maHoaDon: string;
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  tienNuoc: number;
  soDien: number;
  soNuoc: number;
  phiDichVu: unknown;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  hanThanhToan: Date;
  phong: { maPhong: string; tang?: number };
  khachThue?: { hoTen: string } | null;
}

/** Build tin nhắn hóa đơn đầy đủ (tiền phòng, điện, nước, phí DV, tổng, đã TT, còn lại, hạn TT). */
function buildInvoiceMessage(hd: InvoiceForMessage, fallbackKhachThueName?: string): string {
  const hanTT = new Date(hd.hanThanhToan).toLocaleDateString('vi-VN');
  const phiDV = Array.isArray(hd.phiDichVu) ? hd.phiDichVu as { ten?: string; gia?: number }[] : [];
  const phiDVText = phiDV.length > 0
    ? phiDV.map(p => `  - ${p.ten ?? ''}: ${fmtVND(p.gia)}`).join('\n')
    : '  (không có)';

  const isPaid = Number(hd.conLai) <= 0;
  const footer = isPaid
    ? `Hạn thanh toán: ${hanTT}\n✅ Đã thanh toán đầy đủ. Cảm ơn bạn!`
    : `Hạn thanh toán: ${hanTT}\nVui lòng thanh toán đúng hạn.`;

  const tangInfo = hd.phong.tang && hd.phong.tang > 0 ? ` (Tầng ${hd.phong.tang})` : '';
  return `THÔNG BÁO TIỀN PHÒNG THÁNG ${hd.thang}/${hd.nam}
━━━━━━━━━━━━━━━━━━━━
Phòng: ${hd.phong.maPhong}${tangInfo}
Khách thuê: ${hd.khachThue?.hoTen ?? fallbackKhachThueName ?? ''}
━━━━━━━━━━━━━━━━━━━━
Tiền phòng: ${fmtVND(hd.tienPhong)}
Tiền điện (${hd.soDien} kWh): ${fmtVND(hd.tienDien)}
Tiền nước (${hd.soNuoc} m³): ${fmtVND(hd.tienNuoc)}
Phí dịch vụ:
${phiDVText}
━━━━━━━━━━━━━━━━━━━━
TỔNG TIỀN: ${fmtVND(hd.tongTien)}
Đã thanh toán: ${fmtVND(hd.daThanhToan)}
CÒN LẠI: ${fmtVND(hd.conLai)}
━━━━━━━━━━━━━━━━━━━━
${footer}`;
}

/** Gửi tin nhắn đến nhóm chat của tòa nhà (chỉ dùng cho nhắc nhở, không dùng cho sự cố/hóa đơn) */
async function sendToGroup(toaNhaId: string, text: string, tang?: number): Promise<void> {
  const toaNha = await prisma.toaNha.findUnique({ where: { id: toaNhaId }, select: { zaloNhomChat: true } });
  const groups = (toaNha?.zaloNhomChat as { tang?: number | null; threadId: string }[] | null) ?? [];
  let threadId: string | null = null;
  if (groups.length > 0) {
    if (tang !== undefined) threadId = groups.find(g => g.tang === tang)?.threadId ?? null;
    if (!threadId) threadId = groups.find(g => g.tang == null)?.threadId ?? null;
    if (!threadId) threadId = groups[0]?.threadId ?? null;
  }
  if (!threadId) threadId = await getSetting('bot_forward_thread_id') || null;
  if (threadId) await sendZalo(threadId, text, toaNhaId);
}

/**
 * Gửi kèm file đính kèm (ảnh hoặc tài liệu) cho một chatId.
 * Tự phát hiện ảnh/khác bằng đuôi file để chọn sendImage vs sendFile.
 */
async function sendAttachmentToChat(
  chatId: string,
  fileUrl: string,
  toaNhaId: string | undefined,
  threadType: 0 | 1 = 0,
): Promise<void> {
  const { sendImageViaBotServer, sendFileViaBotServer, getActiveMode } = await import('@/lib/zalo-bot-client');
  const botConfig = toaNhaId ? await getBotConfigForToaNha(toaNhaId) : await getBotConfig();
  const lower = fileUrl.toLowerCase().split('?')[0];
  const isImage = /\.(jpe?g|png|gif|webp|bmp|avif|heic)$/.test(lower);
  const activeMode = await getActiveMode();

  if (isImage) {
    if (activeMode === 'direct') {
      const { sendImage: directSendImage } = await import('@/lib/zalo-direct/service');
      await directSendImage(chatId, fileUrl, '', threadType, 0);
    } else {
      await sendImageViaBotServer(chatId, fileUrl, '', threadType, undefined, botConfig);
    }
  } else {
    if (activeMode === 'direct') {
      const { sendFile: directSendFile } = await import('@/lib/zalo-direct/service');
      await directSendFile(chatId, fileUrl, '', threadType, 0);
    } else {
      await sendFileViaBotServer(chatId, fileUrl, '', threadType, undefined, botConfig);
    }
  }
}

/**
 * Broadcast nội dung thông báo: gửi text + file đính kèm cho
 *  - danh sách chatId cá nhân (khách thuê/người dùng)
 *  - danh sách nhóm Zalo (threadType = 1)
 * Fire-and-forget mỗi đích để một đích lỗi không block các đích khác.
 */
export async function broadcastThongBao(opts: {
  text: string;
  chatIds?: string[];
  groupThreadIds?: string[];
  fileUrls?: string[];
  toaNhaId?: string;
}): Promise<void> {
  const { text, chatIds = [], groupThreadIds = [], fileUrls = [], toaNhaId } = opts;

  const sendAllTo = async (chatId: string, threadType: 0 | 1) => {
    try {
      if (text) await sendZalo(chatId, text, toaNhaId);
      for (const url of fileUrls) {
        await sendAttachmentToChat(chatId, url, toaNhaId, threadType).catch(e =>
          console.error('[broadcastThongBao] attachment error:', e),
        );
      }
    } catch (e) {
      console.error('[broadcastThongBao] chat error:', e);
    }
  };

  // Cá nhân
  for (const chatId of chatIds) if (chatId) await sendAllTo(chatId, 0);
  // Nhóm
  for (const tid of groupThreadIds) if (tid) await sendAllTo(tid, 1);
}

// ─── Notification Router ──────────────────────────────────────────────────────

type NotifCategory = 'SuCo' | 'HoaDon' | 'TinKhach' | 'NguoiLa' | 'NhacNho';

interface NotifTarget { chatId: string }

/**
 * Xác định danh sách người nhận thông báo theo ZaloThongBaoCaiDat.
 * Ưu tiên ủy quyền → quản lý; fallback → chủ trọ.
 */
async function getTargets(toaNhaId: string, category: NotifCategory): Promise<NotifTarget[]> {
  const nhanKey = `nhan${category}` as const;
  const chuyenKey = `chuyen${category}ChoQL` as const;

  const toaNha = await prisma.toaNha.findUnique({
    where: { id: toaNhaId },
    select: {
      chuSoHuu: { select: { id: true, zaloChatId: true } },
      nguoiQuanLy: { select: { nguoiDung: { select: { id: true, zaloChatId: true } } } },
    },
  });
  if (!toaNha) return [];

  const chu = toaNha.chuSoHuu;
  const quanLys = toaNha.nguoiQuanLy.map(q => q.nguoiDung);

  // Lấy settings chủ trọ
  const chuSettings = await prisma.zaloThongBaoCaiDat.findFirst({
    where: { nguoiDungId: chu.id, toaNhaId },
  });

  const chuNhan: boolean = chuSettings ? !!(chuSettings as any)[nhanKey] : true;
  const chuyenChoQL: boolean = chuSettings ? !!(chuSettings as any)[chuyenKey] : false;

  // "Chuyển QL" và "Nhận" độc lập nhau: ủy quyền cho QL không phụ thuộc vào chuNha có bật nhận hay không
  if (chuyenChoQL && quanLys.length > 0) {
    const qlTargets: NotifTarget[] = [];
    for (const ql of quanLys) {
      if (!ql.zaloChatId) continue;
      const qlSettings = await prisma.zaloThongBaoCaiDat.findFirst({
        where: { nguoiDungId: ql.id, toaNhaId },
      });
      const qlNhan: boolean = qlSettings ? !!(qlSettings as any)[nhanKey] : true;
      if (qlNhan) qlTargets.push({ chatId: ql.zaloChatId });
    }
    if (qlTargets.length > 0) return qlTargets;
    // Fallback: không có QL nhận → gửi chủ trọ nếu chủ trọ bật nhận
  }

  // Gửi chủ trọ chỉ khi họ bật nhận loại thông báo này
  if (chuNhan && chu.zaloChatId) return [{ chatId: chu.zaloChatId }];
  return [];
}

// ─── Hóa đơn ──────────────────────────────────────────────────────────────────

/**
 * Thông báo hóa đơn mới cho đúng khách thuê (kèm QR thanh toán).
 * Chỉ gửi nếu cài đặt auto_zalo_hoa_don_tao = true.
 *
 * Thứ tự gửi:
 *   - Nếu còn nợ (conLai > 0): gửi PDF hóa đơn + ảnh QR kèm caption là tóm tắt các khoản tiền.
 *   - Nếu đã thanh toán đầy đủ: gửi text tóm tắt + PDF (không cần QR).
 */
export async function notifyNewInvoice(hoaDonId: string): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_hoa_don_tao')) return;
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        id: true, maHoaDon: true, thang: true, nam: true,
        tienPhong: true, tienDien: true, tienNuoc: true, soDien: true, soNuoc: true, phiDichVu: true,
        tongTien: true, conLai: true, daThanhToan: true, hanThanhToan: true, nguoiTaoId: true,
        phong: { select: { id: true, maPhong: true, tang: true, dienTich: true, giaThue: true, toaNhaId: true, toaNha: { select: { tenToaNha: true, diaChi: true } } } },
        khachThue: { select: { hoTen: true, soDienThoai: true, zaloChatId: true, nhanThongBaoZalo: true } },
        hopDong: { select: { nguoiDaiDien: { select: { hoTen: true, zaloChatId: true, nhanThongBaoZalo: true } } } },
      },
    });
    if (!hd) return;

    const nguoiNhan = hd.hopDong?.nguoiDaiDien;
    if (!nguoiNhan?.nhanThongBaoZalo || !nguoiNhan.zaloChatId) return;

    const chatId = nguoiNhan.zaloChatId;
    const toaNhaId = hd.phong.toaNhaId;

    const message = buildInvoiceMessage(hd, nguoiNhan.hoTen);

    if (hd.conLai > 0) {
      const qrUrl = await buildQrUrl(hd);
      if (qrUrl) {
        // Còn nợ → gửi QR kèm caption là toàn bộ thông báo tiền phòng
        await sendQrImage(chatId, qrUrl, toaNhaId, `${message}\n\n📲 Quét QR để thanh toán`)
          .catch(e => console.error('[zalo-notify] sendQrImage error:', e));
      } else {
        await sendZalo(chatId, message, toaNhaId);
      }
    } else {
      // Đã thanh toán đầy đủ → gửi text
      await sendZalo(chatId, message, toaNhaId);
    }

    // Gửi PDF sau (Puppeteer sinh file cần thời gian) — fire-and-forget
    sendInvoicePdf(hd, chatId, toaNhaId).catch(e => console.error('[zalo-notify] sendInvoicePdf error:', e));
  } catch (e) {
    console.error('[zalo-notify] notifyNewInvoice error:', e);
  }
}

/** Tạo PDF hóa đơn rồi gửi qua Zalo */
async function sendInvoicePdf(hd: any, chatId: string, toaNhaId: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { buildInvoiceHTML } = await import('@/lib/invoice-pdf-template');
  const { renderPdf } = await import('@/lib/puppeteer-browser');
  const { resolveInvoiceBankInfo } = await import('@/lib/invoice-bank-resolver');
  const { sendFileViaBotServer, getActiveMode } = await import('@/lib/zalo-bot-client');

  const cauHinh = await resolveInvoiceBankInfo(hd.nguoiTaoId);
  const html = buildInvoiceHTML({
    hoaDon: hd as any,
    phong: hd.phong,
    khachThue: hd.khachThue,
    cauHinh,
  });
  const pdfBuffer = await renderPdf(html);

  const TEMP_DIR = path.join(process.cwd(), 'tmp', 'zalo');
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tempPath = path.join(TEMP_DIR, `invoice_${hd.maHoaDon}_${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, pdfBuffer as Buffer);

  try {
    const botConfig = await getBotConfigForToaNha(toaNhaId);
    const caption = `Hóa đơn ${hd.maHoaDon} — T${hd.thang}/${hd.nam}`;
    const activeMode = await getActiveMode();
    if (activeMode === 'direct') {
      const { sendFile: directSendFile } = await import('@/lib/zalo-direct/service');
      await directSendFile(chatId, tempPath, caption, 0, 0);
    } else {
      await sendFileViaBotServer(chatId, tempPath, caption, 0, undefined, botConfig);
    }
  } finally {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  }
}

/** Tải ảnh QR về rồi gửi kèm qua Zalo (vì URL vietqr.io có thể không ổn định với bot server) */
async function sendQrImage(chatId: string, qrUrl: string, toaNhaId: string, caption = '📲 Quét QR để thanh toán'): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { sendImageViaBotServer, getActiveMode } = await import('@/lib/zalo-bot-client');

  const res = await fetch(qrUrl);
  if (!res.ok) throw new Error(`QR fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const TEMP_DIR = path.join(process.cwd(), 'tmp', 'zalo');
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tempPath = path.join(TEMP_DIR, `qr_${Date.now()}.png`);
  fs.writeFileSync(tempPath, buf);

  try {
    const botConfig = await getBotConfigForToaNha(toaNhaId);
    const activeMode = await getActiveMode();
    if (activeMode === 'direct') {
      const { sendImage: directSendImage } = await import('@/lib/zalo-direct/service');
      await directSendImage(chatId, tempPath, caption, 0, 0);
    } else {
      await sendImageViaBotServer(chatId, tempPath, caption, 0, undefined, botConfig);
    }
  } finally {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  }
}

/**
 * Tải ảnh từ URL về rồi gửi kèm (dùng cho ảnh sự cố đã xử lý xong).
 * Bot server có thể không gửi được qua URL trực tiếp (CDN yêu cầu auth/redirect),
 * nên tải về file tạm sẽ ổn định hơn.
 */
async function sendLocalImage(chatId: string, imageUrl: string, toaNhaId: string, caption = ''): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { sendImageViaBotServer, getActiveMode } = await import('@/lib/zalo-bot-client');

  let tempPath: string | null = null;
  try {
    // Nếu là URL http(s) → tải về; nếu là path cục bộ thì dùng trực tiếp
    if (/^https?:\/\//i.test(imageUrl)) {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const TEMP_DIR = path.join(process.cwd(), 'tmp', 'zalo');
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
      const ext = (imageUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
      tempPath = path.join(TEMP_DIR, `suco_${Date.now()}.${ext}`);
      fs.writeFileSync(tempPath, buf);
    } else {
      tempPath = imageUrl;
    }

    const botConfig = await getBotConfigForToaNha(toaNhaId);
    const activeMode = await getActiveMode();
    if (activeMode === 'direct') {
      const { sendImage: directSendImage } = await import('@/lib/zalo-direct/service');
      await directSendImage(chatId, tempPath, caption, 0, 0);
    } else {
      await sendImageViaBotServer(chatId, tempPath, caption, 0, undefined, botConfig);
    }
  } finally {
    if (tempPath && /^https?:\/\//i.test(imageUrl)) {
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }
  }
}

/**
 * Nhắc hóa đơn quá hạn — gửi cá nhân theo routing (KHÔNG gửi nhóm).
 */
export async function notifyInvoiceOverdue(hoaDonId: string): Promise<void> {
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        maHoaDon: true, thang: true, nam: true, conLai: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, soDienThoai: true } },
      },
    });
    if (!hd) return;

    const msg = [
      `⚠️ Hóa đơn QUÁ HẠN`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${hd.phong.maPhong} — ${hd.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${hd.khachThue?.hoTen ?? '—'} (${hd.khachThue?.soDienThoai ?? ''})`,
      `💳 Còn lại: ${hd.conLai.toLocaleString('vi-VN')}đ`,
      `🔖 Mã HD: ${hd.maHoaDon} T${hd.thang}/${hd.nam}`,
      ``,
      `Vui lòng kiểm tra và xác nhận nếu khách đã thanh toán.`,
    ].join('\n');

    const targets = await getTargets(hd.phong.toaNhaId, 'HoaDon');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msg, hd.phong.toaNhaId)));
  } catch (e) {
    console.error('[zalo-notify] notifyInvoiceOverdue error:', e);
  }
}

/**
 * Xác nhận thanh toán — gửi cho khách thuê nếu cài đặt auto_zalo_hoa_don_thanh_toan = true.
 * Kèm PDF hóa đơn đã đánh dấu "ĐÃ THANH TOÁN" để khách có chứng từ.
 *
 * Khi admin đã bật cờ auto toàn cục → chỉ cần có zaloChatId là gửi,
 * không gate thêm cờ cá nhân nhanThongBaoZalo để tránh tắt ngầm.
 */
export async function notifyPaymentConfirmed(hoaDonId: string, _soTienVừaThanhToan?: number): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_hoa_don_thanh_toan')) return;
  try {
    const hd = await prisma.hoaDon.findUnique({
      where: { id: hoaDonId },
      select: {
        id: true, maHoaDon: true, thang: true, nam: true,
        tienPhong: true, tienDien: true, tienNuoc: true, soDien: true, soNuoc: true, phiDichVu: true,
        tongTien: true, daThanhToan: true, conLai: true,
        hanThanhToan: true, ngayCapNhat: true, nguoiTaoId: true,
        phong: {
          select: {
            id: true, maPhong: true, tang: true, dienTich: true, giaThue: true, toaNhaId: true,
            toaNha: { select: { tenToaNha: true, diaChi: true } },
          },
        },
        khachThue: { select: { hoTen: true, soDienThoai: true, zaloChatId: true } },
        hopDong: { select: { nguoiDaiDien: { select: { hoTen: true, zaloChatId: true } } } },
      },
    });
    if (!hd) return;

    // Ưu tiên người đại diện hợp đồng, fallback khách thuê tạo hóa đơn
    const nguoiNhan = hd.hopDong?.nguoiDaiDien?.zaloChatId
      ? hd.hopDong.nguoiDaiDien
      : hd.khachThue?.zaloChatId
        ? hd.khachThue
        : null;
    if (!nguoiNhan?.zaloChatId) {
      console.warn('[zalo-notify] notifyPaymentConfirmed skipped: no zaloChatId', { hoaDonId });
      return;
    }

    const chatId = nguoiNhan.zaloChatId;
    const toaNhaId = hd.phong.toaNhaId;

    // Dùng cùng format THÔNG BÁO TIỀN PHÒNG như khi tạo hóa đơn, footer tự đổi thành
    // "✅ Đã thanh toán đầy đủ" khi conLai <= 0
    const message = buildInvoiceMessage(hd, nguoiNhan.hoTen);
    
    if (hd.conLai > 0) {
      const qrUrl = await buildQrUrl(hd);
      if (qrUrl) {
        await sendQrImage(chatId, qrUrl, toaNhaId, `${message}\n\n📲 Quét QR để thanh toán`)
          .catch(e => console.error('[zalo-notify] sendQrImage error:', e));
      } else {
        await sendZalo(chatId, message, toaNhaId);
      }
    } else {
      await sendZalo(chatId, message, toaNhaId);
    }

    // Gửi kèm PDF hóa đơn (đã cập nhật trạng thái đã thanh toán) — fire-and-forget
    sendInvoicePdf(hd, chatId, toaNhaId).catch(e => console.error('[zalo-notify] sendInvoicePdf error:', e));
  } catch (e) {
    console.error('[zalo-notify] notifyPaymentConfirmed error:', e);
  }
}

// ─── Sự cố ────────────────────────────────────────────────────────────────────

/**
 * Tìm chatId Zalo phù hợp để gửi cho khách báo sự cố:
 *  1) Ưu tiên zaloChatId của khách thuê báo sự cố.
 *  2) Fallback người đại diện hợp đồng đang hoạt động của phòng.
 */
async function resolveSuCoRecipient(sc: {
  phongId: string;
  khachThue?: { zaloChatId: string | null } | null;
}): Promise<string | null> {
  if (sc.khachThue?.zaloChatId) return sc.khachThue.zaloChatId;
  try {
    const now = new Date();
    const hopDong = await prisma.hopDong.findFirst({
      where: {
        phongId: sc.phongId,
        trangThai: 'hoatDong',
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
      },
      select: { nguoiDaiDien: { select: { zaloChatId: true } } },
    });
    return hopDong?.nguoiDaiDien?.zaloChatId ?? null;
  } catch {
    return null;
  }
}

/**
 * Gửi Zalo cho khách thuê xác nhận đã ghi nhận sự cố.
 * Chỉ gửi nếu auto_zalo_su_co_ghi_nhan = true.
 */
export async function notifyIncidentGhiNhan(suCoId: string): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_su_co_ghi_nhan')) return;
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, moTa: true, phongId: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true } },
      },
    });
    if (!sc) return;

    const chatId = await resolveSuCoRecipient(sc);
    // Admin đã bật cờ auto toàn cục → chỉ cần có zaloChatId là gửi,
    // không gate thêm cờ cá nhân nhanThongBaoZalo (mặc định false gây tắt ngầm).
    if (!chatId) {
      console.warn('[zalo-notify] notifyIncidentGhiNhan skipped: no zaloChatId', { suCoId });
      return;
    }

    const tangInfo = sc.phong.tang && sc.phong.tang > 0 ? ` — Tầng ${sc.phong.tang}` : '';
    const msg = [
      `📋 ĐÃ GHI NHẬN SỰ CỐ`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong}${tangInfo} — ${sc.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${sc.khachThue?.hoTen ?? '—'}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      `📝 Mô tả: ${sc.moTa}`,
      ``,
      `Chúng tôi đã ghi nhận sự cố và sẽ xử lý trong thời gian sớm nhất. Cảm ơn bạn đã phản ánh!`,
    ].join('\n');

    await sendZalo(chatId, msg, sc.phong.toaNhaId);
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentGhiNhan error:', e);
  }
}

/**
 * Thông báo sự cố mới cho chủ trọ/QL — gửi cá nhân theo routing (KHÔNG gửi nhóm).
 */
export async function notifyNewIncident(suCoId: string): Promise<void> {
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, moTa: true, loaiSuCo: true, mucDoUuTien: true, ngayBaoCao: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, soDienThoai: true } },
      },
    });
    if (!sc) return;

    const mucDo: Record<string, string> = { thap: '🟢 Thấp', trungBinh: '🟡 Trung bình', cao: '🔴 Cao', khancap: '🆘 Khẩn cấp' };
    const loai: Record<string, string> = { dienNuoc: '💡 Điện/Nước', noiThat: '🪑 Nội thất', vesinh: '🚿 Vệ sinh', anNinh: '🔒 An ninh', khac: '📋 Khác' };

    const tangInfo = sc.phong.tang && sc.phong.tang > 0 ? ` — Tầng ${sc.phong.tang}` : '';
    const msg = [
      `🚨 SỰ CỐ MỚI`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong}${tangInfo} — ${sc.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${sc.khachThue?.hoTen ?? '—'} (${sc.khachThue?.soDienThoai ?? ''})`,
      `📌 Tiêu đề: ${sc.tieuDe}`,
      `📝 Mô tả: ${sc.moTa}`,
      `🏷️ Loại: ${loai[sc.loaiSuCo] ?? sc.loaiSuCo}`,
      `⚡ Mức độ: ${mucDo[sc.mucDoUuTien] ?? sc.mucDoUuTien}`,
      `🕐 Báo cáo: ${new Date(sc.ngayBaoCao).toLocaleString('vi-VN')}`,
    ].join('\n');

    const targets = await getTargets(sc.phong.toaNhaId, 'SuCo');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msg, sc.phong.toaNhaId)));
  } catch (e) {
    console.error('[zalo-notify] notifyNewIncident error:', e);
  }
}

/**
 * Leo thang sự cố — gửi cá nhân theo routing (KHÔNG gửi nhóm).
 */
export async function notifyIncidentEscalate(suCoId: string, reason: 'chua_nhan' | 'chua_xu_ly'): Promise<void> {
  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, trangThai: true, ngayBaoCao: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true } },
      },
    });
    if (!sc) return;

    const label = reason === 'chua_nhan' ? 'CHƯA ĐƯỢC TIẾP NHẬN' : 'CHƯA ĐƯỢC XỬ LÝ';
    const msg = [
      `⏰ NHẮC NHỞ SỰ CỐ ${label}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong} — ${sc.phong.toaNha.tenToaNha}`,
      `👤 Khách: ${sc.khachThue.hoTen}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      `🕐 Báo cáo: ${new Date(sc.ngayBaoCao).toLocaleString('vi-VN')}`,
      ``,
      `Vui lòng kiểm tra và cập nhật trạng thái sự cố.`,
    ].join('\n');

    const targets = await getTargets(sc.phong.toaNhaId, 'SuCo');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msg, sc.phong.toaNhaId)));
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentEscalate error:', e);
  }
}

/**
 * Thông báo cập nhật trạng thái sự cố cho khách thuê.
 * Mỗi trạng thái có setting riêng; daXong gửi kèm ảnh nếu có.
 */
export async function notifyIncidentUpdate(suCoId: string, newStatus: string, ghiChuXuLy?: string): Promise<void> {
  const settingKey: Record<string, string> = {
    dangXuLy: 'auto_zalo_su_co_tiep_nhan',
    daXong: 'auto_zalo_su_co_xu_ly_xong',
    daHuy: 'auto_zalo_su_co_huy',
  };
  const key = settingKey[newStatus];
  if (!key || !await isAutoEnabled(key)) return;

  try {
    const sc = await prisma.suCo.findUnique({
      where: { id: suCoId },
      select: {
        tieuDe: true, moTa: true, ghiChuXuLy: true, anhSuCo: true, phongId: true,
        phong: { select: { maPhong: true, tang: true, toaNhaId: true, toaNha: { select: { tenToaNha: true } } } },
        khachThue: { select: { hoTen: true, zaloChatId: true } },
        nguoiXuLy: { select: { ten: true } },
      },
    });
    if (!sc) return;

    // Admin đã bật cờ auto cho trạng thái này → chỉ cần có zaloChatId là gửi.
    const chatId = await resolveSuCoRecipient(sc);
    if (!chatId) {
      console.warn('[zalo-notify] notifyIncidentUpdate skipped: no zaloChatId', { suCoId, newStatus });
      return;
    }

    const ghiChu = ghiChuXuLy ?? sc.ghiChuXuLy ?? '';
    const toaNhaId = sc.phong.toaNhaId;
    const tangInfo = sc.phong.tang && sc.phong.tang > 0 ? ` — Tầng ${sc.phong.tang}` : '';

    const headerMap: Record<string, string> = {
      dangXuLy: `🔧 ĐÃ TIẾP NHẬN VÀ ĐANG XỬ LÝ SỰ CỐ`,
      daXong: `✅ ĐÃ XỬ LÝ XONG SỰ CỐ`,
      daHuy: `❌ ĐÃ HỦY SỰ CỐ`,
    };

    const lines = [
      headerMap[newStatus],
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Phòng: ${sc.phong.maPhong}${tangInfo} — ${sc.phong.toaNha.tenToaNha}`,
      `👤 Khách thuê: ${sc.khachThue?.hoTen ?? '—'}`,
      `📌 Sự cố: ${sc.tieuDe}`,
      `📝 Mô tả: ${sc.moTa ?? ''}`,
      sc.nguoiXuLy ? `👷 Người xử lý: ${sc.nguoiXuLy.ten}` : '',
      ghiChu ? (newStatus === 'daHuy' ? `📝 Lý do: ${ghiChu}` : `📝 Ghi chú: ${ghiChu}`) : '',
    ].filter(Boolean);

    const msg = lines.join('\n');

    await sendZalo(chatId, msg, toaNhaId);

    // Gửi kèm ảnh khi daXong (tải ảnh về file tạm trước khi gửi — bot server/zca-js ổn định hơn so với URL trực tiếp)
    if (newStatus === 'daXong' && sc.anhSuCo?.length) {
      for (const imgUrl of sc.anhSuCo.slice(0, 5)) {
        await sendLocalImage(chatId, imgUrl, toaNhaId, '').catch(e => {
          console.error('[zalo-notify] send incident image error:', e);
        });
      }
    }
  } catch (e) {
    console.error('[zalo-notify] notifyIncidentUpdate error:', e);
  }
}

// ─── Nhắc nhở ─────────────────────────────────────────────────────────────────

/**
 * Nhắc chốt chỉ số điện/nước — gửi nhóm chat + cá nhân theo routing.
 */
export async function notifyMeterReminder(toaNhaId: string, tenToaNha: string): Promise<void> {
  try {
    const msgAdmin = [
      `📊 NHẮC NHỞ CHỐT CHỈ SỐ ĐIỆN/NƯỚC`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Tòa nhà: ${tenToaNha}`,
      ``,
      `Vui lòng chốt chỉ số điện/nước để phát hành hóa đơn tháng này.`,
    ].join('\n');

    // Gửi nhóm chat (nhắc nhở chung vẫn gửi nhóm)
    await sendToGroup(toaNhaId, msgAdmin);

    // Gửi cá nhân cho chủ trọ/quản lý theo routing
    const targets = await getTargets(toaNhaId, 'NhacNho');
    await Promise.all(targets.map(t => sendZalo(t.chatId, msgAdmin, toaNhaId)));

    // Gửi nhắc nhở cho khách thuê đang có hợp đồng
    const msgKhachThue = [
      `📊 NHẮC NHỞ CHỐT CHỈ SỐ ĐIỆN/NƯỚC`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏠 Tòa nhà: ${tenToaNha}`,
      ``,
      `Đã đến kỳ chốt chỉ số điện/nước. Vui lòng kiểm tra và báo chỉ số cho quản lý.`,
    ].join('\n');

    const khachThues = await prisma.khachThue.findMany({
      where: {
        hopDong: { some: { phong: { toaNhaId }, trangThai: 'dangThue' } },
        nhanThongBaoZalo: true,
        zaloChatId: { not: null },
      },
      select: { zaloChatId: true },
    });
    await Promise.all(
      khachThues
        .filter(kt => kt.zaloChatId)
        .map(kt => sendZalo(kt.zaloChatId!, msgKhachThue, toaNhaId))
    );
  } catch (e) {
    console.error('[zalo-notify] notifyMeterReminder error:', e);
  }
}

// ─── Yêu cầu phê duyệt ───────────────────────────────────────────────────────

/**
 * Thông báo kết quả phê duyệt yêu cầu thay đổi cho khách thuê.
 * Chỉ gửi nếu auto_zalo_yeu_cau_phe_duyet = true.
 *
 * - daPheduyet: báo đã duyệt + loại yêu cầu
 * - tuChoi: báo đã từ chối + lý do (ghiChuPheDuyet)
 *
 * Admin đã bật cờ auto toàn cục → chỉ cần có zaloChatId là gửi,
 * không gate thêm cờ cá nhân nhanThongBaoZalo.
 */
export async function notifyYeuCauPheDuyet(
  yeuCauId: string,
  trangThai: 'daPheduyet' | 'tuChoi',
  ghiChuPheDuyet?: string | null,
): Promise<void> {
  if (!await isAutoEnabled('auto_zalo_yeu_cau_phe_duyet')) return;
  try {
    const yc = await prisma.yeuCauThayDoi.findUnique({
      where: { id: yeuCauId },
      select: {
        loai: true,
        khachThueId: true,
        khachThue: { select: { hoTen: true, zaloChatId: true } },
      },
    });
    if (!yc || !yc.khachThue?.zaloChatId) {
      console.warn('[zalo-notify] notifyYeuCauPheDuyet skipped: no zaloChatId', { yeuCauId });
      return;
    }

    const loaiLabel: Record<string, string> = {
      thongTin: 'thông tin cá nhân',
      anhCCCD: 'ảnh CCCD',
      nguoiCungPhong: 'người cùng phòng',
      thongBao: 'cài đặt nhận thông báo',
    };
    const loaiText = loaiLabel[yc.loai] ?? yc.loai;

    let msg: string;
    if (trangThai === 'daPheduyet') {
      msg = [
        `✅ YÊU CẦU ĐÃ ĐƯỢC PHÊ DUYỆT`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 Loại yêu cầu: ${loaiText}`,
        ``,
        `Các thay đổi đã được áp dụng. Cảm ơn bạn!`,
      ].join('\n');
    } else {
      msg = [
        `❌ YÊU CẦU BỊ TỪ CHỐI`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 Loại yêu cầu: ${loaiText}`,
        ghiChuPheDuyet ? `📝 Lý do: ${ghiChuPheDuyet}` : '',
        ``,
        `Vui lòng liên hệ quản lý nếu cần hỗ trợ thêm.`,
      ].filter(Boolean).join('\n');
    }

    // Lấy tòa nhà theo hợp đồng đang hoạt động để chọn bot config đúng chủ
    const now = new Date();
    const hopDong = await prisma.hopDong.findFirst({
      where: {
        khachThue: { some: { id: yc.khachThueId } },
        trangThai: 'hoatDong',
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
      },
      select: { phong: { select: { toaNhaId: true } } },
    });
    const toaNhaId = hopDong?.phong.toaNhaId;

    await sendZalo(yc.khachThue.zaloChatId, msg, toaNhaId);
  } catch (e) {
    console.error('[zalo-notify] notifyYeuCauPheDuyet error:', e);
  }
}
