/**
 * storage-cleanup.ts
 * Xóa file cũ khỏi lưu trữ (MinIO/local) dựa trên cài đặt thời gian.
 * - Ảnh/file Zalo: mặc định 7 ngày (storage_cleanup_days_zalo)
 * - Ảnh hóa đơn (chỉ số điện/nước): mặc định 365 ngày (storage_cleanup_days_invoice)
 */
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

async function getCleanupDays(): Promise<{ zalo: number; invoice: number }> {
  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: ['storage_cleanup_days_zalo', 'storage_cleanup_days_invoice'] } },
    select: { khoa: true, giaTri: true },
  });
  const map = Object.fromEntries(rows.map(r => [r.khoa, parseInt(r.giaTri ?? '0', 10)]));
  return {
    zalo: isNaN(map['storage_cleanup_days_zalo']) ? 7 : (map['storage_cleanup_days_zalo'] ?? 7),
    invoice: isNaN(map['storage_cleanup_days_invoice']) ? 365 : (map['storage_cleanup_days_invoice'] ?? 365),
  };
}

/** Xóa 1 file từ storage theo secure_url (/api/files/... hoặc /uploads/...) */
async function deleteStorageFile(url: string): Promise<void> {
  if (!url) return;
  try {
    if (url.startsWith('/api/files/')) {
      // MinIO: /api/files/<bucket>/<objectName>
      const parts = url.replace('/api/files/', '').split('/');
      if (parts.length < 2) return;
      const bucket = parts[0];
      const objectName = parts.slice(1).join('/');
      const { getMinioConfig, createMinioClient } = await import('@/lib/minio');
      const config = await getMinioConfig();
      const client = createMinioClient(config);
      await client.removeObject(bucket, objectName);
    } else if (url.startsWith('/uploads/')) {
      // Local: public/uploads/...
      const filePath = path.join(process.cwd(), 'public', url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    // Cloudinary / CDN URLs: không xóa (external)
  } catch (e: any) {
    console.error(`[cleanup] Không xóa được file ${url}: ${e.message}`);
  }
}

let _running = false;

export async function runStorageCleanup(): Promise<{ zaloDeleted: number; invoiceCleared: number }> {
  if (_running) return { zaloDeleted: 0, invoiceCleared: 0 };
  _running = true;
  let zaloDeleted = 0;
  let invoiceCleared = 0;

  try {
    const { zalo, invoice } = await getCleanupDays();

    // ── 1. Ảnh/file Zalo ─────────────────────────────────────────────────────
    if (zalo > 0) {
      const cutoff = new Date(Date.now() - zalo * 86_400_000);
      // Lấy các ZaloMessage cũ có attachmentUrl lưu trong storage của mình
      const oldMsgs = await prisma.zaloMessage.findMany({
        where: {
          createdAt: { lt: cutoff },
          attachmentUrl: { not: null },
        },
        select: { id: true, attachmentUrl: true },
        take: 500,
      });

      for (const msg of oldMsgs) {
        const url = msg.attachmentUrl ?? '';
        if (url.startsWith('/api/files/') || url.startsWith('/uploads/')) {
          await deleteStorageFile(url);
        }
      }
      if (oldMsgs.length > 0) {
        // Xóa bản ghi ZaloMessage cũ
        await prisma.zaloMessage.deleteMany({
          where: { id: { in: oldMsgs.map(m => m.id) } },
        });
        zaloDeleted = oldMsgs.length;
        console.log(`[cleanup] Đã xóa ${zaloDeleted} tin nhắn Zalo cũ`);
      }
    }

    // ── 2. Ảnh hóa đơn (chỉ số điện/nước) ───────────────────────────────────
    if (invoice > 0) {
      const cutoff = new Date(Date.now() - invoice * 86_400_000);
      const oldInvoices = await prisma.hoaDon.findMany({
        where: {
          ngayTao: { lt: cutoff },
          OR: [
            { anhChiSoDien: { not: null } },
            { anhChiSoNuoc: { not: null } },
          ],
        },
        select: { id: true, anhChiSoDien: true, anhChiSoNuoc: true },
        take: 200,
      });

      for (const hd of oldInvoices) {
        if (hd.anhChiSoDien) await deleteStorageFile(hd.anhChiSoDien);
        if (hd.anhChiSoNuoc) await deleteStorageFile(hd.anhChiSoNuoc);
        await prisma.hoaDon.update({
          where: { id: hd.id },
          data: { anhChiSoDien: null, anhChiSoNuoc: null },
        });
        invoiceCleared++;
      }
      if (invoiceCleared > 0) {
        console.log(`[cleanup] Đã xóa ảnh của ${invoiceCleared} hóa đơn cũ`);
      }
    }
  } catch (e: any) {
    console.error('[cleanup] Lỗi cleanup:', e.message);
  } finally {
    _running = false;
  }

  return { zaloDeleted, invoiceCleared };
}
