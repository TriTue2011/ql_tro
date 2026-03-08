import { NextRequest, NextResponse } from 'next/server';
import { getPhongRepo, getKhachThueRepo, getHopDongRepo } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  try {
    console.log('Form data API called');

    console.log('Connecting to database...');

    // Get all rooms for reference (simplified)
    console.log('Fetching phongList...');
    const phongRepo = await getPhongRepo();
    const phongResult = await phongRepo.findMany({ limit: 1000 });
    const phongList = phongResult.data;
    console.log('Fetched phongList:', phongList.length);

    // Get all tenants for reference (simplified)
    console.log('Fetching khachThueList...');
    const khachThueRepo = await getKhachThueRepo();
    const khachThueResult = await khachThueRepo.findMany({ limit: 1000 });
    const khachThueList = khachThueResult.data;
    console.log('Fetched khachThueList:', khachThueList.length);

    // Get active contracts (simplified)
    console.log('Fetching hopDongList...');
    const hopDongRepo = await getHopDongRepo();
    const hopDongResult = await hopDongRepo.findMany({ trangThai: 'hoatDong', limit: 1000 });
    const hopDongList = hopDongResult.data;
    console.log('Fetched hopDongList:', hopDongList.length);

    return NextResponse.json({
      success: true,
      data: {
        hopDongList,
        phongList,
        khachThueList,
      },
    });

  } catch (error) {
    console.error('Error fetching form data:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
