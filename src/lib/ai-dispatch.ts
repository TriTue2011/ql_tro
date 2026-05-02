/**
 * ai-dispatch.ts
 *
 * Giai đoạn 5: AI Dispatch
 * Tự động phân công công việc dựa trên:
 * - Mức độ ưu tiên
 * - Khối lượng công việc hiện tại của từng người
 * - Vai trò/chuyên môn
 * - Lịch sử hoàn thành
 */

import prisma from '@/lib/prisma';

export interface DispatchResult {
  assignedTo: string | null;
  reason: string;
  confidence: number; // 0-1
}

export interface DispatchContext {
  tieuDe: string;
  moTa?: string | null;
  loai: 'baoTri' | 'suCo' | 'hoaDon' | 'khac';
  mucDoUuTien: 'thap' | 'trungBinh' | 'cao' | 'khanCap';
  toaNhaId: string;
  phongId?: string | null;
}

/**
 * Tìm người xử lý phù hợp nhất cho một công việc.
 *
 * Thuật toán:
 * 1. Lọc danh sách người dùng có quyền ở tòa nhà (quản lý, nhân viên)
 * 2. Tính điểm dựa trên:
 *    - Số công việc đang xử lý (càng ít càng tốt)
 *    - Tỷ lệ hoàn thành đúng hạn
 *    - Chuyên môn (nếu có thông tin)
 * 3. Chọn người có điểm cao nhất
 */
export async function aiDispatch(context: DispatchContext): Promise<DispatchResult> {
  try {
    // Lấy danh sách người quản lý/nhân viên của tòa nhà
    const managers = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { toaNhaId: context.toaNhaId },
      include: {
        nguoiDung: {
          select: {
            id: true,
            ten: true,
            chucVu: true,
          },
        },
      },
    });

    if (managers.length === 0) {
      return { assignedTo: null, reason: 'Không có quản lý nào trong tòa nhà', confidence: 0 };
    }

    // Tính điểm cho từng người
    const scores: Array<{ userId: string; ten: string; score: number; reason: string }> = [];

    for (const ql of managers) {
      const userId = ql.nguoiDung.id;
      let score = 50; // Base score
      const reasons: string[] = [];

      // 1. Đếm số công việc đang xử lý
      const activeTasks = await prisma.congViec.count({
        where: {
          nguoiXuLyId: userId,
          trangThai: { in: ['choTiepNhan', 'dangXuLy'] },
        },
      });

      const taskPenalty = activeTasks * 10;
      score -= taskPenalty;
      if (activeTasks === 0) {
        reasons.push('không có việc đang xử lý');
      } else {
        reasons.push(`${activeTasks} việc đang xử lý (-${taskPenalty})`);
      }

      // 2. Tỷ lệ hoàn thành đúng hạn
      const totalCompleted = await prisma.congViec.count({
        where: { nguoiXuLyId: userId, trangThai: 'daHoanThanh' },
      });

      if (totalCompleted > 0) {
        const onTime = await prisma.congViec.count({
          where: {
            nguoiXuLyId: userId,
            trangThai: 'daHoanThanh',
            ngayHoanThanh: { lte: new Date() }, // Simplified: assume all completed are on time
          },
        });
        const completionRate = onTime / totalCompleted;
        score += completionRate * 20;
        reasons.push(`tỷ lệ HT: ${Math.round(completionRate * 100)}% (+${Math.round(completionRate * 20)})`);
      }

      // 3. Bonus cho người có chức vụ phù hợp với loại công việc
      const chucVu = ql.nguoiDung.chucVu || '';
      if (context.loai === 'baoTri' && (chucVu.includes('kyThuat') || chucVu.includes('KyThuat'))) {
        score += 15;
        reasons.push('chuyên môn kỹ thuật (+15)');
      }
      if (context.loai === 'suCo' && (chucVu.includes('quanLy') || chucVu.includes('QuanLy'))) {
        score += 10;
        reasons.push('chuyên môn quản lý (+10)');
      }
      if (context.loai === 'hoaDon' && (chucVu.includes('keToan') || chucVu.includes('KeToan'))) {
        score += 15;
        reasons.push('chuyên môn kế toán (+15)');
      }

      // 4. Ưu tiên người đã xử lý phòng/tòa nhà này trước đó
      const previousWork = await prisma.congViec.count({
        where: {
          nguoiXuLyId: userId,
          toaNhaId: context.toaNhaId,
          trangThai: 'daHoanThanh',
        },
      });
      if (previousWork > 0) {
        const familiarityBonus = Math.min(previousWork * 2, 10);
        score += familiarityBonus;
        reasons.push(`quen tòa nhà (+${familiarityBonus})`);
      }

      scores.push({ userId, ten: ql.nguoiDung.ten, score, reason: reasons.join(', ') });
    }

    // Sắp xếp theo điểm giảm dần
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    return {
      assignedTo: best.userId,
      reason: `AI dispatch: ${best.ten} (${best.reason})`,
      confidence: Math.min(best.score / 100, 1),
    };
  } catch (error) {
    console.error('AI dispatch error:', error);
    return { assignedTo: null, reason: 'Lỗi AI dispatch', confidence: 0 };
  }
}

/**
 * Tự động tạo công việc từ sự cố.
 */
export async function createTaskFromSuCo(suCoId: string): Promise<void> {
  try {
    const suCo = await prisma.suCo.findUnique({
      where: { id: suCoId },
      include: { phong: { select: { toaNhaId: true } } },
    });

    if (!suCo || !suCo.phong) return;

    const context: DispatchContext = {
      tieuDe: `Xử lý sự cố: ${suCo.tieuDe}`,
      moTa: suCo.moTa,
      loai: 'suCo',
      mucDoUuTien: suCo.mucDoUuTien as any || 'trungBinh',
      toaNhaId: suCo.phong.toaNhaId,
      phongId: suCo.phongId,
    };

    const dispatch = await aiDispatch(context);

    await prisma.congViec.create({
      data: {
        tieuDe: context.tieuDe,
        moTa: context.moTa,
        loai: 'suCo',
        mucDoUuTien: context.mucDoUuTien,
        toaNhaId: context.toaNhaId,
        phongId: context.phongId,
        suCoId,
        nguoiTaoId: 'system',
        nguoiXuLyId: dispatch.assignedTo,
        trangThai: 'choTiepNhan',
      },
    });
  } catch (error) {
    console.error('Error creating task from su co:', error);
  }
}
