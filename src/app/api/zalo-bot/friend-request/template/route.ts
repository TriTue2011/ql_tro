/**
 * GET  /api/zalo-bot/friend-request/template?toaNhaId=&ten=&entityType=&phong=
 *   → Trả về văn mẫu (ưu tiên tùy chỉnh từ DB, fallback mặc định)
 *
 * PUT  /api/zalo-bot/friend-request/template
 *   → Lưu văn mẫu tùy chỉnh cho tòa nhà
 *   Body: { toaNhaId, friendMsgKT?, friendMsgQL?, followUpMsgKT?, followUpMsgQL? }
 *
 * Biến hỗ trợ: {ten}, {tenToaNha}, {diaChiNgan}, {diaChiDay}, {phong}, {soNha}, {duong}
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const MAX_FRIEND_MSG = 150;

// ── Helpers ──

function formatDiaChiNgan(diaChi: any): string {
  if (!diaChi || typeof diaChi !== 'object') return '';
  const { soNha, duong, phuong, thanhPho } = diaChi as Record<string, string | undefined>;
  return [soNha, duong, phuong, thanhPho].filter(Boolean).join(', ');
}

function formatDiaChiDay(diaChi: any): string {
  if (!diaChi || typeof diaChi !== 'object') return '';
  const { soNha, duong, phuong, quan, thanhPho } = diaChi as Record<string, string | undefined>;
  return [soNha, duong, phuong, quan, thanhPho].filter(Boolean).join(', ');
}

/** Thay thế biến {ten}, {tenToaNha}, v.v. trong template */
function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

// ── Văn mẫu mặc định ──

interface VanMauDefaults {
  friendMsgKT: string;
  friendMsgQL: string;
  followUpMsgKT: string;
  followUpMsgQL: string;
}

const DEFAULTS: VanMauDefaults = {
  friendMsgKT: 'Chào {ten}, kết bạn với tôi để nhận thông báo từ nhà trọ {soNha}, {duong}.',
  friendMsgQL: 'Chào {ten}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ {soNha}, {duong}.',
  followUpMsgKT: 'Chào {ten}, bạn đang ở nhà trọ {diaChiNgan} (phòng {phong}). Bạn cần xác nhận "đúng" hay "không phải" để nhận thông báo qua Zalo từ bây giờ!',
  followUpMsgQL: 'Chào {ten}, bạn đang làm việc tại nhà trọ {diaChiNgan}. Bạn cần xác nhận "đúng" hay "không phải".',
};

// ── GET: lấy văn mẫu (tùy chỉnh hoặc mặc định) ──

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const toaNhaId = searchParams.get('toaNhaId') ?? '';
  const ten = searchParams.get('ten') ?? 'bạn';
  const entityType = (searchParams.get('entityType') ?? 'khachThue') as 'nguoiDung' | 'khachThue';
  const phong = searchParams.get('phong') ?? '';

  // Lấy thông tin tòa nhà + cài đặt văn mẫu
  let toaNha: { tenToaNha: string; diaChi: any } | null = null;
  let vanMau: Partial<VanMauDefaults> = {};
  if (toaNhaId) {
    const row = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      select: {
        tenToaNha: true,
        diaChi: true,
        caiDatToaNha: { select: { zaloVanMau: true } },
      },
    });
    if (row) {
      toaNha = { tenToaNha: row.tenToaNha, diaChi: row.diaChi };
      if (row.caiDatToaNha?.zaloVanMau) {
        try {
          vanMau = JSON.parse(row.caiDatToaNha.zaloVanMau);
        } catch { /* ignore */ }
      }
    }
  }

  const diaChiNgan = toaNha ? formatDiaChiNgan(toaNha.diaChi) : '';
  const diaChiDay = toaNha ? formatDiaChiDay(toaNha.diaChi) : '';
  const tenToaNha = toaNha?.tenToaNha ?? '';
  const dc = toaNha?.diaChi as Record<string, string | undefined> | null;
  const soNha = dc?.soNha ?? '';
  const duong = dc?.duong ?? '';

  // Biến để thay thế trong template
  const vars: Record<string, string> = {
    '{ten}': ten,
    '{tenToaNha}': tenToaNha,
    '{diaChiNgan}': diaChiNgan,
    '{diaChiDay}': diaChiDay,
    '{phong}': phong,
    '{soNha}': soNha,
    '{duong}': duong,
  };

  // Chọn template: ưu tiên custom từ DB, fallback mặc định
  const isKT = entityType === 'khachThue';
  const friendTemplate = isKT
    ? (vanMau.friendMsgKT || DEFAULTS.friendMsgKT)
    : (vanMau.friendMsgQL || DEFAULTS.friendMsgQL);
  const followUpTemplate = isKT
    ? (vanMau.followUpMsgKT || DEFAULTS.followUpMsgKT)
    : (vanMau.followUpMsgQL || DEFAULTS.followUpMsgQL);

  // Thay biến
  let friendMsg = replaceVars(friendTemplate, vars);
  const followUpMsg = replaceVars(followUpTemplate, vars);

  // Cắt nếu quá 150 ký tự
  if (friendMsg.length > MAX_FRIEND_MSG) {
    friendMsg = friendMsg.slice(0, MAX_FRIEND_MSG - 1) + '.';
  }

  // Raw templates (chưa thay biến) để UI hiển thị cho chỉnh sửa
  const rawTemplates: VanMauDefaults = {
    friendMsgKT: vanMau.friendMsgKT || DEFAULTS.friendMsgKT,
    friendMsgQL: vanMau.friendMsgQL || DEFAULTS.friendMsgQL,
    followUpMsgKT: vanMau.followUpMsgKT || DEFAULTS.followUpMsgKT,
    followUpMsgQL: vanMau.followUpMsgQL || DEFAULTS.followUpMsgQL,
  };

  return NextResponse.json({
    ok: true,
    friendMsg,
    friendMsgLength: friendMsg.length,
    friendMsgMaxLength: MAX_FRIEND_MSG,
    followUpMsg,
    followUpMsgLength: followUpMsg.length,
    // Template gốc (chưa thay biến)
    rawTemplates,
    defaults: DEFAULTS,
    isCustom: !!(vanMau.friendMsgKT || vanMau.friendMsgQL || vanMau.followUpMsgKT || vanMau.followUpMsgQL),
    info: { ten, entityType, tenToaNha, diaChiNgan, diaChiDay, phong: phong || null },
    variables: vars,
  });
}

// ── PUT: lưu văn mẫu tùy chỉnh cho tòa nhà ──

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !['admin', 'chuNha'].includes(session.user.role ?? '')) {
    return NextResponse.json({ ok: false, error: 'Không có quyền' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.toaNhaId) {
    return NextResponse.json({ ok: false, error: 'Cần toaNhaId' }, { status: 400 });
  }

  const { toaNhaId, friendMsgKT, friendMsgQL, followUpMsgKT, followUpMsgQL } = body as {
    toaNhaId: string;
    friendMsgKT?: string;
    friendMsgQL?: string;
    followUpMsgKT?: string;
    followUpMsgQL?: string;
  };

  const vanMau: Partial<VanMauDefaults> = {};
  if (friendMsgKT?.trim()) vanMau.friendMsgKT = friendMsgKT.trim();
  if (friendMsgQL?.trim()) vanMau.friendMsgQL = friendMsgQL.trim();
  if (followUpMsgKT?.trim()) vanMau.followUpMsgKT = followUpMsgKT.trim();
  if (followUpMsgQL?.trim()) vanMau.followUpMsgQL = followUpMsgQL.trim();

  const zaloVanMau = Object.keys(vanMau).length > 0 ? JSON.stringify(vanMau) : null;

  await prisma.caiDatToaNha.upsert({
    where: { toaNhaId },
    create: { toaNhaId, zaloVanMau },
    update: { zaloVanMau },
  });

  return NextResponse.json({ ok: true, message: 'Đã lưu văn mẫu', zaloVanMau: vanMau });
}
