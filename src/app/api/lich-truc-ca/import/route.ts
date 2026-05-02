import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getUserToaNhaIds } from '@/lib/server/get-user-toa-nha-ids';
import { sseEmit } from '@/lib/sse-emitter';

// Các ca làm việc chuẩn
const SHIFT_TYPES = ['C1', 'C2', 'C3', 'HC'] as const;

/**
 * Parse CSV text content thành mảng các dòng.
 * Hỗ trợ cả dấu phẩy và tab làm delimiter.
 */
function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  // Detect delimiter: ưu tiên tab, sau đó comma
  const firstLine = lines[0] ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  return lines.map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

/**
 * Parse header row để tìm cột định danh và cột ngày.
 * Trả về { identifyCol: number, dayCols: Map<dayNumber, colIndex> }
 */
function parseHeader(
  header: string[],
): { identifyCol: number; dayCols: Map<number, number> } | { error: string } {
  const identifyKeywords = ['sdt', 'phone', 'điện thoại', 'dien thoai', 'email', 'e-mail', 'mail'];
  let identifyCol = -1;
  const dayCols = new Map<number, number>();

  for (let i = 0; i < header.length; i++) {
    const col = header[i].toLowerCase().trim();

    // Check if this is an identity column
    if (identifyKeywords.some((kw) => col.includes(kw))) {
      identifyCol = i;
    }

    // Check if this is a day column (1-31)
    const dayNum = parseInt(col, 10);
    if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
      dayCols.set(dayNum, i);
    }
  }

  if (identifyCol === -1) {
    return { error: 'Không tìm thấy cột định danh (SĐT hoặc Email)' };
  }

  if (dayCols.size === 0) {
    return { error: 'Không tìm thấy cột ngày (1-31)' };
  }

  return { identifyCol, dayCols };
}

// ─── POST: Import lịch trực ca từ file Excel/CSV ──────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role === 'admin' || role === 'nhanVien') {
      return NextResponse.json({ message: 'Bạn không có quyền import lịch trực ca' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const toaNhaId = formData.get('toaNhaId') as string | null;
    const isPreview = request.nextUrl.searchParams.get('preview') === 'true';

    if (!file || !toaNhaId) {
      return NextResponse.json({ message: 'Thiếu file hoặc tòa nhà' }, { status: 400 });
    }

    // Kiểm tra quyền truy cập tòa nhà
    const toaNhaIds = await getUserToaNhaIds(session.user.id, role);
    if (!toaNhaIds.includes(toaNhaId)) {
      return NextResponse.json({ message: 'Bạn không có quyền quản lý tòa nhà này' }, { status: 403 });
    }

    // Đọc nội dung file
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let rows: string[][];

    if (fileName.endsWith('.csv')) {
      // Parse CSV
      const text = buffer.toString('utf-8');
      rows = parseCSV(text);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // For xlsx/xls, we need to try to parse as CSV-like or return a helpful error
      // Since we don't have a library installed, try reading as text (some xlsx may have embedded content)
      const text = buffer.toString('utf-8');
      // Check if it looks like CSV
      if (text.includes(',') || text.includes('\t')) {
        rows = parseCSV(text);
      } else {
        return NextResponse.json({
          success: false,
          message: 'File Excel (.xlsx/.xls) cần được cài đặt thư viện xử lý. Vui lòng xuất file sang định dạng CSV và thử lại.',
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({ message: 'Định dạng file không hỗ trợ. Chấp nhận: .csv, .xlsx, .xls' }, { status: 400 });
    }

    if (rows.length < 2) {
      return NextResponse.json({ message: 'File không có dữ liệu (cần ít nhất header + 1 dòng)' }, { status: 400 });
    }

    // Parse header
    const headerResult = parseHeader(rows[0]);
    if ('error' in headerResult) {
      return NextResponse.json({ message: headerResult.error }, { status: 400 });
    }

    const { identifyCol, dayCols } = headerResult;

    // Lấy danh sách người dùng trong tòa nhà để map
    const buildingUsers = await prisma.toaNhaNguoiQuanLy.findMany({
      where: { toaNhaId },
      include: {
        nguoiDung: {
          select: { id: true, ten: true, soDienThoai: true, email: true },
        },
      },
    });

    // Nếu là chuNha, thêm chính họ
    let ownerUser: { id: string; ten: string; soDienThoai: string | null; email: string | null } | null = null;
    if (role === 'chuNha') {
      ownerUser = await prisma.nguoiDung.findUnique({
        where: { id: session.user.id },
        select: { id: true, ten: true, soDienThoai: true, email: true },
      });
    }

    // Build lookup map: normalize phone/email -> user
    const lookupMap = new Map<string, { id: string; ten: string }>();
    for (const record of buildingUsers) {
      const u = record.nguoiDung;
      if (u.soDienThoai) {
        const normalizedPhone = u.soDienThoai.replace(/[^0-9]/g, '');
        lookupMap.set(normalizedPhone, { id: u.id, ten: u.ten });
        // Also store with 0 prefix
        if (normalizedPhone.startsWith('84')) {
          lookupMap.set('0' + normalizedPhone.slice(2), { id: u.id, ten: u.ten });
        }
      }
      if (u.email) {
        lookupMap.set(u.email.toLowerCase().trim(), { id: u.id, ten: u.ten });
      }
    }
    if (ownerUser) {
      if (ownerUser.soDienThoai) {
        lookupMap.set(ownerUser.soDienThoai.replace(/[^0-9]/g, ''), { id: ownerUser.id, ten: ownerUser.ten });
      }
      if (ownerUser.email) {
        lookupMap.set(ownerUser.email.toLowerCase().trim(), { id: ownerUser.id, ten: ownerUser.ten });
      }
    }

    // Parse data rows
    const importRows: Array<{
      row: number;
      nguoiDung?: { id: string; ten: string };
      error?: string;
      shifts: Array<{ ngay: number; ca: string }>;
    }> = [];

    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Get identity value
      const identifyValue = row[identifyCol]?.trim();
      if (!identifyValue) {
        importRows.push({ row: rowNum, error: 'Thiếu thông tin định danh', shifts: [] });
        errors.push(`Dòng ${rowNum}: Thiếu SĐT/Email`);
        continue;
      }

      // Lookup user
      const normalizedIdentify = identifyValue.toLowerCase().trim();
      const phoneOnly = identifyValue.replace(/[^0-9]/g, '');
      let matchedUser = lookupMap.get(normalizedIdentify) ?? lookupMap.get(phoneOnly);

      // Also try with 0 prefix for phone numbers starting with 84
      if (!matchedUser && phoneOnly.startsWith('84')) {
        matchedUser = lookupMap.get('0' + phoneOnly.slice(2));
      }

      if (!matchedUser) {
        importRows.push({
          row: rowNum,
          error: `Không tìm thấy nhân sự với SĐT/Email: ${identifyValue}`,
          shifts: [],
        });
        errors.push(`Dòng ${rowNum}: Không tìm thấy nhân sự "${identifyValue}"`);
        continue;
      }

      // Parse shifts for each day
      const shifts: Array<{ ngay: number; ca: string }> = [];
      let hasInvalidShift = false;

      for (const [day, colIndex] of dayCols) {
        const value = row[colIndex]?.trim().toUpperCase();
        if (!value) continue; // Empty = no shift

        if (SHIFT_TYPES.includes(value as typeof SHIFT_TYPES[number])) {
          shifts.push({ ngay: day, ca: value });
        } else {
          hasInvalidShift = true;
          errors.push(`Dòng ${rowNum}, ngày ${day}: Giá trị ca không hợp lệ "${value}"`);
        }
      }

      if (hasInvalidShift) {
        importRows.push({
          row: rowNum,
          nguoiDung: matchedUser,
          error: 'Có giá trị ca không hợp lệ',
          shifts,
        });
      } else {
        importRows.push({
          row: rowNum,
          nguoiDung: matchedUser,
          shifts,
        });
      }
    }

    // If preview mode, return parsed data without saving
    if (isPreview) {
      return NextResponse.json({
        success: true,
        data: importRows,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: importRows.length,
          valid: importRows.filter((r) => !r.error).length,
          invalid: importRows.filter((r) => r.error).length,
          totalShifts: importRows.reduce((sum, r) => sum + r.shifts.length, 0),
        },
      });
    }

    // ─── Save mode: ghi dữ liệu vào DB ────────────────────────────────────────

    // Determine current month/year from the file context
    // We'll use the current month as default, but the import data contains day numbers
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let savedCount = 0;
    let errorCount = 0;

    for (const row of importRows) {
      if (!row.nguoiDung || row.error) {
        errorCount++;
        continue;
      }

      for (const shift of row.shifts) {
        const ngayDate = new Date(currentYear, currentMonth - 1, shift.ngay);
        ngayDate.setHours(0, 0, 0, 0);

        try {
          await prisma.lichTrucCa.upsert({
            where: {
              nguoiDungId_toaNhaId_ngay: {
                nguoiDungId: row.nguoiDung.id,
                toaNhaId,
                ngay: ngayDate,
              },
            },
            update: {
              ca: shift.ca,
            },
            create: {
              nguoiDungId: row.nguoiDung.id,
              toaNhaId,
              ngay: ngayDate,
              ca: shift.ca,
              nguoiTaoId: session.user.id,
            },
          });
          savedCount++;
        } catch (err) {
          console.error(`Error saving shift for user ${row.nguoiDung.id} on day ${shift.ngay}:`, err);
          errorCount++;
        }
      }
    }

    // Broadcast real-time event
    sseEmit('lich-truc-ca', { action: 'updated' });

    return NextResponse.json({
      success: true,
      message: `Đã import ${savedCount} ca trực${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`,
      summary: {
        saved: savedCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    console.error('POST /api/lich-truc-ca/import error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
