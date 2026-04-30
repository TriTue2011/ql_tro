import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { autoLinkZaloChatIds, notifyTenantsOfNewManager } from '@/lib/zalo-auto-link';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { validateChucVuForRole } from '@/lib/chuc-vu';

const createUserSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(128).optional().or(z.literal('')),
  phone: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ (10-11 chữ số)').optional().or(z.literal('')),
  role: z.enum(['admin', 'chuNha', 'dongChuTro', 'quanLy', 'nhanVien']),
  chucVu: z.string().optional().nullable(),
  toaNhaId: z.string().optional().nullable(),
}).refine(
  data => (data.phone && data.phone.trim() !== '') || (data.email && data.email.trim() !== ''),
  { message: 'Cần ít nhất số điện thoại hoặc email', path: ['phone'] }
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const role = session?.user?.role;
    const ALLOWED_MANAGERS = ['admin', 'chuNha', 'dongChuTro', 'quanLy'];
    if (!session?.user?.id || !ALLOWED_MANAGERS.includes(role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const selectFields = {
      id: true,
      ten: true,
      email: true,
      soDienThoai: true,
      vaiTro: true,
      chucVu: true,
      anhDaiDien: true,
      trangThai: true,
      zaloChatId: true,
      nhanThongBaoZalo: true,
      zaloAccountId: true,
      zaloViTri: true,
      ngayTao: true,
      ngayCapNhat: true,
      toaNha: { select: { id: true, tenToaNha: true }, take: 1 },
      toaNhaQuanLy: {
        select: {
          toaNha: { select: { id: true, tenToaNha: true } },
          quyenKichHoatTaiKhoan: true,
          quyenHopDong: true,
          quyenHoaDon: true,
          quyenThanhToan: true,
          quyenSuCo: true,
        },
      },
    } as const;

    let users;
    if (role === 'admin') {
      // Admin chỉ quản lý admin và chuNha
      users = await prisma.nguoiDung.findMany({
        where: { vaiTro: { in: ['admin', 'chuNha'] } },
        take: 1000,
        orderBy: { ngayTao: 'desc' },
        select: selectFields,
      });
    } else {
      // chuNha/dongChuTro/quanLy: thấy cấp dưới gán vào tòa nhà của mình
      const myBuildingIds = await prisma.toaNha.findMany({
        where: {
          OR: [
            { chuSoHuuId: session.user.id },
            { nguoiQuanLy: { some: { nguoiDungId: session.user.id } } },
          ],
        },
        select: { id: true },
      }).then(rows => rows.map(r => r.id));

      // quanLy chỉ thấy nhanVien; chuNha/dongChuTro thấy dongChuTro, quanLy, nhanVien
      const visibleRoles = role === 'quanLy'
        ? ['nhanVien']
        : ['dongChuTro', 'quanLy', 'nhanVien'];

      // Lấy danh sách người dùng được tạo bởi user hiện tại (qua raw SQL vì nguoiTaoId chưa có trong Prisma schema)
      const createdByMe = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "NguoiDung" WHERE "nguoiTaoId" = ${session.user.id}`;
      const createdByMeIds = createdByMe.map(r => r.id);

      users = await prisma.nguoiDung.findMany({
        where: {
          vaiTro: { in: visibleRoles },
          OR: [
            { toaNhaQuanLy: { some: { toaNhaId: { in: myBuildingIds } } } },
            ...(createdByMeIds.length > 0 ? [{ id: { in: createdByMeIds } }] : []),
          ],
        },
        take: 1000,
        orderBy: { ngayTao: 'desc' },
        select: selectFields,
      });
    }

    // Batch-fetch nguoiTaoId via raw SQL (column not in Prisma schema)
    const userIds = users.map(u => u.id);
    const nguoiTaoRows = userIds.length > 0
      ? await prisma.$queryRaw<{ id: string; nguoiTaoId: string | null }[]>`
          SELECT id, "nguoiTaoId" FROM "NguoiDung" WHERE id = ANY(${userIds})`
      : [];
    const nguoiTaoIdByUser = new Map(nguoiTaoRows.map(r => [r.id, r.nguoiTaoId]));

    // Batch-fetch tên người tạo
    const creatorIds = [...new Set(nguoiTaoRows.map(r => r.nguoiTaoId).filter(Boolean) as string[])];
    const creators = creatorIds.length > 0
      ? await prisma.nguoiDung.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, ten: true },
        })
      : [];
    const creatorMap = new Map(creators.map(c => [c.id, c.ten]));

    const result = users.map(u => {
      const ownedBuilding = u.toaNha[0] ?? null;
      const managedEntry = u.toaNhaQuanLy[0] ?? null;
      const managedBuilding = managedEntry?.toaNha ?? null;
      const assignedBuilding = ownedBuilding || managedBuilding;
      const nguoiTaoId = nguoiTaoIdByUser.get(u.id) ?? null;
      // toaNhaIds: tất cả tòa nhà được gán qua ToaNhaNguoiQuanLy (dùng cho multi-select admin)
      const toaNhaIds = u.toaNhaQuanLy.map(q => q.toaNha.id);
      const quyenTheoToaNha = Object.fromEntries(
        u.toaNhaQuanLy.map(q => [
          q.toaNha.id,
          {
            quyenKichHoatTaiKhoan: q.quyenKichHoatTaiKhoan,
            quyenHopDong: q.quyenHopDong,
            quyenHoaDon: q.quyenHoaDon,
            quyenThanhToan: q.quyenThanhToan,
            quyenSuCo: q.quyenSuCo,
          },
        ]),
      );
      return {
        id: u.id,
        ten: u.ten,
        email: u.email,
        soDienThoai: u.soDienThoai,
        vaiTro: u.vaiTro,
        chucVu: u.chucVu,
        anhDaiDien: u.anhDaiDien,
        trangThai: u.trangThai,
        zaloChatId: u.zaloChatId,
        nhanThongBaoZalo: u.nhanThongBaoZalo,
        zaloAccountId: u.zaloAccountId,
        zaloViTri: u.zaloViTri,
        nguoiTaoId: nguoiTaoId,
        nguoiTaoTen: nguoiTaoId ? (creatorMap.get(nguoiTaoId) ?? null) : null,
        ngayTao: u.ngayTao.toISOString(),
        createdAt: u.ngayTao.toISOString(),
        toaNhaId: assignedBuilding?.id ?? null,
        toaNhaTen: assignedBuilding?.tenToaNha ?? null,
        toaNhaIds,
        quyenTheoToaNha,
        quyenKichHoatTaiKhoan: managedEntry?.quyenKichHoatTaiKhoan ?? false,
        quyenHopDong: managedEntry?.quyenHopDong ?? false,
        quyenHoaDon: managedEntry?.quyenHoaDon ?? false,
        quyenThanhToan: managedEntry?.quyenThanhToan ?? false,
        quyenSuCo: managedEntry?.quyenSuCo ?? false,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const callerRole = session?.user?.role;
    const ALLOWED_CREATORS = ['admin', 'chuNha', 'dongChuTro'];
    if (!session?.user?.id || !ALLOWED_CREATORS.includes(callerRole ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, phone, role, chucVu, toaNhaId } = parsed.data;
  // toaNhaIds từ body (không qua zod schema vì không dùng cho chuNha)
  const toaNhaIds: string[] = Array.isArray(body.toaNhaIds) ? body.toaNhaIds : (toaNhaId ? [toaNhaId] : []);

    // chuNha/dongChuTro chỉ được tạo dongChuTro/quanLy/nhanVien
    if (callerRole !== 'admin' && ['admin', 'chuNha'].includes(role)) {
      return NextResponse.json({ error: 'Không có quyền tạo tài khoản với vai trò này' }, { status: 403 });
    }

    const chucVuResult = validateChucVuForRole(role, chucVu);
    if (!chucVuResult.ok) {
      return NextResponse.json({ error: chucVuResult.error }, { status: 400 });
    }

    // Giới hạn số lượng vai trò trên mỗi tòa nhà (đọc từ cài đặt DB)
    const DEFAULT_LIMITS: Record<string, number> = { dongChuTro: 2, quanLy: 3, nhanVien: 5 };
    let roleLimits = DEFAULT_LIMITS;
    try {
      const row = await prisma.caiDat.findUnique({ where: { khoa: 'role_limits' } });
      if (row?.giaTri) roleLimits = { ...DEFAULT_LIMITS, ...JSON.parse(row.giaTri) };
    } catch {}
    const maxForRole = roleLimits[role];
    if (maxForRole && toaNhaIds.length > 0) {
      for (const tid of toaNhaIds) {
        const count = await prisma.toaNhaNguoiQuanLy.count({
          where: {
            toaNhaId: tid,
            nguoiDung: { vaiTro: role },
          },
        });
        if (count >= maxForRole) {
          const building = await prisma.toaNha.findUnique({ where: { id: tid }, select: { tenToaNha: true } });
          return NextResponse.json(
            { error: `Tòa nhà "${building?.tenToaNha || tid}" đã đạt giới hạn ${maxForRole} ${role} cho phép` },
            { status: 400 }
          );
        }
      }
    }

    const cleanEmail = email?.trim() ? email.toLowerCase() : null;
    const cleanPhone = phone?.trim() || null;

    // Kiểm tra email trùng (nếu có nhập email)
    if (cleanEmail) {
      const byEmail = await prisma.nguoiDung.findUnique({ where: { email: cleanEmail } });
      if (byEmail) return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 });
    }
    // Kiểm tra SĐT trùng (nếu có nhập SĐT)
    if (cleanPhone) {
      const bySdt = await prisma.nguoiDung.findFirst({ where: { soDienThoai: cleanPhone } });
      if (bySdt) return NextResponse.json({ error: 'Số điện thoại đã được sử dụng' }, { status: 400 });
    }

    // Mật khẩu: nếu không nhập → dùng SĐT hoặc email làm mật khẩu tạm
    const rawPw = password || cleanPhone || cleanEmail || 'default123';
    const hashedPassword = await hash(rawPw, 12);

    const newUser = await prisma.nguoiDung.create({
      data: {
        ten: sanitizeText(name),
        email: cleanEmail,
        matKhau: hashedPassword,
        soDienThoai: cleanPhone,
        vaiTro: role,
        chucVu: chucVuResult.chucVu,
        ...(body.zaloViTri ? { zaloViTri: body.zaloViTri } : {}),
      },
    });

    // Lưu người tạo via raw SQL (column not in Prisma schema)
    prisma.$executeRawUnsafe(
      `UPDATE "NguoiDung" SET "nguoiTaoId" = $1 WHERE id = $2`,
      session.user.id,
      newUser.id,
    ).catch((err) => {
      console.error('[admin/users] Failed to save nguoiTaoId:', err);
    });

    // Tự động tra cứu và liên kết zaloChatId qua bot server (fire-and-forget)
    if (phone && toaNhaIds.length > 0) {
      autoLinkZaloChatIds('nguoiDung', newUser.id, phone, toaNhaIds[0]).catch(() => {});
    } else if (phone) {
      autoLinkZaloChatIds('nguoiDung', newUser.id, phone).catch(() => {});
    }

    // Gán tòa nhà nếu có và không phải admin (hỗ trợ nhiều tòa)
    if (role !== 'admin' && toaNhaIds.length > 0) {
      for (const tid of toaNhaIds) {
        await prisma.toaNhaNguoiQuanLy.create({
          data: { toaNhaId: tid, nguoiDungId: newUser.id },
        }).catch(() => {});
      }

      // Nếu là quản lý mới → gửi thông báo đến toàn bộ khách thuê
      if (role === 'quanLy' || role === 'dongChuTro') {
        for (const tid of toaNhaIds) {
          notifyTenantsOfNewManager(tid, newUser.id).catch(() => {});
        }
      }
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
