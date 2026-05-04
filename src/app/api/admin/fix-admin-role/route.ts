/**
 * POST /api/admin/fix-admin-role
 * Sửa lỗi "admin biến thành chủ trọ" cho dữ liệu hiện tại:
 * 1. Tìm tài khoản admin qua email hoặc số điện thoại và đưa vaiTro về 'admin'
 * 2. Tìm các tòa nhà có chuSoHuuId trỏ vào admin (thay vì chủ trọ thật)
 *    và gán lại chuSoHuuId cho chủ trọ thật (nếu có)
 *
 * Request body (tất cả đều optional):
 *   - email: email của admin cần sửa (mặc định: tritue0610@gmail.com)
 *   - phone: số điện thoại của admin cần sửa (nếu có, sẽ tìm theo phone thay vì email)
 *   - fixAll: true nếu muốn sửa TẤT CẢ tài khoản có vaiTro='chuNha' nhưng thực chất là admin
 *            (dựa vào nguoiTaoId = null và email chứa 'admin' hoặc tên chứa 'admin')
 *
 * Chỉ admin mới được gọi API này.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function fixAdminAccount(adminUser: { id: string; ten: string; email: string | null; soDienThoai: string | null; vaiTro: string }): Promise<string[]> {
  const results: string[] = [];

  // 1. Khôi phục vaiTro của admin
  if (adminUser.vaiTro !== 'admin') {
    await prisma.nguoiDung.update({
      where: { id: adminUser.id },
      data: { vaiTro: 'admin' },
    });
    results.push(`Đã khôi phục vaiTro của admin "${adminUser.ten}" (${adminUser.email || adminUser.soDienThoai}) từ "${adminUser.vaiTro}" thành "admin"`);
  } else {
    results.push(`Admin "${adminUser.ten}" (${adminUser.email || adminUser.soDienThoai}) đã có vaiTro = "admin", không cần sửa`);
  }

  // 2. Tìm các tòa nhà có chuSoHuuId trỏ vào admin
  const buildingsOwnedByAdmin = await prisma.toaNha.findMany({
    where: { chuSoHuuId: adminUser.id },
    select: { id: true, tenToaNha: true },
  });

  if (buildingsOwnedByAdmin.length > 0) {
    results.push(`Tìm thấy ${buildingsOwnedByAdmin.length} tòa nhà có chuSoHuuId trỏ vào admin "${adminUser.ten}":`);
    for (const b of buildingsOwnedByAdmin) {
      results.push(`  - "${b.tenToaNha}" (${b.id})`);
    }

    // Kiểm tra xem có chủ trọ thật nào đang quản lý các tòa nhà này không
    for (const b of buildingsOwnedByAdmin) {
      // Tìm user có vaiTro = 'chuNha' và có trong ToaNhaNguoiQuanLy của tòa nhà này
      const realChuTro = await prisma.toaNhaNguoiQuanLy.findFirst({
        where: {
          toaNhaId: b.id,
          nguoiDung: { vaiTro: 'chuNha', id: { not: adminUser.id } },
        },
        select: {
          nguoiDung: { select: { id: true, ten: true, soDienThoai: true, email: true } },
        },
      });

      if (realChuTro) {
        // Đã có chủ trọ thật → gán lại chuSoHuuId
        await prisma.toaNha.update({
          where: { id: b.id },
          data: { chuSoHuuId: realChuTro.nguoiDung.id },
        });
        results.push(`  → Đã gán chuSoHuuId cho "${b.tenToaNha}" về chủ trọ "${realChuTro.nguoiDung.ten}" (${realChuTro.nguoiDung.soDienThoai || realChuTro.nguoiDung.email})`);
      } else {
        // Chưa có chủ trọ thật → thông báo cần tạo chủ trọ mới
        results.push(`  → Tòa nhà "${b.tenToaNha}" chưa có chủ trọ thật. Vui lòng tạo chủ trọ mới và chỉnh sửa tòa nhà để gán.`);
      }
    }
  } else {
    results.push(`Không có tòa nhà nào có chuSoHuuId trỏ vào admin "${adminUser.ten}"`);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    // Mode: fixAll = true → tìm và sửa tất cả admin bị lỗi
    if (body.fixAll === true) {
      const allResults: string[] = [];
      let totalFixed = 0;
      let totalBuildingsFixed = 0;

      // Tìm tất cả user có vaiTro = 'chuNha' nhưng thực chất là admin
      // Dấu hiệu: nguoiTaoId = null (admin được tạo từ đầu) hoặc email chứa 'admin'
      const potentialAdmins = await prisma.nguoiDung.findMany({
        where: {
          vaiTro: 'chuNha',
          OR: [
            { nguoiTaoId: null },
            { email: { contains: 'admin', mode: 'insensitive' } },
          ],
        },
        select: { id: true, ten: true, email: true, soDienThoai: true, vaiTro: true },
      });

      if (potentialAdmins.length === 0) {
        allResults.push('Không tìm thấy tài khoản admin nào bị lỗi (vaiTro = "chuNha")');
      } else {
        allResults.push(`Tìm thấy ${potentialAdmins.length} tài khoản nghi là admin bị lỗi:`);
        for (const acc of potentialAdmins) {
          allResults.push(`  - "${acc.ten}" (${acc.email || acc.soDienThoai})`);
        }

        for (const acc of potentialAdmins) {
          const accResults = await fixAdminAccount(acc);
          allResults.push(...accResults);
          if (accResults.some(r => r.includes('Đã khôi phục'))) totalFixed++;
          if (accResults.some(r => r.includes('Đã gán chuSoHuuId'))) totalBuildingsFixed++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Đã xử lý ${totalFixed} tài khoản admin, sửa ${totalBuildingsFixed} tòa nhà`,
        data: {
          adminsFixed: totalFixed,
          buildingsFixed: totalBuildingsFixed,
          details: allResults,
        },
      });
    }

    // Mode: sửa một admin cụ thể
    const adminEmail = body.email || 'tritue0610@gmail.com';
    const adminPhone = body.phone || undefined;

    // 1. Tìm admin account
    let adminUser;
    if (adminPhone) {
      adminUser = await prisma.nguoiDung.findFirst({
        where: { soDienThoai: adminPhone },
        select: { id: true, ten: true, email: true, soDienThoai: true, vaiTro: true },
      });
      if (!adminUser) {
        return NextResponse.json(
          { error: `Không tìm thấy tài khoản với số điện thoại ${adminPhone}` },
          { status: 404 }
        );
      }
    } else {
      adminUser = await prisma.nguoiDung.findFirst({
        where: { email: adminEmail.toLowerCase() },
        select: { id: true, ten: true, email: true, soDienThoai: true, vaiTro: true },
      });
      if (!adminUser) {
        return NextResponse.json(
          { error: `Không tìm thấy tài khoản với email ${adminEmail}` },
          { status: 404 }
        );
      }
    }

    const results = await fixAdminAccount(adminUser);

    return NextResponse.json({
      success: true,
      message: 'Đã sửa lỗi dữ liệu thành công',
      data: {
        admin: {
          id: adminUser.id,
          ten: adminUser.ten,
          email: adminUser.email,
          soDienThoai: adminUser.soDienThoai,
          vaiTroCu: adminUser.vaiTro,
          vaiTroMoi: 'admin',
        },
        buildingsFixed: results.filter(r => r.includes('Đã gán chuSoHuuId')).length,
        details: results,
      },
    });
  } catch (error) {
    console.error('Error fixing admin role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
