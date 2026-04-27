/**
 * GET  /api/cai-dat/zalo-filter      → Lấy cài đặt lọc Zalo Monitor
 * PUT  /api/cai-dat/zalo-filter      → Cập nhật cài đặt lọc Zalo Monitor
 *
 * Quyền:
 *   - GET: mọi role đã đăng nhập
 *   - PUT dmFilter: admin only → global (ảnh hưởng tất cả)
 *   - PUT groupWhitelist: admin | chuNha | dongChuTro
 *       + chuNha/dongChuTro: lưu per-user (key: zalo_group_whitelist_{userId})
 *       + Nếu kèm toaNhaId + threadId → cập nhật ToaNha.zaloNhomChat luôn
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const KEY_DM_FILTER = 'zalo_monitor_dm_filter';
const KEY_GROUP_WL  = 'zalo_monitor_group_whitelist'; // global (admin only - legacy)
const userGroupKey  = (uid: string) => `zalo_group_whitelist_${uid}`;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = session.user.id;
  const role = session.user.role as string;

  const dbUser = await prisma.nguoiDung.findUnique({ where: { id: uid }, select: { vaiTro: true } });
  const effectiveRole = dbUser?.vaiTro || role;

  // Tìm tất cả tòa nhà mà user có quyền truy cập
  const buildings = await prisma.toaNha.findMany({
    where: effectiveRole === 'admin' ? {} : {
      OR: [
        { chuSoHuuId: uid },
        { nguoiQuanLy: { some: { nguoiDungId: uid } } }
      ]
    },
    select: { id: true, zaloNhomChat: true }
  });

  const mergedGroups: string[] = [];
  
  // DM Filter: Mặc định lấy theo setting toàn cục của Admin
  const globalDmRow = await prisma.caiDat.findUnique({ where: { khoa: KEY_DM_FILTER }, select: { giaTri: true } });
  let finalDmFilter: 'none' | 'system_only' = globalDmRow?.giaTri === 'system_only' ? 'system_only' : 'none';

  // Duyệt qua từng tòa nhà để gộp whitelist và cập nhật dmFilter
  for (const b of buildings) {
    const configRow = await prisma.caiDat.findUnique({ where: { khoa: `zalo_monitor_config_${b.id}` } });
    const config = configRow ? JSON.parse(configRow.giaTri || '{}') : { enabled: true, dmFilter: 'none' };

    if (config.enabled !== false) {
      // Thêm nhóm vào whitelist
      if (Array.isArray(b.zaloNhomChat)) {
        b.zaloNhomChat.forEach((g: any) => { if (g?.name) mergedGroups.push(g.name); });
      }
      
      // Nếu có bất kỳ tòa nhà nào đang bật Monitor và để 'none' (tất cả tin nhắn), 
      // thì UI Monitor nên hiển thị tất cả (để không bỏ lỡ tin của tòa đó).
      if (config.dmFilter === 'none') {
        finalDmFilter = 'none';
      }
    }
  }

  // Admin fallback for global whitelist (legacy)
  if (effectiveRole === 'admin') {
    const gwRow = await prisma.caiDat.findUnique({ where: { khoa: KEY_GROUP_WL }, select: { giaTri: true } });
    try {
      const globalWl = JSON.parse(gwRow?.giaTri || '[]');
      if (Array.isArray(globalWl)) mergedGroups.push(...globalWl);
    } catch {}
  }

  return NextResponse.json({ 
    dmFilter: finalDmFilter, 
    groupWhitelist: [...new Set(mergedGroups)] 
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = session.user.id;
  const role = session.user.role as string;
  const body = await req.json();

  // ── dmFilter: admin only ──────────────────────────────────────────────────
  if ('dmFilter' in body) {
    if (role !== 'admin') return NextResponse.json({ error: 'Chỉ admin mới được đổi bộ lọc DM' }, { status: 403 });
    const val = body.dmFilter === 'system_only' ? 'system_only' : 'none';
    await prisma.caiDat.upsert({
      where: { khoa: KEY_DM_FILTER },
      update: { giaTri: val },
      create: { khoa: KEY_DM_FILTER, giaTri: val, moTa: 'Bộ lọc DM Zalo Monitor', nhom: 'zalo', laBiMat: false },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });
}
