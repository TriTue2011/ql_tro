import { NextRequest, NextResponse } from 'next/server';
import { getToaNhaRepo } from '@/lib/repositories';
import { parsePage, parseLimit } from '@/lib/parse-query';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get('page'));
    const limit = parseLimit(searchParams.get('limit'), 50);
    const search = searchParams.get('search') || '';

    const repo = await getToaNhaRepo();

    const result = await repo.findMany({
      page,
      limit,
      search: search || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error fetching public toa nha:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
