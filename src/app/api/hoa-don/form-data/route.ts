import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPhongRepo, getKhachThueRepo, getHopDongRepo } from '@/lib/repositories';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const phongRepo = await getPhongRepo();
    const khachThueRepo = await getKhachThueRepo();
    const hopDongRepo = await getHopDongRepo();

    const [phongResult, khachThueResult, hopDongResult] = await Promise.all([
      phongRepo.findMany({ limit: 1000 }),
      khachThueRepo.findMany({ limit: 1000 }),
      hopDongRepo.findMany({ trangThai: 'hoatDong', limit: 1000 }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        hopDongList: hopDongResult.data,
        phongList: phongResult.data,
        khachThueList: khachThueResult.data,
      },
    });

  } catch (error) {
    console.error('Error fetching form data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
