import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNguoiDungRepo } from '@/lib/repositories';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = await getNguoiDungRepo();
    const user = await repo.findByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      ten: user.ten,
      email: user.email,
      soDienThoai: user.soDienThoai,
      vaiTro: user.vaiTro,
      anhDaiDien: user.anhDaiDien,
      trangThai: user.trangThai,
      ngayTao: user.ngayTao,
      ngayCapNhat: user.ngayCapNhat,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ten, soDienThoai, anhDaiDien } = body;

    const repo = await getNguoiDungRepo();

    // Find user by email first to get id
    const existingUser = await repo.findByEmail(session.user.email);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await repo.update(existingUser.id, {
      ten,
      soDienThoai,
      anhDaiDien,
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updatedUser.id,
      ten: updatedUser.ten,
      email: updatedUser.email,
      soDienThoai: updatedUser.soDienThoai,
      vaiTro: updatedUser.vaiTro,
      anhDaiDien: updatedUser.anhDaiDien,
      trangThai: updatedUser.trangThai,
      ngayTao: updatedUser.ngayTao,
      ngayCapNhat: updatedUser.ngayCapNhat,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
