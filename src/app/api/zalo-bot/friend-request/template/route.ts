/**
 * GET /api/zalo-bot/friend-request/template?toaNhaId=xxx&ten=Nguyen Van A&entityType=khachThue&phong=101
 *
 * Trả về văn mẫu kết bạn + tin nhắn sau kết bạn với đầy đủ thông tin tòa nhà/phòng.
 * Người dùng có thể chỉnh sửa trước khi gửi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const MAX_FRIEND_MSG = 150;

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

  // Lấy thông tin tòa nhà
  let toaNha: { tenToaNha: string; diaChi: any } | null = null;
  if (toaNhaId) {
    const row = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      select: { tenToaNha: true, diaChi: true },
    });
    if (row) toaNha = row;
  }

  const diaChiNgan = toaNha ? formatDiaChiNgan(toaNha.diaChi) : '';
  const diaChiDay = toaNha ? formatDiaChiDay(toaNha.diaChi) : '';
  const tenToaNha = toaNha?.tenToaNha ?? '';
  const dc = toaNha?.diaChi as Record<string, string | undefined> | null;
  const soNha = dc?.soNha ?? '';
  const duong = dc?.duong ?? '';
  const diaChiSoNhaDuong = [soNha, duong].filter(Boolean).join(', ');

  // ── Văn mẫu kết bạn (tối đa 150 ký tự) ──
  let friendMsg: string;
  if (entityType === 'khachThue') {
    friendMsg = diaChiSoNhaDuong
      ? `Chào ${ten}, kết bạn với tôi để nhận thông báo từ nhà trọ ${diaChiSoNhaDuong}.`
      : `Chào ${ten}, kết bạn với tôi để nhận thông báo từ nhà trọ.`;
  } else {
    friendMsg = diaChiSoNhaDuong
      ? `Chào ${ten}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ ${diaChiSoNhaDuong}.`
      : `Chào ${ten}, Bạn đồng ý kết bạn để xác nhận bây giờ làm việc nhà trọ.`;
  }
  // Cắt nếu quá dài
  if (friendMsg.length > MAX_FRIEND_MSG) {
    friendMsg = friendMsg.slice(0, MAX_FRIEND_MSG - 1) + '.';
  }

  // ── Văn mẫu tin nhắn sau kết bạn (đầy đủ thông tin hơn) ──
  const nhaTro = diaChiNgan ? `nhà trọ ${diaChiNgan}` : (tenToaNha ? `nhà trọ ${tenToaNha}` : 'nhà trọ');
  const phongInfo = phong ? ` (phòng ${phong})` : '';

  let followUpMsg: string;
  if (entityType === 'khachThue') {
    followUpMsg = `Chào ${ten}, bạn đang ở ${nhaTro}${phongInfo}. Bạn cần xác nhận "đúng" hay "không phải" để nhận thông báo qua Zalo từ bây giờ!`;
  } else {
    followUpMsg = `Chào ${ten}, bạn đang làm việc tại ${nhaTro}. Bạn cần xác nhận "đúng" hay "không phải".`;
  }

  return NextResponse.json({
    ok: true,
    friendMsg,
    friendMsgLength: friendMsg.length,
    friendMsgMaxLength: MAX_FRIEND_MSG,
    followUpMsg,
    followUpMsgLength: followUpMsg.length,
    // Thông tin đã dùng trong văn mẫu
    info: {
      ten,
      entityType,
      tenToaNha,
      diaChiNgan,
      diaChiDay,
      phong: phong || null,
    },
    // Biến thể người dùng có thể chọn
    variables: {
      '{ten}': ten,
      '{tenToaNha}': tenToaNha || '(chưa có)',
      '{diaChiNgan}': diaChiNgan || '(chưa có)',
      '{diaChiDay}': diaChiDay || '(chưa có)',
      '{phong}': phong || '(chưa có)',
      '{soNha}': soNha || '(chưa có)',
      '{duong}': duong || '(chưa có)',
    },
  });
}
