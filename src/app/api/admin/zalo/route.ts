/**
 * GET  /api/admin/zalo  — Lấy toàn bộ tòa nhà với chủ trọ + quản lý + ZaloThongBaoCaiDat
 * PUT  /api/admin/zalo  — Upsert ZaloThongBaoCaiDat + cập nhật zaloAccountId
 *
 * Role access:
 *  GET:  admin (tất cả), chuNha (chỉ tòa nhà của mình), quanLy (chỉ tòa nhà phụ trách)
 *  PUT:  admin + chuNha (settings toàn bộ), quanLy (chỉ settings của mình)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getAccountsFromBotServer } from '@/lib/zalo-bot-client';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId, role } = session.user;

  // Xác định tòa nhà được phép xem
  let toaNhaFilter: Record<string, any> = {};
  if (role === 'chuNha') {
    // Chủ trọ: tòa nhà họ sở hữu HOẶC được gán quản lý
    toaNhaFilter = {
      OR: [
        { chuSoHuuId: userId },
        { nguoiQuanLy: { some: { nguoiDungId: userId } } },
      ],
    };
  } else if (role === 'dongChuTro') {
    // Đồng chủ trọ: chủ yếu được gán vào nguoiQuanLy
    toaNhaFilter = {
      OR: [
        { chuSoHuuId: userId },
        { nguoiQuanLy: { some: { nguoiDungId: userId } } },
      ],
    };
  } else if (role === 'quanLy') {
    toaNhaFilter = { nguoiQuanLy: { some: { nguoiDungId: userId } } };
  } else if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const buildings = await prisma.toaNha.findMany({
    where: toaNhaFilter,
    orderBy: { tenToaNha: 'asc' },
    select: {
      id: true,
      tenToaNha: true,
      chuSoHuu: {
        select: {
          id: true, ten: true, email: true, soDienThoai: true, vaiTro: true,
          zaloChatId: true, pendingZaloChatId: true, zaloAccountId: true, zaloBotServerUrl: true, zaloBotUsername: true, zaloBotPassword: true, zaloBotTtl: true, nhanThongBaoZalo: true,
          zaloThongBaoCaiDat: { where: { toaNhaId: undefined }, select: allSettingFields() },
        },
      },
      nguoiQuanLy: {
        select: {
          nguoiDung: {
            select: {
              id: true, ten: true, email: true, vaiTro: true,
              zaloChatId: true, pendingZaloChatId: true, zaloAccountId: true, zaloBotServerUrl: true, zaloBotUsername: true, zaloBotPassword: true, zaloBotTtl: true, nhanThongBaoZalo: true,
              zaloThongBaoCaiDat: { select: allSettingFields() },
            },
          },
        },
      },
    },
  });

  // Kiểm tra tài khoản nào đang online trên bot server
  let botAccountIds: Set<string> = new Set();
  try {
    const { accounts: botAccounts } = await getAccountsFromBotServer();
    for (const acc of botAccounts) {
      const accId = acc.id ?? acc.ownId;
      if (accId) botAccountIds.add(String(accId));
      // Cũng thêm phoneNumber để match
      if (acc.phoneNumber) botAccountIds.add(acc.phoneNumber);
      if (acc.phone) botAccountIds.add(acc.phone);
    }
  } catch { /* bot server không khả dụng → không check */ }

  function checkBotOnline(account: { zaloAccountId?: string | null; soDienThoai?: string | null }): boolean | null {
    // null = chưa cấu hình bot server hoặc chưa link zaloAccountId
    if (botAccountIds.size === 0) return null;
    if (!account.zaloAccountId && !account.soDienThoai) return null;
    // Check bằng zaloAccountId hoặc SĐT (trường hợp zaloAccountId lưu dạng SĐT)
    if (account.zaloAccountId && botAccountIds.has(account.zaloAccountId)) return true;
    if (account.soDienThoai) {
      const phone = account.soDienThoai;
      if (botAccountIds.has(phone) || botAccountIds.has(phone.replace(/^0/, '+84')) || botAccountIds.has(phone.replace(/^\+84/, '0'))) return true;
    }
    return account.zaloAccountId ? false : null;
  }

  // Gắn đúng ZaloThongBaoCaiDat cho từng (nguoiDung × toaNha)
  const result = buildings.map(b => ({
    id: b.id,
    tenToaNha: b.tenToaNha,
    chuTro: {
      ...omit(b.chuSoHuu, 'zaloThongBaoCaiDat'),
      settings: b.chuSoHuu.zaloThongBaoCaiDat.find(s => s.toaNhaId === b.id) ?? null,
      botOnline: checkBotOnline(b.chuSoHuu),
    },
    quanLys: b.nguoiQuanLy.map(q => ({
      ...omit(q.nguoiDung, 'zaloThongBaoCaiDat'),
      settings: q.nguoiDung.zaloThongBaoCaiDat.find(s => s.toaNhaId === b.id) ?? null,
      botOnline: checkBotOnline(q.nguoiDung),
    })),
  }));

  return NextResponse.json({ ok: true, buildings: result });
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sessionUserId, role } = session.user;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { nguoiDungId, toaNhaId, zaloAccountId, zaloBotServerUrl, zaloBotUsername, zaloBotPassword, zaloBotTtl, settings } = body as {
    nguoiDungId: string;
    toaNhaId: string;
    zaloAccountId?: string;
    zaloBotServerUrl?: string;
    zaloBotUsername?: string;
    zaloBotPassword?: string;
    zaloBotTtl?: number | null;
    settings?: Partial<SettingsPayload>;
  };

  if (!nguoiDungId) {
    return NextResponse.json({ error: 'Thiếu nguoiDungId' }, { status: 400 });
  }
  // toaNhaId có thể rỗng khi chỉ cập nhật bot config (không cập nhật ZaloThongBaoCaiDat)
  if (!toaNhaId && settings) {
    return NextResponse.json({ error: 'Thiếu toaNhaId khi cập nhật settings' }, { status: 400 });
  }

  // Kiểm tra quyền: quanLy chỉ được sửa settings của chính họ
  if (role === 'quanLy' && nguoiDungId !== sessionUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // chuNha/dongChuTro chỉ được sửa tòa nhà của họ (sở hữu hoặc được gán)
  if ((role === 'chuNha' || role === 'dongChuTro') && toaNhaId) {
    const owned = await prisma.toaNha.findFirst({
      where: {
        id: toaNhaId,
        OR: [
          { chuSoHuuId: sessionUserId },
          { nguoiQuanLy: { some: { nguoiDungId: sessionUserId } } },
        ],
      },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cập nhật các trường Zalo per-user nếu được cung cấp
  const updateData: Record<string, unknown> = {};
  if (zaloAccountId !== undefined) updateData.zaloAccountId = zaloAccountId || null;
  if (zaloBotServerUrl !== undefined) updateData.zaloBotServerUrl = zaloBotServerUrl || null;
  if (zaloBotUsername !== undefined) updateData.zaloBotUsername = zaloBotUsername || null;
  if (zaloBotPassword !== undefined && !zaloBotPassword.includes('••••')) updateData.zaloBotPassword = zaloBotPassword || null;
  if (zaloBotTtl !== undefined) updateData.zaloBotTtl = zaloBotTtl ?? null;

  if (Object.keys(updateData).length > 0) {
    await prisma.nguoiDung.update({
      where: { id: nguoiDungId },
      data: updateData,
    });
  }

  // Upsert ZaloThongBaoCaiDat (chỉ khi có toaNhaId)
  if (settings && toaNhaId) {
    const data = sanitizeSettings(settings);
    await prisma.zaloThongBaoCaiDat.upsert({
      where: { nguoiDungId_toaNhaId: { nguoiDungId, toaNhaId } },
      create: { nguoiDungId, toaNhaId, ...data },
      update: data,
    });
  }

  return NextResponse.json({ ok: true });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function allSettingFields() {
  return {
    id: true, toaNhaId: true,
    nhanSuCo: true, nhanHoaDon: true, nhanTinKhach: true, nhanNguoiLa: true, nhanNhacNho: true,
    chuyenSuCoChoQL: true, chuyenHoaDonChoQL: true, chuyenTinKhachChoQL: true,
    chuyenNguoiLaChoQL: true, chuyenNhacNhoChoQL: true,
  } as const;
}

type SettingsPayload = {
  nhanSuCo: boolean; nhanHoaDon: boolean; nhanTinKhach: boolean;
  nhanNguoiLa: boolean; nhanNhacNho: boolean;
  chuyenSuCoChoQL: boolean; chuyenHoaDonChoQL: boolean; chuyenTinKhachChoQL: boolean;
  chuyenNguoiLaChoQL: boolean; chuyenNhacNhoChoQL: boolean;
};

function sanitizeSettings(s: Partial<SettingsPayload>): Partial<SettingsPayload> {
  const result: Partial<SettingsPayload> = {};
  const boolKeys: (keyof SettingsPayload)[] = [
    'nhanSuCo', 'nhanHoaDon', 'nhanTinKhach', 'nhanNguoiLa', 'nhanNhacNho',
    'chuyenSuCoChoQL', 'chuyenHoaDonChoQL', 'chuyenTinKhachChoQL',
    'chuyenNguoiLaChoQL', 'chuyenNhacNhoChoQL',
  ];
  for (const k of boolKeys) {
    if (typeof s[k] === 'boolean') result[k] = s[k];
  }
  return result;
}

function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const k of keys) delete result[k];
  return result as Omit<T, K>;
}
