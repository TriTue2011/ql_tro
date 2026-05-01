/**
 * API quản lý 3 công tắc Zalo Hotline cho từng tòa nhà.
 *
 * GET  /api/admin/zalo-hotline-switches?toaNhaId=xxx
 *   → Trả về trạng thái 3 công tắc + kịch bản hiện tại + kiểm tra quyền
 *
 * PUT  /api/admin/zalo-hotline-switches
 *   → Cập nhật 3 công tắc (body: { toaNhaId, batHotline?, uyQuyenQL?, uyQuyenHotline? })
 *
 * Chỉ admin và chủ nhà của tòa nhà đó được truy cập.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  getHotlineSwitches,
  identifyScenario,
  checkRequiredPermissions,
} from '@/lib/zalo-hotline-router';

async function authorize(toaNhaId: string, session: any): Promise<boolean> {
  if (session?.user?.role === 'admin') return true;
  if (session?.user?.role === 'chuNha') {
    const toaNha = await prisma.toaNha.findUnique({
      where: { id: toaNhaId },
      select: { chuSoHuuId: true },
    });
    return toaNha?.chuSoHuuId === session.user.id;
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const toaNhaId = searchParams.get('toaNhaId');

    if (!toaNhaId) {
      return NextResponse.json({ error: 'Missing toaNhaId' }, { status: 400 });
    }

    if (!await authorize(toaNhaId, session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const switches = await getHotlineSwitches(toaNhaId);
    const scenario = identifyScenario(switches);
    const permCheck = switches.uyQuyenQL ? await checkRequiredPermissions(toaNhaId) : { ok: true, missing: [] };

    return NextResponse.json({
      success: true,
      data: {
        switches,
        scenario,
        permissions: permCheck,
      },
    });
  } catch (error) {
    console.error('[zalo-hotline-switches GET]', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { toaNhaId, batHotline, uyQuyenQL, uyQuyenHotline } = body;

    if (!toaNhaId) {
      return NextResponse.json({ error: 'Missing toaNhaId' }, { status: 400 });
    }

    if (!await authorize(toaNhaId, session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Xây dựng update data
    const updateData: any = {};
    if (typeof batHotline === 'boolean') updateData.batHotline = batHotline;
    if (typeof uyQuyenQL === 'boolean') updateData.uyQuyenQL = uyQuyenQL;
    if (typeof uyQuyenHotline === 'boolean') updateData.uyQuyenHotline = uyQuyenHotline;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Nếu bật uyQuyenQL, kiểm tra quản lý có đủ quyền không
    if (uyQuyenQL === true) {
      const permCheck = await checkRequiredPermissions(toaNhaId);
      if (!permCheck.ok) {
        return NextResponse.json({
          error: 'Không thể bật Ủy quyền QL vì quản lý thiếu quyền',
          detail: {
            missing: permCheck.missing,
            hint: 'Cấp đủ 4 nhóm quyền (Sự cố, Hóa đơn, Thông báo, Phê duyệt Yêu cầu) cho ít nhất 1 quản lý trước khi bật ủy quyền.',
          },
        }, { status: 400 });
      }
    }

    const settings = await prisma.caiDatToaNha.upsert({
      where: { toaNhaId },
      update: updateData,
      create: {
        toaNhaId,
        ...updateData,
      },
    });

    // Trả về trạng thái mới
    const switches = await getHotlineSwitches(toaNhaId);
    const scenario = identifyScenario(switches);

    return NextResponse.json({
      success: true,
      data: {
        switches,
        scenario,
      },
    });
  } catch (error: any) {
    console.error('[zalo-hotline-switches PUT]', error);
    return NextResponse.json(
      { error: `Lỗi server: ${error?.message || 'Unknown'}` },
      { status: 500 },
    );
  }
}
