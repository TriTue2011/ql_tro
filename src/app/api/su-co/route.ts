import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSuCoRepo, getPhongRepo, getKhachThueRepo } from '@/lib/repositories';
import { sseEmit } from '@/lib/sse-emitter';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { parsePage, parseLimit } from '@/lib/parse-query';
import { z } from 'zod';
import { checkQuyen } from '@/lib/server/check-quyen';
import { notifyIncidentGhiNhan, notifyNewIncident } from '@/lib/zalo-notify';

const suCoSchema = z.object({
  phong: z.string().min(1, 'Phòng là bắt buộc'),
  khachThue: z.string().min(1, 'Khách thuê là bắt buộc'),
  tieuDe: z.string().min(1, 'Tiêu đề là bắt buộc'),
  moTa: z.string().min(1, 'Mô tả là bắt buộc'),
  anhSuCo: z.array(z.string()).optional(),
  loaiSuCo: z.enum(['dienNuoc', 'noiThat', 'vesinh', 'anNinh', 'khac']),
  mucDoUuTien: z.enum(['thap', 'trungBinh', 'cao', 'khancap']).optional(),
  trangThai: z.enum(['moi', 'dangXuLy', 'daXong', 'daHuy']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (role === 'admin') {
      return NextResponse.json({ message: 'Admin không quản lý sự cố' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'));
    const search = searchParams.get('search') || '';
    const loaiSuCo = searchParams.get('loaiSuCo') || '';
    const mucDoUuTien = searchParams.get('mucDoUuTien') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    const repo = await getSuCoRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
      loaiSuCo: ['dienNuoc','noiThat','vesinh','anNinh','khac'].includes(loaiSuCo) ? loaiSuCo as import('@/lib/repositories/types').LoaiSuCo : undefined,
      mucDoUuTien: ['thap','trungBinh','cao','khancap'].includes(mucDoUuTien) ? mucDoUuTien as import('@/lib/repositories/types').MucDoUuTien : undefined,
      trangThai: ['moi','dangXuLy','daXong','daHuy'].includes(trangThai) ? trangThai as import('@/lib/repositories/types').TrangThaiSuCo : undefined,
      toaNhaIds,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching su co:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = suCoSchema.parse(body);

    const phongRepo = await getPhongRepo();
    const khachThueRepo = await getKhachThueRepo();
    const suCoRepo = await getSuCoRepo();

    // Check if phong exists
    const phong = await phongRepo.findById(validatedData.phong);
    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 400 }
      );
    }

    // Kiểm tra quyền thêm sự cố
    const role = session.user.role;
    if (role === 'quanLy' || role === 'nhanVien') {
      const perm = await checkQuyen(session.user.id, role, phong.toaNhaId, 'quyenSuCo');
      if (!perm.allowed) {
        return NextResponse.json({ message: perm.message }, { status: 403 });
      }
    }

    // Check if khach thue exists
    const khachThue = await khachThueRepo.findById(validatedData.khachThue);
    if (!khachThue) {
      return NextResponse.json(
        { message: 'Khách thuê không tồn tại' },
        { status: 400 }
      );
    }

    const newSuCo = await suCoRepo.create({
      phongId: validatedData.phong,
      khachThueId: validatedData.khachThue,
      tieuDe: validatedData.tieuDe,
      moTa: validatedData.moTa,
      anhSuCo: validatedData.anhSuCo || [],
      loaiSuCo: validatedData.loaiSuCo,
      mucDoUuTien: validatedData.mucDoUuTien || 'trungBinh',
    });

    notifyIncidentGhiNhan(newSuCo.id, session.user.id).catch(() => {});
    notifyNewIncident(newSuCo.id, session.user.id).catch(() => {});

    sseEmit('su-co', { action: 'created' });
    return NextResponse.json({
      success: true,
      data: newSuCo,
      message: 'Sự cố đã được báo cáo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating su co:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
