/**
 * Repository Factory
 *
 * Tự động chọn implementation dựa trên DATABASE_PROVIDER:
 *   mongodb     → MongoDB + Mongoose  (online/default)
 *   postgresql  → PostgreSQL + Prisma (offline)
 *
 * Cách dùng trong API route:
 *   import { getPhongRepo } from '@/lib/repositories';
 *   const repo = await getPhongRepo();
 *   const { data, pagination } = await repo.findMany({ page: 1, limit: 10 });
 */

export * from './types';

const provider = () => process.env.DATABASE_PROVIDER || 'mongodb';

// ─── NguoiDung ────────────────────────────────────────────────
export async function getNguoiDungRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/nguoi-dung');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/nguoi-dung');
  return new Repo();
}

// ─── ToaNha ───────────────────────────────────────────────────
export async function getToaNhaRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/toa-nha');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/toa-nha');
  return new Repo();
}

// ─── Phong ────────────────────────────────────────────────────
export async function getPhongRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/phong');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/phong');
  return new Repo();
}

// ─── KhachThue ────────────────────────────────────────────────
export async function getKhachThueRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/khach-thue');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/khach-thue');
  return new Repo();
}

// ─── HopDong ──────────────────────────────────────────────────
export async function getHopDongRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/hop-dong');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/hop-dong');
  return new Repo();
}

// ─── ChiSoDienNuoc ────────────────────────────────────────────
export async function getChiSoRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/chi-so-dien-nuoc');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/chi-so-dien-nuoc');
  return new Repo();
}

// ─── HoaDon ───────────────────────────────────────────────────
export async function getHoaDonRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/hoa-don');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/hoa-don');
  return new Repo();
}

// ─── ThanhToan ────────────────────────────────────────────────
export async function getThanhToanRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/thanh-toan');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/thanh-toan');
  return new Repo();
}

// ─── SuCo ─────────────────────────────────────────────────────
export async function getSuCoRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/su-co');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/su-co');
  return new Repo();
}

// ─── ThongBao ─────────────────────────────────────────────────
export async function getThongBaoRepo() {
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/thong-bao');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/thong-bao');
  return new Repo();
}
